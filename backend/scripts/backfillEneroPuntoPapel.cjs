// Backfill retroactivo (una sola vez, manual): genera Entidad + Asiento
// automático para los 320 documentos de enero 2026 de Punto Papel Express
// que ya existen pero nunca pasaron por el endpoint transaccional de
// ingreso (fueron cargados antes de que ese endpoint existiera).
// Reutiliza exactamente las mismas reglas que /api/ingreso-documentos
// (services/generarAsiento.js) para que backfill y flujo en vivo nunca
// diverjan. Puramente aditivo: crea entidades y asientos nuevos, solo
// escribe documento.asientoId en los documentos existentes — no borra ni
// sobreescribe nada de lo que ya está.
//
// Uso: node backend/scripts/backfillEneroPuntoPapel.cjs [--dry-run]
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();
const { lineasParaDocumento, crearAsiento } = require('../services/generarAsiento');

const EMPRESA_ID = 'bb148b69-a167-4983-8a07-6b839638ed36';
// Las compras no tienen una cuenta de gasto asignada por RUT en el
// servidor (ese mapeo — rutCuentas — solo vive en localStorage del
// navegador de quien centralizó antes). Todas caen aquí; se reclasifican
// después editando la línea en Asientos Contables (RUT y documento se
// mantienen, solo cambia la cuenta de gasto/activo).
const CODIGO_CUENTA_POR_CLASIFICAR = '5-03-004-0001';

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const documentos = await prisma.documentoTributario.findMany({
    where: { empresaId: EMPRESA_ID, asientoId: null },
    orderBy: [{ fechaEmision: 'asc' }, { folio: 'asc' }],
  });
  console.log(`Documentos sin asiento: ${documentos.length}${DRY_RUN ? ' (DRY RUN — no se escribe nada)' : ''}`);

  const cuentaPorClasificar = await prisma.cuenta.findFirst({
    where: { codigo: CODIGO_CUENTA_POR_CLASIFICAR, empresaId: EMPRESA_ID },
  });
  if (!cuentaPorClasificar) {
    console.error(`No se encontró la cuenta ${CODIGO_CUENTA_POR_CLASIFICAR} para esta empresa — abortando.`);
    process.exit(1);
  }

  let exitosos = 0;
  let fallidos = 0;
  let entidadesCreadas = 0;
  const errores = [];

  for (const doc of documentos) {
    try {
      if (DRY_RUN) {
        const entidadExistente = await prisma.entidad.findFirst({ where: { rut: doc.rutReceptor, empresaId: EMPRESA_ID } });
        console.log(`[dry-run] ${doc.tipo} N°${doc.folio} (${doc.tipoTransaccion}) — ${doc.razonSocialReceptor} — total ${doc.montoTotal} — entidad ${entidadExistente ? 'existente' : 'NUEVA'}`);
        exitosos++;
        continue;
      }

      await prisma.$transaction(async (tx) => {
        let entidad = await tx.entidad.findFirst({ where: { rut: doc.rutReceptor, empresaId: EMPRESA_ID } });
        if (!entidad) {
          entidad = await tx.entidad.create({
            data: {
              id: crypto.randomUUID(),
              rut: doc.rutReceptor,
              razonSocial: doc.razonSocialReceptor,
              giro: doc.giroReceptor || null,
              direccion: doc.direccionReceptor || null,
              comuna: doc.comunaReceptor || null,
              tipo: doc.tipoTransaccion === 'compra' ? 'proveedor' : 'cliente',
              empresaId: EMPRESA_ID,
            },
          });
          entidadesCreadas++;
        }

        const detalles = await lineasParaDocumento(tx, EMPRESA_ID, {
          tipo: doc.tipo,
          tipoTransaccion: doc.tipoTransaccion,
          neto: doc.montoNeto,
          exento: doc.montoExento,
          iva: doc.iva,
          total: doc.montoTotal,
          cuentaGastoId: doc.tipoTransaccion === 'compra' ? cuentaPorClasificar.id : undefined,
          entidad,
          documentoId: doc.id,
        });

        const asiento = await crearAsiento(tx, {
          empresaId: EMPRESA_ID,
          fecha: doc.fechaEmision,
          glosa: `${doc.tipo} N° ${doc.folio} — ${entidad.razonSocial} (backfill enero 2026)`,
          tipo: doc.tipoTransaccion,
          detalles,
        });

        await tx.documentoTributario.update({ where: { id: doc.id }, data: { asientoId: asiento.id } });
      }, { timeout: 15000 });

      exitosos++;
    } catch (err) {
      fallidos++;
      errores.push(`${doc.tipo} N°${doc.folio} (${doc.id}): ${err.message}`);
    }
  }

  console.log(`\nExitosos: ${exitosos} | Fallidos: ${fallidos} | Entidades nuevas: ${entidadesCreadas}`);
  if (errores.length > 0) {
    console.log('\nErrores:');
    errores.forEach(e => console.log(' -', e));
  }
  await prisma.$disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });

// Uso:
//   node backend/scripts/anular-documentos-de-asientos-anulados.js            (simulacion, no escribe)
//   node backend/scripts/anular-documentos-de-asientos-anulados.js --aplicar  (escribe)
//
// Desde ahora, anular un comprobante anula tambien el documento (factura) o la
// boleta de honorarios que lo origino (routes/asientos.js). Este script pone al
// dia los que se anularon ANTES de ese cambio: busca documentos y honorarios
// que siguen vigentes aunque su asiento ya esta anulado y los marca anulados.
// Es idempotente: si no hay nada pendiente, no hace nada. Cubre todas las empresas.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const APLICAR = process.argv.includes('--aplicar');

async function main() {
    const anulados = await prisma.asientoContable.findMany({ where: { estado: 'anulado' }, select: { id: true, numero: true, empresaId: true } });
    const ids = anulados.map(a => a.id);
    const numeroDe = (asientoId) => anulados.find(a => a.id === asientoId)?.numero;

    const docs = await prisma.documentoTributario.findMany({
        where: { asientoId: { in: ids }, estado: { not: 'anulado' } },
        select: { id: true, tipo: true, folio: true, razonSocialReceptor: true, asientoId: true },
    });
    const hons = await prisma.honorario.findMany({
        where: { asientoId: { in: ids }, estado: { not: 'anulado' } },
        select: { id: true, folio: true, nombre: true, asientoId: true },
    });

    console.log(`Asientos anulados en el sistema: ${anulados.length}`);
    for (const d of docs) console.log(` - documento ${d.tipo} N° ${d.folio} (${d.razonSocialReceptor}) -> comprobante #${numeroDe(d.asientoId)} anulado`);
    for (const h of hons) console.log(` - honorario N° ${h.folio ?? 's/n'} (${h.nombre}) -> comprobante #${numeroDe(h.asientoId)} anulado`);
    if (docs.length + hons.length === 0) { console.log('\nNada que corregir.'); return; }

    if (!APLICAR) { console.log('\nSIMULACION: no se escribio nada. Repite con --aplicar.'); return; }

    await prisma.$transaction(async (tx) => {
        await tx.documentoTributario.updateMany({ where: { id: { in: docs.map(d => d.id) } }, data: { estado: 'anulado' } });
        await tx.honorario.updateMany({ where: { id: { in: hons.map(h => h.id) } }, data: { estado: 'anulado' } });
    });
    console.log(`\nOK: ${docs.length} documento(s) y ${hons.length} honorario(s) marcados como anulados.`);
}

main()
    .catch((err) => { console.error('ERROR:', err.message); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());

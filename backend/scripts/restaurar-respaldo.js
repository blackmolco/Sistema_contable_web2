// Uso:
//   node scripts/restaurar-respaldo.js <archivo.json>                 (simulacion: solo verifica y cuenta)
//   node scripts/restaurar-respaldo.js <archivo.json> --ejecutar      (restaura de verdad)
//
// Reconstruye UNA empresa desde un respaldo (routes/respaldo.js o
// scripts/respaldo-completo.js). Pensado para PROBAR restauraciones en una
// base de desarrollo o para recuperar una empresa borrada. Reglas de
// seguridad:
//   - Sin --ejecutar no escribe nada.
//   - Verifica el checksum antes de tocar la base.
//   - Se niega si la empresa ya tiene datos en la base destino (no
//     sobrescribe nunca; para reemplazar hay que borrarla a proposito antes).
//   - Todo ocurre en una sola transaccion: o se restaura completo o nada.
//   - Al terminar, vuelve a exportar la empresa y compara los conteos.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const { PrismaClient, Prisma } = require('@prisma/client');
const { verificarRespaldo, revivirFilas, exportarEmpresa, ORDEN } = require('../services/respaldo');

const prisma = new PrismaClient();
const minuscula = (m) => m.charAt(0).toLowerCase() + m.slice(1);

async function main() {
    const archivo = process.argv[2];
    const EJECUTAR = process.argv.includes('--ejecutar');
    if (!archivo) { console.error('Uso: node scripts/restaurar-respaldo.js <archivo.json> [--ejecutar]'); process.exitCode = 1; return; }

    const respaldo = JSON.parse(fs.readFileSync(archivo, 'utf8'));
    const v = verificarRespaldo(respaldo);
    if (!v.ok) { console.error('RESPALDO INVALIDO:\n - ' + v.errores.join('\n - ')); process.exitCode = 1; return; }

    const { empresa, conteos } = respaldo;
    console.log(`Respaldo de ${empresa.razonSocial} (${empresa.rut}) generado ${respaldo.generadoEn}`);
    console.log('Filas por tabla:', Object.entries(conteos).filter(([, n]) => n > 0).map(([t, n]) => `${t}=${n}`).join(', '));
    const host = (process.env.DATABASE_URL || '').replace(/^.*@/, '').replace(/\/.*$/, '');
    console.log(`Base destino: ${host}`);

    const existente = await prisma.empresa.findFirst({ where: { OR: [{ id: empresa.id }, { rut: empresa.rut }] } });
    if (existente) {
        const previos = await exportarEmpresa(prisma, existente.id);
        const total = Object.entries(previos.conteos).filter(([t]) => t !== 'Empresa').reduce((s, [, n]) => s + n, 0);
        if (total > 0) { console.error(`ABORTADO: la empresa ya existe en la base destino con ${total} registros. No se sobrescribe.`); process.exitCode = 1; return; }
        console.log('La empresa existe pero esta vacia: se completara.');
    }
    if (!EJECUTAR) { console.log('\nSIMULACION: todo en orden. Agrega --ejecutar para restaurar.'); return; }

    // Los usuarios no viajan en el respaldo: las referencias a usuarios que no existan aqui se anulan.
    const usuarios = new Set((await prisma.usuario.findMany({ select: { id: true } })).map(u => u.id));

    await prisma.$transaction(async (tx) => {
        for (const modelo of ORDEN) {
            if (modelo === 'Empresa' && existente) continue;
            const campos = Prisma.dmmf.datamodel.models.find(m => m.name === modelo).fields.map(f => f.name);
            const filas = revivirFilas(modelo, respaldo.tablas[modelo]).map(f => {
                const g = { ...f };
                if (campos.includes('usuarioId') && g.usuarioId && !usuarios.has(g.usuarioId)) g.usuarioId = null;
                return g;
            });
            if (filas.length) await tx[minuscula(modelo)].createMany({ data: filas });
        }
    }, { timeout: 120000, maxWait: 30000 });

    const despues = await exportarEmpresa(prisma, empresa.id);
    const distintos = ORDEN.filter(t => despues.conteos[t] !== conteos[t]);
    if (distintos.length) { console.error('VERIFICACION FALLIDA, conteos distintos en:', distintos.join(', ')); process.exitCode = 1; return; }
    console.log('\nRESTAURACION COMPLETA y verificada (los conteos coinciden con el respaldo).');
}

main().catch(e => { console.error('ERROR', e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());

// Uso: node scripts/respaldo-completo.js [carpeta] [--conservar 14]
//
// Guarda un respaldo JSON (con checksum) de CADA empresa activa en la carpeta
// indicada (por defecto backend/backups/completo), en una subcarpeta con la
// fecha, y verifica cada archivo al escribirlo. Conserva solo las N
// subcarpetas mas recientes (por defecto 14). Pensado para correrlo a diario
// desde un equipo propio (por ejemplo con el Programador de tareas de
// Windows) y asi tener una copia FUERA del proveedor de base de datos.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { exportarEmpresa, verificarRespaldo } = require('../services/respaldo');

const prisma = new PrismaClient();

async function main() {
    const args = process.argv.slice(2);
    const iConservar = args.indexOf('--conservar');
    const conservar = iConservar >= 0 ? parseInt(args[iConservar + 1], 10) : 14;
    const posicional = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--conservar');
    const carpeta = path.resolve(posicional || path.join(__dirname, '..', 'backups', 'completo'));
    const dia = new Date().toISOString().slice(0, 10);
    const destino = path.join(carpeta, dia);
    fs.mkdirSync(destino, { recursive: true });

    const empresas = await prisma.empresa.findMany({ where: { activo: true }, select: { id: true, rut: true, razonSocial: true } });
    let fallos = 0;
    for (const e of empresas) {
        const respaldo = await exportarEmpresa(prisma, e.id);
        const archivo = path.join(destino, `respaldo_${e.rut.replace(/[^0-9kK]/g, '')}.json`);
        fs.writeFileSync(archivo, JSON.stringify(respaldo));
        const v = verificarRespaldo(JSON.parse(fs.readFileSync(archivo, 'utf8')));
        const filas = Object.values(respaldo.conteos).reduce((s, n) => s + n, 0);
        console.log(`${v.ok ? 'OK ' : 'ERR'} ${e.razonSocial} - ${filas} filas - ${(fs.statSync(archivo).size / 1024).toFixed(0)} KB`);
        if (!v.ok) { fallos++; console.error('   ' + v.errores.join('; ')); }
    }

    const carpetas = fs.readdirSync(carpeta, { withFileTypes: true })
        .filter(d => d.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d.name)).map(d => d.name).sort();
    for (const vieja of carpetas.slice(0, Math.max(0, carpetas.length - conservar))) fs.rmSync(path.join(carpeta, vieja), { recursive: true });
    console.log(`\nRespaldos en ${destino}. Se conservan las ultimas ${conservar} carpetas.`);
    if (fallos) process.exitCode = 1;
}

main().catch(e => { console.error('ERROR', e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());

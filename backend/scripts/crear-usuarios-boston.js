// Uso:
//   node backend/scripts/crear-usuarios-boston.js            (simulacion, no escribe)
//   node backend/scripts/crear-usuarios-boston.js --aplicar  (crea los usuarios)
//
// Crea los 3 usuarios pedidos para Inversiones Boston Autoparts (RUT
// 78378856-K), cada uno atado SOLO a esa empresa (no ven Punto Papel Express
// ni Etérea). Si un email ya existe, NO se pisa su rol/clave — solo se
// ajusta accesoRemuneraciones si quedo distinto de lo pedido aqui.
//
// Nota de roles (no hay rol "Solo lectura" en el sistema hoy):
//   - "Administrador" (Sonia, Juan) -> rol 'supervisor': administra TODO
//     dentro de Boston (usuarios, cuentas, remuneraciones, cierre de mes).
//     OJO: el rol 'admin' del sistema es GLOBAL (ve todas las empresas), por
//     eso NO se usa aqui aunque el cliente diga "Administrador".
//   - "Contador" (Maria), sin acceso a remuneraciones -> rol 'contador' +
//     accesoRemuneraciones=false: NO puede entrar al modulo Remuneraciones
//     (ni por menu ni por URL directa; el backend rechaza con 403).
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const APLICAR = process.argv.includes('--aplicar');
const RUT_BOSTON = '78378856-K';

const USUARIOS = [
    { nombre: 'Sonia Jara', email: 'sjara@repuestosboston.cl', rol: 'supervisor', accesoRemuneraciones: true },
    { nombre: 'Juan Sepúlveda', email: 'contabilidad@repuestosboston.cl', rol: 'supervisor', accesoRemuneraciones: true },
    { nombre: 'Maria Palomino', email: 'finanzas@repuestosboston.cl', rol: 'contador', accesoRemuneraciones: false },
];

function claveAleatoria() {
    return crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, 'x') + '7Q';
}

async function main() {
    const empresa = await prisma.empresa.findFirst({ where: { rut: { in: [RUT_BOSTON, RUT_BOSTON.replace(/\./g, '')] } } });
    if (!empresa) throw new Error(`No se encontro una empresa con RUT ${RUT_BOSTON}.`);
    console.log(`Empresa: ${empresa.razonSocial} (${empresa.id})`);

    const existentes = await prisma.usuario.findMany({ where: { email: { in: USUARIOS.map(u => u.email) } } });
    const porEmail = new Map(existentes.map(u => [u.email, u]));

    const aCrear = [];
    const aAjustar = [];
    for (const u of USUARIOS) {
        const ya = porEmail.get(u.email);
        if (ya) {
            if (ya.empresaId !== empresa.id) {
                console.log(`- ${u.email} ya existe pero en OTRA empresa (${ya.empresaId}) -> se omite, revisar a mano.`);
            } else if (ya.accesoRemuneraciones !== u.accesoRemuneraciones) {
                console.log(`- ${u.email} ya existe (rol ${ya.rol}) -> se ajusta accesoRemuneraciones a ${u.accesoRemuneraciones}.`);
                aAjustar.push(u);
            } else {
                console.log(`- ${u.email} ya existe y esta correcto -> se omite.`);
            }
            continue;
        }
        console.log(`- se creara ${u.nombre} <${u.email}> rol=${u.rol} accesoRemuneraciones=${u.accesoRemuneraciones}`);
        aCrear.push(u);
    }
    if (aCrear.length === 0 && aAjustar.length === 0) { console.log('\nNada que hacer.'); return; }
    if (!APLICAR) { console.log('\nSIMULACION: no se escribio nada. Repite con --aplicar.'); return; }

    const claves = [];
    await prisma.$transaction(async (tx) => {
        for (const u of aCrear) {
            const clave = claveAleatoria();
            await tx.usuario.create({ data: {
                email: u.email, nombre: u.nombre, rut: '00.000.000-0', rol: u.rol, accesoRemuneraciones: u.accesoRemuneraciones,
                passwordHash: await bcrypt.hash(clave, 12), activo: true, empresaId: empresa.id,
            } });
            claves.push({ ...u, clave });
        }
        for (const u of aAjustar) {
            await tx.usuario.update({ where: { email: u.email }, data: { accesoRemuneraciones: u.accesoRemuneraciones } });
        }
    });

    if (claves.length) {
        console.log('\nOK: usuarios creados. Anota las claves ahora: no se vuelven a mostrar (se pueden cambiar despues desde Gestión de Usuarios).\n');
        for (const u of claves) console.log(`  ${u.nombre.padEnd(20)} ${u.email.padEnd(32)} clave: ${u.clave}`);
        console.log('\nEl RUT quedo en 00.000.000-0 (no se pidio); se puede editar despues en Gestión de Usuarios.');
    }
    if (aAjustar.length) console.log(`\nOK: ${aAjustar.length} usuario(s) existentes ajustados.`);
}

main()
    .catch((err) => { console.error('ERROR:', err.message); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());

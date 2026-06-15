// backend/prisma/ensure-admin.js
// Garantiza que existan los usuarios base en la base de datos.
// Es idempotente (upsert por email): seguro de correr en cada deploy. A
// diferencia de seed.js, NO crea empresas ni trabajadores demo — solo usuarios,
// para que el login siempre funcione aunque la base se haya reseteado.
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Usuarios garantizados. El passwordHash se actualiza siempre para garantizar
// que las credenciales definidas aquí sean siempre válidas.
const USUARIOS = [
    { email: 'admin@contable.cl',          nombre: 'Administrador',      rut: '76.192.600-5', rol: 'administrador', password: 'admin123' },
    { email: 'carlos@gmail.com',           nombre: 'Carlos',             rut: '16.121.114-1', rol: 'administrador', password: 'carlos123' },
    { email: 'robvalenzuela@gmail.com',    nombre: 'Roberto Valenzuela', rut: '18.672.888-2', rol: 'administrador', password: 'molco123' },
];

async function main() {
    for (const u of USUARIOS) {
        try {
            const passwordHash = bcrypt.hashSync(u.password, 8);
            await prisma.usuario.upsert({
                where: { email: u.email },
                update: { activo: true, passwordHash, nombre: u.nombre, rut: u.rut, rol: u.rol },
                create: {
                    email: u.email,
                    nombre: u.nombre,
                    rut: u.rut,
                    rol: u.rol,
                    passwordHash,
                    activo: true,
                },
            });
            console.log(`✓ Usuario asegurado: ${u.email}`);
        } catch (e) {
            console.error(`✗ Error en ${u.email}:`, e.message);
        }
    }
}

main()
    .catch((e) => {
        console.error('Error asegurando usuarios:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

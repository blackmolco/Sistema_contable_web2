// backend/prisma/ensure-admin.js
// Garantiza que existan los usuarios base en la base de datos.
// Es idempotente (upsert por email): seguro de correr en cada deploy. A
// diferencia de seed.js, NO crea empresas ni trabajadores demo — solo usuarios,
// para que el login siempre funcione aunque la base se haya reseteado.
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Usuarios garantizados. Si ya existen, NO se toca su passwordHash (respeta
// cambios de clave hechos desde la app).
const USUARIOS = [
    { email: 'admin@contable.cl',          nombre: 'Administrador',      rut: '76.192.600-5', rol: 'administrador', password: 'admin123' },
    { email: 'carlos@gmail.com',           nombre: 'Carlos',             rut: '16.121.114-1', rol: 'administrador', password: 'carlos123' },
    { email: 'robvalenzuela@gmail.com',    nombre: 'Roberto Valenzuela', rut: '18.672.888-2', rol: 'administrador', password: 'molco123' },
];

async function main() {
    for (const u of USUARIOS) {
        await prisma.usuario.upsert({
            where: { email: u.email },
            update: { activo: true },
            create: {
                email: u.email,
                nombre: u.nombre,
                rut: u.rut,
                rol: u.rol,
                passwordHash: bcrypt.hashSync(u.password, 10),
                activo: true,
            },
        });
        console.log(`✓ Usuario asegurado: ${u.email}`);
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

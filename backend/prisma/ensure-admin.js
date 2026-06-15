// backend/prisma/ensure-admin.js
// Garantiza que exista el usuario administrador en la base de datos.
// Es idempotente (upsert): seguro de correr en cada deploy. A diferencia de
// seed.js, NO crea empresas ni trabajadores demo — solo el usuario admin, para
// que el login siempre funcione aunque la base se haya reseteado.
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const email = process.env.ADMIN_EMAIL || 'admin@contable.cl';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    const passwordHash = bcrypt.hashSync(password, 10);

    await prisma.usuario.upsert({
        where: { email },
        // Si ya existe, NO tocamos su passwordHash (respeta cambios de clave).
        update: { activo: true },
        create: {
            email,
            nombre: 'Administrador',
            rut: '76.192.600-5',
            rol: 'administrador',
            passwordHash,
            activo: true,
        },
    });
    console.log(`✓ Usuario admin asegurado: ${email}`);
}

main()
    .catch((e) => {
        console.error('Error asegurando admin:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

// Crea o recupera UN administrador solamente cuando las variables BOOTSTRAP_*
// están configuradas. Nunca contiene contraseñas en el repositorio ni cambia
// la clave de usuarios existentes en cada despliegue.
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const email = String(process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
    const password = String(process.env.BOOTSTRAP_ADMIN_PASSWORD || '');

    if (!email && !password) {
        console.log('Bootstrap de administrador omitido: no hay variables BOOTSTRAP_ADMIN_* configuradas.');
        return;
    }
    if (!email || !password) {
        throw new Error('BOOTSTRAP_ADMIN_EMAIL y BOOTSTRAP_ADMIN_PASSWORD deben configurarse juntas');
    }
    if (password.length < 12) {
        throw new Error('BOOTSTRAP_ADMIN_PASSWORD debe tener al menos 12 caracteres');
    }

    const existente = await prisma.usuario.findUnique({ where: { email } });
    if (existente) {
        await prisma.usuario.update({ where: { email }, data: { activo: true, rol: 'administrador' } });
        console.log(`Usuario administrador existente verificado: ${email}`);
        return;
    }

    const nombre = String(process.env.BOOTSTRAP_ADMIN_NAME || 'Administrador').trim();
    const rut = String(process.env.BOOTSTRAP_ADMIN_RUT || '').trim();
    if (!rut) throw new Error('BOOTSTRAP_ADMIN_RUT es obligatorio para crear el administrador inicial');

    await prisma.usuario.create({
        data: { email, nombre, rut, rol: 'administrador', passwordHash: await bcrypt.hash(password, 12), activo: true },
    });
    console.log(`Usuario administrador inicial creado: ${email}`);
}

main()
    .catch((e) => { console.error('Error asegurando administrador:', e.message); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });

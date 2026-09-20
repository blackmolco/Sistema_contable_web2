// Uso: node scripts/dev.js <comando> [argumentos...]
//   node scripts/dev.js npx prisma migrate deploy
//   node scripts/dev.js node scripts/restaurar-respaldo.js archivo.json --ejecutar
//   node scripts/dev.js npx prisma studio
//
// Ejecuta un comando contra la base de DESARROLLO (backend/.env.desarrollo)
// y nunca contra produccion (backend/.env):
//   - Exige que exista .env.desarrollo con DATABASE_URL y DIRECT_URL.
//   - Se niega si apunta al mismo proyecto/base que produccion.
//   - Pasa esas variables al comando (tienen prioridad sobre .env).
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const dotenv = require('dotenv');

const raiz = path.join(__dirname, '..');
const archivoDev = path.join(raiz, '.env.desarrollo');
const archivoProd = path.join(raiz, '.env');

const salir = (msg) => { console.error(`\n[dev] ${msg}\n`); process.exit(1); };

if (process.argv.length < 3) salir('Falta el comando. Ejemplo: node scripts/dev.js npx prisma migrate deploy');
if (!fs.existsSync(archivoDev)) salir('No existe backend/.env.desarrollo. Copia .env.desarrollo.example con ese nombre y completa los datos de tu proyecto de desarrollo.');

const dev = dotenv.parse(fs.readFileSync(archivoDev));
const prod = fs.existsSync(archivoProd) ? dotenv.parse(fs.readFileSync(archivoProd)) : {};

for (const k of ['DATABASE_URL', 'DIRECT_URL']) {
    if (!dev[k]) salir(`Falta ${k} en .env.desarrollo.`);
    if (/REEMPLAZA/.test(dev[k])) salir(`${k} en .env.desarrollo todavia tiene el texto de ejemplo (REEMPLAZA...).`);
    if (!/^postgres(ql)?:\/\//.test(dev[k])) salir(`${k} en .env.desarrollo no es una conexion de Postgres.`);
}

// Identidad de una conexion: usuario (que en Supabase incluye el ref del proyecto) + host + base.
const identidad = (url) => {
    try { const u = new URL(url); return `${decodeURIComponent(u.username)}@${u.hostname}${u.pathname}`; } catch { return url; }
};
const proyecto = (url) => { try { return decodeURIComponent(new URL(url).username).split('.')[1] || ''; } catch { return ''; } };

for (const k of ['DATABASE_URL', 'DIRECT_URL']) {
    if (prod[k] && (identidad(dev[k]) === identidad(prod[k]) || (proyecto(dev[k]) && proyecto(dev[k]) === proyecto(prod[k])))) {
        salir(`${k} de .env.desarrollo apunta al MISMO proyecto que produccion (.env). Crea un proyecto de Supabase distinto para desarrollo.`);
    }
}

const host = new URL(dev.DATABASE_URL).hostname;
console.log(`[dev] Base DE DESARROLLO -> ${host} (proyecto ${proyecto(dev.DATABASE_URL) || '?'})`);

const [cmd, ...args] = process.argv.slice(2);
// shell:true (necesario para npx en Windows) une los argumentos con espacios: se citan los que los tengan.
const citar = (a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);
const r = spawnSync(cmd, args.map(citar), { cwd: raiz, stdio: 'inherit', shell: true, env: { ...process.env, ...dev } });
process.exit(r.status ?? 1);

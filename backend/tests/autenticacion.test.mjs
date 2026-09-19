// Bloqueo de cuenta por intentos fallidos y recuperacion de contrasena
// (routes/auth.js). Sin base de datos ni correo real: Prisma se reemplaza por
// un doble en memoria y el envio de correo se intercepta.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-para-autenticacion-1234567890';
process.env.ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN || 'test-admin-token';
process.env.CORS_ORIGINS = 'http://localhost:5173,https://contable.ejemplo.cl';

const bcrypt = require('bcryptjs');
const request = require('supertest');

// ---------- dobles ----------
let usuarios, restablecimientos, sesiones, correos;

const clon = (o) => (o ? { ...o } : null);
const prismaFalso = {
  usuario: {
    findUnique: async ({ where }) => clon(usuarios.find(u => (where.email ? u.email === where.email : u.id === where.id))),
    update: async ({ where, data }) => { const u = usuarios.find(x => x.id === where.id); Object.assign(u, data); return clon(u); },
  },
  restablecerClave: {
    create: async ({ data }) => { const r = { id: 'r' + (restablecimientos.length + 1), usadoEn: null, ...data }; restablecimientos.push(r); return r; },
    findUnique: async ({ where }) => clon(restablecimientos.find(r => r.tokenHash === where.tokenHash)),
    update: async ({ where, data }) => { const r = restablecimientos.find(x => x.id === where.id); Object.assign(r, data); return clon(r); },
    deleteMany: async ({ where }) => {
      const antes = restablecimientos.length;
      restablecimientos = restablecimientos.filter(r => !(r.usuarioId === where.usuarioId && r.usadoEn === where.usadoEn));
      return { count: antes - restablecimientos.length };
    },
  },
  sesion: {
    create: async ({ data }) => { sesiones.push(data); return data; },
    deleteMany: async ({ where }) => { sesiones = sesiones.filter(s => s.usuarioId !== where.usuarioId); return { count: 0 }; },
  },
  $transaction: async (ops) => Promise.all(ops),
  $queryRaw: async () => [],
};

let app;
beforeAll(() => {
  const compartido = require(path.join(dirname, '..', 'shared.js'));
  compartido.prisma = prismaFalso;
  compartido.auditLog = async () => {};
  require('../email').sendEmail = async (m) => { correos.push(m); return { sent: true }; };
  app = require('../app');
});

const EMAIL = 'ana@cliente.cl';
const CLAVE = 'ClaveSegura123';

beforeEach(async () => {
  usuarios = [{
    id: 'u1', email: EMAIL, nombre: 'Ana', rut: '1-9', rol: 'contador', empresaId: 'e1', activo: true,
    passwordHash: await bcrypt.hash(CLAVE, 4), intentosFallidos: 0, bloqueadoHasta: null,
  }];
  restablecimientos = []; sesiones = []; correos = [];
});

// Cada prueba usa su propia IP (trust proxy = 1) para no chocar con los
// limitadores de peticiones por IP, que aqui no son lo que se prueba.
let ip = 0;
beforeEach(() => { ip += 1; });
const post = (url, body) => request(app).post(url).set('X-Forwarded-For', `10.0.${Math.floor(ip / 250)}.${ip % 250}`).send(body);
const login = (password, email = EMAIL) => post('/api/auth/login', { email, password });
const tokenDelCorreo = () => /restablecer=([0-9a-f]+)/.exec(correos.at(-1).text)[1];

describe('Bloqueo por intentos fallidos', () => {
  it('el login correcto funciona y deja los contadores en cero', async () => {
    usuarios[0].intentosFallidos = 3;
    const res = await login(CLAVE);
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(usuarios[0].intentosFallidos).toBe(0);
  });

  it('cinco contrasenas incorrectas bloquean la cuenta, incluso con la contrasena correcta', async () => {
    for (let i = 0; i < 5; i++) expect((await login('incorrecta-' + i)).status).toBe(401);
    expect(usuarios[0].bloqueadoHasta).toBeInstanceOf(Date);
    expect(usuarios[0].bloqueadoHasta.getTime()).toBeGreaterThan(Date.now());
    const res = await login(CLAVE);
    expect(res.status).toBe(429);
    expect(res.body.token).toBeUndefined();
    expect(sesiones).toHaveLength(0);
  });

  it('cuatro fallos no bloquean; un acierto reinicia la cuenta', async () => {
    for (let i = 0; i < 4; i++) await login('clave-mala-' + i);
    expect(usuarios[0].intentosFallidos).toBe(4);
    expect(usuarios[0].bloqueadoHasta).toBeNull();
    expect((await login(CLAVE)).status).toBe(200);
    expect(usuarios[0].intentosFallidos).toBe(0);
  });

  it('pasado el tiempo de bloqueo se puede volver a entrar', async () => {
    usuarios[0].bloqueadoHasta = new Date(Date.now() - 1000);
    expect((await login(CLAVE)).status).toBe(200);
    expect(usuarios[0].bloqueadoHasta).toBeNull();
  });

  it('un correo inexistente responde igual que una contrasena mala (no revela cuentas)', async () => {
    const a = await login('x'.repeat(10), 'nadie@cliente.cl');
    const b = await login('x'.repeat(10));
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body).toEqual(b.body);
  });
});

describe('Olvide mi contrasena', () => {
  it('responde lo mismo exista o no el correo y solo envia correo si existe', async () => {
    const conocido = await post('/api/auth/olvide-clave', { email: EMAIL });
    const desconocido = await post('/api/auth/olvide-clave', { email: 'nadie@cliente.cl' });
    expect(conocido.status).toBe(200);
    expect(desconocido.status).toBe(200);
    expect(conocido.body).toEqual(desconocido.body);
    expect(correos).toHaveLength(1);
    expect(correos[0].to).toBe(EMAIL);
  });

  it('el enlace usa el dominio configurado (no localhost) y guarda solo el hash del token', async () => {
    await post('/api/auth/olvide-clave', { email: EMAIL });
    const token = tokenDelCorreo();
    expect(correos[0].text).toContain('https://contable.ejemplo.cl/?restablecer=' + token);
    expect(token).toHaveLength(64);
    expect(restablecimientos[0].tokenHash).not.toBe(token);
    expect(JSON.stringify(restablecimientos)).not.toContain(token);
    const minutos = (restablecimientos[0].expiraEn.getTime() - Date.now()) / 60000;
    expect(minutos).toBeGreaterThan(28);
    expect(minutos).toBeLessThanOrEqual(30);
  });

  it('un usuario desactivado no recibe correo', async () => {
    usuarios[0].activo = false;
    await post('/api/auth/olvide-clave', { email: EMAIL });
    expect(correos).toHaveLength(0);
  });

  it('un segundo pedido invalida el enlace anterior', async () => {
    await post('/api/auth/olvide-clave', { email: EMAIL });
    const primero = tokenDelCorreo();
    await post('/api/auth/olvide-clave', { email: EMAIL });
    const segundo = tokenDelCorreo();
    expect(segundo).not.toBe(primero);
    const viejo = await post('/api/auth/restablecer-clave', { token: primero, passwordNuevo: 'NuevaClave456' });
    expect(viejo.status).toBe(400);
    const nuevo = await post('/api/auth/restablecer-clave', { token: segundo, passwordNuevo: 'NuevaClave456' });
    expect(nuevo.status).toBe(200);
  });
});

describe('Restablecer contrasena', () => {
  const pedirEnlace = async () => { await post('/api/auth/olvide-clave', { email: EMAIL }); return tokenDelCorreo(); };

  it('con un enlace valido cambia la contrasena, cierra las sesiones y solo se usa una vez', async () => {
    const token = await pedirEnlace();
    sesiones.push({ usuarioId: 'u1', token: 't-viejo' });
    const res = await post('/api/auth/restablecer-clave', { token, passwordNuevo: 'NuevaClave456' });
    expect(res.status).toBe(200);
    expect(sesiones.filter(s => s.usuarioId === 'u1' && s.token === 't-viejo')).toHaveLength(0);
    expect((await login(CLAVE)).status).toBe(401);
    expect((await login('NuevaClave456')).status).toBe(200);
    const otraVez = await post('/api/auth/restablecer-clave', { token, passwordNuevo: 'OtraClave789' });
    expect(otraVez.status).toBe(400);
  });

  it('un enlace vencido se rechaza', async () => {
    const token = await pedirEnlace();
    restablecimientos[0].expiraEn = new Date(Date.now() - 1000);
    const res = await post('/api/auth/restablecer-clave', { token, passwordNuevo: 'NuevaClave456' });
    expect(res.status).toBe(400);
    expect((await login(CLAVE)).status).toBe(200);
  });

  it('un token inventado se rechaza', async () => {
    const res = await request(app).post('/api/auth/restablecer-clave').send({ token: 'a'.repeat(64), passwordNuevo: 'NuevaClave456' });
    expect(res.status).toBe(400);
  });

  it('una contrasena de menos de 8 caracteres se rechaza y el enlace sigue vigente', async () => {
    const token = await pedirEnlace();
    const corta = await post('/api/auth/restablecer-clave', { token, passwordNuevo: 'corta' });
    expect(corta.status).toBe(400);
    const bien = await post('/api/auth/restablecer-clave', { token, passwordNuevo: 'NuevaClave456' });
    expect(bien.status).toBe(200);
  });

  it('restablecer la contrasena desbloquea una cuenta bloqueada', async () => {
    for (let i = 0; i < 5; i++) await login('clave-mala-' + i);
    expect((await login(CLAVE)).status).toBe(429);
    const token = await pedirEnlace();
    await post('/api/auth/restablecer-clave', { token, passwordNuevo: 'NuevaClave456' });
    expect((await login('NuevaClave456')).status).toBe(200);
  });
});

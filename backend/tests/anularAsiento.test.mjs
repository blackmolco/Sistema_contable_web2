// PUT /api/asientos/:id con estado 'anulado' (routes/asientos.js): anular un
// comprobante tambien anula el documento o la boleta de honorarios que lo
// origino, en la misma transaccion, y solo de la misma empresa. Sin base de datos.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-para-anular-asiento-1234567890';
process.env.ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN || 'test-admin-token';

const jwt = require('jsonwebtoken');
const request = require('supertest');

let asientos;
let documentos;
let honorarios;

const aplicaFiltro = (fila, where) =>
  Object.entries(where).every(([k, v]) => (v && typeof v === 'object' && 'not' in v ? fila[k] !== v.not : fila[k] === v));

const actualizarMuchos = (tabla) => async ({ where, data }) => {
  const afectadas = tabla.filter(f => aplicaFiltro(f, where));
  afectadas.forEach(f => Object.assign(f, data));
  return { count: afectadas.length };
};

const prismaFalso = {
  asientoContable: {
    findUnique: async ({ where: { id } }) => asientos.find(a => a.id === id) ?? null,
    update: async ({ where: { id }, data }) => {
      const a = asientos.find(x => x.id === id);
      Object.assign(a, data);
      return { ...a, detalles: [] };
    },
  },
  documentoTributario: { updateMany: async (args) => actualizarMuchos(documentos)(args) },
  honorario: { updateMany: async (args) => actualizarMuchos(honorarios)(args) },
  $transaction: async (fn) => fn(prismaFalso),
};

const compartido = require(path.join(dirname, '..', 'shared.js'));
let app;

beforeAll(() => {
  compartido.prisma = prismaFalso;
  Object.defineProperty(compartido, 'prisma', { value: prismaFalso, writable: true });
  compartido.auditLog = async () => {};
  app = require('../app');
});

beforeEach(() => {
  asientos = [
    { id: 'as-10', numero: 10, estado: 'contabilizado', empresaId: 'boston' },
    { id: 'as-11', numero: 11, estado: 'contabilizado', empresaId: 'boston' },
  ];
  documentos = [
    { id: 'doc-1', asientoId: 'as-10', empresaId: 'boston', estado: 'emitido' },
    { id: 'doc-2', asientoId: 'as-11', empresaId: 'boston', estado: 'emitido' },
    // Mismo asientoId pero de OTRA empresa: nunca debe tocarse.
    { id: 'doc-ajeno', asientoId: 'as-10', empresaId: 'otra', estado: 'emitido' },
  ];
  honorarios = [{ id: 'hon-1', asientoId: 'as-10', empresaId: 'boston', estado: 'pendiente' }];
});

const tokenAdmin = jwt.sign({ id: 'admin-1', email: 'a@t.cl', rol: 'administrador', empresaId: null }, process.env.JWT_SECRET, { expiresIn: '1h' });
const anular = (id) => request(app).put(`/api/asientos/${id}`).set('Authorization', `Bearer ${tokenAdmin}`).send({ estado: 'anulado' });

describe('Anular un comprobante anula lo que lo origino', () => {
  it('anula el asiento, su documento y su honorario; deja intacto lo demas', async () => {
    const res = await anular('as-10');
    expect(res.status).toBe(200);
    expect(asientos.find(a => a.id === 'as-10').estado).toBe('anulado');
    expect(documentos.find(d => d.id === 'doc-1').estado).toBe('anulado');
    expect(honorarios[0].estado).toBe('anulado');
    expect(res.body.documentosAnulados).toBe(1);
    expect(res.body.honorariosAnulados).toBe(1);

    expect(documentos.find(d => d.id === 'doc-2').estado).toBe('emitido');
    expect(asientos.find(a => a.id === 'as-11').estado).toBe('contabilizado');
  });

  it('no toca documentos de otra empresa aunque compartan el asientoId', async () => {
    await anular('as-10');
    expect(documentos.find(d => d.id === 'doc-ajeno').estado).toBe('emitido');
  });

  it('contabilizar un asiento (no anular) no cambia ningun documento', async () => {
    asientos[0].estado = 'pendiente';
    const res = await request(app).put('/api/asientos/as-10').set('Authorization', `Bearer ${tokenAdmin}`).send({ estado: 'contabilizado' });
    expect(res.status).toBe(200);
    expect(documentos.find(d => d.id === 'doc-1').estado).toBe('emitido');
  });

  it('un asiento ya anulado no se puede volver a modificar', async () => {
    asientos[0].estado = 'anulado';
    const res = await anular('as-10');
    expect(res.status).toBe(409);
  });
});

// Respaldo por empresa (services/respaldo.js): exporta, verifica y revive
// datos. Sin base de datos: Prisma se reemplaza por un doble en memoria.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { exportarEmpresa, verificarRespaldo, revivirFilas, ORDEN } = require('../services/respaldo');

const EMPRESA = 'e-1';
const filas = {
  empresa: [{ id: EMPRESA, rut: '78378856-K', razonSocial: 'Boston', ultimoNumeroAsiento: 3, fechaCreacion: new Date('2026-01-05T10:00:00Z') }],
  cuenta: [{ id: 'c1', empresaId: EMPRESA, codigo: '1-01', nombre: 'Caja', createdAt: new Date('2026-01-05T10:00:00Z') }],
  asientoContable: [{ id: 'a1', empresaId: EMPRESA, numero: 1, fecha: new Date('2026-05-10T00:00:00Z'), glosa: 'x' }],
  detalleAsiento: [{ id: 'd1', asientoId: 'a1', debe: 100, haber: 0 }, { id: 'd2', asientoId: 'a1', debe: 0, haber: 100 }],
  trabajador: [{ id: 't1', empresaId: EMPRESA, rut: '7.008.720-0', fechaIngreso: new Date('2026-05-04T00:00:00Z') }],
  liquidacionSueldo: [{ id: 'l1', trabajadorId: 't1', periodo: '2026-05', sueldoLiquido: 579155 }],
  configCentralizacionRemuneraciones: [{ empresaId: EMPRESA, cuentaRemuneracionesGastoId: 'c1', actualizadoEn: new Date('2026-06-01T00:00:00Z') }],
};

function prismaFalso() {
  const solicitudes = [];
  const delegado = (nombre) => ({
    findUnique: async ({ where }) => (nombre === 'empresa' && where.id === EMPRESA ? filas.empresa[0] : null),
    findMany: async (args) => { solicitudes.push({ nombre, args }); return filas[nombre] ?? []; },
  });
  return { solicitudes, ...Object.fromEntries(['empresa', ...ORDEN.map(m => m.charAt(0).toLowerCase() + m.slice(1))].map(n => [n, delegado(n)])) };
}

describe('exportarEmpresa', () => {
  it('incluye todas las tablas en orden de restauracion, con conteos y checksum', async () => {
    const r = await exportarEmpresa(prismaFalso(), EMPRESA);
    expect(Object.keys(r.tablas)).toEqual(ORDEN);
    expect(r.conteos.Cuenta).toBe(1);
    expect(r.conteos.DetalleAsiento).toBe(2);
    expect(r.conteos.LiquidacionSueldo).toBe(1);
    expect(r.empresa).toMatchObject({ id: EMPRESA, rut: '78378856-K' });
    expect(r.checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it('filtra por la empresa pedida y los hijos por sus padres (nunca trae filas de otra empresa)', async () => {
    const p = prismaFalso();
    await exportarEmpresa(p, EMPRESA);
    const conEmpresa = p.solicitudes.filter(s => ['cuenta', 'asientoContable', 'trabajador', 'entidad', 'documentoTributario'].includes(s.nombre));
    for (const s of conEmpresa) expect(s.args.where).toEqual({ empresaId: EMPRESA });
    const detalles = p.solicitudes.find(s => s.nombre === 'detalleAsiento');
    expect(detalles.args.where).toEqual({ asientoId: { in: ['a1'] } });
    const liquidaciones = p.solicitudes.find(s => s.nombre === 'liquidacionSueldo');
    expect(liquidaciones.args.where).toEqual({ trabajadorId: { in: ['t1'] } });
  });

  it('empresa inexistente responde 404', async () => {
    await expect(exportarEmpresa(prismaFalso(), 'no-existe')).rejects.toMatchObject({ status: 404 });
  });
});

describe('verificarRespaldo', () => {
  const generar = async () => JSON.parse(JSON.stringify(await exportarEmpresa(prismaFalso(), EMPRESA))); // ida y vuelta por archivo

  it('un respaldo recien generado (y leido de un archivo) es valido', async () => {
    expect(verificarRespaldo(await generar())).toEqual({ ok: true, errores: [] });
  });

  it('detecta un dato alterado', async () => {
    const r = await generar();
    r.tablas.AsientoContable[0].glosa = 'manipulado';
    const v = verificarRespaldo(r);
    expect(v.ok).toBe(false);
    expect(v.errores.join()).toMatch(/checksum/i);
  });

  it('detecta filas borradas aunque se recalcule el checksum', async () => {
    const r = await generar();
    r.tablas.DetalleAsiento.pop();
    const v = verificarRespaldo(r);
    expect(v.ok).toBe(false);
  });

  it('rechaza archivos que no son un respaldo', () => {
    expect(verificarRespaldo({}).ok).toBe(false);
    expect(verificarRespaldo(null).ok).toBe(false);
    expect(verificarRespaldo({ formato: 'otra-cosa' }).ok).toBe(false);
  });

  it('rechaza una version futura', async () => {
    const r = await generar();
    r.version = 99;
    expect(verificarRespaldo(r).ok).toBe(false);
  });
});

describe('revivirFilas', () => {
  it('convierte los campos DateTime de texto a Date y deja el resto igual', () => {
    const [f] = revivirFilas('AsientoContable', [{ id: 'a1', numero: 1, fecha: '2026-05-10T00:00:00.000Z', glosa: 'x', createdAt: '2026-05-10T12:00:00.000Z' }]);
    expect(f.fecha).toBeInstanceOf(Date);
    expect(f.createdAt).toBeInstanceOf(Date);
    expect(f.fecha.toISOString()).toBe('2026-05-10T00:00:00.000Z');
    expect(f.numero).toBe(1);
    expect(f.glosa).toBe('x');
  });

  it('respeta los nulos', () => {
    const [f] = revivirFilas('Trabajador', [{ id: 't1', fechaIngreso: '2026-05-04T00:00:00.000Z', fechaTermino: null, fechaNacimiento: null }]);
    expect(f.fechaTermino).toBeNull();
    expect(f.fechaNacimiento).toBeNull();
    expect(f.fechaIngreso).toBeInstanceOf(Date);
  });
});

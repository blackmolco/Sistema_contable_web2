// Aislamiento multiempresa: un usuario de la empresa A NUNCA debe poder leer,
// modificar ni borrar datos de la empresa B, por ninguna ruta.
//
// Corre SIN base de datos: se reemplaza `shared.prisma` por un doble que
// registra cada llamada y devuelve siempre filas que pertenecen a la
// empresa "duenia" indicada. Asi se comprueba solo la logica de acceso de
// las rutas (que cada una valide la empresa antes de leer/escribir).
//
// Al agregar una ruta nueva que reciba un id o un empresaId, agregar su caso
// a las tablas de abajo.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-para-aislamiento-1234567890';
process.env.ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN || 'test-admin-token';

const EMPRESA_A = '11111111-1111-4111-8111-111111111111';
const EMPRESA_B = '22222222-2222-4222-8222-222222222222';
const UUID = '33333333-3333-4333-8333-333333333333';

const ESCRITURA = new Set(['create', 'update', 'upsert', 'delete', 'createMany', 'updateMany', 'deleteMany']);

// ---------- doble de Prisma ----------
let duenio = EMPRESA_B;
let llamadas = [];

function fila() {
  return {
    id: UUID, empresaId: duenio, trabajador: { empresaId: duenio }, trabajadorId: UUID,
    detalles: [], estado: 'pendiente', tipo: 'factura', tipoTransaccion: 'venta',
    rut: '11.111.111-1', rutNormalizado: '111111111', razonSocial: 'X', nombre: 'X', codigo: '1-01', naturaleza: 'deudora',
    fecha: new Date('2026-05-10'), fechaEmision: new Date('2026-05-10'), numero: 1, glosa: 'x', periodo: '2026-05',
    asientoId: null, mes: 5, anio: 2026, activo: true, folio: 1, montoTotal: 100, total: 100,
  };
}

function delegado(modelo) {
  return new Proxy({}, {
    get(_, metodo) {
      return async (args) => {
        llamadas.push({ modelo, metodo, args });
        if (metodo === 'count') return 1;
        if (metodo === 'findMany' || metodo === 'groupBy') return [fila()];
        if (metodo === 'aggregate') return {};
        if (metodo.endsWith('Many')) return { count: 1 };
        return fila();
      };
    },
  });
}

const modelos = {};
const prismaFalso = new Proxy({}, {
  get(_, prop) {
    if (prop === '$transaction') {
      return async (arg) => (typeof arg === 'function' ? arg(prismaFalso) : Promise.all(arg));
    }
    if (typeof prop === 'symbol' || prop === 'then') return undefined;
    if (prop.startsWith('$')) return async () => [];
    return (modelos[prop] ??= delegado(prop));
  },
});

const compartido = require(path.join(dirname, '..', 'shared.js'));

// ---------- tokens ----------
const jwt = require('jsonwebtoken');
const token = (extra) => jwt.sign({ id: 'u-test', email: 't@t.cl', ...extra }, process.env.JWT_SECRET, { expiresIn: '1h' });
const tokenA = token({ rol: 'contador', empresaId: EMPRESA_A });
const tokenSupervisorA = token({ rol: 'supervisor', empresaId: EMPRESA_A });
const tokenSinEmpresa = token({ rol: 'contador', empresaId: null });
const tokenAdmin = token({ rol: 'admin', empresaId: null });

const request = require('supertest');
let app;

beforeAll(() => {
  // Se reemplaza en el mismo objeto que ya importan todas las rutas.
  compartido.prisma = prismaFalso;
  Object.defineProperty(compartido, 'prisma', { value: prismaFalso, writable: true });
  compartido.auditLog = async () => {};
  app = require('../app');
});

beforeEach(() => { llamadas = []; duenio = EMPRESA_B; });

const hayEscritura = () => llamadas.filter(c => ESCRITURA.has(c.metodo));

async function llamar(metodo, url, body, tk = tokenA) {
  let r = request(app)[metodo](url).set('Authorization', `Bearer ${tk}`);
  if (body !== undefined) r = r.send(body);
  return r;
}

// ---------- casos: filas de la empresa B, usuario de la empresa A ----------
// [metodo, url, body]
const CASOS_POR_ID = [
  ['put', '/api/cuentas/' + UUID, { nombre: 'Hack' }],
  ['delete', '/api/cuentas/' + UUID],
  ['put', '/api/entidades/' + UUID, { razonSocial: 'Hack' }],
  ['delete', '/api/entidades/' + UUID],
  ['put', '/api/honorarios/' + UUID, { nombre: 'Hack' }],
  ['delete', '/api/honorarios/' + UUID],
  ['put', '/api/trabajadores/' + UUID, { nombres: 'Hack' }],
  ['delete', '/api/trabajadores/' + UUID],
  ['delete', '/api/trabajadores/liquidaciones/' + UUID],
  ['put', '/api/documentos-tributarios/' + UUID, { estado: 'anulado' }],
  ['delete', '/api/documentos-tributarios/' + UUID],
  ['delete', '/api/asientos/' + UUID],
];

const CASOS_LISTA_OTRA_EMPRESA = [
  '/api/cuentas', '/api/asientos', '/api/entidades', '/api/trabajadores', '/api/trabajadores/liquidaciones',
  '/api/honorarios', '/api/documentos-tributarios', '/api/libro-ventas', '/api/libro-compras', '/api/tesoreria',
  '/api/activos-fijos', '/api/periodos', '/api/importaciones-sii', '/api/documentos', '/api/busqueda?q=ab',
  '/api/periodos/checklist?anio=2026&mes=5', '/api/respaldo/empresa',
].map(u => [u + (u.includes('?') ? '&' : '?') + 'empresaId=' + EMPRESA_B]);

const CASOS_ESCRITURA_OTRA_EMPRESA = [
  ['post', '/api/cuentas', { codigo: '9-99', nombre: 'Cuenta ajena', tipo: 'activo', naturaleza: 'deudora', empresaId: EMPRESA_B }],
  ['post', '/api/entidades', { rut: '11.111.111-1', razonSocial: 'Hack', empresaId: EMPRESA_B }],
  ['post', '/api/entidades/bulk', { empresaId: EMPRESA_B, filas: [{ rut: '11.111.111-1', razonSocial: 'Hack' }] }],
  ['post', '/api/honorarios', { rut: '11.111.111-1', nombre: 'Prestador ajeno', periodo: '2026-05', montoBruto: 100, retencion: 10, montoLiquido: 90, empresaId: EMPRESA_B }],
  ['post', '/api/tesoreria', { fecha: '2026-05-10', tipo: 'entrada', categoria: 'x', descripcion: 'x', monto: 10, origen: 'otro', empresaId: EMPRESA_B }],
  ['put', '/api/periodos', { empresaId: EMPRESA_B, anio: 2026, mes: 5, estado: 'revision' }],
  ['post', '/api/trabajadores/liquidaciones/centralizar', { empresaId: EMPRESA_B, periodo: '2026-05' }],
  ['post', '/api/trabajadores/liquidaciones/descentralizar', { empresaId: EMPRESA_B, periodo: '2026-05' }],
  ['post', '/api/ingreso-documentos', { tipoDocumento: 'factura', tipoTransaccion: 'venta', folio: 1, fecha: '2026-05-10', entidad: { rut: '11.111.111-1', razonSocial: 'Cliente ajeno' }, neto: 100, iva: 19, total: 119, empresaId: EMPRESA_B }],
  ['post', '/api/cuenta-corriente/aplicar', { empresaId: EMPRESA_B, fecha: '2026-05-10', cuentaMedioId: UUID, aplicaciones: [{ documentoId: UUID, rut: '1-9', nombre: 'X', cuentaControlId: UUID, monto: 10 }] }],
  ['patch', '/api/empresas/'+EMPRESA_B+'/cuentas-sistema', { clientes: UUID }],
  ['post', '/api/asientos', { fecha: '2026-05-10', glosa: 'hack', empresaId: EMPRESA_B, detalles: [{ debe: 10, haber: 0 }, { debe: 0, haber: 10 }] }],
];

describe('Aislamiento multiempresa (usuario de A contra datos de B)', () => {
  it.each(CASOS_POR_ID)('%s %s no toca filas de otra empresa', async (metodo, url, body) => {
    const res = await llamar(metodo, url, body);
    expect([403, 404]).toContain(res.status);
    expect(hayEscritura()).toEqual([]);
  });

  it.each(CASOS_LISTA_OTRA_EMPRESA)('GET %s con empresaId de otra empresa responde 403', async (url) => {
    const res = await llamar('get', url);
    expect(res.status).toBe(403);
    expect(llamadas.filter(c => c.modelo !== 'sesion')).toEqual([]);
  });

  it.each(CASOS_ESCRITURA_OTRA_EMPRESA)('%s %s con empresaId de otra empresa responde 403 y no escribe', async (metodo, url, body) => {
    const res = await llamar(metodo, url, body);
    expect(res.status, JSON.stringify(res.body)).toBe(403);
    expect(hayEscritura()).toEqual([]);
  });

  it('calcular liquidacion de un trabajador ajeno se rechaza aunque se declare la empresa propia', async () => {
    const res = await llamar('post', '/api/trabajadores/liquidaciones/calcular', { trabajadorId: UUID, periodo: '2026-05', empresaId: EMPRESA_A });
    expect(res.status).toBe(400);
    expect(hayEscritura()).toEqual([]);
  });

  it('calcular liquidacion de un trabajador ajeno sin declarar empresa responde 403', async () => {
    const res = await llamar('post', '/api/trabajadores/liquidaciones/calcular', { trabajadorId: UUID, periodo: '2026-05' });
    expect(res.status).toBe(403);
    expect(hayEscritura()).toEqual([]);
  });

  it('un PUT no puede dejar una fila propia sin empresa (empresaId: null)', async () => {
    duenio = EMPRESA_A;
    for (const url of ['/api/cuentas/', '/api/entidades/', '/api/honorarios/', '/api/trabajadores/']) {
      llamadas = [];
      await llamar('put', url + UUID, { empresaId: null });
      for (const c of hayEscritura()) {
        expect(c.args?.data?.empresaId).toBeUndefined();
      }
    }
  });

  it('un supervisor de A tampoco accede a B', async () => {
    const res = await llamar('get', '/api/asientos?empresaId=' + EMPRESA_B, undefined, tokenSupervisorA);
    expect(res.status).toBe(403);
  });
});

describe('Respaldo de empresa', () => {
  it('un usuario comun (contador) no puede descargar el respaldo ni de su propia empresa', async () => {
    duenio = EMPRESA_A;
    const res = await llamar('get', '/api/respaldo/empresa?empresaId=' + EMPRESA_A);
    expect(res.status).toBe(403);
  });

  it('el supervisor de A descarga el respaldo de A: JSON con checksum, y solo consulta filas de A', async () => {
    duenio = EMPRESA_A;
    const res = await llamar('get', '/api/respaldo/empresa?empresaId=' + EMPRESA_A, undefined, tokenSupervisorA);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="respaldo_.*\.json"/);
    const cuerpo = JSON.parse(res.text);
    expect(cuerpo.formato).toBe('sistema-contable-respaldo');
    expect(cuerpo.checksum).toMatch(/^[0-9a-f]{64}$/);
    for (const c of llamadas.filter(x => x.metodo === 'findMany' && x.args?.where?.empresaId !== undefined)) {
      expect(c.args.where.empresaId).toBe(EMPRESA_A);
    }
  });

  it('el supervisor de A no descarga el respaldo de B', async () => {
    const res = await llamar('get', '/api/respaldo/empresa?empresaId=' + EMPRESA_B, undefined, tokenSupervisorA);
    expect(res.status).toBe(403);
  });
});

describe('Cuentas del sistema por empresa', () => {
  beforeEach(() => { duenio = EMPRESA_A; llamadas = []; });

  it('el GET de otra empresa responde 403', async () => {
    const res = await llamar('get', '/api/empresas/' + EMPRESA_B + '/cuentas-sistema');
    expect(res.status).toBe(403);
  });

  it('un contador no puede cambiar las cuentas ni de su propia empresa', async () => {
    const res = await llamar('patch', '/api/empresas/' + EMPRESA_A + '/cuentas-sistema', { clientes: UUID });
    expect(res.status).toBe(403);
    expect(hayEscritura()).toEqual([]);
  });

  it('el supervisor de A configura las cuentas de A', async () => {
    const res = await llamar('patch', '/api/empresas/' + EMPRESA_A + '/cuentas-sistema', { clientes: UUID }, tokenSupervisorA);
    expect(res.status).toBe(200);
    const w = hayEscritura().find(l => l.modelo === 'configCuentasSistema');
    expect(w.args.where.empresaId).toBe(EMPRESA_A);
  });

  it('rechaza claves desconocidas', async () => {
    const res = await llamar('patch', '/api/empresas/' + EMPRESA_A + '/cuentas-sistema', { inventada: UUID }, tokenSupervisorA);
    expect(res.status).toBe(400);
  });
});

describe('Usuarios sin empresa', () => {
  it('un usuario no admin sin empresa no puede listar datos (nada de filas huerfanas)', async () => {
    for (const url of ['/api/cuentas', '/api/asientos', '/api/entidades', '/api/trabajadores', '/api/honorarios', '/api/busqueda?q=ab']) {
      const res = await llamar('get', url, undefined, tokenSinEmpresa);
      expect(res.status).toBe(400);
    }
    expect(llamadas).toEqual([]);
  });
});

describe('Controles: la prueba no es vacia', () => {
  it('el usuario de A SI puede leer datos de A', async () => {
    duenio = EMPRESA_A;
    for (const url of ['/api/cuentas', '/api/entidades', '/api/asientos', '/api/trabajadores']) {
      const res = await llamar('get', url + '?empresaId=' + EMPRESA_A);
      expect(res.status).toBe(200);
    }
  });

  it('un admin global SI puede leer datos de B', async () => {
    const res = await llamar('get', '/api/cuentas?empresaId=' + EMPRESA_B, undefined, tokenAdmin);
    expect(res.status).toBe(200);
  });

  it('el usuario de A SI puede borrar una fila de A (la regla no bloquea todo)', async () => {
    duenio = EMPRESA_A;
    const res = await llamar('delete', '/api/entidades/' + UUID);
    expect(res.status).toBe(200);
  });
});

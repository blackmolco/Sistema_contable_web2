// Checklist de cierre mensual (services/cierreMensual.js), sin base de datos.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { evaluarCierre } = require('../services/cierreMensual');

// Doble de Prisma con datos controlados para un mes.
function prismaCon({
  asientos = [], pendientes = 0, docsSinAsiento = 0, honSinAsiento = 0, liqSinCentralizar = 0,
  trabajadoresActivos = 0, liqCalculadas = 0, auxSinRut = 0, activos = 0, asientosDepreciacion = 0,
  periodoAnterior = { estado: 'cerrado' }, documentos = [],
} = {}) {
  return {
    asientoContable: {
      findMany: async () => asientos,
      count: async ({ where }) => (where.estado === 'pendiente' ? pendientes : asientosDepreciacion),
    },
    documentoTributario: {
      count: async () => docsSinAsiento,
      findMany: async () => documentos,
    },
    honorario: { count: async () => honSinAsiento },
    liquidacionSueldo: { count: async ({ where }) => (where.asientoId === null ? liqSinCentralizar : liqCalculadas) },
    trabajador: { count: async () => trabajadoresActivos },
    cuenta: { findMany: async () => [{ id: 'c-aux' }] },
    detalleAsiento: { count: async () => auxSinRut },
    activoFijo: { count: async () => activos },
    periodoContable: { findUnique: async () => periodoAnterior },
  };
}

const asiento = (numero, debe, haber) => ({ id: 'a' + numero, numero, detalles: [{ debe, haber: 0, cuentaCodigo: '1-01' }, { debe: 0, haber, cuentaCodigo: '4-01' }] });
const fallo = (r, id) => r.checks.find(c => c.id === id);

describe('evaluarCierre', () => {
  it('un mes sin movimientos y con el anterior cerrado se puede cerrar', async () => {
    const r = await evaluarCierre(prismaCon(), 'e1', 2026, 5);
    expect(r.puedeCerrar).toBe(true);
    expect(r.bloqueantes).toBe(0);
    expect(r.periodo).toBe('2026-05');
  });

  it('detecta asientos descuadrados', async () => {
    const r = await evaluarCierre(prismaCon({ asientos: [asiento(1, 100, 100), asiento(2, 100, 90)] }), 'e1', 2026, 5);
    expect(fallo(r, 'asientos_cuadrados').ok).toBe(false);
    expect(fallo(r, 'asientos_cuadrados').cantidad).toBe(1);
    expect(fallo(r, 'asientos_cuadrados').detalle).toContain('#2');
    expect(r.puedeCerrar).toBe(false);
  });

  it('tolera diferencias de $1 en un asiento', async () => {
    const r = await evaluarCierre(prismaCon({ asientos: [asiento(1, 100, 99)] }), 'e1', 2026, 5);
    expect(fallo(r, 'asientos_cuadrados').ok).toBe(true);
  });

  it.each([
    ['pendientes', 'asientos_contabilizados', 2],
    ['docsSinAsiento', 'documentos_con_asiento', 3],
    ['honSinAsiento', 'honorarios_con_asiento', 1],
    ['auxSinRut', 'auxiliares_con_rut', 4],
    ['liqSinCentralizar', 'remuneraciones_centralizadas', 1],
  ])('%s > 0 bloquea el cierre', async (campo, id, n) => {
    const r = await evaluarCierre(prismaCon({ [campo]: n }), 'e1', 2026, 5);
    expect(fallo(r, id).ok).toBe(false);
    expect(fallo(r, id).severidad).toBe('bloqueante');
    expect(fallo(r, id).cantidad).toBe(n);
    expect(r.puedeCerrar).toBe(false);
  });

  it('IVA del libro distinto del mayor bloquea; con nota de credito resta', async () => {
    const documentos = [
      { tipo: 'factura', tipoTransaccion: 'venta', iva: 190 },
      { tipo: 'nota_credito', tipoTransaccion: 'venta', iva: 19 },
      { tipo: 'factura', tipoTransaccion: 'compra', iva: 95 },
    ];
    const mayorOk = [{ id: 'a1', numero: 1, detalles: [
      { debe: 0, haber: 171, cuentaCodigo: '2-01-002-0001' },
      { debe: 95, haber: 0, cuentaCodigo: '1-02-002-0001' },
      { debe: 76, haber: 0, cuentaCodigo: '9-99' },
    ] }];
    const ok = await evaluarCierre(prismaCon({ documentos, asientos: mayorOk }), 'e1', 2026, 5);
    expect(fallo(ok, 'iva_debito').ok).toBe(true);
    expect(fallo(ok, 'iva_credito').ok).toBe(true);

    const mayorMal = [{ id: 'a1', numero: 1, detalles: [{ debe: 0, haber: 190, cuentaCodigo: '2-01-002-0001' }, { debe: 190, haber: 0, cuentaCodigo: '9-99' }] }];
    const mal = await evaluarCierre(prismaCon({ documentos, asientos: mayorMal }), 'e1', 2026, 5);
    expect(fallo(mal, 'iva_debito').ok).toBe(false);
    expect(fallo(mal, 'iva_credito').ok).toBe(false);
    expect(mal.puedeCerrar).toBe(false);
  });

  it('las advertencias no impiden cerrar', async () => {
    const r = await evaluarCierre(prismaCon({
      trabajadoresActivos: 3, liqCalculadas: 2, activos: 2, asientosDepreciacion: 0, periodoAnterior: null,
    }), 'e1', 2026, 5);
    expect(fallo(r, 'remuneraciones_completas').ok).toBe(false);
    expect(fallo(r, 'depreciacion').ok).toBe(false);
    expect(fallo(r, 'periodo_anterior').ok).toBe(false);
    expect(r.bloqueantes).toBe(0);
    expect(r.puedeCerrar).toBe(true);
  });

  it('enero mira diciembre del anio anterior', async () => {
    let consultado;
    const p = prismaCon();
    p.periodoContable.findUnique = async (a) => { consultado = a.where.empresaId_anio_mes; return { estado: 'cerrado' }; };
    await evaluarCierre(p, 'e1', 2026, 1);
    expect(consultado).toEqual({ empresaId: 'e1', anio: 2025, mes: 12 });
  });
});

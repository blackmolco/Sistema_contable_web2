// Tests del motor REAL de remuneraciones (services/motorRemuneraciones.js) y
// de la centralizacion (services/generarAsiento.js). Antes este archivo
// probaba formulas copiadas dentro del propio test, asi que no detectaba
// ningun error del motor (por ejemplo los que aparecieron con un pensionado
// y con una media jornada). Sin base de datos.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { calcularLiquidacion, calcularImpuestoUnico, getTramoReformaPrevisional } = require('../services/motorRemuneraciones');
const { lineasParaRemuneraciones } = require('../services/generarAsiento');
const { Prisma } = require('@prisma/client');

// Indices previsionales reales (boletines Previred cargados a la base).
const IDX_2026_09 = { valorUf: 41057.2, valorUtm: 71721, sueldoMinimo: 553553, topeAfpSaludUf: 90, topeCesantiaUf: 135.2, tasaSis: 0.0178, valorTramoA: 22601, valorTramoB: 13870, valorTramoC: 4382 };
const IDX_2026_05 = { ...IDX_2026_09, valorUf: 40610.69, valorUtm: 70588, tasaSis: 0.0162 };

const trabajador = (extra = {}) => ({
  tipoContrato: 'indefinido', sueldoBase: 1_000_000, colacion: 0, movilizacion: 0,
  tasaAfp: 0.1144, isapre: null, saludPactado: 0,
  tramoAsignacionFamiliar: 'D', cargasSimples: 0, cargasMaternales: 0, cargasInvalidez: 0,
  tipoTrabajadorPrevired: '0', ...extra,
});
const liquidar = (t, entrada = {}, idx = IDX_2026_09, periodo = '2026-09', opciones = {}) =>
  calcularLiquidacion(t, entrada, idx, periodo, opciones);

const TOPE_GRATIFICACION = Math.round((4.75 * 553553) / 12); // 219.115

describe('Contrato con la base de datos', () => {
  it('cada campo que devuelve el motor es una columna real de LiquidacionSueldo', () => {
    // Regresion: el motor devolvia totalHaberes/totalNoImponible, que no son
    // columnas; Prisma rechazaba el upsert y NINGUNA liquidacion se podia calcular.
    const columnas = new Set(Prisma.dmmf.datamodel.models.find(m => m.name === 'LiquidacionSueldo').fields.map(f => f.name));
    const r = liquidar(trabajador());
    for (const campo of Object.keys(r)) expect(columnas.has(campo), `campo "${campo}" no existe en LiquidacionSueldo`).toBe(true);
  });

  it('devuelve diasTrabajados entero', () => {
    expect(liquidar(trabajador(), { diasTrabajados: 27 }).diasTrabajados).toBe(27);
    expect(Number.isInteger(liquidar(trabajador(), { diasTrabajados: 22.6 }).diasTrabajados)).toBe(true);
    expect(liquidar(trabajador()).diasTrabajados).toBe(30);
  });

  it('sin indices previsionales falla con status 400', () => {
    expect(() => calcularLiquidacion(trabajador(), {}, null, '2026-09')).toThrow(/indices previsionales/i);
  });
});

describe('Caso real: Mario Mancilla (pensionado, no cotiza AFP, sueldo minimo)', () => {
  const mario = trabajador({ sueldoBase: 553_553, tipoTrabajadorPrevired: '2', tasaAfp: 0.10 });

  it('septiembre 2026, mes completo: solo descuenta salud', () => {
    const r = liquidar(mario);
    expect(r.totalImponible).toBe(691_941);
    expect(r.descuentoAFP).toBe(0);
    expect(r.descuentoAFC).toBe(0);
    expect(r.descuentoSalud).toBe(48_436);
    expect(r.totalDescuentos).toBe(48_436);
    expect(r.sueldoLiquido).toBe(643_505);
  });

  it('mayo 2026, 27 dias: sueldo prorrateado, sin AFP ni cesantia', () => {
    const r = liquidar(mario, { diasTrabajados: 27 }, IDX_2026_05, '2026-05');
    expect(r.sueldoBase).toBe(498_198);
    expect(r.gratificacion).toBe(124_549);
    expect(r.totalImponible).toBe(622_747);
    expect(r.descuentoAFP).toBe(0);
    expect(r.descuentoAFC).toBe(0);
    expect(r.descuentoSalud).toBe(43_592);
    expect(r.sueldoLiquido).toBe(579_155);
    expect(r.diasTrabajados).toBe(27);
  });

  it('el empleador tampoco paga SIS, Reforma Previsional ni AFC por un pensionado que no cotiza', () => {
    const r = liquidar(mario);
    expect(r.aporteSis).toBe(0);
    expect(r.aporteReformaPrevisional).toBe(0);
    expect(r.aporteAfcEmpresa).toBe(0);
    expect(r.aporteMutual).toBeGreaterThan(0); // el seguro de accidentes si corresponde
  });
});

describe('Situacion previsional (tabla N5 Previred)', () => {
  const casos = {
    '0': { afp: true, sis: true, afc: true, desc: 'cotiza normal' },
    '1': { afp: true, sis: true, afc: false, desc: 'pensionado y cotiza (exento de AFC)' },
    '2': { afp: false, sis: false, afc: false, desc: 'pensionado, no cotiza' },
    '3': { afp: true, sis: true, afc: true, desc: 'otro pensionado (cotiza)' },
    '8': { afp: false, sis: false, afc: true, desc: 'exento por edad/extranjero (sigue con AFC)' },
  };
  it.each(Object.entries(casos))('tipo %s (%o)', (tipo, esperado) => {
    const r = liquidar(trabajador({ tipoTrabajadorPrevired: tipo }));
    expect(r.descuentoAFP > 0, 'descuento AFP').toBe(esperado.afp);
    expect(r.aporteSis > 0, 'aporte SIS').toBe(esperado.sis);
    expect(r.aporteReformaPrevisional > 0, 'reforma previsional').toBe(esperado.sis);
    expect(r.descuentoAFC > 0, 'descuento AFC').toBe(esperado.afc);
    expect(r.aporteAfcEmpresa > 0, 'aporte AFC empleador').toBe(esperado.afc);
    expect(r.descuentoSalud).toBeGreaterThan(0); // la salud siempre se cotiza
  });
});

describe('Dias trabajados (media jornada / mes parcial)', () => {
  it('prorratea el sueldo base y la gratificacion', () => {
    const t = trabajador({ sueldoBase: 600_000 });
    const completo = liquidar(t);
    const mitad = liquidar(t, { diasTrabajados: 15 });
    expect(mitad.sueldoBase).toBe(300_000);
    expect(mitad.gratificacion).toBe(75_000);
    expect(mitad.totalImponible).toBe(375_000);
    expect(mitad.totalImponible).toBeLessThan(completo.totalImponible);
  });

  it('0 dias no genera sueldo ni descuentos', () => {
    const r = liquidar(trabajador(), { diasTrabajados: 0 });
    expect(r.sueldoBase).toBe(0);
    expect(r.totalImponible).toBe(0);
    expect(r.sueldoLiquido).toBe(0);
  });

  it('un sueldo base distinto en la entrada reemplaza el del contrato', () => {
    expect(liquidar(trabajador(), { sueldoBase: 700_000 }).sueldoBase).toBe(700_000);
  });
});

describe('Gratificacion legal (art. 50 CT)', () => {
  it('25% del sueldo mientras no supere el tope de 4,75 sueldos minimos / 12', () => {
    const r = liquidar(trabajador({ sueldoBase: 600_000 }));
    expect(r.gratificacion).toBe(150_000);
  });
  it('se topa en 4,75 sueldos minimos / 12', () => {
    const r = liquidar(trabajador({ sueldoBase: 3_000_000 }));
    expect(r.gratificacion).toBe(TOPE_GRATIFICACION);
  });
});

describe('Salud', () => {
  it('Fonasa: 7% del imponible', () => {
    const r = liquidar(trabajador({ sueldoBase: 600_000 }));
    expect(r.descuentoSalud).toBe(Math.round(r.totalImponible * 0.07));
  });
  it('Isapre con plan pactado sobre el 7%: descuenta el plan en UF', () => {
    const r = liquidar(trabajador({ sueldoBase: 600_000, isapre: 'Banmedica', saludPactado: 4 }));
    expect(r.descuentoSalud).toBe(Math.round(4 * 41_057.2));
  });
  it('Isapre con plan menor al 7%: descuenta igual el 7% legal', () => {
    const r = liquidar(trabajador({ sueldoBase: 1_000_000, isapre: 'Banmedica', saludPactado: 1 }));
    expect(r.descuentoSalud).toBe(Math.round(r.totalImponible * 0.07));
  });
});

describe('Seguro de cesantia (AFC)', () => {
  it('indefinido: 0,6% trabajador y 2,4% empleador', () => {
    const r = liquidar(trabajador({ sueldoBase: 600_000 }));
    expect(r.descuentoAFC).toBe(Math.round(r.totalImponible * 0.006));
    expect(r.aporteAfcEmpresa).toBe(Math.round(r.totalImponible * 0.024));
  });
  it('plazo fijo: el trabajador no paga y el empleador 3%', () => {
    const r = liquidar(trabajador({ sueldoBase: 600_000, tipoContrato: 'plazo_fijo' }));
    expect(r.descuentoAFC).toBe(0);
    expect(r.aporteAfcEmpresa).toBe(Math.round(r.totalImponible * 0.03));
  });
  it('tipo de contrato de la entrada tiene prioridad sobre el de la ficha', () => {
    const r = liquidar(trabajador(), { tipoContrato: 'plazo_fijo' });
    expect(r.descuentoAFC).toBe(0);
  });
});

describe('Topes imponibles', () => {
  const r = liquidar(trabajador({ sueldoBase: 10_000_000 }));
  it('AFP y salud se calculan hasta 90 UF', () => {
    const tope = 90 * 41_057.2;
    expect(r.descuentoAFP).toBe(Math.round(tope * 0.1144));
    expect(r.descuentoSalud).toBe(Math.round(tope * 0.07));
  });
  it('cesantia se calcula hasta 135,2 UF', () => {
    expect(r.descuentoAFC).toBe(Math.round(135.2 * 41_057.2 * 0.006));
  });
});

describe('Aportes del empleador', () => {
  it('SIS usa la tasa del periodo cargada en los indices', () => {
    const r = liquidar(trabajador({ sueldoBase: 600_000 }));
    expect(r.aporteSis).toBe(Math.round(r.totalImponible * 0.0178));
    const rMayo = liquidar(trabajador({ sueldoBase: 600_000 }), {}, IDX_2026_05, '2026-05');
    expect(rMayo.aporteSis).toBe(Math.round(rMayo.totalImponible * 0.0162));
  });

  it('Reforma Previsional (Ley 21.735): 1,0% hasta jul-2026 y 1,72% desde ago-2026', () => {
    const mayo = liquidar(trabajador({ sueldoBase: 600_000 }), {}, IDX_2026_05, '2026-05');
    expect(mayo.aporteReformaPrevisional).toBe(Math.round(mayo.totalImponible * 0.01));
    const sep = liquidar(trabajador({ sueldoBase: 600_000 }));
    expect(sep.aporteReformaPrevisional).toBe(Math.round(sep.totalImponible * 0.0172));
  });

  it('antes de agosto 2025 no hay Reforma Previsional', () => {
    expect(getTramoReformaPrevisional('2025-07')).toBeNull();
    expect(liquidar(trabajador(), {}, IDX_2026_05, '2025-07').aporteReformaPrevisional).toBe(0);
  });

  it('Mutual: piso legal 0,90% o la tasa real de la empresa', () => {
    const base = liquidar(trabajador({ sueldoBase: 600_000 }));
    expect(base.aporteMutual).toBe(Math.round(base.totalImponible * 0.009));
    const propia = liquidar(trabajador({ sueldoBase: 600_000 }), {}, IDX_2026_09, '2026-09', { mutualTasaPct: 1.53 });
    expect(propia.aporteMutual).toBe(Math.round(propia.totalImponible * 0.0153));
  });

  it('costo total empresa = haberes + aportes patronales', () => {
    const r = liquidar(trabajador({ sueldoBase: 600_000, colacion: 30_000 }));
    const haberes = r.totalImponible + r.colacion + r.movilizacion + r.asignacionFamiliar;
    const aportes = r.aporteSis + r.aporteReformaPrevisional + r.aporteMutual + r.aporteAfcEmpresa;
    expect(Math.abs(r.costoTotalEmpresa - (haberes + aportes))).toBeLessThanOrEqual(2);
  });
});

describe('Haberes no imponibles y otros conceptos', () => {
  it('colacion y movilizacion no son imponibles pero suman al liquido', () => {
    const sin = liquidar(trabajador({ sueldoBase: 600_000 }));
    const con = liquidar(trabajador({ sueldoBase: 600_000, colacion: 40_000, movilizacion: 20_000 }));
    expect(con.totalImponible).toBe(sin.totalImponible);
    expect(con.sueldoLiquido - sin.sueldoLiquido).toBe(60_000);
  });

  it('asignacion familiar: cargas simples + 2 x invalidas + maternales por el valor del tramo', () => {
    const r = liquidar(trabajador({ tramoAsignacionFamiliar: 'A', cargasSimples: 2, cargasInvalidez: 1, cargasMaternales: 1 }));
    expect(r.asignacionFamiliar).toBe((2 + 2 * 1 + 1) * 22_601);
    expect(liquidar(trabajador({ tramoAsignacionFamiliar: 'D', cargasSimples: 3 })).asignacionFamiliar).toBe(0);
  });

  it('horas extra: valor hora = sueldo x 28 / (30 x horas semanales x 4), con 50% de recargo, y son imponibles', () => {
    const t = trabajador({ sueldoBase: 900_000 });
    const r = liquidar(t, { horasExtra: 10 }); // jornada de 42 h desde abril 2026
    const valorHora = (900_000 * 28) / (30 * 42 * 4);
    expect(r.montoHorasExtras).toBe(Math.round(valorHora * 1.5 * 10));
    expect(r.totalImponible).toBeGreaterThan(liquidar(t).totalImponible);
  });

  it('bonos y aguinaldo entran al imponible', () => {
    const base = liquidar(trabajador({ sueldoBase: 600_000 }));
    const con = liquidar(trabajador({ sueldoBase: 600_000 }), { bonos: 100_000, aguinaldo: 50_000 });
    expect(con.totalImponible).toBeGreaterThan(base.totalImponible + 150_000 - 1);
  });

  it('anticipos y prestamos bajan el liquido sin tocar el imponible ni el impuesto', () => {
    const base = liquidar(trabajador({ sueldoBase: 600_000 }));
    const con = liquidar(trabajador({ sueldoBase: 600_000 }), { anticipos: 50_000, prestamos: 30_000 });
    expect(con.totalImponible).toBe(base.totalImponible);
    expect(con.descuentoImpuesto).toBe(base.descuentoImpuesto);
    expect(base.sueldoLiquido - con.sueldoLiquido).toBe(80_000);
    expect(con.anticipos).toBe(50_000);
    expect(con.prestamos).toBe(30_000);
  });
});

describe('Impuesto unico de segunda categoria', () => {
  it('sueldos bajos no pagan (hasta 13,5 UTM)', () => {
    expect(calcularImpuestoUnico(900_000, 71_721)).toBe(0);
    expect(liquidar(trabajador({ sueldoBase: 600_000 })).descuentoImpuesto).toBe(0);
  });
  it('tramo 30-50 UTM: 8% menos 1,74 UTM', () => {
    const base = 40 * 71_721;
    expect(calcularImpuestoUnico(base, 71_721)).toBe(Math.round(base * 0.08 - 1.74 * 71_721));
  });
  it('nunca es negativo', () => {
    expect(calcularImpuestoUnico(13.6 * 71_721, 71_721)).toBeGreaterThanOrEqual(0);
  });
  it('la base tributable descuenta AFP, salud y cesantia', () => {
    // Un sueldo justo sobre 13,5 UTM en bruto pero bajo el limite una vez descontada la prevision.
    const r = liquidar(trabajador({ sueldoBase: 900_000 }));
    expect(r.descuentoImpuesto).toBe(calcularImpuestoUnico(r.totalImponible - r.descuentoAFP - r.descuentoSalud - r.descuentoAFC, 71_721));
  });
});

describe('Identidad del liquido', () => {
  it('sueldoLiquido = haberes - descuentos (con tolerancia de redondeo)', () => {
    const casos = [
      liquidar(trabajador()),
      liquidar(trabajador({ sueldoBase: 553_553, tipoTrabajadorPrevired: '2' }), { diasTrabajados: 27 }),
      liquidar(trabajador({ sueldoBase: 2_500_000, colacion: 50_000, movilizacion: 30_000, isapre: 'X', saludPactado: 5, tramoAsignacionFamiliar: 'B', cargasSimples: 1 }), { anticipos: 100_000, horasExtra: 8 }),
    ];
    for (const r of casos) {
      const haberes = r.totalImponible + r.colacion + r.movilizacion + r.asignacionFamiliar;
      expect(Math.abs(r.sueldoLiquido - (haberes - r.totalDescuentos))).toBeLessThanOrEqual(2);
    }
  });
});

// ---------- Centralizacion: el asiento generado debe cuadrar ----------
function txFalso() {
  return {
    configCentralizacionRemuneraciones: { findUnique: async () => null },
    cuenta: { findFirst: async ({ where }) => ({ id: 'id-' + where.codigo, codigo: where.codigo, nombre: 'Cuenta ' + where.codigo }) },
  };
}
const conTrabajador = (r, n) => ({ ...r, id: 'liq-' + n, trabajador: { rut: `1000000${n}-K`, nombres: 'Trab', apellidos: String(n) } });

describe('Centralizacion de remuneraciones', () => {
  const sumar = (lineas) => lineas.reduce((s, l) => ({ debe: s.debe + (l.debe || 0), haber: s.haber + (l.haber || 0) }), { debe: 0, haber: 0 });

  it('el asiento cuadra para un mes con trabajadores de distinto tipo', async () => {
    const liqs = [
      liquidar(trabajador({ sueldoBase: 1_000_000, colacion: 40_000 }), {}),
      liquidar(trabajador({ sueldoBase: 553_553, tipoTrabajadorPrevired: '2' }), { diasTrabajados: 27 }),
      liquidar(trabajador({ sueldoBase: 800_000, tipoContrato: 'plazo_fijo', isapre: 'X', saludPactado: 3 }), { anticipos: 50_000 }),
      liquidar(trabajador({ sueldoBase: 2_000_000, tramoAsignacionFamiliar: 'C', cargasSimples: 2 }), { prestamos: 80_000, horasExtra: 6 }),
    ].map(conTrabajador);
    const lineas = await lineasParaRemuneraciones(txFalso(), 'e1', liqs);
    const { debe, haber } = sumar(lineas);
    // El liquido y cada concepto se redondean por separado: hasta unos pocos pesos de diferencia.
    expect(Math.abs(debe - haber)).toBeLessThanOrEqual(liqs.length * 2);
  });

  it('sueldo liquido y anticipos/prestamos quedan por trabajador con su RUT (cuenta corriente)', async () => {
    const liqs = [
      liquidar(trabajador({ sueldoBase: 700_000 }), { anticipos: 40_000 }),
      liquidar(trabajador({ sueldoBase: 900_000 }), {}),
    ].map(conTrabajador);
    const lineas = await lineasParaRemuneraciones(txFalso(), 'e1', liqs);
    const porPagar = lineas.filter(l => l.cuentaCodigo === '2-01-003-0001');
    expect(porPagar).toHaveLength(2);
    expect(porPagar.map(l => l.rutAuxiliar)).toEqual(['10000000-K', '10000001-K']);
    expect(porPagar.map(l => l.documentoId)).toEqual(['liq-0-pagar', 'liq-1-pagar']);
    const deudores = lineas.filter(l => l.cuentaCodigo === '1-02-001-0003');
    expect(deudores).toHaveLength(1);
    expect(deudores[0].haber).toBe(40_000);
    expect(deudores[0].documentoId).toBe('liq-0-deudor');
  });

  it('un pensionado no genera lineas de SIS/reforma ni cesantia', async () => {
    const lineas = await lineasParaRemuneraciones(txFalso(), 'e1', [conTrabajador(liquidar(trabajador({ sueldoBase: 553_553, tipoTrabajadorPrevired: '2' })), 0)]);
    const codigos = lineas.map(l => l.cuentaCodigo);
    expect(codigos).not.toContain('2-01-003-0004'); // cesantia
    expect(codigos).not.toContain('2-01-003-0009'); // reforma/SIS
    expect(codigos).not.toContain('2-01-003-0002'); // AFP
  });

  it('usa la cuenta personalizada de la empresa cuando existe', async () => {
    const tx = txFalso();
    tx.configCentralizacionRemuneraciones.findUnique = async () => ({ cuentaRemuneracionesGastoId: 'mi-cuenta-gasto' });
    const buscar = tx.cuenta.findFirst;
    tx.cuenta.findFirst = async (args) => (args.where.id === 'mi-cuenta-gasto' ? { id: 'mi-cuenta-gasto', codigo: '9-99-999', nombre: 'Mi gasto' } : buscar(args));
    const lineas = await lineasParaRemuneraciones(tx, 'e1', [conTrabajador(liquidar(trabajador()), 0)]);
    expect(lineas.find(l => l.debe > 0 && l.cuentaCodigo === '9-99-999')).toBeTruthy();
  });
});

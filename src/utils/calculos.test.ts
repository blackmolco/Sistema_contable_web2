import { describe, it, expect } from 'vitest';
import {
  validarRUT,
  formatRUT,
  calcularHonorarios,
  calcularHonorariosDesdeLiquido,
  calcularCotizaciones,
  calcularImpuestoUnico,
  calcularImpuestoMensual,
  calcularAsignacionFamiliar,
  calcularSueldoLiquido,
  formatCurrency,
  getPeriodoActual,
  truncateText,
} from './calculos';
import { RETENCION_HONORARIOS, ASIGNACION_FAMILIAR } from '../data/normativa';

// ============ RUT ============

describe('validarRUT', () => {
  it('acepta RUTs válidos conocidos', () => {
    expect(validarRUT('76.543.210-3')).toBe(true); // DV calculado: 3
    expect(validarRUT('11.111.111-1')).toBe(true);
    expect(validarRUT('7.654.321-6')).toBe(true);  // DV calculado: 6
    expect(validarRUT('765-K')).toBe(true);        // DV calculado: K
  });

  it('rechaza RUTs con DV incorrecto', () => {
    expect(validarRUT('76.543.210-K')).toBe(false); // DV real es 3
    expect(validarRUT('12.345.678-0')).toBe(false);
    expect(validarRUT('11.111.111-2')).toBe(false);
  });

  it('rechaza cadenas vacías o muy cortas', () => {
    expect(validarRUT('')).toBe(false);
    expect(validarRUT('1')).toBe(false);
    expect(validarRUT('1-2')).toBe(false);
  });

  it('es insensible a mayúsculas/minúsculas en K', () => {
    expect(validarRUT('765-K')).toBe(validarRUT('765-k'));
    expect(validarRUT('765-K')).toBe(true);
    expect(validarRUT('765-k')).toBe(true);
  });

  it('acepta RUT sin formato (solo dígitos)', () => {
    expect(validarRUT('111111111')).toBe(true); // 11.111.111-1
  });
});

describe('formatRUT', () => {
  it('formatea número sin puntos', () => {
    expect(formatRUT('111111111')).toBe('11.111.111-1');
  });

  it('devuelve cadena vacía para entrada vacía', () => {
    expect(formatRUT('')).toBe('');
  });

  it('maneja RUT ya formateado', () => {
    expect(formatRUT('11.111.111-1')).toBe('11.111.111-1');
  });
});

// ============ HONORARIOS ============

describe('calcularHonorarios – retención vigente 2026', () => {
  it('calcula retención y líquido correctamente desde bruto', () => {
    const { retencion, liquido } = calcularHonorarios(100_000);
    expect(retencion).toBe(Math.round(100_000 * RETENCION_HONORARIOS.TASA_NORMA / 100));
    expect(liquido).toBe(100_000 - retencion);
    expect(liquido + retencion).toBe(100_000);
  });

  it('redondea al entero más próximo', () => {
    const { retencion } = calcularHonorarios(150_001);
    expect(Number.isInteger(retencion)).toBe(true);
  });

  it('maneja monto cero', () => {
    const { retencion, liquido } = calcularHonorarios(0);
    expect(retencion).toBe(0);
    expect(liquido).toBe(0);
  });
});

describe('calcularHonorariosDesdeLiquido – reverso del cálculo', () => {
  it('recupera el bruto original dado el líquido', () => {
    const brutoOriginal = 100_000;
    const { liquido } = calcularHonorarios(brutoOriginal);
    const { bruto, retencion } = calcularHonorariosDesdeLiquido(liquido);
    expect(bruto).toBe(brutoOriginal);
    expect(retencion).toBe(Math.round(brutoOriginal * RETENCION_HONORARIOS.TASA_NORMA / 100));
  });

  it('bruto + líquido es consistente con la tasa', () => {
    const montoLiquido = 200_000;
    const { bruto, retencion } = calcularHonorariosDesdeLiquido(montoLiquido);
    expect(bruto - retencion).toBeCloseTo(montoLiquido, -1);
  });
});

// ============ COTIZACIONES ============

describe('calcularCotizaciones', () => {
  const sueldo = 1_000_000;

  it('calcula SIS correctamente (1.49% del imponible — tasa vigente mayo 2026)', () => {
    const { afpSis } = calcularCotizaciones(sueldo, 1.44, 'indefinido');
    expect(afpSis).toBe(Math.round(sueldo * 0.0149));
  });

  it('calcula salud correctamente (7%)', () => {
    const { salud } = calcularCotizaciones(sueldo, 1.44, 'indefinido');
    expect(salud).toBe(Math.round(sueldo * 0.07));
  });

  it('AFC indefinido es 0.6%', () => {
    const { afc } = calcularCotizaciones(sueldo, 1.44, 'indefinido');
    expect(afc).toBe(Math.round(sueldo * 0.006));
  });

  it('AFC plazo fijo: trabajador no cotiza (0%) — empleador paga 3% aparte', () => {
    // Según Ley 19.728 Art. 5: contrato plazo fijo → trabajador no cotiza AFC
    const { afc } = calcularCotizaciones(sueldo, 1.44, 'plazo');
    expect(afc).toBe(0);
  });

  it('AFP ahorro es 10% del imponible', () => {
    const { afpAhorro } = calcularCotizaciones(sueldo, 1.44, 'indefinido');
    expect(afpAhorro).toBe(Math.round(sueldo * 0.10));
  });

  it('totalAfp = ahorro + SIS + comisión', () => {
    const result = calcularCotizaciones(sueldo, 1.44, 'indefinido');
    expect(result.totalAfp).toBe(result.afpAhorro + result.afpSis + result.afpComision);
  });

  it('todos los montos son enteros', () => {
    const result = calcularCotizaciones(sueldo, 1.27, 'indefinido');
    for (const val of Object.values(result)) {
      expect(Number.isInteger(val)).toBe(true);
    }
  });
});

// ============ IMPUESTO ÚNICO ============

describe('calcularImpuestoUnico', () => {
  it('tramo exento: impuesto = 0', () => {
    // Sueldo mensual bajo el primer tramo exento.
    const { impuesto } = calcularImpuestoUnico(500_000);
    expect(impuesto).toBe(0);
  });

  it('sueldo cero da impuesto cero', () => {
    const { impuesto, tramo } = calcularImpuestoUnico(0);
    expect(impuesto).toBe(0);
    expect(tramo).toBeNull();
  });

  it('impuesto nunca es negativo', () => {
    for (const anual of [0, 500_000, 2_000_000, 10_000_000, 50_000_000]) {
      const { impuesto } = calcularImpuestoUnico(anual);
      expect(impuesto).toBeGreaterThanOrEqual(0);
    }
  });

  it('tramo con renta alta tiene impuesto positivo', () => {
    const { impuesto } = calcularImpuestoUnico(30_000_000);
    expect(impuesto).toBeGreaterThan(0);
  });

  it('impuesto crece con la renta', () => {
    const { impuesto: imp1 } = calcularImpuestoUnico(10_000_000);
    const { impuesto: imp2 } = calcularImpuestoUnico(20_000_000);
    expect(imp2).toBeGreaterThan(imp1);
  });

  it('devuelve objeto tramo con campos correctos cuando aplica', () => {
    const { tramo } = calcularImpuestoUnico(20_000_000);
    expect(tramo).not.toBeNull();
    expect(tramo!.tasa).toBeGreaterThan(0);
    expect(tramo!.impuestoCalculado).toBeGreaterThan(0);
  });
});

describe('calcularImpuestoMensual', () => {
  it('delega en la tabla mensual vigente', () => {
    const sueldo = 3_000_000;
    const { impuesto } = calcularImpuestoUnico(sueldo);
    const mensual = calcularImpuestoMensual(sueldo);
    expect(mensual).toBe(impuesto);
  });

  it('nunca es negativo', () => {
    for (const s of [0, 500_000, 2_000_000, 5_000_000]) {
      expect(calcularImpuestoMensual(s)).toBeGreaterThanOrEqual(0);
    }
  });
});

// ============ ASIGNACIÓN FAMILIAR ============

describe('calcularAsignacionFamiliar', () => {
  it('tramo A: sueldo ≤ límite A recibe monto A por carga', () => {
    const sueldoBajo = ASIGNACION_FAMILIAR.TRAMO_A.limite - 1;
    const resultado = calcularAsignacionFamiliar(sueldoBajo, 1, 0);
    expect(resultado).toBe(ASIGNACION_FAMILIAR.MONTO_UNICO_A);
  });

  it('tramo B: monto intermedio', () => {
    const sueldoB = ASIGNACION_FAMILIAR.TRAMO_A.limite + 1;
    const resultado = calcularAsignacionFamiliar(sueldoB, 1, 0);
    expect(resultado).toBe(ASIGNACION_FAMILIAR.MONTO_UNICO_B);
  });

  it('tramo C: monto menor', () => {
    const sueldoC = ASIGNACION_FAMILIAR.TRAMO_B.limite + 1;
    const resultado = calcularAsignacionFamiliar(sueldoC, 1, 0);
    expect(resultado).toBe(ASIGNACION_FAMILIAR.MONTO_UNICO_C);
  });

  it('sin cargas da 0', () => {
    expect(calcularAsignacionFamiliar(200_000, 0, 0)).toBe(0);
  });

  it('multiplica correctamente por cantidad de cargas', () => {
    const sueldoBajo = ASIGNACION_FAMILIAR.TRAMO_A.limite - 1;
    const result3cargas = calcularAsignacionFamiliar(sueldoBajo, 2, 1);
    expect(result3cargas).toBe(ASIGNACION_FAMILIAR.MONTO_UNICO_A * 3);
  });

  it('sueldo sobre tramo C da 0', () => {
    const sueldoAlto = ASIGNACION_FAMILIAR.TRAMO_C.limite + 1;
    expect(calcularAsignacionFamiliar(sueldoAlto, 1, 0)).toBe(0);
  });
});

// ============ SUELDO LÍQUIDO COMPLETO ============

describe('calcularSueldoLiquido', () => {
  const params = {
    sueldoBase: 800_000,
    colacion: 50_000,
    movilizacion: 35_000,
    bonificacion: 0,
    comisionAfp: 1.27,
    tipoContrato: 'indefinido' as const,
    cargaCivil: 0,
    cargaMilitar: 0,
  };

  it('sueldo líquido es positivo para sueldo sobre mínimo', () => {
    const { sueldoLiquido } = calcularSueldoLiquido(params);
    expect(sueldoLiquido).toBeGreaterThan(0);
  });

  it('líquido es menor que bruto (hay descuentos)', () => {
    const { sueldoBruto, sueldoLiquido } = calcularSueldoLiquido(params);
    expect(sueldoLiquido).toBeLessThan(sueldoBruto + params.colacion + params.movilizacion);
  });

  it('total cotizaciones = AFP + salud + AFC', () => {
    const { cotizaciones } = calcularSueldoLiquido(params);
    expect(cotizaciones.total).toBe(
      cotizaciones.afpAhorro + cotizaciones.afpSis + cotizaciones.afpComision + cotizaciones.salud + cotizaciones.afc
    );
  });

  it('desglose incluye todos los conceptos principales', () => {
    const { desglose } = calcularSueldoLiquido(params);
    const conceptos = desglose.map(d => d.concepto);
    expect(conceptos).toContain('Sueldo base');
    expect(conceptos).toContain('Cotización AFP (10%)');
    expect(conceptos).toContain('Cotización Salud (7%)');
    expect(conceptos).toContain('Impuesto Único');
  });

  it('todos los montos del desglose son enteros', () => {
    const { desglose } = calcularSueldoLiquido(params);
    for (const item of desglose) {
      expect(Number.isInteger(item.monto)).toBe(true);
    }
  });
});

// ============ UTILIDADES ============

describe('formatCurrency', () => {
  it('incluye el símbolo $ por defecto', () => {
    expect(formatCurrency(1000)).toContain('$');
  });

  it('omite símbolo cuando incluirSimbolo = false', () => {
    expect(formatCurrency(1000, false)).not.toContain('$');
  });

  it('redondea al entero', () => {
    // 1000.7 → 1001 (redondeo)
    const result = formatCurrency(1000.7, false);
    expect(result).toContain('1.001');
  });

  it('formatea con separadores de miles chilenos', () => {
    expect(formatCurrency(1_000_000, false)).toContain('1.000.000');
  });
});

describe('getPeriodoActual', () => {
  it('devuelve formato YYYY-MM', () => {
    expect(getPeriodoActual()).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe('truncateText', () => {
  it('no trunca textos cortos', () => {
    expect(truncateText('hola', 10)).toBe('hola');
  });

  it('trunca textos largos y agrega ...', () => {
    const result = truncateText('texto muy largo', 5);
    expect(result).toBe('texto...');
    expect(result.length).toBe(8);
  });
});

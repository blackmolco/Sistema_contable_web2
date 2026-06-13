// Utilidades para formateo y cálculos chilenos

import {
  COTIZACIONES,
  ESCALA_IMPUESTO_UNICO,
  RETENCION_HONORARIOS,
  ASIGNACION_FAMILIAR,
  TOPES_LEGALES,
  MONEDA,
  SUELDO_MINIMO,
  getHorasSemanalesPorPeriodo,
  getTopeGratificacionMensual,
} from '../data/normativa';
import type { TramoImpuesto, ResultadoSueldoLiquido } from '../types';

// ============ FORMATEO DE NÚMEROS ============

/**
 * Formatea un número como moneda chilena (CLP)
 */
export const formatCurrency = (valor: number, incluirSimbolo = true): string => {
  const formateado = Math.round(valor).toLocaleString('es-CL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return incluirSimbolo ? `${MONEDA.simbolo}${formateado}` : formateado;
};

/**
 * Formatea un número con separadores de miles
 */
export const formatNumber = (valor: number, decimales = 0): string => {
  return valor.toLocaleString('es-CL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

/**
 * Parsea un string de moneda a número
 */
export const parseCurrency = (valor: string): number => {
  const limpio = valor.replace(/[$.]/g, '').replace(/,/g, '.');
  return parseFloat(limpio) || 0;
};

// ============ FORMATEO DE FECHAS ============

/**
 * Formatea fecha ISO a formato chileno dd/mm/yyyy
 */
export const formatDate = (fecha: string | Date): string => {
  const date = typeof fecha === 'string' ? new Date(fecha) : fecha;
  return date.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

/**
 * Formatea fecha a ISO yyyy-mm-dd para inputs de fecha
 */
export const formatDateISO = (fecha: Date): string => {
  return fecha.toISOString().split('T')[0];
};

/**
 * Obtiene el período actual en formato yyyy-mm
 */
export const getPeriodoActual = (): string => {
  const ahora = new Date();
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Obtiene el nombre del mes
 */
export const getNombreMes = (numeroMes: number): string => {
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return meses[numeroMes - 1] || '';
};

// ============ FORMATEO DE RUT ============

/**
 * Formatea RUT chileno (ej: 12345678-9)
 */
export const formatRUT = (rut: string): string => {
  if (!rut) return '';
  const limpio = rut.replace(/[^0-9kK]/g, '');
  if (limpio.length < 2) return limpio;
  const numero = limpio.slice(0, -1);
  const dv = limpio.slice(-1).toUpperCase();
  return `${numero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`;
};

/**
 * Valida RUT chileno
 */
export const validarRUT = (rut: string): boolean => {
  if (!rut) return false;
  const limpio = rut.replace(/[^0-9kK]/g, '');
  if (limpio.length < 2) return false;

  const rutNum = parseInt(limpio.slice(0, -1), 10);
  const dv = limpio.slice(-1).toUpperCase();

  let suma = 0;
  let mult = 2;

  for (let i = rutNum.toString().length - 1; i >= 0; i--) {
    suma += parseInt(rutNum.toString()[i], 10) * mult;
    mult = mult === 7 ? 2 : mult + 1;
  }

  const resto = suma % 11;
  const dvCalculado = resto === 0 ? '0' : resto === 1 ? 'K' : String(11 - resto);

  return dv === dvCalculado;
};

/**
 * Obtiene el DV de un RUT sin formato
 */
export const getDVRUT = (rut: string): string => {
  if (!rut) return '';
  const limpio = rut.replace(/[^0-9]/g, '');
  if (limpio.length < 1) return '';

  const rutNum = parseInt(limpio, 10);
  let suma = 0;
  let mult = 2;

  for (let i = rutNum.toString().length - 1; i >= 0; i--) {
    suma += parseInt(rutNum.toString()[i], 10) * mult;
    mult = mult === 7 ? 2 : mult + 1;
  }

  const resto = suma % 11;
  if (resto === 0) return '0';
  if (resto === 1) return 'K';
  return String(11 - resto);
};

// ============ CÁLCULOS TRIBUTARIOS ============

/**
 * Calcula las cotizaciones previsionales chilenas
 */
export const calcularCotizaciones = (
  sueldoImponible: number,
  afpComision: number,
  tipoContrato: 'indefinido' | 'plazo' | 'honorarios',
  cotizaAfp: boolean = true   // false = Sin Afiliación AFP (pensionado u otra excepción)
): {
  afpAhorro: number;
  afpSis: number;
  afpComision: number;
  totalAfp: number;
  salud: number;
  afc: number;
  totalCotizaciones: number;
} => {
  // Aplicar topes legales a la base imponible
  const imponibleAfpSalud = Math.min(sueldoImponible, TOPES_LEGALES.COTIZACION_AFP_SALUD_MAX);
  const imponibleAfc = Math.min(sueldoImponible, TOPES_LEGALES.COTIZACION_AFC);

  // Sin afiliación AFP → ahorro 10% y comisión son $0 (pensionados u otras excepciones)
  const afpAhorro = cotizaAfp ? imponibleAfpSalud * (COTIZACIONES.AFP_PORCENTAJE / 100) : 0;
  const afpSis = cotizaAfp ? imponibleAfpSalud * (COTIZACIONES.SIS_DEPENDIENTE / 100) : 0;
  const afpComisionCalculada = cotizaAfp ? imponibleAfpSalud * (afpComision / 100) : 0;
  // SIS es costo del empleador, no se descuenta al trabajador
  const totalAfp = afpAhorro + afpComisionCalculada;

  const salud = imponibleAfpSalud * (COTIZACIONES.SALUD_PORCENTAJE / 100);

  const afcTasa = tipoContrato === 'plazo'
    ? COTIZACIONES.AFC_PLAZO
    : COTIZACIONES.AFC_DEPENDIENTE;
  const afc = imponibleAfc * (afcTasa / 100);

  const totalCotizaciones = totalAfp + salud + afc;

  return {
    afpAhorro: Math.round(afpAhorro),
    afpSis: Math.round(afpSis),
    afpComision: Math.round(afpComisionCalculada),
    totalAfp: Math.round(totalAfp),
    salud: Math.round(salud),
    afc: Math.round(afc),
    totalCotizaciones: Math.round(totalCotizaciones),
  };
};

/**
 * Calcula el impuesto único de 2da categoría
 * Basado en Art. 52 LIR
 */
export const calcularImpuestoUnico = (
  sueldoImponibleMensual: number
): { impuesto: number; tramo: TramoImpuesto | null } => {
  if (sueldoImponibleMensual <= 0) {
    return { impuesto: 0, tramo: null };
  }

  for (const item of ESCALA_IMPUESTO_UNICO) {
    if (sueldoImponibleMensual <= item.hasta) {
      const factor = item.factor;
      const deduccion = item.deduccion;
      const impuesto = Math.max(0, (sueldoImponibleMensual * factor) - deduccion);

      return {
        impuesto: Math.round(impuesto),
        tramo: {
          tramo: item.tramo,
          rentaImponible: sueldoImponibleMensual,
          tasa: factor * 100,
          deduccion,
          impuestoCalculado: Math.round(impuesto),
          nombre: item.nombre,
        },
      };
    }
  }

  return { impuesto: 0, tramo: null };
};

/**
 * Calcula el impuesto único mensual (división del anual)
 */
export const calcularImpuestoMensual = (sueldoImponible: number): number => {
  const { impuesto } = calcularImpuestoUnico(sueldoImponible);
  return impuesto;
};

/**
 * Calcula el monto líquido desde el bruto para honorarios
 */
export const calcularHonorarios = (montoBruto: number): {
  retencion: number;
  liquido: number;
} => {
  const retencion = Math.round(montoBruto * (RETENCION_HONORARIOS.TASA_NORMA / 100));
  const liquido = montoBruto - retencion;
  return { retencion, liquido };
};

/**
 * Calcula el monto bruto desde el líquido para honorarios
 */
export const calcularHonorariosDesdeLiquido = (montoLiquido: number): {
  bruto: number;
  retencion: number;
} => {
  const bruto = Math.round(montoLiquido / (1 - RETENCION_HONORARIOS.TASA_NORMA / 100));
  const retencion = Math.round(bruto * (RETENCION_HONORARIOS.TASA_NORMA / 100));
  return { bruto, retencion };
};

// ============ CÁLCULO SUELDO LÍQUIDO COMPLETO ============

export interface CalculoSueldoLiquidoParams {
  sueldoBase: number;
  colacion: number;
  movilizacion: number;
  bonificacion: number;
  comisionAfp: number;
  tipoContrato: 'indefinido' | 'plazo' | 'honorarios';
  cargaCivil: number;
  cargaMilitar: number;
  /** Horas extraordinarias trabajadas en el período (máx. legal: 2/día, 10/semana) */
  horasExtras?: number;
  /**
   * Período de liquidación en formato 'YYYY-MM'.
   * Se usa para determinar: horas semanales vigentes (44h vs 42h) y tope de gratificación (IMM).
   * Si se omite se usan los valores vigentes (42h, IMM mayo 2026).
   */
  periodo?: string;
  /**
   * Horas semanales ordinarias del período (44, 42, 40...).
   * Si se omite, se determina automáticamente desde `periodo`.
   * Ley 21.561: 44h hasta mar-2026, 42h desde abr-2026, 40h desde abr-2028.
   */
  horasSemanales?: number;
  /**
   * Tope mensual de gratificación legal (4,75 IMM / 12).
   * Si se omite, se calcula automáticamente según el período.
   */
  topeGratificacion?: number;
  /**
   * Gratificación legal Art. 47 CT (imponible).
   * Si no se pasa, se calcula automáticamente:
   *   MIN((sueldoBase + bonificacion + HH.EE.) × 25%, topeGratificacion)
   */
  gratificacion?: number;
  /** Anticipos entregados al trabajador en el período (descuento del líquido). */
  anticipos?: number;
  /**
   * Si el trabajador está afiliado a una AFP (default: true).
   * false = Sin Afiliación AFP: el ahorro 10% y la comisión son $0.
   * El SIS del empleador también queda en $0 (no hay AFP que lo gestione).
   * La salud (7%) y la AFC siguen aplicando normalmente.
   */
  cotizaAfp?: boolean;
}

/**
 * Calcula el sueldo líquido completo con todas las cotizaciones.
 * Incluye cálculo de horas extraordinarias según Art. 32 Código del Trabajo:
 *   - Recargo mínimo 50% sobre el valor de la hora ordinaria
 *   - Límite legal: 2 horas/día y 10 horas/semana
 *   - Las horas extras son IMPONIBLES (Art. 16 DL 3500)
 */
export const calcularSueldoLiquido = (params: CalculoSueldoLiquidoParams): ResultadoSueldoLiquido => {
  const {
    sueldoBase,
    colacion,
    movilizacion,
    bonificacion,
    comisionAfp,
    tipoContrato,
    cargaCivil,
    cargaMilitar,
    horasExtras = 0,
    periodo,
    anticipos = 0,
    cotizaAfp = true,
  } = params;

  // ---- Horas semanales ordinarias (Ley 21.561) ----
  // Fórmula: horasSemanales × 30/7  (igual que Excel oficial PreviRed)
  // Ene–Mar 2026: 44h → 44×30/7 = 188,57 ≈ 189h
  // Abr 2026+:    42h → 42×30/7 = 180h
  const horasSemanalesVigentes = params.horasSemanales
    ?? (periodo ? getHorasSemanalesPorPeriodo(periodo) : 42);
  const horasOrdinariasMes = horasSemanalesVigentes * 30 / 7; // fórmula legal/Excel

  // ---- Horas extraordinarias Art. 32 CT: tasa 1,5× hora ordinaria (IMPONIBLE) ----
  // valorHora = sueldoBase × 28/(30 × horasSemanales × 4)  ← fórmula Excel oficial
  //           = sueldoBase / (horasSemanales × 30/7)
  const valorHoraNormal = sueldoBase > 0 && horasOrdinariasMes > 0
    ? sueldoBase / horasOrdinariasMes
    : 0;
  const montoHorasExtras = Math.round(horasExtras * valorHoraNormal * 1.5);

  // ---- Gratificación legal Art. 47 CT (IMPONIBLE) ----
  // Base = sueldoBase + bonificacion + HH.EE. (todos los haberes imponibles excepto gratificación)
  // Tope = 4,75 IMM / 12  (IMM es period-dependent: $529.000 hasta abr-2026, $539.000 desde may-2026)
  const TOPE_GRATIFICACION_MENSUAL = params.topeGratificacion
    ?? (periodo
      ? getTopeGratificacionMensual(periodo)
      : Math.round(SUELDO_MINIMO.GENERAL * 4.75 / 12));
  const gratificacionCalculada = Math.min(
    Math.round((sueldoBase + bonificacion + montoHorasExtras) * 0.25),
    TOPE_GRATIFICACION_MENSUAL
  );
  const gratificacion = params.gratificacion !== undefined
    ? params.gratificacion
    : gratificacionCalculada;

  // ---- HABERES IMPONIBLES ----
  // Sueldo Base + Gratificación + Bonificación + HH.EE.
  const totalImponible = sueldoBase + gratificacion + bonificacion + montoHorasExtras;

  // ---- HABERES NO IMPONIBLES ----
  // Coláción + Movilización (no afectos a cotizaciones)
  const totalHaberesNoImponibles = colacion + movilizacion;

  // ---- Total Haberes (lo que aparece en la liquidación) ----
  const totalHaberes = totalImponible + totalHaberesNoImponibles;

  // ---- Cotizaciones (calculadas SOLO sobre imponible) ----
  const cotizaciones = calcularCotizaciones(totalImponible, comisionAfp, tipoContrato, cotizaAfp);

  // ---- Renta imponible para Impuesto Único Art. 52 LIR ----
  // = Imponible - Cotizaciones
  const sueldoImponible = totalImponible - cotizaciones.totalCotizaciones;

  // ---- Asignación familiar ----
  const asignacionFamiliar = calcularAsignacionFamiliar(totalImponible, cargaCivil, cargaMilitar);

  // ---- Impuesto Único 2ª Categoría ----
  const { impuesto: impuestoUnico, tramo: detalleImpuesto } =
    calcularImpuestoUnico(sueldoImponible);

  // ---- Sueldo Líquido ----
  // Total Haberes - Cotizaciones - Impuesto Único - Anticipos + Asignación Familiar
  const sueldoLiquido = Math.round(
    totalHaberes
    - cotizaciones.totalCotizaciones
    - impuestoUnico
    - anticipos
    + asignacionFamiliar
  );

  // ---- Desglose ----
  const desglose: Array<{ concepto: string; monto: number; tipo: 'haber' | 'descuento' }> = [
    // Haberes imponibles
    { concepto: 'Sueldo Base (imponible)', monto: sueldoBase, tipo: 'haber' },
    { concepto: 'Gratificación Legal 25% (imponible)', monto: gratificacion, tipo: 'haber' },
    ...(bonificacion > 0 ? [{ concepto: 'Bonificación (imponible)', monto: bonificacion, tipo: 'haber' as const }] : []),
    ...(montoHorasExtras > 0 ? [{ concepto: `HH.EE. (${horasExtras}h × 1,5) imponible`, monto: montoHorasExtras, tipo: 'haber' as const }] : []),
    // Haberes no imponibles
    { concepto: 'Coláción (no imponible)', monto: colacion, tipo: 'haber' },
    { concepto: 'Movilización (no imponible)', monto: movilizacion, tipo: 'haber' },
    // Descuentos
    { concepto: `AFP (${(10 + comisionAfp).toFixed(2)}%)`, monto: cotizaciones.totalAfp, tipo: 'descuento' },
    { concepto: 'Salud (7%)', monto: cotizaciones.salud, tipo: 'descuento' },
    ...(cotizaciones.afc > 0 ? [{ concepto: 'AFC Cesantía', monto: cotizaciones.afc, tipo: 'descuento' as const }] : []),
    ...(asignacionFamiliar > 0 ? [{ concepto: 'Asignación Familiar', monto: asignacionFamiliar, tipo: 'haber' as const }] : []),
    { concepto: 'Impuesto Único 2ª Categoría', monto: impuestoUnico, tipo: 'descuento' },
    ...(anticipos > 0 ? [{ concepto: 'Anticipos', monto: anticipos, tipo: 'descuento' as const }] : []),
  ];

  return {
    sueldoBruto: sueldoBase,
    totalHaberes,
    totalHaberesNoImponibles,
    imponible: totalImponible,
    gratificacion,
    horasExtras,
    montoHorasExtras,
    cotizaciones: {
      afpAhorro: cotizaciones.afpAhorro,
      afpSis: cotizaciones.afpSis,
      afpComision: cotizaciones.afpComision,
      totalAfp: cotizaciones.totalAfp,
      salud: cotizaciones.salud,
      afc: cotizaciones.afc,
      total: cotizaciones.totalCotizaciones,
    },
    sueldoImponible: Math.round(sueldoImponible),
    asignacionFamiliar,
    impuestoUnico,
    detalleImpuesto,
    sueldoLiquido,
    desglose,
  };
};

/**
 * Calcula la asignación familiar según el tramo
 */
export const calcularAsignacionFamiliar = (
  sueldoImponible: number,
  cargaCivil: number,
  cargaMilitar: number
): number => {
  let montoUnitario = 0;

  if (sueldoImponible <= ASIGNACION_FAMILIAR.TRAMO_A.limite) {
    montoUnitario = ASIGNACION_FAMILIAR.MONTO_UNICO_A;
  } else if (sueldoImponible <= ASIGNACION_FAMILIAR.TRAMO_B.limite) {
    montoUnitario = ASIGNACION_FAMILIAR.MONTO_UNICO_B;
  } else if (sueldoImponible <= ASIGNACION_FAMILIAR.TRAMO_C.limite) {
    montoUnitario = ASIGNACION_FAMILIAR.MONTO_UNICO_C;
  }

  const totalCargas = cargaCivil + cargaMilitar;
  return montoUnitario * totalCargas;
};

// ============ UTILIDADES VARIAS ============

/**
 * Genera un ID único
 */
export const generateId = (): string => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch (e) {
    // Fallback silencioso
  }
  return Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 11);
};

/**
 * Obtiene las iniciales de un nombre
 */
export const getIniciales = (nombre: string): string => {
  return nombre
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

/**
 * Trunca un texto a una longitud máxima
 */
export const truncateText = (texto: string, maxLength: number): string => {
  if (texto.length <= maxLength) return texto;
  return `${texto.slice(0, maxLength)}...`;
};

/**
 * Convierte texto a slug (para URLs)
 */
export const toSlug = (texto: string): string => {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
};

/**
 * Calcula el dígito verificador de un número de documento
 */
export const calcularDV = (numero: string): string => {
  const nums = numero.split('').reverse().join('');
  const secuencia = [2, 3, 4, 5, 6, 7, 2, 3, 4, 5, 6, 7];

  let suma = 0;
  for (let i = 0; i < nums.length; i++) {
    suma += parseInt(nums[i]) * secuencia[i];
  }

  const resto = suma % 11;
  if (resto === 0) return '0';
  if (resto === 1) return 'K';
  return String(11 - resto);
};

/**
 * Genera número de folio para documentos
 */
export const generarFolio = (serie: string, numero: number): string => {
  return `${serie}-${numero.toString().padStart(6, '0')}`;
};

/**
 * Convierte un número a letras (pesos chilenos)
 */
export const numeroALetras = (num: number): string => {
  if (num === 0) return 'Cero Pesos';
  
  const unidades = ['', 'Un', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'Ocho', 'Nueve'];
  const decenas = ['Diez', 'Once', 'Doce', 'Trece', 'Catorce', 'Quince', 'Dieciseis', 'Diecisiete', 'Dieciocho', 'Diecinueve'];
  const decenas2 = ['', '', 'Veinte', 'Treinta', 'Cuarenta', 'Cincuenta', 'Sesenta', 'Setenta', 'Ochenta', 'Noventa'];
  const centenas = ['', 'Ciento', 'Doscientos', 'Trescientos', 'Cuatrocientos', 'Quinientos', 'Seiscientos', 'Setecientos', 'Ochocientos', 'Novecientos'];

  const getGrupo = (n: number): string => {
    let res = '';
    const c = Math.floor(n / 100);
    const r = n % 100;
    const d = Math.floor(r / 10);
    const u = r % 10;

    if (c === 1 && r === 0) res = 'Cien';
    else if (c > 0) res = centenas[c] + ' ';

    if (r >= 10 && r < 20) {
      res += decenas[r - 10];
    } else {
      if (d === 2 && u === 0) res += 'Veinte';
      else if (d === 2) res += 'Veinti' + unidades[u].toLowerCase();
      else if (d > 2) res += decenas2[d] + (u > 0 ? ' y ' + unidades[u] : '');
      else if (u > 0) res += unidades[u];
    }
    return res.trim();
  };

  let result = '';
  const millones = Math.floor(num / 1000000);
  const miles = Math.floor((num % 1000000) / 1000);
  const resto = num % 1000;

  if (millones > 0) {
    if (millones === 1) result += 'Un Millón ';
    else result += getGrupo(millones) + ' Millones ';
  }
  if (miles > 0) {
    if (miles === 1) result += 'Mil ';
    else result += getGrupo(miles) + ' Mil ';
  }
  if (resto > 0) {
    result += getGrupo(resto);
  }

  return result.trim() + ' Pesos.-';
};

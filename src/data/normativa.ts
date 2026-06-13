import type { Cuenta } from '../types';

// Constantes normativas chilenas para el sistema contable
// Actualizado según normativa vigente 2024-2025

// ============ MONEDA Y UNIDADES ============
export const MONEDA = {
  simbolo: '$',
  codigo: 'CLP',
  nombre: 'Peso Chileno',
  decimales: 0,
};

export const UTM_2026_MAYO = 70588;
export const UTA_2026_MAYO = 847056;
export const UF_2026_MAYO_REFERENCIAL = 40610.69; // UF al 31/05/2026 según PreviRed

// Alias legacy: el proyecto historicamente usaba "UIT"; en Chile corresponde UTM.
export const UIT_2024 = UTM_2026_MAYO;
export const UIT_2023 = 61764;

// ============ COTIZACIONES PREVISIONALES 2026 ============
// Fuente: Indicadores PreviRed publicados en previred.com
// Verificado con PDFs oficiales Enero–Mayo 2026
//
// comisionFija    = % comisión AFP que descuenta el trabajador (además del 10% ahorro)
// Total trabajador = 10% ahorro + comisionFija
// sisEmpleador    = tasa SIS vigente (cargo del empleador, cambia por período)
//                   Ene–Mar 2026: 1.54%  |  Abr–May 2026: 1.62% (Oficio 7429 del 14/04/2026)
export const AFP_DATA = [
  { id: 'afp_capital',   nombre: 'AFP Capital',       comisionFija: 1.44, comisionVariable: 1.44, sisEmpleador: 1.62, cotizaAfp: true  },
  { id: 'afp_cuprum',    nombre: 'AFP Cuprum',         comisionFija: 1.44, comisionVariable: 1.44, sisEmpleador: 1.62, cotizaAfp: true  },
  { id: 'afp_habitat',   nombre: 'AFP Hábitat',        comisionFija: 1.27, comisionVariable: 1.27, sisEmpleador: 1.62, cotizaAfp: true  },
  { id: 'afp_modelo',    nombre: 'AFP Modelo',         comisionFija: 0.58, comisionVariable: 0.58, sisEmpleador: 1.62, cotizaAfp: true  },
  { id: 'afp_planvital', nombre: 'AFP Planvital',      comisionFija: 1.16, comisionVariable: 1.16, sisEmpleador: 1.62, cotizaAfp: true  },
  { id: 'afp_provida',   nombre: 'AFP Provida',        comisionFija: 1.45, comisionVariable: 1.45, sisEmpleador: 1.62, cotizaAfp: true  },
  { id: 'afp_uno',       nombre: 'AFP Uno',            comisionFija: 0.46, comisionVariable: 0.46, sisEmpleador: 1.62, cotizaAfp: true  },
  { id: 'afp_ninguna',   nombre: 'Sin Afiliación AFP', comisionFija: 0,    comisionVariable: 0,    sisEmpleador: 0,    cotizaAfp: false },
];

// Cotizaciones vigentes 2026 según PreviRed
// SIS: 1.54% (Ene–Mar 2026) → 1.62% (Abr 2026+, Oficio Ordinario N° 7429)
export const COTIZACIONES = {
  AFP_PORCENTAJE: 10,     // 10% cotización legal ahorro individual (trabajador)
  SIS_EMPLEADOR: 1.62,   // SIS actual (Abr 2026+). Usar PreviRedService para valor por período.
  SIS_DEPENDIENTE: 0,    // Dependientes NO pagan SIS (empleador lo paga desde 2021)
  SIS_INDEPENDIENTE: 1.62, // Independientes pagan su propio SIS
  AFP_EMPLEADOR_ADICIONAL: 0.1, // Cotización adicional empleador al AFP (Ley reforma previsional 2026)
  SALUD_PORCENTAJE: 7,   // 7% cotización legal FONASA/ISAPRE (trabajador)
  // Seguro de Cesantía — Art. 5 Ley 19.728
  AFC_TRABAJADOR_INDEFINIDO: 0.6,  // % descuento al trabajador (indefinido)
  AFC_TRABAJADOR_PLAZO: 0.0,       // trabajador a plazo fijo no cotiza
  AFC_EMPLEADOR_INDEFINIDO: 2.4,   // % cargo empleador (indefinido)
  AFC_EMPLEADOR_PLAZO: 3.0,        // % cargo empleador (plazo fijo)
  // Legacy aliases (compatibilidad con calcularCotizaciones existente)
  AFC_DEPENDIENTE: 0.6,
  AFC_PLAZO: 0.0,
};

// ============ JORNADA LABORAL — Ley 21.561 ("Ley de las 40 Horas") ============
// Reducción gradual de la jornada máxima ordinaria (Art. 22 CT)
export const JORNADA_LABORAL = {
  // Horas semanales máximas vigentes (desde abril 2026)
  HORAS_SEMANA_VIGENTE: 42,
  // Horas mensuales usando fórmula legal: horasSemanales × 30/7
  // (Art. 32 CT y práctica PreviRed: 30 días/mes × 1/7 semana × horas)
  // 42 × 30/7 = 180h  ← vigente desde abril 2026
  HORAS_MES_VIGENTE: Math.round(42 * 30 / 7), // 180h
  // Calendario completo Ley 21.561
  ETAPAS: [
    { horas: 45, desde: '2000-01', hasta: '2026-03', descripcion: 'Antes de Ley 21.561 y período 44h' },
    { horas: 44, desde: '2024-04', hasta: '2026-03', descripcion: 'Vigente abril 2024 → marzo 2026' },
    { horas: 42, desde: '2026-04', hasta: '2028-03', descripcion: 'Vigente desde abril 2026 (Ley 21.561)' },
    { horas: 40, desde: '2028-04', hasta: '9999-12', descripcion: 'Vigente desde abril 2028' },
  ],
  // Horas mensuales por etapa usando fórmula 30/7 (igual que Excel oficial)
  HORAS_MES_POR_ETAPA: {
    h45: Math.round(45 * 30 / 7), // 193h
    h44: Math.round(44 * 30 / 7), // 189h
    h42: Math.round(42 * 30 / 7), // 180h  ← vigente desde abril 2026
    h40: Math.round(40 * 30 / 7), // 171h
  },
};

// ============ JORNADA SEMANAL POR PERÍODO (para cálculo de horas extra) ============
// Ley 21.561: 44h hasta marzo 2026 → 42h desde abril 2026 → 40h desde abril 2028
// Estas horas definen el valor de la hora ordinaria (base para HH.EE.)
export const HORAS_SEMANA_POR_PERIODO: Record<string, number> = {
  '2025-01': 44, '2025-02': 44, '2025-03': 44, '2025-04': 44,
  '2025-05': 44, '2025-06': 44, '2025-07': 44, '2025-08': 44,
  '2025-09': 44, '2025-10': 44, '2025-11': 44, '2025-12': 44,
  '2026-01': 44, '2026-02': 44, '2026-03': 44, // 44h hasta marzo 2026
  '2026-04': 42, '2026-05': 42, '2026-06': 42, '2026-07': 42,
  '2026-08': 42, '2026-09': 42, '2026-10': 42, '2026-11': 42, '2026-12': 42,
  '2027-01': 42, '2027-02': 42, '2027-03': 42, '2027-04': 42,
  '2027-05': 42, '2027-06': 42, '2027-07': 42, '2027-08': 42,
  '2027-09': 42, '2027-10': 42, '2027-11': 42, '2027-12': 42,
};

/** Retorna las horas semanales vigentes para un período YYYY-MM */
export function getHorasSemanalesPorPeriodo(periodo: string): number {
  return HORAS_SEMANA_POR_PERIODO[periodo] ?? 42;
}

// ============ IMM (INGRESO MÍNIMO MENSUAL) POR PERÍODO ============
// Base para el tope legal de gratificación (Art. 47 CT: 4,75 IMM / 12)
// IMM $529.000: vigente jul 2024 – abr 2026 (Ley 21.790 / Ley reajuste IMM)
// IMM $539.000: vigente desde may 2026
export const IMM_POR_PERIODO: Record<string, number> = {
  '2025-01': 529000, '2025-02': 529000, '2025-03': 529000, '2025-04': 529000,
  '2025-05': 529000, '2025-06': 529000, '2025-07': 529000, '2025-08': 529000,
  '2025-09': 529000, '2025-10': 529000, '2025-11': 529000, '2025-12': 529000,
  '2026-01': 529000, '2026-02': 529000, '2026-03': 529000, '2026-04': 529000,
  '2026-05': 539000, '2026-06': 539000, '2026-07': 539000, '2026-08': 539000,
  '2026-09': 539000, '2026-10': 539000, '2026-11': 539000, '2026-12': 539000,
};

/** Retorna el IMM vigente para un período YYYY-MM */
export function getIMMPorPeriodo(periodo: string): number {
  return IMM_POR_PERIODO[periodo] ?? SUELDO_MINIMO.GENERAL;
}

/** Retorna el tope legal de gratificación mensual para un período YYYY-MM (4,75 IMM / 12) */
export function getTopeGratificacionMensual(periodo: string): number {
  return Math.round(getIMMPorPeriodo(periodo) * 4.75 / 12);
}

// ============ SUELDO MÍNIMO 2026 ============
// Vigente desde julio 2025 según Ley 21.790
export const SUELDO_MINIMO = {
  GENERAL: 539000, // $539.000 (vigente mayo 2026)
  GENERAL_VIGENTE_DESDE: '2025-07-01',
  MENSUAL: 539000,
  // Valor hora: sueldo mínimo / horas mensuales de la jornada vigente (42h → 182h/mes)
  HORA: Math.round(539000 / JORNADA_LABORAL.HORAS_MES_VIGENTE), // → $2.962/h
};

// ============ ASIGNACIÓN FAMILIAR Mayo 2026 (SUF/UNIFAMILIAR) ============
// Fuente: PreviRed / Previred mayo 2026
export const ASIGNACION_FAMILIAR = {
  TRAMO_A: { limite: 631976,  monto: 22007 }, // Remuneración ≤ $631.976
  TRAMO_B: { limite: 923067,  monto: 13505 }, // Remuneración ≤ $923.067
  TRAMO_C: { limite: 1439668, monto: 4267  }, // Remuneración ≤ $1.439.668
  MONTO_UNICO_A: 22007,
  MONTO_UNICO_B: 13505,
  MONTO_UNICO_C: 4267,
};

// ============ ESCALA IMPUESTO ÚNICO DE 2DA CATEGORÍA 2024 ============
// Según Art. 52 LIR - Renta percibida
export const ESCALA_IMPUESTO_UNICO = [
  { tramo: 1, desde: 0, hasta: 13.5 * UTM_2026_MAYO, factor: 0, deduccion: 0, nombre: 'Exento' },
  { tramo: 2, desde: 13.5 * UTM_2026_MAYO, hasta: 30 * UTM_2026_MAYO, factor: 0.04, deduccion: 0.54 * UTM_2026_MAYO, nombre: '4%' },
  { tramo: 3, desde: 30 * UTM_2026_MAYO, hasta: 50 * UTM_2026_MAYO, factor: 0.08, deduccion: 1.74 * UTM_2026_MAYO, nombre: '8%' },
  { tramo: 4, desde: 50 * UTM_2026_MAYO, hasta: 70 * UTM_2026_MAYO, factor: 0.135, deduccion: 4.49 * UTM_2026_MAYO, nombre: '13,5%' },
  { tramo: 5, desde: 70 * UTM_2026_MAYO, hasta: 90 * UTM_2026_MAYO, factor: 0.23, deduccion: 11.14 * UTM_2026_MAYO, nombre: '23%' },
  { tramo: 6, desde: 90 * UTM_2026_MAYO, hasta: 120 * UTM_2026_MAYO, factor: 0.304, deduccion: 17.8 * UTM_2026_MAYO, nombre: '30,4%' },
  { tramo: 7, desde: 120 * UTM_2026_MAYO, hasta: 310 * UTM_2026_MAYO, factor: 0.35, deduccion: 23.3 * UTM_2026_MAYO, nombre: '35%' },
  { tramo: 8, desde: 310 * UTM_2026_MAYO, hasta: Infinity, factor: 0.40, deduccion: 38.8 * UTM_2026_MAYO, nombre: '40%' },
];

// ============ IVA ============
export const IVA = {
  TASA: 19, // 19% IVA general
  TASA_REDUCIDA: 0, // 0% exento
};

// ============ RETENCIÓN HONORARIOS ============
export const RETENCION_HONORARIOS = {
  TASA_ANTICIPADO: 15.25,
  TASA_NORMA: 15.25,
  VIGENTE_DESDE: '2026-01-01',
};

// ============ TIPO DE CAMBIO ============
export const TIPO_CAMBIO = {
  UF_VIGENTE: UF_2026_MAYO_REFERENCIAL,
  USD_VIGENTE: 902.81,
};

// ============ TOPES LEGALES Mayo 2026 ============
// Fuente: PreviRed mayo 2026
// Tope AFP/Salud: 90 UF (modificado por Ley 21.790)
// Tope AFC: 135,2 UF
const _UF = UF_2026_MAYO_REFERENCIAL;
export const TOPES_LEGALES = {
  // Tope imponible AFP y Salud: 90 UF × UF_mayo_2026
  COTIZACION_AFP_SALUD_MAX_UF: 90,
  COTIZACION_AFP_SALUD_MAX: Math.round(90 * _UF),     // $3.654.962
  // 7% del tope AFP = tope cotización salud
  COTIZACION_SALUD_MAX: Math.round(90 * _UF * 0.07),  // $255.847
  // Tope AFC: 135,2 UF × UF_mayo_2026
  COTIZACION_AFC_UF: 135.2,
  COTIZACION_AFC: Math.round(135.2 * _UF),            // $5.490.565
  SUELDO_BASE_AFC: 0, // sin tope inferior vigente
};

// ============ CUENTAS CONTABLES PREDETERMINADAS ============
export const PLAN_CUENTAS_DEFAULT: Cuenta[] = [
  {
    id: "1-01-001-0001",
    codigo: "1-01-001-0001",
    nombre: "Caja Moneda Nacional",
    tipo: "activo",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "1-01-001",
    permiteMovimiento: true,
    descripcion: "Efectivo en caja MN"
  },
  {
    id: "1-01-001-0002",
    codigo: "1-01-001-0002",
    nombre: "Caja Moneda Extranjera",
    tipo: "activo",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "1-01-001",
    permiteMovimiento: true,
    descripcion: "Efectivo en caja ME"
  },
  {
    id: "1-01-002-0001",
    codigo: "1-01-002-0001",
    nombre: "Banco Cuenta Corriente",
    tipo: "activo",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "1-01-002",
    permiteMovimiento: true
  },
  {
    id: "1-01-002-0002",
    codigo: "1-01-002-0002",
    nombre: "Banco Cuenta Ahorro",
    tipo: "activo",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "1-01-002",
    permiteMovimiento: true
  },
  {
    id: "1-01-003-0001",
    codigo: "1-01-003-0001",
    nombre: "Fondos por Rendir",
    tipo: "activo",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "1-01-003",
    permiteMovimiento: true,
    descripcion: "Anticipos a rendir cuentas"
  },
  {
    id: "1-02-001-0001",
    codigo: "1-02-001-0001",
    nombre: "Clientes (Deudores por Ventas)",
    tipo: "activo",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "1-02-001",
    permiteMovimiento: true,
    refSII: "DJ1887",
    descripcion: "Cuentas por cobrar clientes"
  },
  {
    id: "1-02-001-0002",
    codigo: "1-02-001-0002",
    nombre: "Documentos por Cobrar",
    tipo: "activo",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "1-02-001",
    permiteMovimiento: true,
    descripcion: "Letras y pagarés"
  },
  {
    id: "1-02-001-0003",
    codigo: "1-02-001-0003",
    nombre: "Deudores Varios",
    tipo: "activo",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "1-02-001",
    permiteMovimiento: true
  },
  {
    id: "1-02-001-0004",
    codigo: "1-02-001-0004",
    nombre: "Provisión Deudores Incobrables",
    tipo: "activo",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "1-02-001",
    permiteMovimiento: true,
    descripcion: "Estimación pérdida cartera"
  },
  {
    id: "1-02-002-0001",
    codigo: "1-02-002-0001",
    nombre: "IVA Crédito Fiscal",
    tipo: "activo",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "1-02-002",
    permiteMovimiento: true,
    refSII: "F29",
    descripcion: "IVA soportado en compras"
  },
  {
    id: "1-02-002-0002",
    codigo: "1-02-002-0002",
    nombre: "Pagos Provisionales Mensuales (PPM)",
    tipo: "activo",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "1-02-002",
    permiteMovimiento: true,
    refSII: "F29",
    descripcion: "PPM Art. 84 LIR"
  },
  {
    id: "1-02-002-0003",
    codigo: "1-02-002-0003",
    nombre: "Retenciones de Impuesto por Recuperar",
    tipo: "activo",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "1-02-002",
    permiteMovimiento: true
  },
  {
    id: "1-02-003-0001",
    codigo: "1-02-003-0001",
    nombre: "Existencias Mercaderías",
    tipo: "activo",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "1-02-003",
    permiteMovimiento: true,
    descripcion: "Inventario de bienes para venta"
  },
  {
    id: "1-02-003-0002",
    codigo: "1-02-003-0002",
    nombre: "Existencias Materias Primas",
    tipo: "activo",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "1-02-003",
    permiteMovimiento: true
  },
  {
    id: "1-02-003-0003",
    codigo: "1-02-003-0003",
    nombre: "Existencias Productos en Proceso",
    tipo: "activo",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "1-02-003",
    permiteMovimiento: true
  },
  {
    id: "1-02-003-0004",
    codigo: "1-02-003-0004",
    nombre: "Existencias Productos Terminados",
    tipo: "activo",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "1-02-003",
    permiteMovimiento: true
  },
  {
    id: "1-02-004-0001",
    codigo: "1-02-004-0001",
    nombre: "Gastos Pagados por Anticipado",
    tipo: "activo",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "1-02-004",
    permiteMovimiento: true,
    descripcion: "Seguros, arriendos anticipados"
  },
  {
    id: "1-02-005-0001",
    codigo: "1-02-005-0001",
    nombre: "Impuesto a la Renta por Recuperar",
    tipo: "activo",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "1-02-005",
    permiteMovimiento: true,
    refSII: "F22",
    descripcion: "IDPC a recuperar F22"
  },
  {
    id: "1-03-001-0001",
    codigo: "1-03-001-0001",
    nombre: "Terrenos",
    tipo: "activo",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "1-03-001",
    permiteMovimiento: true,
    descripcion: "No deprecia"
  },
  {
    id: "1-03-002-0001",
    codigo: "1-03-002-0001",
    nombre: "Construcciones e Instalaciones",
    tipo: "activo",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "1-03-002",
    permiteMovimiento: true
  },
  {
    id: "1-03-002-0002",
    codigo: "1-03-002-0002",
    nombre: "Dep. Acumulada Construcciones",
    tipo: "activo",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "1-03-002",
    permiteMovimiento: true
  },
  {
    id: "1-03-003-0001",
    codigo: "1-03-003-0001",
    nombre: "Maquinaria y Equipos",
    tipo: "activo",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "1-03-003",
    permiteMovimiento: true
  },
  {
    id: "1-03-003-0002",
    codigo: "1-03-003-0002",
    nombre: "Dep. Acumulada Maquinaria",
    tipo: "activo",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "1-03-003",
    permiteMovimiento: true
  },
  {
    id: "1-03-004-0001",
    codigo: "1-03-004-0001",
    nombre: "Vehículos y Equipos de Transporte",
    tipo: "activo",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "1-03-004",
    permiteMovimiento: true
  },
  {
    id: "1-03-004-0002",
    codigo: "1-03-004-0002",
    nombre: "Dep. Acumulada Vehículos",
    tipo: "activo",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "1-03-004",
    permiteMovimiento: true
  },
  {
    id: "1-03-005-0001",
    codigo: "1-03-005-0001",
    nombre: "Muebles y Útiles de Oficina",
    tipo: "activo",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "1-03-005",
    permiteMovimiento: true
  },
  {
    id: "1-03-005-0002",
    codigo: "1-03-005-0002",
    nombre: "Dep. Acumulada Muebles y Útiles",
    tipo: "activo",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "1-03-005",
    permiteMovimiento: true
  },
  {
    id: "1-03-006-0001",
    codigo: "1-03-006-0001",
    nombre: "Equipos Computacionales",
    tipo: "activo",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "1-03-006",
    permiteMovimiento: true
  },
  {
    id: "1-03-006-0002",
    codigo: "1-03-006-0002",
    nombre: "Depreciacion Acumulada",
    tipo: "activo",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "1-03-006",
    permiteMovimiento: true
  },
  {
    id: "1-04-001-0001",
    codigo: "1-04-001-0001",
    nombre: "Software y Licencias",
    tipo: "activo",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "1-04-001",
    permiteMovimiento: true,
    descripcion: "Activos intangibles"
  },
  {
    id: "1-04-001-0002",
    codigo: "1-04-001-0002",
    nombre: "Amortización Acumulada Software",
    tipo: "activo",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "1-04-001",
    permiteMovimiento: true
  },
  {
    id: "1-04-002-0001",
    codigo: "1-04-002-0001",
    nombre: "Garantia de arriendo",
    tipo: "activo",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "1-04-002",
    permiteMovimiento: true
  },
  {
    id: "1-04-003-0001",
    codigo: "1-04-003-0001",
    nombre: "Mayor Valor de Inversiones (Goodwill)",
    tipo: "activo",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "1-04-003",
    permiteMovimiento: true
  },
  {
    id: "2-01-001-0001",
    codigo: "2-01-001-0001",
    nombre: "Proveedores (Acreedores por Compras)",
    tipo: "pasivo",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "2-01-001",
    permiteMovimiento: true,
    refSII: "DJ1879",
    descripcion: "Cuentas por pagar proveedores"
  },
  {
    id: "2-01-001-0002",
    codigo: "2-01-001-0002",
    nombre: "Documentos por Pagar",
    tipo: "pasivo",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "2-01-001",
    permiteMovimiento: true,
    descripcion: "Letras y pagarés por pagar"
  },
  {
    id: "2-01-001-0003",
    codigo: "2-01-001-0003",
    nombre: "Honorarios por pagar",
    tipo: "pasivo",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "2-01-001",
    permiteMovimiento: true
  },
  {
    id: "2-01-002-0001",
    codigo: "2-01-002-0001",
    nombre: "IVA Débito Fiscal",
    tipo: "pasivo",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "2-01-002",
    permiteMovimiento: true,
    refSII: "F29",
    descripcion: "IVA recargado en ventas"
  },
  {
    id: "2-01-002-0002",
    codigo: "2-01-002-0002",
    nombre: "Postergacion IVA",
    tipo: "pasivo",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "2-01-002",
    permiteMovimiento: true,
    refSII: "F29",
    descripcion: "Resultado neto IVA"
  },
  {
    id: "2-01-002-0003",
    codigo: "2-01-002-0003",
    nombre: "Impuesto de Primera Categoría por Pagar",
    tipo: "pasivo",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "2-01-002",
    permiteMovimiento: true,
    refSII: "F22",
    descripcion: "IDPC"
  },
  {
    id: "2-01-002-0004",
    codigo: "2-01-002-0004",
    nombre: "IUSC por Pagar (Imp. 2ª Categoría)",
    tipo: "pasivo",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "2-01-002",
    permiteMovimiento: true,
    refSII: "LRE"
  },
  {
    id: "2-01-002-0005",
    codigo: "2-01-002-0005",
    nombre: "Impuesto retencion 2° categoria",
    tipo: "pasivo",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "2-01-002",
    permiteMovimiento: true,
    refSII: "F29",
    descripcion: "Ret. honorarios"
  },
  {
    id: "2-01-003-0001",
    codigo: "2-01-003-0001",
    nombre: "Remuneraciones por Pagar",
    tipo: "pasivo",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "2-01-003",
    permiteMovimiento: true,
    refSII: "LRE",
    descripcion: "Sueldos devengados no pagados"
  },
  {
    id: "2-01-003-0002",
    codigo: "2-01-003-0002",
    nombre: "Imposiciones por pagar",
    tipo: "pasivo",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "2-01-003",
    permiteMovimiento: true,
    descripcion: "Cotizaciones AFP pendientes"
  },
  {
    id: "2-01-003-0003",
    codigo: "2-01-003-0003",
    nombre: "Salud por Pagar (Fonasa/Isapre)",
    tipo: "pasivo",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "2-01-003",
    permiteMovimiento: true
  },
  {
    id: "2-01-003-0004",
    codigo: "2-01-003-0004",
    nombre: "Seguro Cesantía por Pagar",
    tipo: "pasivo",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "2-01-003",
    permiteMovimiento: true
  },
  {
    id: "2-01-003-0005",
    codigo: "2-01-003-0005",
    nombre: "Provisión Vacaciones",
    tipo: "pasivo",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "2-01-003",
    permiteMovimiento: true
  },
  {
    id: "2-01-003-0006",
    codigo: "2-01-003-0006",
    nombre: "Provisión Indemnización por Años de Servicio",
    tipo: "pasivo",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "2-01-003",
    permiteMovimiento: true
  },
  {
    id: "2-01-004-0001",
    codigo: "2-01-004-0001",
    nombre: "Préstamos Bancarios Corto Plazo",
    tipo: "pasivo",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "2-01-004",
    permiteMovimiento: true,
    descripcion: "Vencimiento < 1 año"
  },
  {
    id: "2-01-004-0002",
    codigo: "2-01-004-0002",
    nombre: "Porción Corriente Deuda Largo Plazo",
    tipo: "pasivo",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "2-01-004",
    permiteMovimiento: true
  },
  {
    id: "2-01-005-0001",
    codigo: "2-01-005-0001",
    nombre: "Ingresos Percibidos por Anticipado",
    tipo: "pasivo",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "2-01-005",
    permiteMovimiento: true
  },
  {
    id: "2-02-001-0001",
    codigo: "2-02-001-0001",
    nombre: "Préstamos Bancarios Largo Plazo",
    tipo: "pasivo",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "2-02-001",
    permiteMovimiento: true,
    descripcion: "Vencimiento > 1 año"
  },
  {
    id: "2-02-002-0001",
    codigo: "2-02-002-0001",
    nombre: "Impuesto Diferido Pasivo",
    tipo: "pasivo",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "2-02-002",
    permiteMovimiento: true,
    descripcion: "NIC 12"
  },
  {
    id: "3-01-001-0001",
    codigo: "3-01-001-0001",
    nombre: "Capital Pagado",
    tipo: "patrimonio",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "3-01-001",
    permiteMovimiento: true,
    refSII: "F22",
    descripcion: "Capital social efectivamente pagado"
  },
  {
    id: "3-01-001-0002",
    codigo: "3-01-001-0002",
    nombre: "Capital por Enterar",
    tipo: "patrimonio",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "3-01-001",
    permiteMovimiento: true,
    descripcion: "Capital suscrito no pagado"
  },
  {
    id: "3-01-002-0001",
    codigo: "3-01-002-0001",
    nombre: "Reservas de Revalorización",
    tipo: "patrimonio",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "3-01-002",
    permiteMovimiento: true,
    descripcion: "Corrección monetaria Art. 41 LIR"
  },
  {
    id: "3-01-003-0001",
    codigo: "3-01-003-0001",
    nombre: "Utilidades (perdida) Ejercicio",
    tipo: "patrimonio",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "3-01-003",
    permiteMovimiento: true,
    refSII: "F22",
    descripcion: "FUT / RAI acumulado"
  },
  {
    id: "3-01-003-0002",
    codigo: "3-01-003-0002",
    nombre: "Pérdidas Acumuladas",
    tipo: "patrimonio",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "3-01-003",
    permiteMovimiento: true
  },
  {
    id: "3-01-004-0001",
    codigo: "3-01-004-0001",
    nombre: "Utilidad del Ejercicio",
    tipo: "patrimonio",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "3-01-004",
    permiteMovimiento: true,
    refSII: "F22",
    descripcion: "Resultado positivo del período"
  },
  {
    id: "3-01-004-0002",
    codigo: "3-01-004-0002",
    nombre: "Pérdida del Ejercicio",
    tipo: "patrimonio",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "3-01-004",
    permiteMovimiento: true
  },
  {
    id: "3-01-005-0001",
    codigo: "3-01-005-0001",
    nombre: "Dividendos / Retiros Pagados",
    tipo: "patrimonio",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "3-01-005",
    permiteMovimiento: true,
    refSII: "DJ1879"
  },
  {
    id: "4-01-001-0001",
    codigo: "4-01-001-0001",
    nombre: "Ventas",
    tipo: "ingreso",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "4-01-001",
    permiteMovimiento: true,
    refSII: "F29",
    descripcion: "Ventas afectas IVA"
  },
  {
    id: "4-01-001-0002",
    codigo: "4-01-001-0002",
    nombre: "Ventas Exentas de IVA",
    tipo: "ingreso",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "4-01-001",
    permiteMovimiento: true,
    refSII: "F29",
    descripcion: "Ventas exentas"
  },
  {
    id: "4-01-001-0003",
    codigo: "4-01-001-0003",
    nombre: "Ventas No Afectas",
    tipo: "ingreso",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "4-01-001",
    permiteMovimiento: true,
    descripcion: "Ventas fuera del campo IVA"
  },
  {
    id: "4-01-002-0001",
    codigo: "4-01-002-0001",
    nombre: "Prestación de Servicios Afectos IVA",
    tipo: "ingreso",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "4-01-002",
    permiteMovimiento: true,
    refSII: "F29"
  },
  {
    id: "4-01-002-0002",
    codigo: "4-01-002-0002",
    nombre: "Prestación de Servicios Exentos",
    tipo: "ingreso",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "4-01-002",
    permiteMovimiento: true
  },
  {
    id: "4-01-003-0001",
    codigo: "4-01-003-0001",
    nombre: "Devoluciones y Descuentos sobre Ventas",
    tipo: "ingreso",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "4-01-003",
    permiteMovimiento: true,
    descripcion: "Nota de crédito emitida"
  },
  {
    id: "4-02-001-0001",
    codigo: "4-02-001-0001",
    nombre: "Ingresos Financieros (Intereses)",
    tipo: "ingreso",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "4-02-001",
    permiteMovimiento: true,
    refSII: "F22",
    descripcion: "Art. 20 N°2 LIR"
  },
  {
    id: "4-02-001-0002",
    codigo: "4-02-001-0002",
    nombre: "Dividendos Percibidos",
    tipo: "ingreso",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "4-02-001",
    permiteMovimiento: true,
    refSII: "F22",
    descripcion: "Art. 20 N°2 LIR"
  },
  {
    id: "4-02-002-0001",
    codigo: "4-02-002-0001",
    nombre: "Venta de Activo Fijo",
    tipo: "ingreso",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "4-02-002",
    permiteMovimiento: true
  },
  {
    id: "4-02-003-0001",
    codigo: "4-02-003-0001",
    nombre: "Otros Ingresos No Operacionales",
    tipo: "ingreso",
    naturaleza: "acreedora",
    nivel: 3,
    padreId: "4-02-003",
    permiteMovimiento: true
  },
  {
    id: "5-01-001-0001",
    codigo: "5-01-001-0001",
    nombre: "Costo de Ventas",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-01-001",
    permiteMovimiento: true,
    descripcion: "CMV — Art. 30 LIR"
  },
  {
    id: "5-01-001-0002",
    codigo: "5-01-001-0002",
    nombre: "Combustible",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-01-001",
    permiteMovimiento: true
  },
  {
    id: "5-01-001-0003",
    codigo: "5-01-001-0003",
    nombre: "Mantencion Vehiculos",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-01-001",
    permiteMovimiento: true
  },
  {
    id: "5-01-001-0004",
    codigo: "5-01-001-0004",
    nombre: "Envio mercaderia",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-01-001",
    permiteMovimiento: true
  },
  {
    id: "5-01-002-0001",
    codigo: "5-01-002-0001",
    nombre: "Gasto de administracion y venta",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-01-002",
    permiteMovimiento: true
  },
  {
    id: "5-01-002-0002",
    codigo: "5-01-002-0002",
    nombre: "Mantenciones",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-01-002",
    permiteMovimiento: true
  },
  {
    id: "5-01-002-0003",
    codigo: "5-01-002-0003",
    nombre: "Patente comercial",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-01-002",
    permiteMovimiento: true
  },
  {
    id: "5-01-002-0004",
    codigo: "5-01-002-0004",
    nombre: "Colacion",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-01-002",
    permiteMovimiento: true
  },
  {
    id: "5-01-002-0005",
    codigo: "5-01-002-0005",
    nombre: "Multas e intereses",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-01-002",
    permiteMovimiento: true
  },
  {
    id: "5-01-002-0006",
    codigo: "5-01-002-0006",
    nombre: "Costo venta AF",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-01-002",
    permiteMovimiento: true
  },
  {
    id: "5-02-001-0001",
    codigo: "5-02-001-0001",
    nombre: "Remuneraciones del Personal",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-02-001",
    permiteMovimiento: true,
    refSII: "LRE",
    descripcion: "Sueldos y salarios Art. 31 N°6"
  },
  {
    id: "5-02-001-0002",
    codigo: "5-02-001-0002",
    nombre: "Horas Extraordinarias",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-02-001",
    permiteMovimiento: true
  },
  {
    id: "5-02-001-0003",
    codigo: "5-02-001-0003",
    nombre: "Gratificaciones",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-02-001",
    permiteMovimiento: true,
    descripcion: "Art. 47/50 CT"
  },
  {
    id: "5-02-001-0004",
    codigo: "5-02-001-0004",
    nombre: "Honorarios a Terceros",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-02-001",
    permiteMovimiento: true,
    refSII: "DJ1879",
    descripcion: "Art. 31 N°12 LIR"
  },
  {
    id: "5-02-001-0005",
    codigo: "5-02-001-0005",
    nombre: "Finiquito",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-02-001",
    permiteMovimiento: true
  },
  {
    id: "5-02-002-0001",
    codigo: "5-02-002-0001",
    nombre: "Cotizaciones Previsionales Empleador",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-02-002",
    permiteMovimiento: true
  },
  {
    id: "5-02-002-0002",
    codigo: "5-02-002-0002",
    nombre: "Movilizacion y Peajes",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-02-002",
    permiteMovimiento: true
  },
  {
    id: "5-02-003-0001",
    codigo: "5-02-003-0001",
    nombre: "Arriendo de Inmuebles",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-02-003",
    permiteMovimiento: true,
    refSII: "DJ1887",
    descripcion: "Art. 31 N°11 LIR"
  },
  {
    id: "5-02-003-0002",
    codigo: "5-02-003-0002",
    nombre: "Gasto de representacion",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-02-003",
    permiteMovimiento: true
  },
  {
    id: "5-02-004-0001",
    codigo: "5-02-004-0001",
    nombre: "Energía Eléctrica",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-02-004",
    permiteMovimiento: true
  },
  {
    id: "5-02-004-0002",
    codigo: "5-02-004-0002",
    nombre: "Agua Potable",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-02-004",
    permiteMovimiento: true
  },
  {
    id: "5-02-004-0003",
    codigo: "5-02-004-0003",
    nombre: "Gas",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-02-004",
    permiteMovimiento: true
  },
  {
    id: "5-02-004-0004",
    codigo: "5-02-004-0004",
    nombre: "Telecomunicaciones e Internet",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-02-004",
    permiteMovimiento: true
  },
  {
    id: "5-02-005-0001",
    codigo: "5-02-005-0001",
    nombre: "Materiales y Suministros de Oficina",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-02-005",
    permiteMovimiento: true
  },
  {
    id: "5-02-005-0002",
    codigo: "5-02-005-0002",
    nombre: "Gastos de Aseo y Mantención",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-02-005",
    permiteMovimiento: true
  },
  {
    id: "5-02-005-0003",
    codigo: "5-02-005-0003",
    nombre: "Seguros",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-02-005",
    permiteMovimiento: true
  },
  {
    id: "5-02-005-0004",
    codigo: "5-02-005-0004",
    nombre: "Capacitación y Perfeccionamiento",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-02-005",
    permiteMovimiento: true,
    descripcion: "Franquicia SENCE"
  },
  {
    id: "5-02-005-0005",
    codigo: "5-02-005-0005",
    nombre: "Publicidad y Propaganda",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-02-005",
    permiteMovimiento: true
  },
  {
    id: "5-02-005-0006",
    codigo: "5-02-005-0006",
    nombre: "Software de gestion de flotas",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-02-005",
    permiteMovimiento: true,
    descripcion: "Art. 31 N°5 LIR"
  },
  {
    id: "5-02-005-0007",
    codigo: "5-02-005-0007",
    nombre: "Software GPS",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-02-005",
    permiteMovimiento: true
  },
  {
    id: "5-02-005-0008",
    codigo: "5-02-005-0008",
    nombre: "Software contable",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-02-005",
    permiteMovimiento: true
  },
  {
    id: "5-02-006-0001",
    codigo: "5-02-006-0001",
    nombre: "Depreciación del Ejercicio",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-02-006",
    permiteMovimiento: true,
    descripcion: "Art. 31 N°5 LIR"
  },
  {
    id: "5-02-006-0002",
    codigo: "5-02-006-0002",
    nombre: "Amortización de Intangibles",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-02-006",
    permiteMovimiento: true
  },
  {
    id: "5-02-006-0003",
    codigo: "5-02-006-0003",
    nombre: "CM PATRIMONIO",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-02-006",
    permiteMovimiento: true
  },
  {
    id: "5-02-006-0004",
    codigo: "5-02-006-0004",
    nombre: "CM AF",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-02-006",
    permiteMovimiento: true
  },
  {
    id: "5-02-006-0005",
    codigo: "5-02-006-0005",
    nombre: "Castigo de Activos",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-02-006",
    permiteMovimiento: true
  },
  {
    id: "5-03-001-0001",
    codigo: "5-03-001-0001",
    nombre: "Gastos Financieros (Intereses)",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-03-001",
    permiteMovimiento: true,
    descripcion: "Art. 31 N°1 LIR"
  },
  {
    id: "5-03-001-0002",
    codigo: "5-03-001-0002",
    nombre: "Comisiones Bancarias",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-03-001",
    permiteMovimiento: true
  },
  {
    id: "5-03-002-0001",
    codigo: "5-03-002-0001",
    nombre: "Pérdida en Venta de Activo Fijo",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-03-002",
    permiteMovimiento: true
  },
  {
    id: "5-03-002-0002",
    codigo: "5-03-002-0002",
    nombre: "Pérdidas por Siniestros",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-03-002",
    permiteMovimiento: true
  },
  {
    id: "5-03-003-0001",
    codigo: "5-03-003-0001",
    nombre: "Impuesto de Primera Categoría",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-03-003",
    permiteMovimiento: true,
    refSII: "F22",
    descripcion: "IDPC — Art. 20 LIR"
  },
  {
    id: "5-03-003-0002",
    codigo: "5-03-003-0002",
    nombre: "Gastos Rechazados Art. 21 LIR",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-03-003",
    permiteMovimiento: true,
    refSII: "F22",
    descripcion: "Gastos no aceptados trib."
  },
  {
    id: "5-03-004-0001",
    codigo: "5-03-004-0001",
    nombre: "Otros Gastos No Operacionales",
    tipo: "gasto",
    naturaleza: "deudora",
    nivel: 3,
    padreId: "5-03-004",
    permiteMovimiento: true
  }
];

// ============ ISAPRES POPULARES ============
export const ISAPRES = [
  { id: 'isapre_colmena', nombre: 'Isapre Colmena', tipo: 'abierta' },
  { id: 'isapre_cruz_blanca', nombre: 'Isapre Cruz Blanca', tipo: 'abierta' },
  { id: 'isapre_banmedica', nombre: 'Isapre Banmédica', tipo: 'abierta' },
  { id: 'isapre_vidaintegra', nombre: 'Isapre Vida Tres', tipo: 'abierta' },
  { id: 'isapre_consalud', nombre: 'Isapre Consalud', tipo: 'abierta' },
  { id: 'isapre_fundacion', nombre: 'Isapre Fundación', tipo: 'cerrada' },
  { id: 'isapre_chile', nombre: 'Isapre del Trabajador', tipo: 'cerrada' },
  { id: 'isapre_san_lorenzo', nombre: 'Isapre San Lorenzo', tipo: 'cerrada' },
  { id: 'isapre_futuro', nombre: 'Isapre Futuro', tipo: 'cerrada' },
  { id: 'fonasa', nombre: 'FONASA', tipo: 'publico' },
];

// ============ MESES DEL AÑO ============
export const MESES = [
  { numero: 1, nombre: 'Enero', short: 'Ene' },
  { numero: 2, nombre: 'Febrero', short: 'Feb' },
  { numero: 3, nombre: 'Marzo', short: 'Mar' },
  { numero: 4, nombre: 'Abril', short: 'Abr' },
  { numero: 5, nombre: 'Mayo', short: 'May' },
  { numero: 6, nombre: 'Junio', short: 'Jun' },
  { numero: 7, nombre: 'Julio', short: 'Jul' },
  { numero: 8, nombre: 'Agosto', short: 'Ago' },
  { numero: 9, nombre: 'Septiembre', short: 'Sep' },
  { numero: 10, nombre: 'Octubre', short: 'Oct' },
  { numero: 11, nombre: 'Noviembre', short: 'Nov' },
  { numero: 12, nombre: 'Diciembre', short: 'Dic' },
];

// ============ TIPO DE DOCUMENTOS SII ============
export const TIPOS_DOCUMENTO_SII = [
  { codigo: 'factura',           nombre: 'Factura',              descripcion: 'Documento que acredita venta de bienes o servicios', creditoFiscal: true  },
  { codigo: 'factura_exenta',    nombre: 'Factura Exenta',       descripcion: 'Ventas exentas de IVA', creditoFiscal: true  },
  { codigo: 'factura_compra',    nombre: 'Factura de Compra',    descripcion: 'Emitida por el comprador (cambio de sujeto)', creditoFiscal: true  },
  { codigo: 'boleta',            nombre: 'Boleta',               descripcion: 'Comprobante de venta para consumidores finales', creditoFiscal: false },
  { codigo: 'boleta_exenta',     nombre: 'Boleta Exenta',        descripcion: 'Boleta por ventas exentas de IVA', creditoFiscal: false },
  { codigo: 'boleta_electronica',nombre: 'Boleta Electrónica',   descripcion: 'Boleta emitida electrónicamente', creditoFiscal: false },
  { codigo: 'nota_credito',      nombre: 'Nota de Crédito',      descripcion: 'Rectifica documento anterior (descuento/devolución)', creditoFiscal: true  },
  { codigo: 'nota_debito',       nombre: 'Nota de Débito',       descripcion: 'Carga valores adicionales a documento anterior', creditoFiscal: true  },
  { codigo: 'guia_despacho',     nombre: 'Guía de Despacho',     descripcion: 'Documento de transporte de mercaderías', creditoFiscal: true  },
  { codigo: 'liquidacion',       nombre: 'Liquidación Factura',  descripcion: 'Liquidación de facturas entre partes', creditoFiscal: true  },
  { codigo: 'factura_exportacion',nombre:'Factura Exportación',  descripcion: 'Factura para operaciones de exportación', creditoFiscal: false },
];

// ============ CONDICIONES DE PAGO ============
export const CONDICIONES_PAGO = [
  { codigo: 'contado', nombre: 'Contado' },
  { codigo: 'credito_30', nombre: 'Crédito 30 días' },
  { codigo: 'credito_60', nombre: 'Crédito 60 días' },
  { codigo: 'credito_90', nombre: 'Crédito 90 días' },
  { codigo: 'ocompra', nombre: 'Aceptación O/C' },
];

// ============ REGIONES DE CHILE ============
export const REGIONES = [
  { codigo: 'RM', nombre: 'Región Metropolitana' },
  { codigo: 'I', nombre: 'Tarapacá' },
  { codigo: 'II', nombre: 'Antofagasta' },
  { codigo: 'III', nombre: 'Atacama' },
  { codigo: 'IV', nombre: 'Coquimbo' },
  { codigo: 'V', nombre: 'Valparaíso' },
  { codigo: 'VI', nombre: 'O Higgins' },
  { codigo: 'VII', nombre: 'Maule' },
  { codigo: 'VIII', nombre: 'Biobío' },
  { codigo: 'IX', nombre: 'Araucanía' },
  { codigo: 'X', nombre: 'Los Lagos' },
  { codigo: 'XI', nombre: 'Aysén' },
  { codigo: 'XII', nombre: 'Magallanes' },
  { codigo: 'XIV', nombre: 'Los Ríos' },
  { codigo: 'XV', nombre: 'Arica y Parinacota' },
];

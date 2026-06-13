// Servicio PreviRed — Indicadores previsionales por período (Ley 21.561 / PreviRed Chile)
// ============================================================
// FUENTE OFICIAL: Indicadores Previsionales PREVIRED (previred.com)
// PDFs verificados: Enero–Mayo 2026
// ============================================================

export interface TasaAFP {
  afp: string;
  tasaNominal: number;    // Tasa independiente (trabajador + SIS) — columna "Independiente"
  tasaReal: number;       // Cargo del trabajador dependiente (10% ahorro + comisión AFP)
  sis: number;            // Tasa SIS del período (cargo empleador)
  seguro: number;         // AFC trabajador indefinido (0.6%) — alias histórico
  total: number;          // = tasaNominal (alias)
  empleadorAdicional: number; // Cotización adicional empleador AFP (0.1% — reforma previsional 2026)
}

export interface ValorUF {
  fecha: string;
  valor: number;
  variacion: number;
}

export interface TablaImpositiva {
  tramo: number;
  desde: number;
  hasta: number;
  factor: number;
  descuento: number;
}

export interface DatosPreviRed {
  periodo: string;           // 'YYYY-MM'
  fechaActualizacion: string;
  mes: string;
  anio: number;
  uf: ValorUF;
  utm: number;
  tasasAFP: TasaAFP[];
  tablaImpositiva: TablaImpositiva[];
  rentaTopes: {
    imss: number;    // alias legacy = rentaTopes.afp
    afp: number;     // tope AFP/Salud en pesos
    seguro: number;  // tope Seguro Cesantía en pesos
  };
  // Nuevos campos por período
  sis: number;         // Tasa SIS vigente para el período
  topeUFafp: number;   // Tope imponible AFP en UF (89.9 en Ene, 90 desde Feb)
  topeUFseguro: number; // Tope imponible AFC en UF (135.1 Ene, 135.2 desde Feb)
  ufVerificada?: boolean;
}

// ============================================================
// TASAS AFP POR PERÍODO — Fuente: PDFs oficiales PreviRed 2026
// Columna "Cargo del Trabajador" (dependiente) = 10% ahorro + comisión AFP
// Columna "Cargo del Empleador" en la tabla AFP = 0.1% adicional (reforma previsional)
// SIS = cargo exclusivo del empleador (separado de la tabla AFP)
// ============================================================

// ── Enero 2026 ──
// SIS: 1.54%  |  Tope AFP: 89.9 UF  |  Tope AFC: 135.1 UF
// PlanVital: 11.18%, Uno: 10.45% (diferencia mínima vs resto del año)
const TASAS_AFP_ENE_2026 = (sis: number): TasaAFP[] => [
  { afp: 'AFP Capital',   tasaReal: 11.44, sis, tasaNominal: 11.44 + sis, seguro: 0.60, total: 11.44 + sis, empleadorAdicional: 0.1 },
  { afp: 'AFP Cuprum',    tasaReal: 11.44, sis, tasaNominal: 11.44 + sis, seguro: 0.60, total: 11.44 + sis, empleadorAdicional: 0.1 },
  { afp: 'AFP Hábitat',   tasaReal: 11.27, sis, tasaNominal: 11.27 + sis, seguro: 0.60, total: 11.27 + sis, empleadorAdicional: 0.1 },
  { afp: 'AFP Modelo',    tasaReal: 10.58, sis, tasaNominal: 10.58 + sis, seguro: 0.60, total: 10.58 + sis, empleadorAdicional: 0.1 },
  { afp: 'AFP PlanVital', tasaReal: 11.18, sis, tasaNominal: 11.18 + sis, seguro: 0.60, total: 11.18 + sis, empleadorAdicional: 0.1 },
  { afp: 'AFP ProVida',   tasaReal: 11.45, sis, tasaNominal: 11.45 + sis, seguro: 0.60, total: 11.45 + sis, empleadorAdicional: 0.1 },
  { afp: 'AFP Uno',       tasaReal: 10.45, sis, tasaNominal: 10.45 + sis, seguro: 0.60, total: 10.45 + sis, empleadorAdicional: 0.1 },
];

// ── Febrero en adelante ──
// PlanVital: 11.16% (bajó 0.02%), Uno: 10.46% (subió 0.01%)
const TASAS_AFP_FEB_PLUS = (sis: number): TasaAFP[] => [
  { afp: 'AFP Capital',   tasaReal: 11.44, sis, tasaNominal: 11.44 + sis, seguro: 0.60, total: 11.44 + sis, empleadorAdicional: 0.1 },
  { afp: 'AFP Cuprum',    tasaReal: 11.44, sis, tasaNominal: 11.44 + sis, seguro: 0.60, total: 11.44 + sis, empleadorAdicional: 0.1 },
  { afp: 'AFP Hábitat',   tasaReal: 11.27, sis, tasaNominal: 11.27 + sis, seguro: 0.60, total: 11.27 + sis, empleadorAdicional: 0.1 },
  { afp: 'AFP Modelo',    tasaReal: 10.58, sis, tasaNominal: 10.58 + sis, seguro: 0.60, total: 10.58 + sis, empleadorAdicional: 0.1 },
  { afp: 'AFP PlanVital', tasaReal: 11.16, sis, tasaNominal: 11.16 + sis, seguro: 0.60, total: 11.16 + sis, empleadorAdicional: 0.1 },
  { afp: 'AFP ProVida',   tasaReal: 11.45, sis, tasaNominal: 11.45 + sis, seguro: 0.60, total: 11.45 + sis, empleadorAdicional: 0.1 },
  { afp: 'AFP Uno',       tasaReal: 10.46, sis, tasaNominal: 10.46 + sis, seguro: 0.60, total: 10.46 + sis, empleadorAdicional: 0.1 },
];

// ============================================================
// INDICADORES POR MES — VERIFICADOS CON PDFs OFICIALES PreviRed 2026
// ============================================================
interface IndicadoresMes {
  uf: number;        // UF último día del mes
  utm: number;       // UTM vigente para el mes
  sis: number;       // Tasa SIS del período
  topeUFafp: number; // Tope imponible AFP en UF
  topeUFseguro: number; // Tope Seguro Cesantía en UF
  verificado: boolean;
  tasasFn: (sis: number) => TasaAFP[]; // función que genera las tasas AFP
}

const INDICADORES_2026: Record<string, IndicadoresMes> = {
  // ── Enero 2026 ── (PDF Indicadores PreviRed Enero 2026)
  // Tope AFP: 89.9 UF → $3.569.576 | Tope AFC: 135.1 UF → $5.364.290
  // SIS: 1.54%  |  UTM: $69.751
  '2026-01': { uf: 39706.07, utm: 69751, sis: 1.54, topeUFafp: 89.9, topeUFseguro: 135.1, verificado: true,  tasasFn: TASAS_AFP_ENE_2026  },
  // ── Febrero 2026 ── (PDF Indicadores PreviRed Febrero 2026)
  // Tope AFP: 90 UF → $3.581.157 | Tope AFC: 135.2 UF → $5.379.693
  // SIS: 1.54%  |  UTM: $69.611
  '2026-02': { uf: 39790.63, utm: 69611, sis: 1.54, topeUFafp: 90.0, topeUFseguro: 135.2, verificado: true,  tasasFn: TASAS_AFP_FEB_PLUS  },
  // ── Marzo 2026 ── (PDF Indicadores PreviRed Marzo 2026)
  // Tope AFP: 90 UF → $3.585.755 | Tope AFC: 135.2 UF → $5.386.601
  // SIS: 1.54%  |  UTM: $69.889
  '2026-03': { uf: 39841.72, utm: 69889, sis: 1.54, topeUFafp: 90.0, topeUFseguro: 135.2, verificado: true,  tasasFn: TASAS_AFP_FEB_PLUS  },
  // ── Abril 2026 ── (PDF Indicadores PreviRed Abril 2026)
  // SIS CAMBIA a 1.62% por Oficio Ordinario N° 7429 del 14/04/2026
  // Tope AFP: 90 UF → $3.610.818 | Tope AFC: 135.2 UF → $5.424.251
  // UTM: $69.889 (mismo que Marzo)
  '2026-04': { uf: 40120.20, utm: 69889, sis: 1.62, topeUFafp: 90.0, topeUFseguro: 135.2, verificado: true,  tasasFn: TASAS_AFP_FEB_PLUS  },
  // ── Mayo 2026 ── (PDF Indicadores PreviRed Mayo 2026)
  // Tope AFP: 90 UF → $3.654.962 | Tope AFC: 135.2 UF → $5.490.565
  // SIS: 1.62%  |  UTM: $70.588
  '2026-05': { uf: 40610.69, utm: 70588, sis: 1.62, topeUFafp: 90.0, topeUFseguro: 135.2, verificado: true,  tasasFn: TASAS_AFP_FEB_PLUS  },
  // ── Junio–Diciembre 2026 ── (proyectados — editar en Config. Sueldos cuando salga el PDF)
  '2026-06': { uf: 40900,    utm: 70588, sis: 1.62, topeUFafp: 90.0, topeUFseguro: 135.2, verificado: false, tasasFn: TASAS_AFP_FEB_PLUS  },
  '2026-07': { uf: 41200,    utm: 70588, sis: 1.62, topeUFafp: 90.0, topeUFseguro: 135.2, verificado: false, tasasFn: TASAS_AFP_FEB_PLUS  },
  '2026-08': { uf: 41500,    utm: 70588, sis: 1.62, topeUFafp: 90.0, topeUFseguro: 135.2, verificado: false, tasasFn: TASAS_AFP_FEB_PLUS  },
  '2026-09': { uf: 41800,    utm: 70588, sis: 1.62, topeUFafp: 90.0, topeUFseguro: 135.2, verificado: false, tasasFn: TASAS_AFP_FEB_PLUS  },
  '2026-10': { uf: 42100,    utm: 70588, sis: 1.62, topeUFafp: 90.0, topeUFseguro: 135.2, verificado: false, tasasFn: TASAS_AFP_FEB_PLUS  },
  '2026-11': { uf: 42400,    utm: 70588, sis: 1.62, topeUFafp: 90.0, topeUFseguro: 135.2, verificado: false, tasasFn: TASAS_AFP_FEB_PLUS  },
  '2026-12': { uf: 42700,    utm: 70588, sis: 1.62, topeUFafp: 90.0, topeUFseguro: 135.2, verificado: false, tasasFn: TASAS_AFP_FEB_PLUS  },
};

const NOMBRES_MES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

/** Genera la tabla IUSC 2da Categoría en base al UTM del período (Art. 52 LIR) */
function generarTablaImpositiva(utm: number): TablaImpositiva[] {
  return [
    { tramo: 1, desde: 0,           hasta: 13.5 * utm, factor: 0,     descuento: 0           },
    { tramo: 2, desde: 13.5 * utm,  hasta: 30   * utm, factor: 0.04,  descuento: 0.54  * utm },
    { tramo: 3, desde: 30   * utm,  hasta: 50   * utm, factor: 0.08,  descuento: 1.74  * utm },
    { tramo: 4, desde: 50   * utm,  hasta: 70   * utm, factor: 0.135, descuento: 4.49  * utm },
    { tramo: 5, desde: 70   * utm,  hasta: 90   * utm, factor: 0.23,  descuento: 11.14 * utm },
    { tramo: 6, desde: 90   * utm,  hasta: 120  * utm, factor: 0.304, descuento: 17.80 * utm },
    { tramo: 7, desde: 120  * utm,  hasta: 310  * utm, factor: 0.35,  descuento: 23.30 * utm },
    { tramo: 8, desde: 310  * utm,  hasta: 9e9,        factor: 0.40,  descuento: 38.80 * utm },
  ];
}

/** Construye DatosPreviRed para un período dado */
function crearDatosPeriodo(periodo: string): DatosPreviRed {
  const [anioStr, mesStr] = periodo.split('-');
  const anio   = parseInt(anioStr, 10);
  const mesNum = parseInt(mesStr, 10);

  // Indicadores base para el período (usa mes actual como fallback para períodos distintos de 2026)
  const ind: IndicadoresMes = INDICADORES_2026[periodo] ?? {
    uf: 40610.69, utm: 70588, sis: 1.62,
    topeUFafp: 90.0, topeUFseguro: 135.2,
    verificado: false, tasasFn: TASAS_AFP_FEB_PLUS,
  };

  const { uf, utm, sis, topeUFafp, topeUFseguro } = ind;
  const lastDay = new Date(anio, mesNum, 0).getDate();

  return {
    periodo,
    fechaActualizacion: `${periodo}-01`,
    mes: NOMBRES_MES[mesNum - 1],
    anio,
    uf: {
      fecha:     `${periodo}-${String(lastDay).padStart(2, '0')}`,
      valor:     uf,
      variacion: 0,
    },
    utm,
    tasasAFP: ind.tasasFn(sis),
    tablaImpositiva: generarTablaImpositiva(utm),
    rentaTopes: {
      imss:   Math.round(topeUFafp    * uf),
      afp:    Math.round(topeUFafp    * uf),
      seguro: Math.round(topeUFseguro * uf),
    },
    sis,
    topeUFafp,
    topeUFseguro,
    ufVerificada: ind.verificado,
  };
}

// Versión del dataset — incrementar para forzar migración en localStorage
// Cambio mayor: UF/UTM/SIS/AFP corregidos con PDFs oficiales PreviRed Ene–May 2026
const DATA_VERSION = '2026-05-16-v3';

export class PreviRedService {
  private static readonly BASE_KEY    = 'contable_previred';
  private static readonly VERSION_KEY = 'contable_previred_version';

  // ── Período actual ─────────────────────────────────────────────────────────

  private static keyPara(periodo: string) {
    return `${this.BASE_KEY}_${periodo}`;
  }

  /** Retorna datos para un período (carga desde localStorage o genera defaults) */
  static getDatosParaPeriodo(periodo: string): DatosPreviRed {
    const raw = localStorage.getItem(this.keyPara(periodo));
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as DatosPreviRed;
        // Asegurar que campos nuevos existan aunque el objeto venga de una versión anterior
        if (parsed.sis === undefined)          parsed.sis          = parsed.tasasAFP[0]?.sis ?? 1.62;
        if (parsed.topeUFafp === undefined)    parsed.topeUFafp    = 90.0;
        if (parsed.topeUFseguro === undefined) parsed.topeUFseguro = 135.2;
        return parsed;
      } catch { /* corrupt — fall through */ }
    }
    const datos = crearDatosPeriodo(periodo);
    this.guardarDatosParaPeriodo(datos, periodo);
    return datos;
  }

  /** Persiste datos de un período */
  static guardarDatosParaPeriodo(datos: DatosPreviRed, periodo: string): void {
    localStorage.setItem(this.keyPara(periodo), JSON.stringify({ ...datos, periodo }));
  }

  /** Resetea un período a los valores calculados (elimina edición manual) */
  static resetearPeriodo(periodo: string): DatosPreviRed {
    const datos = crearDatosPeriodo(periodo);
    this.guardarDatosParaPeriodo(datos, periodo);
    return datos;
  }

  // ── Listado de períodos ────────────────────────────────────────────────────

  static getPeriodosAnio(anio = 2026): string[] {
    return Array.from({ length: 12 }, (_, i) =>
      `${anio}-${String(i + 1).padStart(2, '0')}`
    );
  }

  static estaEditado(periodo: string): boolean {
    return localStorage.getItem(this.keyPara(periodo)) !== null;
  }

  /** Info de UF oficial para el período (valor y si está verificado) */
  static getUFInfo(periodo: string): { valor: number; verificado: boolean } {
    const ind = INDICADORES_2026[periodo];
    if (ind) return { valor: ind.uf, verificado: ind.verificado };
    return { valor: 40610.69, verificado: false };
  }

  /** Tasa SIS oficial para el período (antes de edición manual) */
  static getSISPorPeriodo(periodo: string): number {
    return INDICADORES_2026[periodo]?.sis ?? 1.62;
  }

  /**
   * Retorna los indicadores básicos para imprimir en una liquidación PDF.
   * Usa valores almacenados si existen (editados por el usuario), si no los oficiales.
   */
  static getIndicadoresPDF(periodo: string): {
    uf: number; utm: number; topeImponible: number; topeUFafp: number;
  } {
    const base = INDICADORES_2026[periodo] ?? {
      uf: 40610.69, utm: 70588, topeUFafp: 90.0,
    };
    // Intentar leer valores editados por el usuario
    try {
      const raw = localStorage.getItem(this.keyPara(periodo));
      if (raw) {
        const parsed = JSON.parse(raw);
        const uf   = parsed.uf  ?? base.uf;
        const utm  = parsed.utm ?? base.utm;
        const topeUFafp = parsed.topeUFafp ?? base.topeUFafp ?? 90.0;
        return { uf, utm, topeImponible: Math.round(topeUFafp * uf), topeUFafp };
      }
    } catch { /* usa base */ }
    const topeUFafp = (base as any).topeUFafp ?? 90.0;
    return {
      uf: base.uf,
      utm: base.utm,
      topeUFafp,
      topeImponible: Math.round(topeUFafp * base.uf),
    };
  }

  // ── Compatibilidad legacy ──────────────────────────────────────────────────

  /** @deprecated Usar getDatosParaPeriodo('2026-MM') */
  static getDatosActuales(): DatosPreviRed {
    return this.getDatosParaPeriodo('2026-05');
  }

  /** @deprecated Usar guardarDatosParaPeriodo */
  static guardarDatos(datos: DatosPreviRed): void {
    const periodo = datos.periodo ?? '2026-05';
    this.guardarDatosParaPeriodo(datos, periodo);
  }

  static getUltimaActualizacion(): string | null {
    return localStorage.getItem(`${this.BASE_KEY}_ultima`);
  }

  static necesitaActualizacion(): boolean {
    return false;
  }

  static getHistorialActualizaciones() {
    return this.getPeriodosAnio().map((p) => {
      const [, mesStr] = p.split('-');
      const ind = INDICADORES_2026[p];
      return {
        mes:    NOMBRES_MES[parseInt(mesStr, 10) - 1],
        anio:   2026,
        fecha:  p + '-01',
        estado: ind?.verificado ? 'verificado' : this.estaEditado(p) ? 'guardado' : 'default',
      };
    });
  }

  // Inicializar con migración de versión (fuerza recarga si cambia DATA_VERSION)
  static inicializar(): void {
    const version = localStorage.getItem(this.VERSION_KEY);
    if (version !== DATA_VERSION) {
      this.getPeriodosAnio().forEach((p) => {
        localStorage.removeItem(this.keyPara(p));
      });
      localStorage.removeItem(`${this.BASE_KEY}`); // clave legacy
      localStorage.setItem(this.VERSION_KEY, DATA_VERSION);
    }
  }

  // ── Utilidades AFP ─────────────────────────────────────────────────────────

  /** Tasas AFP del período actual (o mayo 2026 por defecto) */
  static getTasasAFP(periodo = '2026-05'): TasaAFP[] {
    return this.getDatosParaPeriodo(periodo).tasasAFP;
  }

  static getMejorAFP(periodo = '2026-05'): TasaAFP {
    return this.getTasasAFP(periodo).reduce((mejor, actual) =>
      actual.tasaReal < mejor.tasaReal ? actual : mejor
    );
  }

  static compararAFP(sueldoImponible: number, periodo = '2026-05'): {
    afp: string; cotizacionTotal: number; ahorroAnual: number;
  }[] {
    const datos = this.getDatosParaPeriodo(periodo);
    const tope  = datos.rentaTopes.afp;
    const imp   = Math.min(sueldoImponible, tope);
    const menores = datos.tasasAFP.map(t => ({
      afp: t.afp,
      cotizacionTotal: Math.round(imp * (t.tasaReal / 100)),
      ahorroAnual: 0,
    }));
    const menor = Math.min(...menores.map(m => m.cotizacionTotal));
    const mayor = Math.max(...menores.map(m => m.cotizacionTotal));
    menores.forEach(m => {
      m.ahorroAnual = Math.round((mayor - m.cotizacionTotal) * 12);
    });
    return menores.sort((a, b) => a.cotizacionTotal - b.cotizacionTotal);
  }

  static getListaAFP(): string[] {
    return TASAS_AFP_FEB_PLUS(1.62).map(t => t.afp);
  }

  /** Calcula cotización AFP para un imponible dado, buscando la AFP por nombre */
  static calcularCotizacionAFP(sueldoImponible: number, afpNombre: string, periodo = '2026-05') {
    const datos = this.getDatosParaPeriodo(periodo);
    const tasa  = datos.tasasAFP.find(t =>
      t.afp.replace(/\s+/g, '').toLowerCase() === afpNombre.replace(/\s+/g, '').toLowerCase()
    ) ?? datos.tasasAFP.find(t =>
      t.afp.toLowerCase().includes(afpNombre.split(' ').pop()?.toLowerCase() ?? '')
    ) ?? datos.tasasAFP[2]; // fallback AFP Hábitat

    const tope = datos.rentaTopes.afp;
    const imp  = Math.min(sueldoImponible, tope);
    const comision = tasa.tasaReal - 10.0; // comisión = total trabajador - 10% ahorro
    return {
      afp:           tasa.afp,
      imponible:     imp,
      cotizacionAFP: Math.round(imp * 0.10),     // 10% ahorro
      comision:      Math.round(imp * comision / 100),
      sis:           Math.round(imp * tasa.sis / 100), // cargo empleador
      total:         Math.round(imp * tasa.tasaReal / 100), // descuento trabajador
      tope,
    };
  }

  static exportarDatos(): string {
    return JSON.stringify(this.getDatosActuales());
  }
}

// Auto-inicializar al importar (limpia caché si cambia DATA_VERSION)
PreviRedService.inicializar();

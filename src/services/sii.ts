// Servicio de Integración con SII - Validación RUT, Tablas y Cálculos
import { validarRUT, formatRUT } from '../utils/calculos';
import { AFP_DATA, ASIGNACION_FAMILIAR, COTIZACIONES } from '../data/normativa';

// ============ TIPOS SII ============
export interface DatosRUT {
  rut: string;
  dv: string;
  digitoVerificador?: string;
  valido: boolean;
  empresa?: {
    razonSocial: string;
    giro: string;
    actividadEconomica: string;
    direcciones: string[];
  };
}

export interface TablaSII {
  id: string;
  nombre: string;
  fechaActualizacion: string;
  datos: Record<string, unknown>[];
}

export interface TablaUF {
  fecha: string;
  valor: number;
}

export interface TablaUTM {
  fecha: string;
  valor: number;
}

export interface TablaImpositiva {
  desde: number;
  hasta: number;
  factor: number;
  descuento: number;
  impuestoFijo?: number;
}

export interface TablaAFC {
  fecha: string;
  tasaMinima: number;
  tasaMaxima: number;
}

export interface ResolucionSII {
  numero: string;
  fecha: string;
  tipo: string;
  descripcion?: string;
  activa?: boolean;
  rangoDesde?: number;
  rangoHasta?: number;
  estado?: 'activa' | 'suspendida' | 'caducada';
}

// Tabla impositiva Art. 52 LIR — actualizar mensualmente desde mindicador.cl
const TABLA_IMPOSITIVA: TablaImpositiva[] = [
  { desde: 0,          hasta: 1104607.5,  factor: 0,     descuento: 0          },
  { desde: 1104607.5,  hasta: 1841012.5,  factor: 0.04,  descuento: 44184.3    },
  { desde: 1841012.5,  hasta: 2577417.5,  factor: 0.08,  descuento: 124890.5   },
  { desde: 2577417.5,  hasta: 3313822.5,  factor: 0.135, descuento: 248401.9   },
  { desde: 3313822.5,  hasta: 4050227.5,  factor: 0.23,  descuento: 347521.57  },
  { desde: 4050227.5,  hasta: 4786632.5,  factor: 0.304, descuento: 516774.32  },
  { desde: 4786632.5,  hasta: 5523037.5,  factor: 0.35,  descuento: 740432.24  },
  { desde: 5523037.5,  hasta: 6259442.5,  factor: 0.40,  descuento: 1000855.39 },
  { desde: 6259442.5,  hasta: 6995847.5,  factor: 0.44,  descuento: 1294419.39 },
  { desde: 6995847.5,  hasta: 999999999,  factor: 0.47,  descuento: 1613621.59 },
];

// Actualizar estos valores mensualmente (fuente: mindicador.cl)
const UF_ACTUAL = 40240.14;  // Mayo 2026, ultimo valor publicado consultado
const UTM_ACTUAL = 70588;    // Mayo 2026 SII
const UTM_ANTERIOR = 69889;  // Abril 2026 SII
const UF_ANTERIOR = 39841.72; // Abril 2026, referencia inicio de mes SII

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(value);
}

// ============ SERVICIO SII ============
export class SIIService {
  private static readonly ULTIMA_ACTUALIZACION_KEY = 'contable_sii_ultima_actualizacion';

  // ---- Validación RUT ----

  static validarRUT(rut: string): DatosRUT {
    const limpio = rut.replace(/[^0-9kK]/g, '');
    if (limpio.length < 2) return { rut, dv: '', valido: false };
    const numero = limpio.slice(0, -1);
    const dv = limpio.slice(-1).toUpperCase();
    const rutFormateado = formatRUT(`${numero}${dv}`);
    return { rut: rutFormateado, dv, digitoVerificador: dv, valido: validarRUT(rutFormateado) };
  }

  static async consultarRUT(rut: string): Promise<DatosRUT> {
    const datosBasicos = this.validarRUT(rut);
    if (!datosBasicos.valido) return datosBasicos;
    // En producción: llamada real a la API del SII
    return {
      ...datosBasicos,
      empresa: {
        razonSocial: `Empresa Demo ${rut.split('-')[0]}`,
        giro: 'Servicios de Consultoría en Sistemas',
        actividadEconomica: '620900 - Otros servicios de tecnología',
        direcciones: ['Av. Providencia 1234, Santiago'],
      },
    };
  }

  // ---- Valores indicadores ----

  static getUFActual(): number { return UF_ACTUAL; }
  static getUTMActual(): number { return UTM_ACTUAL; }

  static getVariacionUF(): number {
    return ((UF_ACTUAL - UF_ANTERIOR) / UF_ANTERIOR) * 100;
  }

  static getTablaImpositiva(): TablaImpositiva[] { return TABLA_IMPOSITIVA; }

  static descargarTablas(): {
    afp: typeof AFP_DATA;
    asignacionFamiliar: typeof ASIGNACION_FAMILIAR;
    cotizaciones: typeof COTIZACIONES;
    uf: { valor: number };
    utm: number;
    uta: number;
    sisa: number;
  } {
    return {
      afp: AFP_DATA,
      asignacionFamiliar: ASIGNACION_FAMILIAR,
      cotizaciones: COTIZACIONES,
      uf: { valor: UF_ACTUAL },
      utm: UTM_ACTUAL,
      uta: UTM_ACTUAL * 12,
      sisa: 0.03,
    };
  }

  // ---- Cálculos tributarios ----

  static calcularImpuestoUnico(sueldoBrutoAnual: number): {
    tasa: number;
    impuestoMensual: number;
    tramo: string;
  } {
    const sueldoMensual = sueldoBrutoAnual / 12;
    for (let i = TABLA_IMPOSITIVA.length - 1; i >= 0; i--) {
      const fila = TABLA_IMPOSITIVA[i];
      if (sueldoMensual >= fila.desde) {
        const impuestoMensual = sueldoMensual * fila.factor - fila.descuento;
        return {
          tasa: fila.factor * 100,
          impuestoMensual: Math.max(0, Math.round(impuestoMensual)),
          tramo: this.getTramoImpositivo(i),
        };
      }
    }
    return { tasa: 0, impuestoMensual: 0, tramo: 'Exento' };
  }

  private static getTramoImpositivo(index: number): string {
    const tramos = [
      'Exento',
      '2da Categoría (4%)',
      '2da Categoría (8%)',
      '2da Categoría (13.5%)',
      '2da Categoría (23%)',
      '2da Categoría (30.4%)',
      '2da Categoría (35%)',
      '2da Categoría (40%)',
      '2da Categoría (44%)',
      '2da Categoría (47%)',
    ];
    return tramos[index] ?? 'Desconocido';
  }

  static calcularPPM(rentaImponible: number): {
    ppmBasico: number;
    ppmAdicional: number;
    ppmTotal: number;
    porcentaje: number;
    monto: number;
  } {
    const ppmBasico = Math.round(rentaImponible * 0.01);
    const umbralAdicional = 480 * 1000;
    const ppmAdicional = rentaImponible > umbralAdicional
      ? Math.round(rentaImponible * 0.02)
      : 0;
    const ppmTotal = ppmBasico + ppmAdicional;
    return { ppmBasico, ppmAdicional, ppmTotal, porcentaje: 1, monto: ppmTotal };
  }

  // ---- Resoluciones ----

  static verificarResolucion(numero: string): ResolucionSII | null {
    const resoluciones: Record<string, ResolucionSII> = {
      '2869': {
        numero: '2869',
        fecha: '2024-01-30',
        tipo: 'DTE',
        descripcion: 'Autoriza emisión de documentos electrónicos',
        activa: true,
      },
      '20': {
        numero: '20',
        fecha: '2020-04-22',
        tipo: 'Renta',
        descripcion: 'Fija tasas de interés moratorio',
        activa: true,
      },
    };
    return resoluciones[numero] ?? null;
  }

  // ---- AFC ----

  static getTasasAFC(): { mutual: number; seguroLaboral: number } {
    return { mutual: 0.95, seguroLaboral: 0.28 };
  }

  // ---- Resúmenes ----

  static getResumenTablas(): {
    uf: { valor: number; variacion: number };
    utm: { valor: number; anterior: number };
    impuestoUnico: string;
    afc: { mutual: number; seguro: number };
  } {
    const afc = this.getTasasAFC();
    return {
      uf: { valor: UF_ACTUAL, variacion: this.getVariacionUF() },
      utm: { valor: UTM_ACTUAL, anterior: UTM_ANTERIOR },
      impuestoUnico: 'Artículo 52 LIR',
      afc: { mutual: afc.mutual, seguro: afc.seguroLaboral },
    };
  }

  // ---- Generación de archivos ----

  static generarArchivoLibro(datos: {
    tipo: 'ventas' | 'compras';
    periodo: string;
    registros: Array<{
      fecha: string;
      tipoDoc: string;
      numero: number;
      rut: string;
      razonSocial: string;
      exento: number;
      neto: number;
      iva: number;
      total: number;
    }>;
  }): string {
    const headers = ['Fecha', 'Tipo Doc', 'Número', 'RUT', 'Razón Social', 'Exento', 'Neto', 'IVA', 'Total'];
    const filas = datos.registros.map(r => [
      r.fecha, r.tipoDoc, r.numero.toString(), r.rut, r.razonSocial,
      r.exento.toString(), r.neto.toString(), r.iva.toString(), r.total.toString(),
    ]);
    return [
      `SII_${datos.tipo.toUpperCase()}_${datos.periodo}`,
      headers.join(';'),
      ...filas.map(f => f.join(';')),
      '',
      `Generado: ${new Date().toISOString()}`,
    ].join('\n');
  }

  static formatearF29(datos: {
    ventasNetas: number;
    comprasNetas: number;
    creditoFiscal: number;
    debitoFiscal: number;
    PPM: number;
  }): string {
    const { ventasNetas, comprasNetas, creditoFiscal, debitoFiscal, PPM } = datos;
    const ivaRecuperable = debitoFiscal - creditoFiscal;
    return `
=== DECLARACIÓN F29 ===

1. Ventas Netas (código 500):    ${formatCurrency(ventasNetas)}
2. Compras Netas (código 550):   ${formatCurrency(comprasNetas)}
3. Crédito Fiscal (código 560):  ${formatCurrency(creditoFiscal)}
4. Débito Fiscal (código 570):   ${formatCurrency(debitoFiscal)}

IVA DÉBITO FISCAL:               ${formatCurrency(debitoFiscal)}
IVA CRÉDITO FISCAL:              ${formatCurrency(creditoFiscal)}
IVA RECUPERABLE:                 ${formatCurrency(ivaRecuperable)}

PPM (1% ventas):                 ${formatCurrency(PPM)}

IMPUESTO A PAGAR:                ${formatCurrency(Math.max(0, ivaRecuperable))}
CRÉDITO FISCAL A FAVOR:          ${formatCurrency(Math.max(0, creditoFiscal - debitoFiscal))}
    `.trim();
  }

  // ---- Sincronización ----

  static guardarUltimaActualizacion(): void {
    localStorage.setItem(this.ULTIMA_ACTUALIZACION_KEY, new Date().toISOString());
  }

  static getUltimaActualizacion(): string | null {
    return localStorage.getItem(this.ULTIMA_ACTUALIZACION_KEY);
  }

  static generarReporteSincronizacion(): {
    fecha: string;
    estado: 'ok' | 'warning' | 'error';
    tablasActualizadas: string[];
    mensaje: string;
  } {
    const ultimaActualizacion = this.getUltimaActualizacion();
    const fecha = new Date();
    let estado: 'ok' | 'warning' | 'error' = 'ok';
    let mensaje = 'Todas las tablas están actualizadas';

    if (!ultimaActualizacion) {
      estado = 'warning';
      mensaje = 'Nunca se ha realizado una sincronización';
    } else {
      const diasDesde = Math.floor(
        (fecha.getTime() - new Date(ultimaActualizacion).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diasDesde > 7) {
        estado = 'warning';
        mensaje = `Última actualización hace ${diasDesde} días`;
      }
    }

    return {
      fecha: fecha.toISOString(),
      estado,
      tablasActualizadas: ['UF', 'UTM', 'Tabla Impositiva', 'AFC'],
      mensaje,
    };
  }

  static exportarDatos(): string {
    return JSON.stringify({
      tablas: this.getResumenTablas(),
      fechaActualizacion: this.getUltimaActualizacion(),
    });
  }
}

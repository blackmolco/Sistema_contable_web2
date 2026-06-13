// Tipos para Activos Fijos
export interface ActivoFijo {
  id: string;
  codigo: string;
  nombre: string;
  categoria: CategoriaActivo;
  fechaAdquisicion: string;
  valorOriginal: number;
  vidaUtilAnos: number;
  valorResidual: number;
  metodoDepreciacion: 'lineal' | 'acelerada' | 'sumaDigitos';
  estado: 'activo' | 'depreciado' | 'dadoBaja';
  observaciones?: string;
}

export type CategoriaActivo =
  | 'equiposComputacionales'
  | 'mobiliario'
  | 'vehiculos'
  | 'maquinaria'
  | 'construcciones'
  | 'terrenos'
  | 'software'
  | 'otros';

export interface Depreciacion {
  anio: number;
  valorInicial: number;
  depreciacionAnual: number;
  depreciacionAcumulada: number;
  valorFinal: number;
}

// Tabla de vidas útiles según SII
export const VIDAS_UTILES_SII: Record<CategoriaActivo, number> = {
  equiposComputacionales: 3,
  mobiliario: 5,
  vehiculos: 5,
  maquinaria: 10,
  construcciones: 20,
  terrenos: 0, // No se deprecia
  software: 4,
  otros: 10,
};

// Tabla de porcentaje máximo depreciación acelerada
export const TASAS_ACELERADA: Record<CategoriaActivo, { lineal: number; maxima: number }> = {
  equiposComputacionales: { lineal: 33.33, maxima: 33.33 },
  mobiliario: { lineal: 20, maxima: 40 },
  vehiculos: { lineal: 20, maxima: 40 },
  maquinaria: { lineal: 10, maxima: 30 },
  construcciones: { lineal: 5, maxima: 20 },
  terrenos: { lineal: 0, maxima: 0 },
  software: { lineal: 25, maxima: 40 },
  otros: { lineal: 10, maxima: 30 },
};

// Servicio de Activos Fijos
export class ActivosFijosService {

  // Calcular depreciación lineal
  static depreciacionLineal(activo: ActivoFijo): Depreciacion[] {
    const depreciaciones: Depreciacion[] = [];
    const valorDepreciable = activo.valorOriginal - activo.valorResidual;
    const depreciacionAnual = valorDepreciable / activo.vidaUtilAnos;
    let depreciacionAcumulada = 0;
    let valorInicial = activo.valorOriginal;

    const anioAdquisicion = new Date(activo.fechaAdquisicion).getFullYear();

    for (let i = 0; i < activo.vidaUtilAnos; i++) {
      depreciacionAcumulada += depreciacionAnual;
      depreciaciones.push({
        anio: anioAdquisicion + i + 1,
        valorInicial,
        depreciacionAnual,
        depreciacionAcumulada,
        valorFinal: activo.valorOriginal - depreciacionAcumulada,
      });
      valorInicial = activo.valorOriginal - depreciacionAcumulada;
    }

    return depreciaciones;
  }

  // Calcular depreciación acelerada
  static depreciacionAcelerada(activo: ActivoFijo): Depreciacion[] {
    const depreciaciones: Depreciacion[] = [];
    const valorDepreciable = activo.valorOriginal - activo.valorResidual;
    const tasa = TASAS_ACELERADA[activo.categoria];
    const depreciacionAnualMax = valorDepreciable * (tasa.maxima / 100);
    let depreciacionAcumulada = 0;
    let valorInicial = activo.valorOriginal;

    const anioAdquisicion = new Date(activo.fechaAdquisicion).getFullYear();

    for (let i = 0; i < activo.vidaUtilAnos; i++) {
      const factor = activo.vidaUtilAnos - i;
      const depreciacion = depreciacionAnualMax * (factor / activo.vidaUtilAnos);
      depreciacionAcumulada += depreciacion;

      depreciaciones.push({
        anio: anioAdquisicion + i + 1,
        valorInicial,
        depreciacionAnual: depreciacion,
        depreciacionAcumulada,
        valorFinal: activo.valorOriginal - depreciacionAcumulada,
      });

      valorInicial = activo.valorOriginal - depreciacionAcumulada;
    }

    return depreciaciones;
  }

  // Calcular depreciación por suma de dígitos
  static depreciacionSumaDigitos(activo: ActivoFijo): Depreciacion[] {
    const depreciaciones: Depreciacion[] = [];
    const valorDepreciable = activo.valorOriginal - activo.valorResidual;
    const n = activo.vidaUtilAnos;
    const sumaDigitos = (n * (n + 1)) / 2;
    let depreciacionAcumulada = 0;
    let valorInicial = activo.valorOriginal;

    const anioAdquisicion = new Date(activo.fechaAdquisicion).getFullYear();

    for (let i = 0; i < n; i++) {
      const digito = n - i;
      const depreciacion = valorDepreciable * (digito / sumaDigitos);
      depreciacionAcumulada += depreciacion;

      depreciaciones.push({
        anio: anioAdquisicion + i + 1,
        valorInicial,
        depreciacionAnual: depreciacion,
        depreciacionAcumulada,
        valorFinal: activo.valorOriginal - depreciacionAcumulada,
      });

      valorInicial = activo.valorOriginal - depreciacionAcumulada;
    }

    return depreciaciones;
  }

  // Calcular depreciación según método
  static calcularDepreciacion(activo: ActivoFijo): Depreciacion[] {
    switch (activo.metodoDepreciacion) {
      case 'lineal':
        return this.depreciacionLineal(activo);
      case 'acelerada':
        return this.depreciacionAcelerada(activo);
      case 'sumaDigitos':
        return this.depreciacionSumaDigitos(activo);
      default:
        return this.depreciacionLineal(activo);
    }
  }

  // Obtener valor actual de un activo
  static valorActual(activo: ActivoFijo, fecha: Date = new Date()): number {
    const depreciaciones = this.calcularDepreciacion(activo);
    const anioActual = fecha.getFullYear();
    const anioAdquisicion = new Date(activo.fechaAdquisicion).getFullYear();

    const depreciacion = depreciaciones.find(d => d.anio === anioActual);
    if (!depreciacion) {
      return activo.valorResidual;
    }

    return Math.max(depreciacion.valorFinal, activo.valorResidual);
  }

  // Obtener depreciación del año en curso
  static depreciacionAnualActual(activo: ActivoFijo, fecha: Date = new Date()): number {
    const depreciaciones = this.calcularDepreciacion(activo);
    const anioActual = fecha.getFullYear();

    const depreciacion = depreciaciones.find(d => d.anio === anioActual);
    return depreciacion?.depreciacionAnual || 0;
  }

  // Generar asientos de depreciación
  static generarAsientoDepreciacion(
    activos: ActivoFijo[],
    cuentaGasto: string,
    cuentaActivo: string,
    cuentaDepreciacion: string,
    fecha: Date
  ): { cuenta: string; debe: number; haber: number; glosa: string }[] {
    const detalles: { cuenta: string; debe: number; haber: number; glosa: string }[] = [];
    let totalDepreciacion = 0;

    activos.forEach(activo => {
      if (activo.estado !== 'activo') return;

      const depreciacion = this.depreciacionAnualActual(activo, fecha);
      if (depreciacion > 0) {
        detalles.push({
          cuenta: cuentaGasto,
          debe: depreciacion,
          haber: 0,
          glosa: `Depreciación ${activo.nombre} año ${fecha.getFullYear()}`,
        });
        detalles.push({
          cuenta: cuentaDepreciacion,
          debe: 0,
          haber: depreciacion,
          glosa: `Depreciación acumulada ${activo.nombre}`,
        });
        totalDepreciacion += depreciacion;
      }
    });

    return detalles;
  }

  // Calcular totales para balance
  static calcularTotales(activos: ActivoFijo[]): {
    totalValorOriginal: number;
    totalDepreciacionAcumulada: number;
    totalValorNeto: number;
    depreciacionAnual: number;
  } {
    const fechaActual = new Date();
    let totalValorOriginal = 0;
    let totalDepreciacionAcumulada = 0;
    let depreciacionAnual = 0;

    activos.forEach(activo => {
      if (activo.estado !== 'activo') return;

      const depreciaciones = this.calcularDepreciacion(activo);
      const depreciacionActual = depreciaciones.find(d => d.anio === fechaActual.getFullYear());

      totalValorOriginal += activo.valorOriginal;
      totalDepreciacionAcumulada += depreciacionActual?.depreciacionAcumulada || 0;
      depreciacionAnual += depreciacionActual?.depreciacionAnual || 0;
    });

    return {
      totalValorOriginal,
      totalDepreciacionAcumulada,
      totalValorNeto: totalValorOriginal - totalDepreciacionAcumulada,
      depreciacionAnual,
    };
  }

  // Obtener nombre de categoría
  static getNombreCategoria(categoria: CategoriaActivo): string {
    const nombres: Record<CategoriaActivo, string> = {
      equiposComputacionales: 'Equipos Computacionales',
      mobiliario: 'Mobiliario',
      vehiculos: 'Vehículos',
      maquinaria: 'Maquinaria',
      construcciones: 'Construcciones',
      terrenos: 'Terrenos',
      software: 'Software',
      otros: 'Otros',
    };
    return nombres[categoria];
  }
}
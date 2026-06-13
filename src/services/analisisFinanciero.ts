// Servicio de Análisis Financiero - Ratios e Indicadores

export interface AnalisisFinanciero {
  liquidez: {
    razonCorriente: number;
    pruebaAcida: number;
    capitalTrabajo: number;
    interpretacion: string;
  };
  rentabilidad: {
    margenBruto: number;
    margenOperacional: number;
    margenNeto: number;
    ROE: number;
    ROI: number;
    interpretacion: string;
  };
  endeuda: {
    razonEndeuda: number;
    razonDeudaPatrimonio: number;
    coberturaIntereses: number;
    interpretacion: string;
  };
  actividad: {
    rotacionInventarios: number;
    diasInventario: number;
    rotacionCuentasPorCobrar: number;
    diasCuentasPorCobrar: number;
    rotacionCuentasPorPagar: number;
    diasCuentasPorPagar: number;
    interpretacion: string;
  };
}

export interface IndicadorMensual {
  mes: string;
  ventas: number;
  costos: number;
  gastos: number;
  utilidad: number;
}

export interface Comparativa {
  periodo: string;
  valor: number;
  variacion: number;
  esMeta: boolean;
}

export class AnalisisFinancieroService {
  private static readonly STORAGE_KEY = 'contable_analisis';
  private static readonly INDICADORES_KEY = 'contable_indicadores';

  // Calcular análisis completo
  static calcularAnalisis(datos: {
    activoCorriente: number;
    pasivoCorriente: number;
    inventario: number;
    activoTotal: number;
    pasivoTotal: number;
    patrimonio: number;
    ventas: number;
    costoVentas: number;
    utilidadBruta: number;
    utilidadOperacional: number;
    utilidadNeta: number;
    gastosOperacionales: number;
    interesesDeuda: number;
    cuentasPorCobrar: number;
    cuentasPorPagar: number;
    costoInventario: number;
    duracionEjercicio?: number;
  }): AnalisisFinanciero {
    const {
      activoCorriente,
      pasivoCorriente,
      inventario,
      activoTotal,
      pasivoTotal,
      patrimonio,
      ventas,
      costoVentas,
      utilidadBruta,
      utilidadOperacional,
      utilidadNeta,
      gastosOperacionales,
      interesesDeuda,
      cuentasPorCobrar,
      cuentasPorPagar,
      costoInventario,
      duracionEjercicio = 365,
    } = datos;

    // Análisis de Liquidez
    const razonCorriente = activoCorriente / (pasivoCorriente || 1);
    const pruebaAcida = (activoCorriente - inventario) / (pasivoCorriente || 1);
    const capitalTrabajo = activoCorriente - pasivoCorriente;
    const liquidezInterpretacion = this.interpretarLiquidez(razonCorriente, pruebaAcida);

    // Análisis de Rentabilidad
    const margenBruto = (utilidadBruta / ventas) * 100 || 0;
    const margenOperacional = (utilidadOperacional / ventas) * 100 || 0;
    const margenNeto = (utilidadNeta / ventas) * 100 || 0;
    const ROE = (utilidadNeta / patrimonio) * 100 || 0;
    const ROI = (utilidadOperacional / activoTotal) * 100 || 0;
    const rentabilidadInterpretacion = this.interpretarRentabilidad(margenNeto, ROE);

    // Análisis de Endeudamiento
    const razonEndeuda = (pasivoTotal / activoTotal) * 100 || 0;
    const razonDeudaPatrimonio = pasivoTotal / (patrimonio || 1);
    const coberturaIntereses = utilidadOperacional / (interesesDeuda || 1);
    const endeudaInterpretacion = this.interpretarEndeudamiento(razonEndeuda, coberturaIntereses);

    // Análisis de Actividad
    const rotacionInventarios = costoInventario > 0 ? costoVentas / costoInventario : 0;
    const diasInventario = rotacionInventarios > 0 ? duracionEjercicio / rotacionInventarios : 0;
    const rotacionCuentasPorCobrar = ventas / (cuentasPorCobrar || 1);
    const diasCuentasPorCobrar = rotacionCuentasPorCobrar > 0 ? duracionEjercicio / rotacionCuentasPorCobrar : 0;
    const rotacionCuentasPorPagar = costoVentas / (cuentasPorPagar || 1);
    const diasCuentasPorPagar = rotacionCuentasPorPagar > 0 ? duracionEjercicio / rotacionCuentasPorPagar : 0;
    const actividadInterpretacion = this.interpretarActividad(diasInventario, diasCuentasPorCobrar, diasCuentasPorPagar);

    return {
      liquidez: {
        razonCorriente,
        pruebaAcida,
        capitalTrabajo,
        interpretacion: liquidezInterpretacion,
      },
      rentabilidad: {
        margenBruto,
        margenOperacional,
        margenNeto,
        ROE,
        ROI,
        interpretacion: rentabilidadInterpretacion,
      },
      endeuda: {
        razonEndeuda,
        razonDeudaPatrimonio,
        coberturaIntereses,
        interpretacion: endeudaInterpretacion,
      },
      actividad: {
        rotacionInventarios,
        diasInventario,
        rotacionCuentasPorCobrar,
        diasCuentasPorCobrar,
        rotacionCuentasPorPagar,
        diasCuentasPorPagar,
        interpretacion: actividadInterpretacion,
      },
    };
  }

  // Interpretar indicadores de liquidez
  private static interpretarLiquidez(razonCorriente: number, pruebaAcida: number): string {
    if (razonCorriente >= 2 && pruebaAcida >= 1) {
      return 'Excelente liquidez. La empresa puede cumplir sus obligaciones de corto plazo sin problemas.';
    } else if (razonCorriente >= 1.5 && pruebaAcida >= 0.8) {
      return 'Buena liquidez. La empresa tiene capacidad para enfrentar obligaciones de corto plazo.';
    } else if (razonCorriente >= 1 && pruebaAcida >= 0.5) {
      return 'Liquidez aceptable. Se recomienda monitorear la evolución de estos indicadores.';
    } else {
      return 'Liquidez comprometida. La empresa podría tener dificultades para cumplir obligaciones de corto plazo.';
    }
  }

  // Interpretar indicadores de rentabilidad
  private static interpretarRentabilidad(margenNeto: number, ROE: number): string {
    if (margenNeto >= 15 && ROE >= 20) {
      return 'Excelente rentabilidad. La empresa genera buenos retornos sobre la inversión.';
    } else if (margenNeto >= 8 && ROE >= 12) {
      return 'Buena rentabilidad. La empresa tiene un rendimiento adecuado.';
    } else if (margenNeto >= 3 && ROE >= 5) {
      return 'Rentabilidad moderada. Hay espacio para mejorar la eficiencia.';
    } else {
      return 'Rentabilidad baja. Se requiere analizar los costos y gastos para mejorar márgenes.';
    }
  }

  // Interpretar indicadores de endeudamiento
  private static interpretarEndeudamiento(razonEndeuda: number, coberturaIntereses: number): string {
    if (razonEndeuda <= 40 && coberturaIntereses >= 5) {
      return 'Nivel de endeudamiento saludable. La empresa tiene capacidad de asumir nueva deuda.';
    } else if (razonEndeuda <= 60 && coberturaIntereses >= 2) {
      return 'Endeudamiento moderado. Mantener vigilancia sobre la capacidad de pago.';
    } else if (razonEndeuda <= 80 && coberturaIntereses >= 1) {
      return 'Endeudamiento alto. Reducir deuda y aumentar cobertura de intereses.';
    } else {
      return 'Endeudamiento excesivo. Riesgo de insolvencia. Priorizar reducción de deuda.';
    }
  }

  // Interpretar indicadores de actividad
  private static interpretarActividad(diasInventario: number, diasCobrar: number, diasPagar: number): string {
    const cicloConversacion = diasInventario + diasCobrar;
    const cicloCaja = cicloConversacion - diasPagar;

    let interpretacion = `Ciclo de caja: ${Math.round(cicloCaja)} días. `;
    interpretacion += `La empresa tarda ${Math.round(diasInventario)} días en vender su inventario. `;
    interpretacion += `Cobra a ${Math.round(diasCobrar)} días y paga a ${Math.round(diasPagar)} días. `;

    if (cicloCaja <= 30) {
      interpretacion += 'Ciclo de caja eficiente.';
    } else if (cicloCaja <= 60) {
      interpretacion += 'Ciclo de caja normal.';
    } else {
      interpretacion += 'Ciclo de caja largo. Considerar negociar mejores condiciones de pago.';
    }

    return interpretacion;
  }

  // Guardar análisis en storage
  static guardarAnalisis(analisis: AnalisisFinanciero): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(analisis));
  }

  // Obtener último análisis guardado
  static getUltimoAnalisis(): AnalisisFinanciero | null {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return null;
  }

  // Generar indicadores mensuales
  static generarIndicadoresMensuales(datos: {
    ventas: number[];
    costos: number[];
    gastos: number[];
  }): IndicadorMensual[] {
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const indicadores: IndicadorMensual[] = [];

    for (let i = 0; i < Math.min(meses.length, datos.ventas.length); i++) {
      const ventas = datos.ventas[i] || 0;
      const costos = datos.costos[i] || 0;
      const gastos = datos.gastos[i] || 0;
      const utilidad = ventas - costos - gastos;

      indicadores.push({
        mes: meses[i],
        ventas,
        costos,
        gastos,
        utilidad,
      });
    }

    return indicadores;
  }

  // Comparar períodos
  static compararPeriodos(actual: number, anterior: number): {
    variacion: number;
    esPositiva: boolean;
    mensaje: string;
  } {
    const variacion = anterior > 0 ? ((actual - anterior) / anterior) * 100 : 0;
    const esPositiva = actual >= anterior;

    let mensaje = '';
    if (variacion > 20) {
      mensaje = `Aumento significativo (${variacion.toFixed(1)}%)`;
    } else if (variacion > 0) {
      mensaje = `Aumento moderado (${variacion.toFixed(1)}%)`;
    } else if (variacion === 0) {
      mensaje = 'Sin cambios';
    } else if (variacion > -20) {
      mensaje = `Disminución moderada (${variacion.toFixed(1)}%)`;
    } else {
      mensaje = `Disminución significativa (${variacion.toFixed(1)}%)`;
    }

    return { variacion, esPositiva, mensaje };
  }

  // Calcular tendencia
  static calcularTendencia(datos: number[]): 'subiendo' | 'bajando' | 'estable' {
    if (datos.length < 2) return 'estable';

    const primeros = datos.slice(0, Math.floor(datos.length / 2));
    const ultimos = datos.slice(Math.floor(datos.length / 2));

    const promedioPrimeros = primeros.reduce((a, b) => a + b, 0) / primeros.length;
    const promedioUltimos = ultimos.reduce((a, b) => a + b, 0) / ultimos.length;

    const diferencia = ((promedioUltimos - promedioPrimeros) / promedioPrimeros) * 100;

    if (diferencia > 5) return 'subiendo';
    if (diferencia < -5) return 'bajando';
    return 'estable';
  }

  // Exportar datos de análisis
  static exportarDatos(): string {
    return JSON.stringify({
      ultimoAnalisis: this.getUltimoAnalisis(),
      fecha: new Date().toISOString(),
    });
  }
}

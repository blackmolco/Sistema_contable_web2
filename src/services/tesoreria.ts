// Servicio de Predicción de Flujo de Caja con IA simulada
import { formatCurrency, getPeriodoActual } from '../utils/calculos';

// ============ TIPOS PARA TESORERÍA ============
export interface FlujoCaja {
  id: string;
  fecha: string;
  tipo: 'entrada' | 'salida';
  categoria: string;
  descripcion: string;
  monto: number;
  origen: 'factura' | 'honorario' | 'arriendo' | 'sueldo' | 'proveedor' | 'impuesto' | 'otro';
  estado: 'proyectado' | 'confirmado' | 'realizado';
}

export interface ProyeccionFlujo {
  dia?: number;
  fecha: string;
  saldo: number;
  entradas: number;
  salidas: number;
}

export interface AlertaTesoreria {
  id: string;
  tipo: 'warning' | 'danger' | 'info';
  mensaje: string;
  monto?: number;
  fecha?: string;
}

// ============ SERVICIO DE TESORERÍA ============
export class TesoreriaService {
  private static readonly FLUJO_KEY = 'contable_flujo_caja';
  private static readonly SALDO_KEY = 'contable_saldo_inicial';

  // Obtener flujo de caja
  static getFlujoCaja(): FlujoCaja[] {
    const data = localStorage.getItem(this.FLUJO_KEY);
    return data ? JSON.parse(data) : [];
  }

  // Agregar movimiento
  static agregarMovimiento(movimiento: Omit<FlujoCaja, 'id'>): FlujoCaja {
    const flujo = this.getFlujoCaja();
    const nuevo: FlujoCaja = {
      id: `flux_${Date.now()}`,
      ...movimiento,
    };
    flujo.push(nuevo);
    localStorage.setItem(this.FLUJO_KEY, JSON.stringify(flujo));
    return nuevo;
  }

  // Actualizar movimiento
  static actualizarMovimiento(id: string, datos: Partial<FlujoCaja>): FlujoCaja | null {
    const flujo = this.getFlujoCaja();
    const index = flujo.findIndex(f => f.id === id);
    if (index === -1) return null;

    flujo[index] = { ...flujo[index], ...datos };
    localStorage.setItem(this.FLUJO_KEY, JSON.stringify(flujo));
    return flujo[index];
  }

  // Eliminar movimiento
  static eliminarMovimiento(id: string): boolean {
    const flujo = this.getFlujoCaja();
    const filtered = flujo.filter(f => f.id !== id);
    if (filtered.length === flujo.length) return false;

    localStorage.setItem(this.FLUJO_KEY, JSON.stringify(filtered));
    return true;
  }

  // Obtener saldo actual
  static getSaldoInicial(): number {
    const saldo = localStorage.getItem(this.SALDO_KEY);
    return saldo ? parseFloat(saldo) : 5000000; // Default $5.000.000
  }

  // Establecer saldo inicial
  static setSaldoInicial(monto: number): void {
    localStorage.setItem(this.SALDO_KEY, monto.toString());
  }

  // Calcular saldo proyectado
  static calcularSaldoProyectado(fecha?: string): number {
    const flujo = this.getFlujoCaja();
    const saldoInicial = this.getSaldoInicial();
    const fechaLimite = fecha || new Date().toISOString();

    let saldo = saldoInicial;
    flujo
      .filter(f => f.estado !== 'realizado' && f.fecha <= fechaLimite)
      .forEach(f => {
        if (f.tipo === 'entrada') {
          saldo += f.monto;
        } else {
          saldo -= f.monto;
        }
      });

    return saldo;
  }

  // Proyeción de flujo de caja
  static proyectarFlujo(dias: number = 30): ProyeccionFlujo[] {
    const flujo = this.getFlujoCaja();
    const saldoInicial = this.getSaldoInicial();
    const proyecciones: ProyeccionFlujo[] = [];

    const hoy = new Date();

    // Calcular flujo base (ya confirmado)
    let saldo = saldoInicial;
    flujo
      .filter(f => f.fecha <= hoy.toISOString().split('T')[0] && f.estado === 'realizado')
      .forEach(f => {
        if (f.tipo === 'entrada') saldo += f.monto;
        else saldo -= f.monto;
      });

    // Generar proyecciones día a día
    for (let i = 0; i <= dias; i++) {
      const fechaProyeccion = new Date(hoy);
      fechaProyeccion.setDate(fechaProyeccion.getDate() + i);
      const fechaStr = fechaProyeccion.toISOString().split('T')[0];

      const entradasDia = flujo
        .filter(f => f.fecha === fechaStr && f.tipo === 'entrada')
        .reduce((sum, f) => sum + f.monto, 0);

      const salidasDia = flujo
        .filter(f => f.fecha === fechaStr && f.tipo === 'salida')
        .reduce((sum, f) => sum + f.monto, 0);

      saldo += entradasDia;
      saldo -= salidasDia;

      proyecciones.push({
        fecha: fechaStr,
        saldo,
        entradas: entradasDia,
        salidas: salidasDia,
      });
    }

    return proyecciones;
  }

  // Generar predicciones con IA (simulada)
  static predecirFlujoFuturo(meses: number = 3): ProyeccionFlujo[] {
    const flujo = this.getFlujoCaja();
    const saldoActual = this.calcularSaldoProyectado();

    // Calcular patrones históricos
    const entradasPromedio = this.calcularPromedioEntradas();
    const salidasPromedio = this.calcularPromedioSalidas();

    // Agregar variación estacional simulada
    const predicciones: ProyeccionFlujo[] = [];
    const hoy = new Date();
    let saldoProyectado = saldoActual;

    for (let mes = 0; mes < meses; mes++) {
      for (let dia = 1; dia <= 30; dia++) {
        const fecha = new Date(hoy.getFullYear(), hoy.getMonth() + mes, dia);
        const fechaStr = fecha.toISOString().split('T')[0];

        // Simular predicción con variación
        const variacionEntradas = 0.9 + Math.random() * 0.2; // 90% - 110%
        const variacionSalidas = 0.95 + Math.random() * 0.1; // 95% - 105%

        const entradas = Math.round(entradasPromedio * variacionEntradas);
        const salidas = Math.round(salidasPromedio * variacionSalidas);

        saldoProyectado += entradas - salidas;

        predicciones.push({
          fecha: fechaStr,
          saldo: saldoProyectado,
          entradas,
          salidas,
        });
      }
    }

    return predicciones;
  }

  private static calcularPromedioEntradas(): number {
    const flujo = this.getFlujoCaja();
    const entradas = flujo.filter(f => f.tipo === 'entrada');
    if (entradas.length === 0) return 500000; // Default

    return entradas.reduce((sum, f) => sum + f.monto, 0) / entradas.length;
  }

  private static calcularPromedioSalidas(): number {
    const flujo = this.getFlujoCaja();
    const salidas = flujo.filter(f => f.tipo === 'salida');
    if (salidas.length === 0) return 400000; // Default

    return salidas.reduce((sum, f) => sum + f.monto, 0) / salidas.length;
  }

  // Detectar anomalías
  static detectarAnomalias(): AlertaTesoreria[] {
    const alertas: AlertaTesoreria[] = [];
    const flujo = this.getFlujoCaja();
    const saldoProyectado = this.calcularSaldoProyectado();

    // Saldo negativo
    if (saldoProyectado < 0) {
      alertas.push({
        id: 'alert_saldo_negativo',
        tipo: 'danger',
        mensaje: '⚠️ Alerta: Saldo proyectado negativo',
        monto: saldoProyectado,
      });
    }

    // Saldo bajo
    if (saldoProyectado > 0 && saldoProyectado < 1000000) {
      alertas.push({
        id: 'alert_saldo_bajo',
        tipo: 'warning',
        mensaje: '⚠️ Saldo bajo, considerar ingresos adicionales',
        monto: saldoProyectado,
      });
    }

    // Pagos próximos
    const proximosPagos = flujo.filter(f => {
      const fechaPago = new Date(f.fecha);
      const hoy = new Date();
      const diffDias = Math.ceil((fechaPago.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
      return f.tipo === 'salida' && f.estado !== 'realizado' && diffDias <= 7 && diffDias >= 0;
    });

    if (proximosPagos.length > 0) {
      const totalProximos = proximosPagos.reduce((sum, f) => sum + f.monto, 0);
      alertas.push({
        id: 'alert_pagos_proximos',
        tipo: 'warning',
        mensaje: `📅 ${proximosPagos.length} pagos programados esta semana`,
        monto: totalProximos,
      });
    }

    // Impuestos pendientes
    const impuestosPendientes = flujo.filter(f =>
      f.origen === 'impuesto' && f.estado !== 'realizado'
    );

    if (impuestosPendientes.length > 0) {
      alertas.push({
        id: 'alert_impuestos',
        tipo: 'info',
        mensaje: `📋 ${impuestosPendientes.length} obligaciones tributarias pendientes`,
      });
    }

    return alertas;
  }

  // Sugerencias de optimización
  static obtenerSugerencias(): string[] {
    const sugerencias: string[] = [];
    const flujo = this.getFlujoCaja();
    const saldo = this.calcularSaldoProyectado();

    // Analizar patrones de pago
    const facturas = flujo.filter(f => f.origen === 'factura' && f.tipo === 'entrada');
    const facturasVencidas = facturas.filter(f => {
      const fechaVencimiento = new Date(f.fecha);
      fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);
      return fechaVencimiento < new Date() && f.estado !== 'realizado';
    });

    if (facturasVencidas.length > 0) {
      sugerencias.push(`💰 Recuperar ${facturasVencidas.length} facturas pendientes por ${formatCurrency(facturasVencidas.reduce((s, f) => s + f.monto, 0))}`);
    }

    // Analizar gastos fijos
    const gastosFijos = flujo.filter(f =>
      ['arriendo', 'sueldo'].includes(f.origen) && f.tipo === 'salida'
    );

    if (gastosFijos.length > 0) {
      const totalGastosFijos = gastosFijos.reduce((s, f) => s + f.monto, 0);
      sugerencias.push(`📊 Gastos fijos mensuales: ${formatCurrency(totalGastosFijos)}`);
    }

    // Liquidez
    if (saldo < 2000000) {
      sugerencias.push('⚠️ Considerar línea de crédito para mantener liquidez');
    }

    if (saldo > 10000000) {
      sugerencias.push('💡 Exceso de liquidez: Evaluar inversiones a corto plazo');
    }

    return sugerencias;
  }
}

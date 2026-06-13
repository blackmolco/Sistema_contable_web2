// Servicio de Notificaciones en Tiempo Real

export type TipoNotificacion =
  | 'info'
  | 'warning'
  | 'success'
  | 'error'
  | 'vencimiento'
  | 'conciliacion'
  | 'sii';

export interface Notificacion {
  id: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  fecha: Date;
  leida: boolean;
  accion?: string;
  datos?: Record<string, unknown>;
}

export interface AlertaVencimiento {
  tipo: 'factura' | 'remuneracion' | 'impuesto';
  diasRestantes: number;
  descripcion: string;
}

export class NotificacionesService {
  private static readonly STORAGE_KEY = 'contable_notificaciones';
  private static readonly ULTIMA_NOTIFICACION_KEY = 'contable_ultima_notificacion';

  // Tipos de notificaciones predefinidas
  private static getNotificacionesPredeterminadas(): Notificacion[] {
    const ahora = new Date();

    return [
      {
        id: 'notif_001',
        tipo: 'info',
        titulo: 'Bienvenido al Sistema',
        mensaje: 'Su sistema contable está configurado y listo para usar.',
        fecha: ahora,
        leida: false,
      },
      {
        id: 'notif_002',
        tipo: 'sii',
        titulo: 'Tablas SII Actualizadas',
        mensaje: 'UF a $37,233.07 - UTM a $63,359 (Mayo 2026)',
        fecha: new Date(ahora.getTime() - 86400000),
        leida: true,
        accion: 'ver_tablas',
      },
      {
        id: 'notif_003',
        tipo: 'warning',
        titulo: 'Revisión Pendiente',
        mensaje: 'Hay 3 conciliaciones bancarias pendientes de revisar.',
        fecha: new Date(ahora.getTime() - 172800000),
        leida: true,
        accion: 'ver_conciliaciones',
      },
    ];
  }

  // Obtener todas las notificaciones
  static getNotificaciones(): Notificacion[] {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      const notificaciones = JSON.parse(stored);
      // Convertir fechas strings a objetos Date
      return notificaciones.map((n: Notificacion) => ({
        ...n,
        fecha: new Date(n.fecha),
      }));
    }

    const predeterminadas = this.getNotificacionesPredeterminadas();
    this.guardarNotificaciones(predeterminadas);
    return predeterminadas;
  }

  // Guardar notificaciones
  private static guardarNotificaciones(notificaciones: Notificacion[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(notificaciones));
  }

  // Agregar nueva notificación
  static agregarNotificacion(notificacion: Omit<Notificacion, 'id' | 'fecha' | 'leida'>): Notificacion {
    const notificaciones = this.getNotificaciones();

    const nueva: Notificacion = {
      ...notificacion,
      id: `notif_${Date.now()}`,
      fecha: new Date(),
      leida: false,
    };

    notificaciones.unshift(nueva);

    // Mantener solo las últimas 50 notificaciones
    if (notificaciones.length > 50) {
      notificaciones.splice(50);
    }

    this.guardarNotificaciones(notificaciones);
    this.guardarUltimaNotificacion(nueva);

    return nueva;
  }

  // Marcar notificación como leída
  static marcarComoLeida(id: string): void {
    const notificaciones = this.getNotificaciones();
    const index = notificaciones.findIndex(n => n.id === id);

    if (index !== -1) {
      notificaciones[index].leida = true;
      this.guardarNotificaciones(notificaciones);
    }
  }

  // Marcar todas como leídas
  static marcarTodasComoLeidas(): void {
    const notificaciones = this.getNotificaciones();
    notificaciones.forEach(n => n.leida = true);
    this.guardarNotificaciones(notificaciones);
  }

  // Eliminar notificación
  static eliminarNotificacion(id: string): void {
    const notificaciones = this.getNotificaciones();
    const filtered = notificaciones.filter(n => n.id !== id);
    this.guardarNotificaciones(filtered);
  }

  // Obtener notificaciones no leídas
  static getNotificacionesNoLeidas(): Notificacion[] {
    return this.getNotificaciones().filter(n => !n.leida);
  }

  // Contar notificaciones no leídas
  static getCantidadNoLeidas(): number {
    return this.getNotificacionesNoLeidas().length;
  }

  // Guardar última notificación
  private static guardarUltimaNotificacion(notificacion: Notificacion): void {
    localStorage.setItem(this.ULTIMA_NOTIFICACION_KEY, JSON.stringify(notificacion));
  }

  // Obtener última notificación
  static getUltimaNotificacion(): Notificacion | null {
    const stored = localStorage.getItem(this.ULTIMA_NOTIFICACION_KEY);
    if (stored) {
      const n = JSON.parse(stored);
      return { ...n, fecha: new Date(n.fecha) };
    }
    return null;
  }

  // Verificar vencimientos próximos
  static verificarVencimientos(datos: {
    facturasPendientes?: { fechaVencimiento: Date; descripcion: string }[];
    remuneracionesPendientes?: { fechaVencimiento: Date; descripcion: string }[];
    impuestosPendientes?: { fechaVencimiento: Date; descripcion: string }[];
  }): AlertaVencimiento[] {
    const alertas: AlertaVencimiento[] = [];
    const hoy = new Date();
    const limite = 7 * 24 * 60 * 60 * 1000; // 7 días en ms

    // Verificar facturas
    if (datos.facturasPendientes) {
      datos.facturasPendientes.forEach(f => {
        const diasRestantes = Math.ceil((f.fechaVencimiento.getTime() - hoy.getTime()) / (24 * 60 * 60 * 1000));
        if (diasRestantes <= 7 && diasRestantes >= 0) {
          alertas.push({
            tipo: 'factura',
            diasRestantes,
            descripcion: `Factura: ${f.descripcion}`,
          });
        }
      });
    }

    // Verificar remuneraciones
    if (datos.remuneracionesPendientes) {
      datos.remuneracionesPendientes.forEach(r => {
        const diasRestantes = Math.ceil((r.fechaVencimiento.getTime() - hoy.getTime()) / (24 * 60 * 60 * 1000));
        if (diasRestantes <= 5 && diasRestantes >= 0) {
          alertas.push({
            tipo: 'remuneracion',
            diasRestantes,
            descripcion: `Remuneración: ${r.descripcion}`,
          });
        }
      });
    }

    // Verificar impuestos
    if (datos.impuestosPendientes) {
      datos.impuestosPendientes.forEach(i => {
        const diasRestantes = Math.ceil((i.fechaVencimiento.getTime() - hoy.getTime()) / (24 * 60 * 60 * 1000));
        if (diasRestantes <= 3 && diasRestantes >= 0) {
          alertas.push({
            tipo: 'impuesto',
            diasRestantes,
            descripcion: `Impuesto: ${i.descripcion}`,
          });
        }
      });
    }

    // Crear notificaciones para las alertas
    alertas.forEach(alerta => {
      this.agregarNotificacion({
        tipo: 'vencimiento',
        titulo: `${alerta.diasRestantes === 0 ? 'VENCE HOY' : `Vence en ${alerta.diasRestantes} días`}`,
        mensaje: alerta.descripcion,
      });
    });

    return alertas;
  }

  // Verificar cambios en tablas SII
  static verificarCambiosSII(tablaAnterior: string, tablaNueva: string): boolean {
    if (tablaAnterior !== tablaNueva) {
      this.agregarNotificacion({
        tipo: 'sii',
        titulo: 'Actualización de Tablas SII',
        mensaje: 'Se han detectado cambios en las tablas tributarias. Revise los nuevos valores.',
        accion: 'ver_tablas',
      });
      return true;
    }
    return false;
  }

  // Verificar conciliaciones pendientes
  static verificarConciliaciones(pendientes: number): void {
    if (pendientes > 0) {
      this.agregarNotificacion({
        tipo: 'conciliacion',
        titulo: 'Conciliaciones Pendientes',
        mensaje: `Hay ${pendientes} conciliación${pendientes > 1 ? 's' : ''} pendiente${pendientes > 1 ? 's' : ''} de revisar.`,
        accion: 'ver_conciliaciones',
      });
    }
  }

  // Limpiar notificaciones antiguas (más de 30 días)
  static limpiarNotificacionesAntiguas(): void {
    const notificaciones = this.getNotificaciones();
    const limite = 30 * 24 * 60 * 60 * 1000; // 30 días
    const hoy = new Date();

    const filtered = notificaciones.filter(n =>
      (hoy.getTime() - n.fecha.getTime()) < limite
    );

    this.guardarNotificaciones(filtered);
  }

  // Exportar notificaciones para backup
  static exportarNotificaciones(): string {
    return JSON.stringify(this.getNotificaciones());
  }

  // Importar notificaciones desde backup
  static importarNotificaciones(json: string): boolean {
    try {
      const notificaciones = JSON.parse(json);
      this.guardarNotificaciones(notificaciones);
      return true;
    } catch {
      return false;
    }
  }
}
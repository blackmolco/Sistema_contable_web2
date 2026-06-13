// Servicio de Backup Automatizado - Exportar/Importar datos localStorage

import { generateId } from '../utils/calculos';

export interface DatosBackup {
  version: string;
  fecha: string;
  empresa?: {
    nombre: string;
    rut: string;
  };
  modulos: Record<string, ModuloBackup>;
  metadata: BackupMetadata;
}

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface ModuloBackup {
  nombre: string;
  cantidadRegistros: number;
  datos: JsonValue;
}

export interface BackupMetadata {
  usuario?: string;
  navegador?: string;
  plataforma?: string;
}

export interface HistorialBackup {
  id: string;
  fecha: Date;
  tipo: 'manual' | 'automatico';
  tamaño: number;
  modulos: string[];
  exitoso: boolean;
}

export class BackupService {
  private static readonly STORAGE_KEYS = [
    'contable_usuarios',
    'contable_empresas',
    'contable_empresa_activa',
    'contable_trabajadores',
    'contable_documentos',
    'contable_asientos',
    'contable_transacciones',
    'contable_inventario',
    'contable_conciliaciones',
    'contable_notificaciones',
    'contable_analisis',
    'contable_plantillas',
    'contable_importaciones',
    'contable_sii_cache',
    'contable_sii_ultima_actualizacion',
  ];

  private static readonly HISTORIAL_KEY = 'contable_backup_historial';
  private static readonly ULTIMO_BACKUP_KEY = 'contable_ultimo_backup';

  // Crear backup completo
  static crearBackup(): DatosBackup {
    const modulos: Record<string, ModuloBackup> = {};

    this.STORAGE_KEYS.forEach(key => {
      try {
        const datos = localStorage.getItem(key);
        if (datos) {
          const parsed = JSON.parse(datos);
          modulos[key] = {
            nombre: this.getNombreModulo(key),
            cantidadRegistros: this.contarRegistros(parsed),
            datos: parsed,
          };
        }
      } catch (e) {
        console.warn(`Error al leer ${key}:`, e);
      }
    });

    // Obtener empresa activa si existe
    const empresaActivaId = localStorage.getItem('contable_empresa_activa');
    let empresa = undefined;
    if (empresaActivaId) {
      const empresasRaw = localStorage.getItem('contable_empresas');
      if (empresasRaw) {
        const empresas = JSON.parse(empresasRaw);
        const emp = empresas.find((e: { id: string }) => e.id === empresaActivaId);
        if (emp) {
          empresa = {
            nombre: emp.razonSocial,
            rut: emp.rut,
          };
        }
      }
    }

    return {
      version: '1.0.0',
      fecha: new Date().toISOString(),
      empresa,
      modulos,
      metadata: {
        navegador: navigator.userAgent,
        plataforma: navigator.platform,
      },
    };
  }

  // Contar registros en datos
  private static contarRegistros(datos: unknown): number {
    if (Array.isArray(datos)) return datos.length;
    if (typeof datos === 'object' && datos !== null) {
      return Object.keys(datos).length;
    }
    return 1;
  }

  // Obtener nombre amigable del módulo
  private static getNombreModulo(key: string): string {
    const nombres: Record<string, string> = {
      'contable_usuarios': 'Usuarios',
      'contable_empresas': 'Empresas',
      'contable_trabajadores': 'Trabajadores',
      'contable_documentos': 'Documentos',
      'contable_asientos': 'Asientos Contables',
      'contable_transacciones': 'Transacciones',
      'contable_inventario': 'Inventario',
      'contable_conciliaciones': 'Conciliaciones',
      'contable_notificaciones': 'Notificaciones',
      'contable_analisis': 'Análisis Financiero',
      'contable_plantillas': 'Plantillas',
      'contable_importaciones': 'Importaciones',
      'contable_sii_cache': 'Datos SII',
      'contable_sii_ultima_actualizacion': 'Sincronización SII',
    };
    return nombres[key] || key;
  }

  // Descargar backup como JSON
  static descargarBackup(): string {
    const backup = this.crearBackup();
    const json = JSON.stringify(backup, null, 2);

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_contable_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);

    // Guardar en historial
    this.guardarHistorial({
      tipo: 'manual',
      tamaño: blob.size,
      modulos: Object.keys(backup.modulos),
      exitoso: true,
    });

    // Actualizar última fecha de backup
    this.actualizarUltimoBackup();

    return json;
  }

  // Restaurar desde archivo JSON
  static async restaurarBackup(archivo: File): Promise<{
    exitoso: boolean;
    mensaje: string;
    modulosRestaurados: string[];
  }> {
    return new Promise((resolve) => {
      const lector = new FileReader();

      lector.onload = (e) => {
        try {
          const contenido = e.target?.result as string;
          const backup: DatosBackup = JSON.parse(contenido);

          // Validar estructura
          if (!backup.version || !backup.modulos) {
            resolve({
              exitoso: false,
              mensaje: 'Archivo de backup inválido',
              modulosRestaurados: [],
            });
            return;
          }

          // Limpiar localStorage actual
          this.limpiarTodoLocalStorage();

          // Restaurar datos
          const modulosRestaurados: string[] = [];
          Object.entries(backup.modulos).forEach(([key, modulo]) => {
            try {
              localStorage.setItem(key, JSON.stringify(modulo.datos));
              modulosRestaurados.push(modulo.nombre);
            } catch (err) {
              console.warn(`Error al restaurar ${key}:`, err);
            }
          });

          // Guardar en historial
          this.guardarHistorial({
            tipo: 'manual',
            tamaño: archivo.size,
            modulos: modulosRestaurados,
            exitoso: true,
          });

          resolve({
            exitoso: true,
            mensaje: `Se restauraron ${modulosRestaurados.length} módulos correctamente`,
            modulosRestaurados,
          });
        } catch (err) {
          resolve({
            exitoso: false,
            mensaje: 'Error al leer el archivo de backup',
            modulosRestaurados: [],
          });
        }
      };

      lector.onerror = () => {
        resolve({
          exitoso: false,
          mensaje: 'Error al leer el archivo',
          modulosRestaurados: [],
        });
      };

      lector.readAsText(archivo);
    });
  }

  // Limpiar todo el localStorage del sistema
  private static limpiarTodoLocalStorage(): void {
    this.STORAGE_KEYS.forEach(key => {
      localStorage.removeItem(key);
    });
  }

  // Guardar historial de backups
  private static guardarHistorial(entrada: Omit<HistorialBackup, 'id' | 'fecha'>): void {
    const historial = this.getHistorial();
    historial.unshift({
      id: generateId(),
      fecha: new Date(),
      ...entrada,
    });

    // Mantener solo los últimos 20 backups en historial
    if (historial.length > 20) {
      historial.splice(20);
    }

    localStorage.setItem(this.HISTORIAL_KEY, JSON.stringify(historial));
  }

  // Obtener historial de backups
  static getHistorial(): HistorialBackup[] {
    const stored = localStorage.getItem(this.HISTORIAL_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return [];
  }

  // Actualizar fecha del último backup
  private static actualizarUltimoBackup(): void {
    localStorage.setItem(this.ULTIMO_BACKUP_KEY, new Date().toISOString());
  }

  // Obtener fecha del último backup
  static getUltimoBackup(): string | null {
    return localStorage.getItem(this.ULTIMO_BACKUP_KEY);
  }

  // Verificar si necesita backup (más de 7 días)
  static necesitaBackup(): boolean {
    const ultimoBackup = this.getUltimoBackup();
    if (!ultimoBackup) return true;

    const dias = Math.floor(
      (Date.now() - new Date(ultimoBackup).getTime()) / (1000 * 60 * 60 * 24)
    );

    return dias >= 7;
  }

  // Crear backup automático programable
  static programarBackupAutomatico(dias: number = 7): void {
    localStorage.setItem('contable_backup_automatico', JSON.stringify({
      habilitado: true,
      intervalo: dias,
      proximo: new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString(),
    }));
  }

  // Deshabilitar backup automático
  static deshabilitarBackupAutomatico(): void {
    localStorage.removeItem('contable_backup_automatico');
  }

  // Verificar estado del backup automático
  static getEstadoBackupAutomatico(): { habilitado: boolean; intervalo: number; proximo: string } | null {
    const stored = localStorage.getItem('contable_backup_automatico');
    if (stored) {
      return JSON.parse(stored);
    }
    return null;
  }

  // Obtener estadísticas del sistema
  static getEstadisticas(): {
    totalModulos: number;
    totalRegistros: number;
    tamañoAproximado: string;
    ultimoBackup: string | null;
  } {
    const backup = this.crearBackup();

    let totalRegistros = 0;
    Object.values(backup.modulos).forEach(m => {
      totalRegistros += m.cantidadRegistros;
    });

    const backupJson = JSON.stringify(backup);
    const bytes = new Blob([backupJson]).size;
    const tamaño = bytes < 1024
      ? `${bytes} B`
      : bytes < 1024 * 1024
        ? `${(bytes / 1024).toFixed(1)} KB`
        : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

    return {
      totalModulos: Object.keys(backup.modulos).length,
      totalRegistros,
      tamañoAproximado: tamaño,
      ultimoBackup: this.getUltimoBackup(),
    };
  }

  // Exportar datos específicos de un módulo
  static exportarModulo(modulo: string): boolean {
    const datos = localStorage.getItem(modulo);
    if (!datos) return false;

    const blob = new Blob([datos], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${modulo}_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);

    return true;
  }

  // Importar datos a un módulo específico
  static async importarModulo(modulo: string, archivo: File): Promise<boolean> {
    return new Promise((resolve) => {
      const lector = new FileReader();
      lector.onload = (e) => {
        try {
          const datos = e.target?.result as string;
          JSON.parse(datos); // Validar que sea JSON válido
          localStorage.setItem(modulo, datos);
          resolve(true);
        } catch {
          resolve(false);
        }
      };
      lector.onerror = () => resolve(false);
      lector.readAsText(archivo);
    });
  }
}
// Estado de la importacion del SII que se guarda en localStorage y que leen el
// encabezado, el aviso flotante y el Centro de Control.

export const CLAVE_ESTADO_IMPORTACION = 'scc_importacion_sii_estado';

export interface EstadoImportacion {
  estado?: string;
  hecho?: number;
  total?: number;
  tipo?: string;
  nombreArchivo?: string;
  importacionId?: string;
  actualizado?: number;
}

// Una importacion que no avanza hace mas de esto se da por interrumpida
// (pestaña cerrada o error a medio camino); cada fila importada renueva `actualizado`.
const MS_SIN_AVANCE = 10 * 60 * 1000;

/**
 * Corrige estados "pegados" en "procesando":
 *  - todo el lote ya esta hecho (hecho >= total): en realidad termino;
 *  - lleva mas de 10 minutos sin avanzar: se descarta (devuelve null).
 */
export function normalizarEstadoImportacion(estado: EstadoImportacion | null, ahora = Date.now()): EstadoImportacion | null {
  if (!estado || estado.estado !== 'procesando') return estado;
  const total = Number(estado.total ?? 0);
  if (total > 0 && Number(estado.hecho ?? 0) >= total) return { ...estado, estado: 'completada' };
  if (estado.actualizado && ahora - estado.actualizado > MS_SIN_AVANCE) return null;
  return estado;
}

export function leerEstadoImportacion(): EstadoImportacion | null {
  try {
    const raw = localStorage.getItem(CLAVE_ESTADO_IMPORTACION);
    return normalizarEstadoImportacion(raw ? JSON.parse(raw) : null);
  } catch {
    return null;
  }
}

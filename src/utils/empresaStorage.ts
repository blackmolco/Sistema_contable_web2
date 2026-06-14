/**
 * Devuelve el ID de la empresa activa leyendo directamente el store persistido en localStorage.
 * Se llama de forma síncrona al inicializar cada contexto, antes del primer render.
 */
export function getEmpresaActivaId(): string {
  try {
    const raw = localStorage.getItem('app-storage');
    if (raw) {
      const data = JSON.parse(raw);
      const id = data?.state?.empresaActiva?.id;
      if (id && typeof id === 'string') return id;
    }
  } catch { /* ignore */ }
  return 'default';
}

export function storageKey(base: string): string {
  return `${base}_${getEmpresaActivaId()}`;
}

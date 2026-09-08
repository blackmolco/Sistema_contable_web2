export interface SyncErrorDetail {
  operacion: string;
  mensaje: string;
}

export function reportSyncError(operacion: string, error: unknown) {
  const mensaje = error instanceof Error ? error.message : 'No fue posible guardar en el servidor';
  console.error(`[sincronizacion] ${operacion}:`, error);
  window.dispatchEvent(new CustomEvent<SyncErrorDetail>('scc:sync-error', {
    detail: { operacion, mensaje },
  }));
}

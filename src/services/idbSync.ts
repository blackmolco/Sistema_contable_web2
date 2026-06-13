/**
 * idbSync.ts — Sincronización automática de Zustand → IndexedDB
 *
 * Llama a `initIDBSync()` una sola vez en el arranque de la app (main.tsx o App.tsx).
 * Hace dos cosas:
 *  1. Hidrata los stores desde IndexedDB si localStorage está vacío o corrupto.
 *  2. Se suscribe a los stores para persistir en IndexedDB en cada cambio.
 *
 * El debounce de 500 ms evita escrituras en cada pulsación de tecla.
 */

import {
  persistContabilidad,
  hydrateContabilidad,
  persistFacturacion,
  hydrateFacturacion,
  persistRemuneraciones,
  hydrateRemuneraciones,
} from './idbService';

// ─── Debounce helper ─────────────────────────────────────────────────────────

function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 500;

async function setupContabilidadSync() {
  const { useContabilidadStore } = await import('../stores/contabilidadStore');

  // 1. Hidratar si el store está vacío
  const current = useContabilidadStore.getState();
  if (current.asientos.length === 0 && current.cuentas.length === 0) {
    const saved = await hydrateContabilidad();
    if (saved) {
      useContabilidadStore.setState({
        cuentas: saved.cuentas as never[],
        asientos: saved.asientos as never[],
        periodoActual: saved.periodoActual,
      });
    }
  }

  // 2. Persistir en cada cambio
  const persist = debounce(() => {
    const state = useContabilidadStore.getState();
    persistContabilidad({
      cuentas: state.cuentas,
      asientos: state.asientos,
      periodoActual: state.periodoActual,
    }).catch(console.error);
  }, DEBOUNCE_MS);

  useContabilidadStore.subscribe(persist);
}

async function setupFacturacionSync() {
  const { useFacturacionStore } = await import('../stores/facturacionStore');

  const current = useFacturacionStore.getState();
  if (current.documentos.length === 0 && current.honorarios.length === 0) {
    const saved = await hydrateFacturacion();
    if (saved) {
      useFacturacionStore.setState({
        documentos: saved.documentos as never[],
        honorarios: saved.honorarios as never[],
      });
    }
  }

  const persist = debounce(() => {
    const state = useFacturacionStore.getState();
    persistFacturacion({
      documentos: state.documentos,
      honorarios: state.honorarios,
    }).catch(console.error);
  }, DEBOUNCE_MS);

  useFacturacionStore.subscribe(persist);
}

async function setupRemuneracionesSync() {
  const { useRemuneracionesStore } = await import('../stores/remuneracionesStore');

  const current = useRemuneracionesStore.getState();
  if (current.trabajadores.length === 0 && current.liquidaciones.length === 0) {
    const saved = await hydrateRemuneraciones();
    if (saved) {
      useRemuneracionesStore.setState({
        trabajadores: saved.trabajadores as never[],
        liquidaciones: saved.liquidaciones as never[],
        periodoActual: saved.periodoActual,
      });
    }
  }

  const persist = debounce(() => {
    const state = useRemuneracionesStore.getState();
    persistRemuneraciones({
      trabajadores: state.trabajadores,
      liquidaciones: state.liquidaciones,
      periodoActual: state.periodoActual,
    }).catch(console.error);
  }, DEBOUNCE_MS);

  useRemuneracionesStore.subscribe(persist);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

let initialized = false;

/**
 * Inicializa la sincronización IDB para todos los stores.
 * Seguro llamarlo múltiples veces — solo ejecuta una vez.
 */
export async function initIDBSync(): Promise<void> {
  if (initialized) return;
  initialized = true;

  // Si IndexedDB no está disponible (SSR, iframe restringido, etc.) → no bloquear
  if (typeof indexedDB === 'undefined') {
    console.warn('[idbSync] IndexedDB no disponible, usando solo localStorage.');
    return;
  }

  try {
    await Promise.all([
      setupContabilidadSync(),
      setupFacturacionSync(),
      setupRemuneracionesSync(),
    ]);
    console.info('[idbSync] Sincronización IndexedDB activa.');
  } catch (err) {
    console.error('[idbSync] Error al inicializar:', err);
  }
}

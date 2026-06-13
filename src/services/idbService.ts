/**
 * idbService.ts — Capa de persistencia IndexedDB para el Sistema Contable Chile
 *
 * Proporciona un API simple para guardar y leer los datos críticos del sistema en
 * IndexedDB (capacidad ~500 MB) en lugar de localStorage (~5 MB).
 *
 * Object stores:
 *  - contabilidad   → asientos, cuentas
 *  - facturacion    → documentos tributarios, honorarios
 *  - remuneraciones → trabajadores, liquidaciones
 *  - empresas       → datos de empresas
 *  - backup         → snapshots completos para recuperación
 *
 * Uso:
 *   await idb.put('contabilidad', 'asientos', asientosArray);
 *   const asientos = await idb.get('contabilidad', 'asientos');
 */

const DB_NAME = 'sistema-contable-cl';
const DB_VERSION = 1;

type StoreName = 'contabilidad' | 'facturacion' | 'remuneraciones' | 'empresas' | 'backup';

// ─── Abrir / crear la base de datos ─────────────────────────────────────────

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const stores: StoreName[] = ['contabilidad', 'facturacion', 'remuneraciones', 'empresas', 'backup'];
      stores.forEach((name) => {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name);
        }
      });
    };

    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
    request.onerror = (event) => {
      dbPromise = null; // reset so next call retries
      reject((event.target as IDBOpenDBRequest).error);
    };
  });

  return dbPromise;
}

// ─── Helpers de transacción ──────────────────────────────────────────────────

function tx(
  db: IDBDatabase,
  store: StoreName,
  mode: IDBTransactionMode
): IDBObjectStore {
  return db.transaction(store, mode).objectStore(store);
}

// ─── API pública ─────────────────────────────────────────────────────────────

/**
 * Guarda un valor bajo una clave en el store indicado.
 * Reemplaza el valor existente si ya existe.
 */
export async function idbPut<T>(store: StoreName, key: string, value: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, store, 'readwrite').put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Lee un valor por clave. Devuelve `undefined` si no existe.
 */
export async function idbGet<T>(store: StoreName, key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, store, 'readonly').get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Elimina una clave del store.
 */
export async function idbDelete(store: StoreName, key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, store, 'readwrite').delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Devuelve todas las claves de un store.
 */
export async function idbKeys(store: StoreName): Promise<string[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, store, 'readonly').getAllKeys();
    req.onsuccess = () => resolve(req.result as string[]);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Limpia todos los registros de un store.
 */
export async function idbClear(store: StoreName): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, store, 'readwrite').clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ─── Helpers de alto nivel para los stores Zustand ───────────────────────────

/**
 * Persiste el estado completo de contabilidad.
 * Llámalo desde el store Zustand con un subscribe() o en cada mutación crítica.
 */
export async function persistContabilidad(state: {
  cuentas: unknown[];
  asientos: unknown[];
  periodoActual: string;
}): Promise<void> {
  await Promise.all([
    idbPut('contabilidad', 'cuentas', state.cuentas),
    idbPut('contabilidad', 'asientos', state.asientos),
    idbPut('contabilidad', 'periodoActual', state.periodoActual),
  ]);
}

/**
 * Hidrata el estado de contabilidad desde IndexedDB.
 * Devuelve null si no hay datos previos.
 */
export async function hydrateContabilidad(): Promise<{
  cuentas: unknown[];
  asientos: unknown[];
  periodoActual: string;
} | null> {
  const [cuentas, asientos, periodoActual] = await Promise.all([
    idbGet<unknown[]>('contabilidad', 'cuentas'),
    idbGet<unknown[]>('contabilidad', 'asientos'),
    idbGet<string>('contabilidad', 'periodoActual'),
  ]);

  if (!cuentas && !asientos) return null;

  return {
    cuentas: cuentas ?? [],
    asientos: asientos ?? [],
    periodoActual: periodoActual ?? new Date().toISOString().slice(0, 7),
  };
}

/**
 * Persiste el estado de facturación.
 */
export async function persistFacturacion(state: {
  documentos: unknown[];
  honorarios: unknown[];
}): Promise<void> {
  await Promise.all([
    idbPut('facturacion', 'documentos', state.documentos),
    idbPut('facturacion', 'honorarios', state.honorarios),
  ]);
}

/**
 * Hidrata el estado de facturación desde IndexedDB.
 */
export async function hydrateFacturacion(): Promise<{
  documentos: unknown[];
  honorarios: unknown[];
} | null> {
  const [documentos, honorarios] = await Promise.all([
    idbGet<unknown[]>('facturacion', 'documentos'),
    idbGet<unknown[]>('facturacion', 'honorarios'),
  ]);

  if (!documentos && !honorarios) return null;

  return {
    documentos: documentos ?? [],
    honorarios: honorarios ?? [],
  };
}

/**
 * Persiste el estado de remuneraciones.
 */
export async function persistRemuneraciones(state: {
  trabajadores: unknown[];
  liquidaciones: unknown[];
  periodoActual: string;
}): Promise<void> {
  await Promise.all([
    idbPut('remuneraciones', 'trabajadores', state.trabajadores),
    idbPut('remuneraciones', 'liquidaciones', state.liquidaciones),
    idbPut('remuneraciones', 'periodoActual', state.periodoActual),
  ]);
}

/**
 * Hidrata el estado de remuneraciones desde IndexedDB.
 */
export async function hydrateRemuneraciones(): Promise<{
  trabajadores: unknown[];
  liquidaciones: unknown[];
  periodoActual: string;
} | null> {
  const [trabajadores, liquidaciones, periodoActual] = await Promise.all([
    idbGet<unknown[]>('remuneraciones', 'trabajadores'),
    idbGet<unknown[]>('remuneraciones', 'liquidaciones'),
    idbGet<string>('remuneraciones', 'periodoActual'),
  ]);

  if (!trabajadores && !liquidaciones) return null;

  return {
    trabajadores: trabajadores ?? [],
    liquidaciones: liquidaciones ?? [],
    periodoActual: periodoActual ?? new Date().toISOString().slice(0, 7),
  };
}

// ─── Backup completo ──────────────────────────────────────────────────────────

export interface BackupSnapshot {
  version: string;
  timestamp: string;
  contabilidad?: unknown;
  facturacion?: unknown;
  remuneraciones?: unknown;
  empresas?: unknown;
}

/**
 * Guarda un snapshot completo del sistema en IndexedDB.
 * Se puede usar para implementar recuperación ante fallos.
 */
export async function crearBackupIDB(snapshot: BackupSnapshot): Promise<void> {
  const key = `backup_${snapshot.timestamp.replace(/[:.]/g, '-')}`;
  await idbPut('backup', key, snapshot);

  // Mantener solo los últimos 10 backups
  const claves = await idbKeys('backup');
  if (claves.length > 10) {
    const ordenadas = claves.sort(); // ISO timestamp → orden cronológico
    const aEliminar = ordenadas.slice(0, claves.length - 10);
    await Promise.all(aEliminar.map((k) => idbDelete('backup', k)));
  }
}

/**
 * Lista todos los backups disponibles (solo metadatos, no el contenido completo).
 */
export async function listarBackups(): Promise<{ key: string; timestamp: string; version: string }[]> {
  const claves = await idbKeys('backup');
  const backups = await Promise.all(
    claves.map(async (key) => {
      const snap = await idbGet<BackupSnapshot>('backup', key);
      return { key, timestamp: snap?.timestamp ?? '', version: snap?.version ?? '?' };
    })
  );
  return backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/**
 * Recupera un backup por su clave.
 */
export async function recuperarBackup(key: string): Promise<BackupSnapshot | undefined> {
  return idbGet<BackupSnapshot>('backup', key);
}

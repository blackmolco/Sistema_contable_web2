// src/services/httpClient.ts
// Cliente HTTP central: agrega Authorization, refresca el token ante 401
// una sola vez y notifica "sesión expirada" a los callbacks registrados.
import * as ApiAuthService from './apiAuth';
import { handleApiResponse } from './errorHandler';

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type SessionExpiredCallback = () => void;
const sessionExpiredCallbacks = new Set<SessionExpiredCallback>();

/** Registra un callback que se dispara cuando la sesión expira (refresh fallido). Retorna unsubscribe. */
export function onSessionExpired(cb: SessionExpiredCallback): () => void {
  sessionExpiredCallbacks.add(cb);
  return () => sessionExpiredCallbacks.delete(cb);
}

function notifySessionExpired() {
  sessionExpiredCallbacks.forEach((cb) => {
    try {
      cb();
    } catch {
      // no propagar errores de callbacks
    }
  });
}

async function rawFetch(path: string, options: RequestInit, token: string | null): Promise<Response> {
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}

/**
 * Fetch tipado contra la API:
 * - agrega Authorization desde ApiAuthService.getToken()
 * - ante 401/403 intenta refresh() una vez y reintenta
 * - si el refresh falla, dispara onSessionExpired y lanza error
 */
export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  let res = await rawFetch(path, options, ApiAuthService.getToken());

  if ((res.status === 401 || res.status === 403) && ApiAuthService.getToken()) {
    const newToken = await ApiAuthService.refreshToken();
    if (newToken) {
      res = await rawFetch(path, options, newToken);
    } else {
      notifySessionExpired();
    }
  }

  return handleApiResponse<T>(res);
}

/** Variante que retorna la Response cruda (para descargas/blobs). */
export async function apiFetchRaw(path: string, options: RequestInit = {}): Promise<Response> {
  let res = await rawFetch(path, options, ApiAuthService.getToken());
  if ((res.status === 401 || res.status === 403) && ApiAuthService.getToken()) {
    const newToken = await ApiAuthService.refreshToken();
    if (newToken) {
      res = await rawFetch(path, options, newToken);
    } else {
      notifySessionExpired();
    }
  }
  return res;
}

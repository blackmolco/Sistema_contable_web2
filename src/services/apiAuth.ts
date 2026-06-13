// src/services/apiAuth.ts
// Autenticacion delegada al backend — usa sessionStorage, no localStorage

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const SESSION_KEY = 'auth_token';
const REFRESH_KEY = 'auth_refresh';
const USER_KEY = 'auth_user';

export interface AuthUser {
  id: string;
  nombre: string;
  email: string;
  rut?: string;
  rol: string;
  empresaId?: string | null;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: AuthUser;
}

function saveSession(data: LoginResponse) {
  sessionStorage.setItem(SESSION_KEY, data.token);
  sessionStorage.setItem(REFRESH_KEY, data.refreshToken);
  sessionStorage.setItem(USER_KEY, JSON.stringify(data.user));
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function getToken(): string | null {
  return sessionStorage.getItem(SESSION_KEY);
}

export function getCurrentUser(): AuthUser | null {
  const raw = sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error al iniciar sesion');
  }
  const data: LoginResponse = await res.json();
  saveSession(data);
  return data.user;
}

export async function logout(): Promise<void> {
  const token = getToken();
  if (token) {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // ignorar errores de red al hacer logout
    }
  }
  clearSession();
}

export async function refreshToken(): Promise<string | null> {
  const refresh = sessionStorage.getItem(REFRESH_KEY);
  if (!refresh) return null;
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (!res.ok) { clearSession(); return null; }
    const data = await res.json();
    sessionStorage.setItem(SESSION_KEY, data.token);
    return data.token;
  } catch {
    clearSession();
    return null;
  }
}

/** Alias: equivalente a getCurrentUser() */
export function getUser(): AuthUser | null {
  return getCurrentUser();
}

/** Alias: equivalente a refreshToken() */
export function refresh(): Promise<string | null> {
  return refreshToken();
}

/** Objeto de conveniencia para usar como ApiAuthService.login(...), etc. */
export const ApiAuthService = {
  login,
  logout,
  isAuthenticated,
  getUser,
  getCurrentUser,
  getToken,
  refresh,
  refreshToken,
  clearSession,
};

/** @deprecated Usar apiFetch de src/services/httpClient.ts (maneja sesión expirada). */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  let token = getToken();
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', headers.get('Content-Type') || 'application/json');

  let res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // Si el token expiro, intentar refrescar
  if (res.status === 403 || res.status === 401) {
    token = await refreshToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
      res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    }
  }

  return res;
}

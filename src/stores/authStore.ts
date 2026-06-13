import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import bcrypt from 'bcryptjs';
import { generateId } from '../utils/calculos';

// ============ TIPOS ============
export type RolUsuario = 'administrador' | 'contador' | 'auxiliar' | 'visor';

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  rol: RolUsuario;
  passwordHash: string;
  activo: boolean;
  ultimoAcceso?: string;
  fechaCreacion: string;
}

export interface Sesion {
  usuarioId: string;
  token: string;
  fechaInicio: string;
  fechaExpiracion: string;
}

// User legacy type (para compatibilidad con UI existente)
export interface User {
  id: string;
  nombre: string;
  email: string;
  rut: string;
  rol: 'admin' | 'contador' | 'supervisor' | 'viewer';
  empresaId: string;
  avatar?: string;
}

// ============ PERMISOS POR ROL ============
export const PERMISOS: Record<RolUsuario, string[]> = {
  administrador: [
    'dashboard.view', 'dashboard.edit',
    'cuentas.view', 'cuentas.create', 'cuentas.edit', 'cuentas.delete',
    'asientos.view', 'asientos.create', 'asientos.edit', 'asientos.delete',
    'remuneraciones.view', 'remuneraciones.create', 'remuneraciones.edit', 'remuneraciones.delete',
    'facturacion.view', 'facturacion.create', 'facturacion.edit', 'facturacion.delete', 'facturacion.export',
    'libroVentas.view', 'libroVentas.export',
    'libroCompras.view', 'libroCompras.export',
    'honorarios.view', 'honorarios.create', 'honorarios.edit', 'honorarios.delete',
    'estadosFinancieros.view', 'estadosFinancieros.export',
    'calculadora.view',
    'tesoreria.view', 'tesoreria.create', 'tesoreria.edit', 'tesoreria.delete',
    'reportes.view', 'reportes.export',
    'usuarios.view', 'usuarios.create', 'usuarios.edit', 'usuarios.delete',
    'configuracion.view', 'configuracion.edit',
  ],
  contador: [
    'dashboard.view',
    'cuentas.view', 'cuentas.create', 'cuentas.edit',
    'asientos.view', 'asientos.create', 'asientos.edit', 'asientos.delete',
    'remuneraciones.view', 'remuneraciones.create', 'remuneraciones.edit', 'remuneraciones.delete',
    'facturacion.view', 'facturacion.create', 'facturacion.edit', 'facturacion.delete', 'facturacion.export',
    'libroVentas.view', 'libroVentas.export',
    'libroCompras.view', 'libroCompras.export',
    'honorarios.view', 'honorarios.create', 'honorarios.edit', 'honorarios.delete',
    'estadosFinancieros.view', 'estadosFinancieros.export',
    'calculadora.view',
    'tesoreria.view', 'tesoreria.create', 'tesoreria.edit', 'tesoreria.delete',
    'reportes.view', 'reportes.export',
    'configuracion.view', 'configuracion.edit',
  ],
  auxiliar: [
    'dashboard.view',
    'cuentas.view',
    'asientos.view', 'asientos.create',
    'remuneraciones.view', 'remuneraciones.create',
    'facturacion.view', 'facturacion.create',
    'libroVentas.view',
    'libroCompras.view',
    'honorarios.view', 'honorarios.create',
    'estadosFinancieros.view',
    'calculadora.view',
    'tesoreria.view',
    'reportes.view',
  ],
  visor: [
    'dashboard.view',
    'cuentas.view',
    'asientos.view',
    'remuneraciones.view',
    'facturacion.view',
    'libroVentas.view',
    'libroCompras.view',
    'honorarios.view',
    'estadosFinancieros.view',
    'calculadora.view',
    'tesoreria.view',
    'reportes.view',
  ],
};

// ============ CONSTANTES DE ALMACENAMIENTO ============
const USUARIOS_KEY = 'contable_usuarios';
const SESION_KEY = 'contable_sesion';
const SESION_EXPIRA = 24 * 60 * 60 * 1000; // 24 horas
const BCRYPT_ROUNDS = 10;

// ============ HELPERS ============
function hashPassword(password: string): string {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

function verifyPassword(password: string, hash: string): boolean {
  if (hash.startsWith('hash_')) return false;
  return bcrypt.compareSync(password, hash);
}

function getUsuariosFromStorage(): Usuario[] {
  const data = localStorage.getItem(USUARIOS_KEY);
  return data ? JSON.parse(data) : [];
}

function saveUsuariosToStorage(usuarios: Usuario[]): void {
  localStorage.setItem(USUARIOS_KEY, JSON.stringify(usuarios));
}

// ============ INTERFACE DEL STORE ============
interface AuthState {
  // Estado
  user: User | null;
  usuarioActual: Usuario | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Acciones (login/sesión)
  login: (email: string, password: string) => Promise<boolean>;
  loginLocal: (email: string, password: string) => boolean;
  logout: () => void;
  setUser: (user: User) => void;
  updateUser: (updates: Partial<User>) => void;
  clearError: () => void;

  // Acciones (usuarios CRUD)
  inicializarUsuarios: () => void;
  getUsuarios: () => Usuario[];
  crearUsuario: (datos: Omit<Usuario, 'id' | 'passwordHash' | 'fechaCreacion'> & { passwordInicial?: string }) => Usuario;
  actualizarUsuario: (id: string, datos: Partial<Usuario>) => Usuario | null;
  eliminarUsuario: (id: string) => boolean;
  cambiarPassword: (usuarioId: string, passwordActual: string, passwordNuevo: string) => boolean;

  // Acciones (permisos)
  getSesionActual: () => { sesion: Sesion; usuario: Usuario } | null;
  tienePermiso: (permiso: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Estado inicial
      user: null,
      usuarioActual: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // ========== LOGIN (versión async / API) ==========
      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });

          if (!response.ok) {
            // Fallback a login local
            const localResult = get().loginLocal(email, password);
            if (!localResult) {
              throw new Error('Credenciales inválidas');
            }
            return true;
          }

          const data = await response.json();
          set({
            user: data.user,
            token: data.token,
            isAuthenticated: true,
            isLoading: false,
          });
          return true;
        } catch (err) {
          // Fallback a login local en caso de error de conexión
          const localResult = get().loginLocal(email, password);
          if (localResult) {
            set({ isLoading: false });
            return true;
          }
          const message = err instanceof Error ? err.message : 'Error al iniciar sesión';
          set({ error: message, isLoading: false });
          return false;
        }
      },

      // ========== LOGIN (versión local / localStorage) ==========
      loginLocal: (email: string, password: string) => {
        const usuarios = getUsuariosFromStorage();
        const usuario = usuarios.find(u => u.email === email && u.activo);
        if (!usuario) return false;

        // Migrar hash legado
        const usuariosActualizados = getUsuariosFromStorage();
        const usuarioActual = usuariosActualizados.find(u => u.id === usuario.id);
        if (!usuarioActual || !verifyPassword(password, usuarioActual.passwordHash)) return false;

        // Actualizar último acceso
        const idx = usuariosActualizados.findIndex(u => u.id === usuario.id);
        usuariosActualizados[idx].ultimoAcceso = new Date().toISOString();
        saveUsuariosToStorage(usuariosActualizados);

        const sesion: Sesion = {
          usuarioId: usuario.id,
          token: generateId(),
          fechaInicio: new Date().toISOString(),
          fechaExpiracion: new Date(Date.now() + SESION_EXPIRA).toISOString(),
        };
        localStorage.setItem(SESION_KEY, JSON.stringify(sesion));

        // Actualizar estado de Zustand
        set({
          usuarioActual: usuarioActual,
          token: sesion.token,
          isAuthenticated: true,
          user: {
            id: usuario.id,
            nombre: usuario.nombre,
            email: usuario.email,
            rut: '',
            rol: usuario.rol === 'administrador' ? 'admin' as const
              : usuario.rol === 'contador' ? 'contador' as const
              : usuario.rol === 'auxiliar' ? 'supervisor' as const
              : 'viewer' as const,
            empresaId: '',
          },
        });

        return true;
      },

      // ========== CERRAR SESIÓN ==========
      logout: () => {
        localStorage.removeItem(SESION_KEY);
        set({
          user: null,
          usuarioActual: null,
          token: null,
          isAuthenticated: false,
          error: null,
        });
      },

      // ========== GESTIÓN DE USUARIOS ==========
      setUser: (user) => set({ user, isAuthenticated: true }),

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      clearError: () => set({ error: null }),

      // ========== INICIALIZAR USUARIOS ==========
      inicializarUsuarios: () => {
        const usuarios = getUsuariosFromStorage();

        if (usuarios.length === 0) {
          // Primera vez: crear admin por defecto
          const admin: Usuario = {
            id: generateId(),
            email: 'admin@contable.cl',
            nombre: 'Administrador',
            rol: 'administrador',
            passwordHash: hashPassword('admin123'),
            activo: true,
            fechaCreacion: new Date().toISOString(),
          };
          saveUsuariosToStorage([admin]);
          return;
        }

        // Reparar hashes en formato antiguo (hash_xxx) que bcrypt no puede verificar
        let reparado = false;
        const usuariosReparados = usuarios.map((u) => {
          if (!u.passwordHash || u.passwordHash.startsWith('hash_') || !u.passwordHash.startsWith('$2')) {
            reparado = true;
            // Asignar contraseña temporal basada en email (primera parte)
            const passwordTemporal = u.email === 'admin@contable.cl' ? 'admin123' : `${u.email.split('@')[0]}@Contable1`;
            return { ...u, passwordHash: hashPassword(passwordTemporal) };
          }
          return u;
        });

        if (reparado) {
          saveUsuariosToStorage(usuariosReparados);
        }

        // Garantizar que siempre existe un admin activo
        const tieneAdmin = usuariosReparados.some(u => u.email === 'admin@contable.cl' && u.activo);
        if (!tieneAdmin) {
          usuariosReparados.push({
            id: generateId(),
            email: 'admin@contable.cl',
            nombre: 'Administrador',
            rol: 'administrador',
            passwordHash: hashPassword('admin123'),
            activo: true,
            fechaCreacion: new Date().toISOString(),
          });
          saveUsuariosToStorage(usuariosReparados);
        }
      },

      // ========== CRUD USUARIOS ==========
      getUsuarios: () => getUsuariosFromStorage(),

      crearUsuario: (datos) => {
        const usuarios = getUsuariosFromStorage();
        if (usuarios.some(u => u.email === datos.email)) {
          throw new Error('El email ya está registrado');
        }
        const passwordInicial = datos.passwordInicial ?? `${datos.email.split('@')[0]}@Contable1`;
        const { passwordInicial: _, ...datosSinPassword } = datos;
        const nuevoUsuario: Usuario = {
          id: generateId(),
          ...datosSinPassword,
          passwordHash: hashPassword(passwordInicial),
          fechaCreacion: new Date().toISOString(),
        };
        usuarios.push(nuevoUsuario);
        saveUsuariosToStorage(usuarios);
        return nuevoUsuario;
      },

      actualizarUsuario: (id, datos) => {
        const usuarios = getUsuariosFromStorage();
        const index = usuarios.findIndex(u => u.id === id);
        if (index === -1) return null;
        usuarios[index] = { ...usuarios[index], ...datos };
        saveUsuariosToStorage(usuarios);
        return usuarios[index];
      },

      eliminarUsuario: (id) => {
        const usuarios = getUsuariosFromStorage();
        const filtered = usuarios.filter(u => u.id !== id);
        if (filtered.length === usuarios.length) return false;
        saveUsuariosToStorage(filtered);
        return true;
      },

      cambiarPassword: (usuarioId, passwordActual, passwordNuevo) => {
        const usuarios = getUsuariosFromStorage();
        const index = usuarios.findIndex(u => u.id === usuarioId);
        if (index === -1) return false;
        if (!verifyPassword(passwordActual, usuarios[index].passwordHash)) return false;
        usuarios[index].passwordHash = hashPassword(passwordNuevo);
        saveUsuariosToStorage(usuarios);
        return true;
      },

      // ========== SESIÓN Y PERMISOS ==========
      getSesionActual: () => {
        const data = localStorage.getItem(SESION_KEY);
        if (!data) return null;
        const sesion: Sesion = JSON.parse(data);
        if (new Date(sesion.fechaExpiracion) < new Date()) {
          localStorage.removeItem(SESION_KEY);
          return null;
        }
        const usuario = getUsuariosFromStorage().find(u => u.id === sesion.usuarioId);
        if (!usuario) return null;
        return { sesion, usuario };
      },

      tienePermiso: (permiso) => {
        const sesionActual = get().getSesionActual();
        if (!sesionActual) return false;
        return PERMISOS[sesionActual.usuario.rol].includes(permiso);
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

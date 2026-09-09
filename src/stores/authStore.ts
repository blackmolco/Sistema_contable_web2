import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Store de sesión: solo mantiene el flag reactivo `isAuthenticated` que los
// contexts (Contabilidad/Facturacion/Entidades/Remuneraciones) escuchan para
// disparar su carga inicial desde el backend — el login real vive en
// ApiAuthService (src/services/apiAuth.ts), que es quien llama al backend y
// guarda el token JWT en sessionStorage.
//
// Este store solía tener un sistema de login "local" completo (usuarios y
// contraseñas guardados en localStorage, con un admin por defecto
// admin@contable.cl/admin123 que se recreaba solo) al que Login.tsx caía
// automáticamente cada vez que el backend no respondía — no solo cuando la
// contraseña era incorrecta. Cualquiera con acceso al navegador podía entrar
// sin pasar por el servidor real. Se eliminó por completo: si el backend no
// responde, el login simplemente falla y hay que reintentar.

export interface User {
  id: string;
  nombre: string;
  email: string;
  rut: string;
  rol: 'admin' | 'contador' | 'supervisor' | 'viewer';
  empresaId: string;
  avatar?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  logout: () => void;
  setUser: (user: User) => void;
  updateUser: (updates: Partial<User>) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false, error: null });
      },

      setUser: (user) => set({ user, isAuthenticated: true }),

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      clearError: () => set({ error: null }),
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

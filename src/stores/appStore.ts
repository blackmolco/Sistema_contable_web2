import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateId } from '../utils/calculos';

export interface Empresa {
  id: string;
  rut: string;
  razonSocial: string;
  nombreFantasia: string;
  giro: string;
  direccion: string;
  comuna: string;
  ciudad: string;
  email: string;
  telefono: string;
  logo?: string;
  activa: boolean;
}

export interface Notificacion {
  id: string;
  tipo: 'info' | 'success' | 'warning' | 'error';
  titulo: string;
  mensaje: string;
  leida: boolean;
  fecha: string;
  link?: string;
  modulo?: string;
}

export interface Tarea {
  id: string;
  titulo: string;
  descripcion?: string;
  completada: boolean;
  fechaCreacion: string;
  fechaVencimiento?: string;
  prioridad: 'baja' | 'media' | 'alta';
  modulo?: string;
}

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

// ============ EMPRESAS DEMO ============
function getEmpresasDemo(): Empresa[] {
  return [
    {
      id: 'emp_001',
      razonSocial: 'Servicios Contables Chile Ltda.',
      nombreFantasia: 'Servicios Contables Chile',
      rut: '76.543.210-K',
      giro: 'Servicios de Contabilidad y Auditoría',
      direccion: 'Av. Providencia 1200, Of. 501',
      comuna: 'Providencia',
      ciudad: 'Santiago',
      telefono: '+56 2 2345 6789',
      email: 'contacto@servicioscontables.cl',
      activa: true,
    },
    {
      id: 'emp_002',
      razonSocial: 'Comercio Electrónico Nacional S.A.',
      nombreFantasia: 'ComercioElec',
      rut: '99.876.543-1',
      giro: 'Venta al por menor por correo y internet',
      direccion: 'Paseo Ahuehues 330, piso 12',
      comuna: 'Las Condes',
      ciudad: 'Santiago',
      telefono: '+56 2 2987 6543',
      email: 'ventas@comercioelec.cl',
      activa: true,
    },
    {
      id: 'emp_003',
      razonSocial: 'Constructora y Remodelaciones Andina E.I.R.L.',
      nombreFantasia: 'Constructora Andina',
      rut: '77.123.456-7',
      giro: 'Construcción y remodeling de edificios',
      direccion: 'Camino a Farellones 5678',
      comuna: 'Lo Barnechea',
      ciudad: 'Santiago',
      telefono: '+56 2 2123 4567',
      email: 'info@constructoraandina.cl',
      activa: true,
    },
  ];
}

interface AppState {
  // UI State
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
  empresaActiva: Empresa | null;
  empresas: Empresa[];

  // Notificaciones
  notificaciones: Notificacion[];
  notificacionesNoLeidas: number;

  // Tareas
  tareas: Tarea[];

  // Toasts
  toasts: Toast[];

  // Actions - UI
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: 'light' | 'dark') => void;

  // Actions - Empresas
  setEmpresas: (empresas: Empresa[]) => void;
  setEmpresaActiva: (empresa: Empresa | null) => void;
  setEmpresaActivaById: (id: string) => void;
  addEmpresa: (empresa: Omit<Empresa, 'id'>) => Empresa;
  updateEmpresa: (id: string, updates: Partial<Empresa>) => void;
  deleteEmpresa: (id: string) => boolean;
  validarRUTEmpresa: (rut: string) => boolean;
  esEmpresaSimple: (rut: string) => boolean;
  cambiarEmpresa: (id: string) => void;

  // Actions - Notificaciones
  addNotificacion: (notificacion: Omit<Notificacion, 'id' | 'fecha' | 'leida'>) => void;
  marcarLeida: (id: string) => void;
  marcarTodasLeidas: () => void;
  eliminarNotificacion: (id: string) => void;

  // Actions - Tareas
  addTarea: (tarea: Omit<Tarea, 'id' | 'fechaCreacion' | 'completada'>) => void;
  toggleTarea: (id: string) => void;
  deleteTarea: (id: string) => void;

  // Actions - Toasts
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      sidebarOpen: true,
      theme: 'light',
      empresaActiva: null,
      empresas: [],
      notificaciones: [],
      notificacionesNoLeidas: 0,
      tareas: [],
      toasts: [],

      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setTheme: (theme) => set({ theme }),

      setEmpresas: (empresas) => {
        // Si está vacío, inicializar con demo
        if (empresas.length === 0) {
          const demo = getEmpresasDemo();
          set({ empresas: demo, empresaActiva: demo[0] });
          return;
        }
        set({ empresas });
      },
      setEmpresaActiva: (empresa) => set({ empresaActiva: empresa }),
      setEmpresaActivaById: (id) =>
        set((state) => {
          const empresa = state.empresas.find((e) => e.id === id);
          return empresa ? { empresaActiva: empresa } : {};
        }),
      addEmpresa: (datos) => {
        const nueva: Empresa = { ...datos, id: generateId() };
        set((state) => ({ empresas: [...state.empresas, nueva] }));
        return nueva;
      },
      updateEmpresa: (id, updates) =>
        set((state) => ({
          empresas: state.empresas.map((e) =>
            e.id === id ? { ...e, ...updates } : e
          ),
          empresaActiva:
            state.empresaActiva?.id === id
              ? { ...state.empresaActiva, ...updates }
              : state.empresaActiva,
        })),
      deleteEmpresa: (id) => {
        let removed = false;
        set((state) => {
          const filtered = state.empresas.filter((e) => e.id !== id);
          removed = filtered.length < state.empresas.length;
          return {
            empresas: filtered,
            empresaActiva:
              state.empresaActiva?.id === id
                ? filtered[0] || null
                : state.empresaActiva,
          };
        });
        return removed;
      },
      validarRUTEmpresa: (rut) => {
        const rutLimpio = rut.replace(/\./g, '').replace(/-/g, '');
        if (rutLimpio.length < 8) return false;
        const numeros = rutLimpio.slice(0, -1);
        const dv = rutLimpio.slice(-1).toUpperCase();
        let suma = 0;
        let multiplicador = 2;
        for (let i = numeros.length - 1; i >= 0; i--) {
          suma += parseInt(numeros[i]) * multiplicador;
          multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
        }
        const resto = suma % 11;
        const dvCalculado = resto === 0 ? '0' : resto === 1 ? 'K' : String(11 - resto);
        return dv === dvCalculado;
      },
      esEmpresaSimple: (rut) => {
        const rutLimpio = rut.replace(/\./g, '').replace(/-/g, '');
        const numeros = rutLimpio.slice(0, -1);
        const acumulador = numeros.split('').reduce((sum, n) => sum + parseInt(n), 0);
        return acumulador <= 1000;
      },
      cambiarEmpresa: (id) => {
        const empresa = get().empresas.find((e) => e.id === id);
        if (!empresa) return;
        set({ empresaActiva: empresa });
        localStorage.removeItem('contable_documentos');
        localStorage.removeItem('contable_asientos');
        localStorage.removeItem('contable_trabajadores');
        window.location.reload();
      },

      addNotificacion: (notificacion) =>
        set((state) => ({
          notificaciones: [
            {
              ...notificacion,
              id: crypto.randomUUID(),
              fecha: new Date().toISOString(),
              leida: false,
            },
            ...state.notificaciones,
          ],
          notificacionesNoLeidas: state.notificacionesNoLeidas + 1,
        })),
      marcarLeida: (id) =>
        set((state) => ({
          notificaciones: state.notificaciones.map((n) =>
            n.id === id ? { ...n, leida: true } : n
          ),
          notificacionesNoLeidas: Math.max(
            0,
            state.notificacionesNoLeidas - 1
          ),
        })),
      marcarTodasLeidas: () =>
        set((state) => ({
          notificaciones: state.notificaciones.map((n) => ({
            ...n,
            leida: true,
          })),
          notificacionesNoLeidas: 0,
        })),
      eliminarNotificacion: (id) =>
        set((state) => ({
          notificaciones: state.notificaciones.filter((n) => n.id !== id),
          notificacionesNoLeidas: state.notificaciones.find((n) => n.id === id)
            ?.leida
            ? state.notificacionesNoLeidas
            : Math.max(0, state.notificacionesNoLeidas - 1),
        })),

      addTarea: (tarea) =>
        set((state) => ({
          tareas: [
            ...state.tareas,
            {
              ...tarea,
              id: crypto.randomUUID(),
              fechaCreacion: new Date().toISOString(),
              completada: false,
            },
          ],
        })),
      toggleTarea: (id) =>
        set((state) => ({
          tareas: state.tareas.map((t) =>
            t.id === id ? { ...t, completada: !t.completada } : t
          ),
        })),
      deleteTarea: (id) =>
        set((state) => ({
          tareas: state.tareas.filter((t) => t.id !== id),
        })),

      addToast: (toast) => {
        const id = crypto.randomUUID();
        set((state) => ({
          toasts: [...state.toasts, { ...toast, id }],
        }));
        setTimeout(() => {
          get().removeToast(id);
        }, toast.duration ?? 4000);
      },
      removeToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        })),
    }),
    {
      name: 'app-storage',
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        theme: state.theme,
        empresaActiva: state.empresaActiva,
        empresas: state.empresas,
        notificaciones: state.notificaciones,
        tareas: state.tareas,
        notificacionesNoLeidas: state.notificacionesNoLeidas,
      }),
      onRehydrateStorage: () => {
        return (state) => {
          if (state && state.empresas.length === 0) {
            state.setEmpresas([]);
            if (state.empresaActiva === null) {
              const demo = getEmpresasDemo();
              if (demo.length > 0) {
                state.setEmpresaActiva(demo[0]);
              }
            }
          }
        };
      },
    }
  )
);

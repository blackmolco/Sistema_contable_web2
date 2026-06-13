import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Cuenta {
  id: string;
  codigo: string;
  nombre: string;
  tipo: 'activo' | 'pasivo' | 'patrimonio' | 'ingreso' | 'gasto' | 'costo';
  nivel: number;
  padreId?: string;
  saldoDeudor: number;
  saldoAcreedor: number;
  afectoIVA: boolean;
  rutina?: string;
}

export interface DetalleAsiento {
  cuentaId: string;
  cuentaCodigo: string;
  cuentaNombre: string;
  debe: number;
  haber: number;
  glosa: string;
}

export interface AsientoContable {
  id: string;
  numero: number;
  fecha: string;
  glosa: string;
  detalle: DetalleAsiento[];
  totalDebe: number;
  totalHaber: number;
  estado: 'pendiente' | 'contabilizado' | 'anulado';
  usuarioId?: string;
  createdAt: string;
}

interface ContabilidadState {
  // Estado
  cuentas: Cuenta[];
  asientos: AsientoContable[];
  periodoActual: string;
  selectedCuentaId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions - Cuentas
  setCuentas: (cuentas: Cuenta[]) => void;
  addCuenta: (cuenta: Cuenta) => void;
  updateCuenta: (id: string, updates: Partial<Cuenta>) => void;
  deleteCuenta: (id: string) => void;

  // Actions - Asientos
  setAsientos: (asientos: AsientoContable[]) => void;
  addAsiento: (asiento: AsientoContable) => void;
  updateAsiento: (id: string, updates: Partial<AsientoContable>) => void;
  deleteAsiento: (id: string) => void;
  contabilizarAsiento: (id: string) => void;
  anularAsiento: (id: string) => void;

  // Actions - Periodo
  setPeriodo: (periodo: string) => void;
  setSelectedCuenta: (id: string | null) => void;

  // Computed
  getCuentaById: (id: string) => Cuenta | undefined;
  getAsientosByPeriodo: (periodo: string) => AsientoContable[];
  getTotalDebeHaber: () => { totalDebe: number; totalHaber: number };
}

export const useContabilidadStore = create<ContabilidadState>()(
  persist(
    (set, get) => ({
      cuentas: [],
      asientos: [],
      periodoActual: new Date().toISOString().slice(0, 7),
      selectedCuentaId: null,
      isLoading: false,
      error: null,

      setCuentas: (cuentas) => set({ cuentas }),
      addCuenta: (cuenta) =>
        set((state) => ({ cuentas: [...state.cuentas, cuenta] })),
      updateCuenta: (id, updates) =>
        set((state) => ({
          cuentas: state.cuentas.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        })),
      deleteCuenta: (id) =>
        set((state) => ({
          cuentas: state.cuentas.filter((c) => c.id !== id),
        })),

      setAsientos: (asientos) => set({ asientos }),
      addAsiento: (asiento) =>
        set((state) => ({ asientos: [...state.asientos, asiento] })),
      updateAsiento: (id, updates) =>
        set((state) => ({
          asientos: state.asientos.map((a) =>
            a.id === id ? { ...a, ...updates } : a
          ),
        })),
      deleteAsiento: (id) =>
        set((state) => ({
          asientos: state.asientos.filter((a) => a.id !== id),
        })),
      contabilizarAsiento: (id) =>
        set((state) => ({
          asientos: state.asientos.map((a) =>
            a.id === id ? { ...a, estado: 'contabilizado' } : a
          ),
        })),
      anularAsiento: (id) =>
        set((state) => ({
          asientos: state.asientos.map((a) =>
            a.id === id ? { ...a, estado: 'anulado' } : a
          ),
        })),

      setPeriodo: (periodo) => set({ periodoActual: periodo }),
      setSelectedCuenta: (id) => set({ selectedCuentaId: id }),

      getCuentaById: (id) => get().cuentas.find((c) => c.id === id),
      getAsientosByPeriodo: (periodo) =>
        get().asientos.filter((a) => a.fecha.startsWith(periodo)),
      getTotalDebeHaber: () => {
        const asientos = get().asientos.filter(
          (a) => a.estado === 'contabilizado'
        );
        return asientos.reduce(
          (acc, a) => ({
            totalDebe: acc.totalDebe + a.totalDebe,
            totalHaber: acc.totalHaber + a.totalHaber,
          }),
          { totalDebe: 0, totalHaber: 0 }
        );
      },
    }),
    {
      name: 'contabilidad-storage',
      partialize: (state) => ({
        cuentas: state.cuentas,
        asientos: state.asientos,
        periodoActual: state.periodoActual,
      }),
    }
  )
);

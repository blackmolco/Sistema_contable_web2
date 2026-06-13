import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Trabajador {
  id: string;
  rut: string;
  nombres: string;
  apellidos: string;
  email: string;
  fechaIngreso: string;
  fechaTermino?: string;
  tipoContrato: 'indefinido' | 'plazo_fijo' | 'por_obra' | 'honorarios' | 'practica';
  sueldoBase: number;
  afp: string;
  isapre: string;
  saludPactada: number;
  estado: 'activo' | 'suspendido' | 'desvinculado';
  asignacionFamiliar?: boolean;
  cargasFamiliares: number;
  sindicalizado?: boolean;
}

export interface LiquidacionSueldo {
  id: string;
  trabajadorId: string;
  periodo: string;
  sueldoBase: number;
  bonos: number;
  horasExtras: number;
  totalImponible: number;
  descuentoAFP: number;
  descuentoSalud: number;
  descuentoImpuesto: number;
  otrosDescuentos: number;
  totalDescuentos: number;
  sueldoLiquido: number;
  estado: 'calculada' | 'pagada' | 'anulada';
  fechaPago?: string;
}

interface RemuneracionesState {
  trabajadores: Trabajador[];
  liquidaciones: LiquidacionSueldo[];
  selectedTrabajadorId: string | null;
  periodoActual: string;
  isLoading: boolean;
  error: string | null;

  setTrabajadores: (trabajadores: Trabajador[]) => void;
  addTrabajador: (t: Trabajador) => void;
  updateTrabajador: (id: string, updates: Partial<Trabajador>) => void;
  deleteTrabajador: (id: string) => void;

  setLiquidaciones: (liquidaciones: LiquidacionSueldo[]) => void;
  addLiquidacion: (l: LiquidacionSueldo) => void;
  updateLiquidacion: (id: string, updates: Partial<LiquidacionSueldo>) => void;

  setPeriodoActual: (periodo: string) => void;
  setSelectedTrabajador: (id: string | null) => void;

  getTrabajadorById: (id: string) => Trabajador | undefined;
  getTrabajadoresActivos: () => Trabajador[];
  getLiquidacionesByPeriodo: (periodo: string) => LiquidacionSueldo[];
  getResumenPeriodo: (periodo: string) => {
    totalTrabajadores: number;
    totalSueldos: number;
    totalAPF: number;
    totalSalud: number;
    totalImpuesto: number;
    totalLiquido: number;
  };
}

export const useRemuneracionesStore = create<RemuneracionesState>()(
  persist(
    (set, get) => ({
      trabajadores: [],
      liquidaciones: [],
      selectedTrabajadorId: null,
      periodoActual: new Date().toISOString().slice(0, 7),
      isLoading: false,
      error: null,

      setTrabajadores: (trabajadores) => set({ trabajadores }),
      addTrabajador: (t) =>
        set((state) => ({ trabajadores: [...state.trabajadores, t] })),
      updateTrabajador: (id, updates) =>
        set((state) => ({
          trabajadores: state.trabajadores.map((tr) =>
            tr.id === id ? { ...tr, ...updates } : tr
          ),
        })),
      deleteTrabajador: (id) =>
        set((state) => ({
          trabajadores: state.trabajadores.filter((t) => t.id !== id),
        })),

      setLiquidaciones: (liquidaciones) => set({ liquidaciones }),
      addLiquidacion: (l) =>
        set((state) => ({ liquidaciones: [...state.liquidaciones, l] })),
      updateLiquidacion: (id, updates) =>
        set((state) => ({
          liquidaciones: state.liquidaciones.map((l) =>
            l.id === id ? { ...l, ...updates } : l
          ),
        })),

      setPeriodoActual: (periodo) => set({ periodoActual: periodo }),
      setSelectedTrabajador: (id) => set({ selectedTrabajadorId: id }),

      getTrabajadorById: (id) => get().trabajadores.find((t) => t.id === id),
      getTrabajadoresActivos: () =>
        get().trabajadores.filter((t) => t.estado === 'activo'),

      getLiquidacionesByPeriodo: (periodo) =>
        get().liquidaciones.filter((l) => l.periodo === periodo),

      getResumenPeriodo: (periodo) => {
        const liquidaciones = get().liquidaciones.filter(
          (l) => l.periodo === periodo
        );
        return liquidaciones.reduce(
          (acc, l) => ({
            totalTrabajadores: acc.totalTrabajadores + 1,
            totalSueldos: acc.totalSueldos + l.totalImponible,
            totalAPF: acc.totalAPF + l.descuentoAFP,
            totalSalud: acc.totalSalud + l.descuentoSalud,
            totalImpuesto: acc.totalImpuesto + l.descuentoImpuesto,
            totalLiquido: acc.totalLiquido + l.sueldoLiquido,
          }),
          {
            totalTrabajadores: 0,
            totalSueldos: 0,
            totalAPF: 0,
            totalSalud: 0,
            totalImpuesto: 0,
            totalLiquido: 0,
          }
        );
      },
    }),
    {
      name: 'remuneraciones-storage',
      partialize: (state) => ({
        trabajadores: state.trabajadores,
        liquidaciones: state.liquidaciones,
        periodoActual: state.periodoActual,
      }),
    }
  )
);

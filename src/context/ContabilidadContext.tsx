import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback, ReactNode } from 'react';
import { Cuenta, AsientoContable, RegistroLibro, PlantillaAsiento } from '../types';
import { PLAN_CUENTAS_DEFAULT } from '../data/normativa';
import { storageKey } from '../utils/empresaStorage';
import {
  isAuthenticated,
  fetchCuentas, saveCuenta, updateCuenta, deleteCuenta,
  fetchAsientos, saveAsiento, updateAsientoEstado, deleteAsiento,
} from '../services/apiSync';
import { useAppStore } from '../stores/appStore';

const STORAGE_KEY = storageKey('scc_contabilidad');

// ============ ESTADO ============
export interface ContabilidadState {
  cuentas: Cuenta[];
  asientos: AsientoContable[];
  numeroAsiento: number;
  libroVentas: RegistroLibro[];
  libroCompras: RegistroLibro[];
  rutCuentas: Record<string, { cuentaCodigo: string; cuentaNombre: string }>;
  plantillas: PlantillaAsiento[];
}

const initialState: ContabilidadState = {
  cuentas: PLAN_CUENTAS_DEFAULT,
  asientos: [],
  numeroAsiento: 1,
  libroVentas: [],
  libroCompras: [],
  rutCuentas: {},
  plantillas: [],
};

function initFromStorage(): ContabilidadState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...initialState, ...JSON.parse(raw) };
  } catch { /* datos corruptos — usar defaults */ }
  return initialState;
}

// ============ ACCIONES ============
export type ContabilidadAction =
  | { type: 'ADD_CUENTA'; payload: Cuenta }
  | { type: 'UPDATE_CUENTA'; payload: Cuenta }
  | { type: 'DELETE_CUENTA'; payload: string }
  | { type: 'ADD_ASIENTO'; payload: AsientoContable }
  | { type: 'UPDATE_ASIENTO'; payload: AsientoContable }
  | { type: 'DELETE_ASIENTO'; payload: string }
  | { type: 'ADD_REGISTRO_VENTA'; payload: RegistroLibro }
  | { type: 'ADD_REGISTRO_COMPRA'; payload: RegistroLibro }
  | { type: 'SET_RUT_CUENTA'; payload: { rut: string; cuentaCodigo: string; cuentaNombre: string } }
  | { type: 'ADD_PLANTILLA'; payload: PlantillaAsiento }
  | { type: 'UPDATE_PLANTILLA'; payload: PlantillaAsiento }
  | { type: 'DELETE_PLANTILLA'; payload: string }
  | { type: 'INCREMENT_USO_PLANTILLA'; payload: string }
  | { type: 'LOAD_CONTABILIDAD'; payload: Partial<ContabilidadState> };

// ============ REDUCER ============
function reducer(state: ContabilidadState, action: ContabilidadAction): ContabilidadState {
  switch (action.type) {
    case 'ADD_CUENTA':
      return { ...state, cuentas: [...state.cuentas, action.payload] };
    case 'UPDATE_CUENTA':
      return { ...state, cuentas: state.cuentas.map(c => c.id === action.payload.id ? action.payload : c) };
    case 'DELETE_CUENTA':
      return { ...state, cuentas: state.cuentas.filter(c => c.id !== action.payload) };
    case 'ADD_ASIENTO':
      return { ...state, asientos: [...state.asientos, action.payload], numeroAsiento: state.numeroAsiento + 1 };
    case 'UPDATE_ASIENTO':
      return { ...state, asientos: state.asientos.map(a => a.id === action.payload.id ? action.payload : a) };
    case 'DELETE_ASIENTO':
      return { ...state, asientos: state.asientos.filter(a => a.id !== action.payload) };
    case 'ADD_REGISTRO_VENTA':
      return { ...state, libroVentas: [...state.libroVentas, action.payload] };
    case 'ADD_REGISTRO_COMPRA':
      return { ...state, libroCompras: [...state.libroCompras, action.payload] };
    case 'SET_RUT_CUENTA':
      return {
        ...state,
        rutCuentas: {
          ...state.rutCuentas,
          [action.payload.rut]: { cuentaCodigo: action.payload.cuentaCodigo, cuentaNombre: action.payload.cuentaNombre },
        },
      };
    case 'ADD_PLANTILLA':
      return { ...state, plantillas: [...(state.plantillas ?? []), action.payload] };
    case 'UPDATE_PLANTILLA':
      return { ...state, plantillas: (state.plantillas ?? []).map(p => p.id === action.payload.id ? action.payload : p) };
    case 'DELETE_PLANTILLA':
      return { ...state, plantillas: (state.plantillas ?? []).filter(p => p.id !== action.payload) };
    case 'INCREMENT_USO_PLANTILLA':
      return { ...state, plantillas: (state.plantillas ?? []).map(p => p.id === action.payload ? { ...p, usosCount: p.usosCount + 1 } : p) };
    case 'LOAD_CONTABILIDAD':
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

// ============ CONTEXTO ============
interface ContabilidadContextType {
  state: ContabilidadState;
  dispatch: React.Dispatch<ContabilidadAction>;
}

const ContabilidadContext = createContext<ContabilidadContextType | undefined>(undefined);

export function ContabilidadProvider({ children }: { children: ReactNode }) {
  const [state, baseDispatch] = useReducer(reducer, undefined, initFromStorage);
  const stateRef = useRef(state);
  const isFirstRender = useRef(true);
  const loadedForEmpresa = useRef<string | null>(null);
  const empresaId = useAppStore(s => s.empresaActiva?.id ?? null);

  stateRef.current = state;

  // Persist to localStorage
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Load from API when empresa changes; if API empty, push local data (migración)
  useEffect(() => {
    if (!isAuthenticated() || !empresaId) return;
    if (loadedForEmpresa.current === empresaId) return;
    loadedForEmpresa.current = empresaId;

    Promise.all([
      fetchCuentas(),
      fetchAsientos(),
    ]).then(async ([apiCuentas, apiAsientos]) => {
      if (apiCuentas.length > 0 || apiAsientos.length > 0) {
        // API tiene datos → usarlos como fuente de verdad
        baseDispatch({
          type: 'LOAD_CONTABILIDAD',
          payload: {
            cuentas: apiCuentas.length > 0 ? apiCuentas : undefined,
            asientos: apiAsientos,
            numeroAsiento: apiAsientos.length > 0
              ? Math.max(...apiAsientos.map(a => a.numero), 0) + 1
              : undefined,
          },
        });
      } else {
        // API vacía → subir datos locales al servidor (migración única)
        const local = stateRef.current;
        // Subir cuentas ordenadas por nivel (padres antes que hijos, FK constraint)
        const cuentasOrdenadas = [...local.cuentas].sort((a, b) => (a.nivel ?? 1) - (b.nivel ?? 1));
        for (const c of cuentasOrdenadas) {
          await saveCuenta(c).catch(() => {});
        }
        for (const a of local.asientos) {
          await saveAsiento(a).catch(() => {});
        }
      }
    }).catch(() => { /* sin conexión — usar localStorage */ });
  }, [empresaId]);

  // Dispatch interceptor: sync writes to API
  const dispatch = useCallback((action: ContabilidadAction) => {
    baseDispatch(action);
    if (!isAuthenticated()) return;

    switch (action.type) {
      case 'ADD_CUENTA':
        saveCuenta(action.payload).catch(() => {});
        break;
      case 'UPDATE_CUENTA':
        updateCuenta(action.payload).catch(() => {});
        break;
      case 'DELETE_CUENTA':
        deleteCuenta(action.payload).catch(() => {});
        break;
      case 'ADD_ASIENTO':
        saveAsiento(action.payload).catch(() => {});
        break;
      case 'UPDATE_ASIENTO':
        updateAsientoEstado(action.payload.id, action.payload.estado).catch(() => {});
        break;
      case 'DELETE_ASIENTO':
        deleteAsiento(action.payload).catch(() => {});
        break;
    }
  }, []);

  return (
    <ContabilidadContext.Provider value={{ state, dispatch }}>
      {children}
    </ContabilidadContext.Provider>
  );
}

export function useContabilidad() {
  const ctx = useContext(ContabilidadContext);
  if (!ctx) throw new Error('useContabilidad debe usarse dentro de ContabilidadProvider');
  return ctx;
}

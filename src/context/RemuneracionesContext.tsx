import React, { createContext, useContext, useReducer, useEffect, useRef, ReactNode } from 'react';
import { Trabajador, LiquidacionPeriodo } from '../types';
import { storageKey } from '../utils/empresaStorage';

const STORAGE_KEY = storageKey('scc_remuneraciones');

// ============ ESTADO ============
export interface RemuneracionesState {
  trabajadores: Trabajador[];
  liquidaciones: LiquidacionPeriodo[];
}

const initialState: RemuneracionesState = {
  trabajadores: [],
  liquidaciones: [],
};

// Lee localStorage de forma síncrona al inicializar — evita el bug de
// React 18 StrictMode donde el efecto de guardado corre antes que el de carga.
function initFromStorage(): RemuneracionesState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...initialState, ...JSON.parse(raw) };
  } catch { /* datos corruptos — usar defaults */ }
  return initialState;
}

// ============ ACCIONES ============
export type RemuneracionesAction =
  | { type: 'ADD_TRABAJADOR'; payload: Trabajador }
  | { type: 'UPDATE_TRABAJADOR'; payload: Trabajador }
  | { type: 'DELETE_TRABAJADOR'; payload: string }
  | { type: 'ADD_LIQUIDACION'; payload: LiquidacionPeriodo }
  | { type: 'DELETE_LIQUIDACION'; payload: string }   // payload = periodo 'YYYY-MM'
  | { type: 'LOAD_REMUNERACIONES'; payload: Partial<RemuneracionesState> };

// ============ REDUCER ============
function reducer(state: RemuneracionesState, action: RemuneracionesAction): RemuneracionesState {
  switch (action.type) {
    case 'ADD_TRABAJADOR':
      return { ...state, trabajadores: [...state.trabajadores, action.payload] };
    case 'UPDATE_TRABAJADOR':
      return { ...state, trabajadores: state.trabajadores.map(t => t.id === action.payload.id ? action.payload : t) };
    case 'DELETE_TRABAJADOR':
      return { ...state, trabajadores: state.trabajadores.filter(t => t.id !== action.payload) };
    case 'ADD_LIQUIDACION': {
      // Si ya existe una para el mismo período, la reemplaza
      const sinDuplicado = (state.liquidaciones || []).filter(l => l.periodo !== action.payload.periodo);
      return { ...state, liquidaciones: [...sinDuplicado, action.payload] };
    }
    case 'DELETE_LIQUIDACION':
      return { ...state, liquidaciones: (state.liquidaciones || []).filter(l => l.periodo !== action.payload) };
    case 'LOAD_REMUNERACIONES':
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

// ============ CONTEXTO ============
interface RemuneracionesContextType {
  state: RemuneracionesState;
  dispatch: React.Dispatch<RemuneracionesAction>;
}

const RemuneracionesContext = createContext<RemuneracionesContextType | undefined>(undefined);

export function RemuneracionesProvider({ children }: { children: ReactNode }) {
  // initFromStorage se llama una sola vez como inicializador de useReducer
  const [state, dispatch] = useReducer(reducer, undefined, initFromStorage);

  // Ref para saber si ya pasamos el primer render — evita guardar el estado
  // vacío antes de que initFromStorage haya poblado el estado inicial.
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return; // no guardar en el primer render: ya está en localStorage
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  return (
    <RemuneracionesContext.Provider value={{ state, dispatch }}>
      {children}
    </RemuneracionesContext.Provider>
  );
}

export function useRemuneraciones() {
  const ctx = useContext(RemuneracionesContext);
  if (!ctx) throw new Error('useRemuneraciones debe usarse dentro de RemuneracionesProvider');
  return ctx;
}

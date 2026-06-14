import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback, ReactNode } from 'react';
import { Trabajador, LiquidacionPeriodo } from '../types';
import { storageKey } from '../utils/empresaStorage';
import { isAuthenticated, fetchTrabajadores, saveTrabajador, updateTrabajador, deleteTrabajador } from '../services/apiSync';

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
  | { type: 'DELETE_LIQUIDACION'; payload: string }
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
  const [state, baseDispatch] = useReducer(reducer, undefined, initFromStorage);
  const stateRef = useRef(state);
  const isFirstRender = useRef(true);
  const apiLoaded = useRef(false);

  stateRef.current = state;

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (apiLoaded.current || !isAuthenticated()) return;
    apiLoaded.current = true;

    fetchTrabajadores().then(trabajadores => {
      if (trabajadores.length > 0) {
        baseDispatch({ type: 'LOAD_REMUNERACIONES', payload: { trabajadores } });
      } else {
        // Migración: subir trabajadores locales al servidor
        stateRef.current.trabajadores.forEach(t => saveTrabajador(t).catch(() => {}));
      }
    }).catch(() => {});
  }, []);

  const dispatch = useCallback((action: RemuneracionesAction) => {
    baseDispatch(action);
    if (!isAuthenticated()) return;

    switch (action.type) {
      case 'ADD_TRABAJADOR':
        saveTrabajador(action.payload).catch(() => {});
        break;
      case 'UPDATE_TRABAJADOR':
        updateTrabajador(action.payload).catch(() => {});
        break;
      case 'DELETE_TRABAJADOR':
        deleteTrabajador(action.payload).catch(() => {});
        break;
    }
  }, []);

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

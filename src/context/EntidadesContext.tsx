import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback, ReactNode } from 'react';
import { Entidad } from '../types';
import { storageKey } from '../utils/empresaStorage';
import { useAppStore } from '../stores/appStore';
import { useAuthStore } from '../stores/authStore';
import { isAuthenticated, fetchEntidades, saveEntidad, updateEntidad, deleteEntidad } from '../services/apiSync';

const STORAGE_KEY = storageKey('scc_entidades');

// ============ ESTADO ============
export interface EntidadesState {
  entidades: Entidad[];
}

const initialState: EntidadesState = { entidades: [] };

function initFromStorage(): EntidadesState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...initialState, ...JSON.parse(raw) };
  } catch { /* datos corruptos — usar defaults */ }
  return initialState;
}

// ============ ACCIONES ============
export type EntidadesAction =
  | { type: 'ADD_ENTIDAD'; payload: Entidad }
  | { type: 'UPDATE_ENTIDAD'; payload: Entidad }
  | { type: 'DELETE_ENTIDAD'; payload: string }
  | { type: 'LOAD_ENTIDADES'; payload: Partial<EntidadesState> };

// ============ REDUCER ============
// Upsert por rut: si ya existe una entidad con ese rut, se actualiza en vez
// de duplicarla (el ingreso de un documento nuevo para un RUT conocido no
// debe crear una segunda fila).
function reducer(state: EntidadesState, action: EntidadesAction): EntidadesState {
  switch (action.type) {
    case 'ADD_ENTIDAD': {
      const existente = state.entidades.find(e => e.rut === action.payload.rut);
      if (existente) {
        return { ...state, entidades: state.entidades.map(e => e.rut === action.payload.rut ? { ...action.payload, id: existente.id } : e) };
      }
      return { ...state, entidades: [...state.entidades, action.payload] };
    }
    case 'UPDATE_ENTIDAD':
      return { ...state, entidades: state.entidades.map(e => e.id === action.payload.id ? action.payload : e) };
    case 'DELETE_ENTIDAD':
      return { ...state, entidades: state.entidades.filter(e => e.id !== action.payload) };
    case 'LOAD_ENTIDADES':
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

// ============ CONTEXTO ============
interface EntidadesContextType {
  state: EntidadesState;
  dispatch: React.Dispatch<EntidadesAction>;
}

const EntidadesContext = createContext<EntidadesContextType | undefined>(undefined);

export function EntidadesProvider({ children }: { children: ReactNode }) {
  const [state, baseDispatch] = useReducer(reducer, undefined, initFromStorage);
  const isFirstRender = useRef(true);
  const loadedForEmpresa = useRef<string | null>(null);
  const empresaId = useAppStore(s => s.empresaActiva?.id ?? null);
  const authReady = useAuthStore(s => s.isAuthenticated);

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    const cargar = () => {
      if (!isAuthenticated() || loadedForEmpresa.current === empresaId) return;
      loadedForEmpresa.current = empresaId;
      fetchEntidades().then(entidades => {
        baseDispatch({ type: 'LOAD_ENTIDADES', payload: { entidades } });
      }).catch(() => {});
    };
    const cargarForzado = () => { loadedForEmpresa.current = null; cargar(); };
    if (authReady) cargar();
    window.addEventListener('scc:login', cargarForzado);
    return () => window.removeEventListener('scc:login', cargarForzado);
  }, [empresaId, authReady]);

  const dispatch = useCallback((action: EntidadesAction) => {
    baseDispatch(action);
    if (!isAuthenticated()) return;
    switch (action.type) {
      case 'ADD_ENTIDAD':
        saveEntidad(action.payload).catch(() => {});
        break;
      case 'UPDATE_ENTIDAD':
        updateEntidad(action.payload).catch(() => {});
        break;
      case 'DELETE_ENTIDAD':
        deleteEntidad(action.payload).catch(() => {});
        break;
    }
  }, []);

  return (
    <EntidadesContext.Provider value={{ state, dispatch }}>
      {children}
    </EntidadesContext.Provider>
  );
}

export function useEntidades() {
  const ctx = useContext(EntidadesContext);
  if (!ctx) throw new Error('useEntidades debe usarse dentro de EntidadesProvider');
  return ctx;
}

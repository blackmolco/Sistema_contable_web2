import React, { createContext, useContext, useReducer, useEffect, useRef, ReactNode } from 'react';
import { DocumentoTributario, Honorario } from '../types';

const STORAGE_KEY = 'scc_facturacion';

// ============ ESTADO ============
export interface FacturacionState {
  documentos: DocumentoTributario[];
  numeroDocumento: number;
  honorarios: Honorario[];
}

const initialState: FacturacionState = {
  documentos: [],
  numeroDocumento: 1,
  honorarios: [],
};

function initFromStorage(): FacturacionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...initialState, ...JSON.parse(raw) };
  } catch { /* datos corruptos — usar defaults */ }
  return initialState;
}

// ============ ACCIONES ============
export type FacturacionAction =
  | { type: 'ADD_DOCUMENTO'; payload: DocumentoTributario }
  | { type: 'BATCH_ADD_DOCUMENTOS'; payload: DocumentoTributario[] }
  | { type: 'UPDATE_DOCUMENTO'; payload: DocumentoTributario }
  | { type: 'DELETE_DOCUMENTO'; payload: string }
  | { type: 'ADD_HONORARIO'; payload: Honorario }
  | { type: 'UPDATE_HONORARIO'; payload: Honorario }
  | { type: 'DELETE_HONORARIO'; payload: string }
  | { type: 'LOAD_FACTURACION'; payload: Partial<FacturacionState> };

// ============ REDUCER ============
function reducer(state: FacturacionState, action: FacturacionAction): FacturacionState {
  switch (action.type) {
    case 'ADD_DOCUMENTO':
      return { ...state, documentos: [...state.documentos, action.payload], numeroDocumento: state.numeroDocumento + 1 };
    case 'BATCH_ADD_DOCUMENTOS':
      return { ...state, documentos: [...state.documentos, ...action.payload], numeroDocumento: state.numeroDocumento + action.payload.length };
    case 'UPDATE_DOCUMENTO':
      return { ...state, documentos: state.documentos.map(d => d.id === action.payload.id ? action.payload : d) };
    case 'DELETE_DOCUMENTO':
      return { ...state, documentos: state.documentos.filter(d => d.id !== action.payload) };
    case 'ADD_HONORARIO':
      return { ...state, honorarios: [...state.honorarios, action.payload] };
    case 'UPDATE_HONORARIO':
      return { ...state, honorarios: state.honorarios.map(h => h.id === action.payload.id ? action.payload : h) };
    case 'DELETE_HONORARIO':
      return { ...state, honorarios: state.honorarios.filter(h => h.id !== action.payload) };
    case 'LOAD_FACTURACION':
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

// ============ CONTEXTO ============
interface FacturacionContextType {
  state: FacturacionState;
  dispatch: React.Dispatch<FacturacionAction>;
}

const FacturacionContext = createContext<FacturacionContextType | undefined>(undefined);

export function FacturacionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initFromStorage);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  return (
    <FacturacionContext.Provider value={{ state, dispatch }}>
      {children}
    </FacturacionContext.Provider>
  );
}

export function useFacturacion() {
  const ctx = useContext(FacturacionContext);
  if (!ctx) throw new Error('useFacturacion debe usarse dentro de FacturacionProvider');
  return ctx;
}

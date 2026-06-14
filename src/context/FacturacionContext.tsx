import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback, ReactNode } from 'react';
import { DocumentoTributario, Honorario } from '../types';
import { storageKey, getEmpresaActivaId } from '../utils/empresaStorage';
import {
  isAuthenticated,
  fetchDocumentos, saveDocumento, updateDocumento,
  fetchHonorarios, saveHonorario, updateHonorario, deleteHonorario,
} from '../services/apiSync';

const STORAGE_KEY = storageKey('scc_facturacion');

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
  const [state, baseDispatch] = useReducer(reducer, undefined, initFromStorage);
  const isFirstRender = useRef(true);
  const apiLoaded = useRef(false);

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Get empresa RUT for documento rutEmisor
  const getEmpresaRut = () => {
    try {
      const raw = localStorage.getItem('app-storage');
      if (raw) {
        const data = JSON.parse(raw);
        return data?.state?.empresaActiva?.rut || '00.000.000-0';
      }
    } catch { /* ignore */ }
    return '00.000.000-0';
  };

  useEffect(() => {
    if (apiLoaded.current || !isAuthenticated()) return;
    const empresaId = getEmpresaActivaId();
    if (empresaId === 'default') return;
    apiLoaded.current = true;

    Promise.all([
      fetchDocumentos(empresaId),
      fetchHonorarios(empresaId),
    ]).then(([documentos, honorarios]) => {
      baseDispatch({
        type: 'LOAD_FACTURACION',
        payload: {
          documentos: documentos.length > 0 ? documentos : undefined,
          honorarios: honorarios.length > 0 ? honorarios : undefined,
          numeroDocumento: documentos.length > 0
            ? Math.max(...documentos.map(d => d.numero), 0) + 1
            : undefined,
        },
      });
    }).catch(() => {});
  }, []);

  const dispatch = useCallback((action: FacturacionAction) => {
    baseDispatch(action);

    if (!isAuthenticated()) return;
    const empresaId = getEmpresaActivaId();
    if (empresaId === 'default') return;

    switch (action.type) {
      case 'ADD_DOCUMENTO':
        saveDocumento(action.payload, empresaId, getEmpresaRut()).catch(() => {});
        break;
      case 'BATCH_ADD_DOCUMENTOS':
        action.payload.forEach(doc => saveDocumento(doc, empresaId, getEmpresaRut()).catch(() => {}));
        break;
      case 'UPDATE_DOCUMENTO':
        updateDocumento(action.payload.id, action.payload.estado).catch(() => {});
        break;
      case 'ADD_HONORARIO':
        saveHonorario(action.payload, empresaId).catch(() => {});
        break;
      case 'UPDATE_HONORARIO':
        updateHonorario(action.payload).catch(() => {});
        break;
      case 'DELETE_HONORARIO':
        deleteHonorario(action.payload).catch(() => {});
        break;
    }
  }, []);

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

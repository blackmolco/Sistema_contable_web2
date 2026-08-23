import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback, ReactNode } from 'react';
import { DocumentoTributario, Honorario } from '../types';
import { storageKey } from '../utils/empresaStorage';
import { useAppStore } from '../stores/appStore';
import { useAuthStore } from '../stores/authStore';
import {
  isAuthenticated,
  fetchDocumentos, saveDocumento, updateDocumento, deleteDocumento,
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
    case 'BATCH_ADD_DOCUMENTOS': {
      const clave = (d: DocumentoTributario) => `${d.tipo}|${d.numero}`;
      const nuevasClaves = new Set(action.payload.map(clave));
      const sinDuplicados = state.documentos.filter(d => !nuevasClaves.has(clave(d)));
      const numNuevos = action.payload.length - (state.documentos.length - sinDuplicados.length);
      return { ...state, documentos: [...sinDuplicados, ...action.payload], numeroDocumento: state.numeroDocumento + Math.max(0, numNuevos) };
    }
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
  const loadedForEmpresa = useRef<string | null>(null);
  const empresaId = useAppStore(s => s.empresaActiva?.id ?? null);
  const authReady = useAuthStore(s => s.isAuthenticated);

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const getEmpresaRut = () => {
    try {
      const raw = localStorage.getItem('app-storage');
      if (raw) return JSON.parse(raw)?.state?.empresaActiva?.rut || '00.000.000-0';
    } catch { /* ignore */ }
    return '00.000.000-0';
  };

  useEffect(() => {
    const cargar = () => {
      if (!isAuthenticated() || loadedForEmpresa.current === empresaId) return;
      loadedForEmpresa.current = empresaId;

      Promise.all([fetchDocumentos(), fetchHonorarios()]).then(([apiDocs, apiHonorarios]) => {
        // El servidor es siempre la fuente de verdad: si esta vacio, el estado local
        // tambien queda vacio (no se re-sube la cache local — eso resucitaba datos
        // ya borrados intencionalmente en el servidor).
        baseDispatch({
          type: 'LOAD_FACTURACION',
          payload: {
            documentos: apiDocs,
            honorarios: apiHonorarios,
            numeroDocumento: apiDocs.length > 0
              ? Math.max(...apiDocs.map(d => d.numero), 0) + 1
              : 1,
          },
        });
      }).catch(() => {});
    };

    // empresaId/authReady (reactivos via zustand) no bastan solos como
    // disparador: el provider se monta antes de que termine el login, y
    // ambos pueden venir precargados (persistidos) de una sesion anterior
    // sin volver a cambiar de valor. 'scc:login' es la señal confiable de
    // que se acaba de iniciar sesion en esta pestaña — fuerza la recarga
    // aunque loadedForEmpresa ya coincida con el empresaId actual.
    const cargarForzado = () => { loadedForEmpresa.current = null; cargar(); };
    if (authReady) cargar();
    window.addEventListener('scc:login', cargarForzado);
    return () => window.removeEventListener('scc:login', cargarForzado);
  }, [empresaId, authReady]);

  const dispatch = useCallback((action: FacturacionAction) => {
    baseDispatch(action);
    if (!isAuthenticated()) return;
    const rut = getEmpresaRut();

    switch (action.type) {
      case 'ADD_DOCUMENTO':
        saveDocumento(action.payload, rut).catch(() => {});
        break;
      case 'BATCH_ADD_DOCUMENTOS':
        action.payload.forEach(doc => saveDocumento(doc, rut).catch(() => {}));
        break;
      case 'UPDATE_DOCUMENTO':
        updateDocumento(action.payload.id, action.payload.estado).catch(() => {});
        break;
      case 'DELETE_DOCUMENTO':
        deleteDocumento(action.payload).catch(() => {});
        break;
      case 'ADD_HONORARIO':
        saveHonorario(action.payload).catch(() => {});
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

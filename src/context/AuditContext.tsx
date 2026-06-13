import React, { createContext, useContext, useReducer, useEffect, useRef, ReactNode } from 'react';

export type AuditAccion = 'crear' | 'actualizar' | 'eliminar' | 'login' | 'backup' | 'importar';
export type AuditModulo =
  | 'asientos' | 'cuentas' | 'clientes' | 'cxc' | 'cxp' | 'notas'
  | 'facturas' | 'honorarios' | 'trabajadores' | 'liquidaciones'
  | 'inventario' | 'configuracion' | 'backup' | 'importar' | 'sistema';

export interface AuditEvent {
  id: string;
  fecha: string;         // ISO string
  accion: AuditAccion;
  modulo: AuditModulo;
  descripcion: string;
  detalle?: string;
}

interface AuditState {
  eventos: AuditEvent[];
}

type AuditAction =
  | { type: 'ADD_EVENTO'; payload: AuditEvent }
  | { type: 'CLEAR_LOG' };

const STORAGE_KEY = 'scc_audit';
const MAX_EVENTOS = 500;

function initFromStorage(): AuditState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /**/ }
  return { eventos: [] };
}

function reducer(state: AuditState, action: AuditAction): AuditState {
  switch (action.type) {
    case 'ADD_EVENTO': {
      const eventos = [action.payload, ...state.eventos].slice(0, MAX_EVENTOS);
      return { eventos };
    }
    case 'CLEAR_LOG':
      return { eventos: [] };
    default:
      return state;
  }
}

interface AuditContextType {
  state: AuditState;
  logEvent: (accion: AuditAccion, modulo: AuditModulo, descripcion: string, detalle?: string) => void;
  clearLog: () => void;
}

const AuditContext = createContext<AuditContextType | undefined>(undefined);

export function AuditProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initFromStorage);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const logEvent = (accion: AuditAccion, modulo: AuditModulo, descripcion: string, detalle?: string) => {
    dispatch({
      type: 'ADD_EVENTO',
      payload: {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        fecha: new Date().toISOString(),
        accion,
        modulo,
        descripcion,
        detalle,
      },
    });
  };

  const clearLog = () => dispatch({ type: 'CLEAR_LOG' });

  return (
    <AuditContext.Provider value={{ state, logEvent, clearLog }}>
      {children}
    </AuditContext.Provider>
  );
}

export function useAudit() {
  const ctx = useContext(AuditContext);
  if (!ctx) throw new Error('useAudit debe usarse dentro de AuditProvider');
  return ctx;
}

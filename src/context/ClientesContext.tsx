import React, { createContext, useContext, useReducer, useEffect, useRef, ReactNode } from 'react';
import {
  ClienteProveedor,
  CuentaCobrar,
  CuentaPagar,
  NotaCreditoDebito,
} from '../types';

const STORAGE_KEY = 'scc_clientes';

// ============ ESTADO ============
export interface ClientesState {
  clientes: ClienteProveedor[];
  cuentasCobrar: CuentaCobrar[];
  cuentasPagar: CuentaPagar[];
  notas: NotaCreditoDebito[];
  numeroNota: number;
}

const initialState: ClientesState = {
  clientes: [],
  cuentasCobrar: [],
  cuentasPagar: [],
  notas: [],
  numeroNota: 1,
};

function initFromStorage(): ClientesState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...initialState, ...JSON.parse(raw) };
  } catch { /* datos corruptos */ }
  return initialState;
}

// ============ ACCIONES ============
export type ClientesAction =
  | { type: 'ADD_CLIENTE';     payload: ClienteProveedor }
  | { type: 'UPDATE_CLIENTE';  payload: ClienteProveedor }
  | { type: 'DELETE_CLIENTE';  payload: string }
  | { type: 'ADD_CXC';         payload: CuentaCobrar }
  | { type: 'UPDATE_CXC';      payload: CuentaCobrar }
  | { type: 'DELETE_CXC';      payload: string }
  | { type: 'ADD_CXP';         payload: CuentaPagar }
  | { type: 'UPDATE_CXP';      payload: CuentaPagar }
  | { type: 'DELETE_CXP';      payload: string }
  | { type: 'ADD_NOTA';        payload: NotaCreditoDebito }
  | { type: 'UPDATE_NOTA';     payload: NotaCreditoDebito }
  | { type: 'DELETE_NOTA';     payload: string }
  | { type: 'LOAD_CLIENTES';   payload: Partial<ClientesState> };

// ============ REDUCER ============
function reducer(state: ClientesState, action: ClientesAction): ClientesState {
  switch (action.type) {
    case 'ADD_CLIENTE':
      return { ...state, clientes: [...state.clientes, action.payload] };
    case 'UPDATE_CLIENTE':
      return { ...state, clientes: state.clientes.map(c => c.id === action.payload.id ? action.payload : c) };
    case 'DELETE_CLIENTE':
      return { ...state, clientes: state.clientes.filter(c => c.id !== action.payload) };

    case 'ADD_CXC':
      return { ...state, cuentasCobrar: [...state.cuentasCobrar, action.payload] };
    case 'UPDATE_CXC':
      return { ...state, cuentasCobrar: state.cuentasCobrar.map(c => c.id === action.payload.id ? action.payload : c) };
    case 'DELETE_CXC':
      return { ...state, cuentasCobrar: state.cuentasCobrar.filter(c => c.id !== action.payload) };

    case 'ADD_CXP':
      return { ...state, cuentasPagar: [...state.cuentasPagar, action.payload] };
    case 'UPDATE_CXP':
      return { ...state, cuentasPagar: state.cuentasPagar.map(c => c.id === action.payload.id ? action.payload : c) };
    case 'DELETE_CXP':
      return { ...state, cuentasPagar: state.cuentasPagar.filter(c => c.id !== action.payload) };

    case 'ADD_NOTA':
      return { ...state, notas: [...state.notas, action.payload], numeroNota: state.numeroNota + 1 };
    case 'UPDATE_NOTA':
      return { ...state, notas: state.notas.map(n => n.id === action.payload.id ? action.payload : n) };
    case 'DELETE_NOTA':
      return { ...state, notas: state.notas.filter(n => n.id !== action.payload) };

    case 'LOAD_CLIENTES':
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

// ============ CONTEXTO ============
interface ClientesContextType {
  state: ClientesState;
  dispatch: React.Dispatch<ClientesAction>;
}

const ClientesContext = createContext<ClientesContextType | undefined>(undefined);

export function ClientesProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initFromStorage);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  return (
    <ClientesContext.Provider value={{ state, dispatch }}>
      {children}
    </ClientesContext.Provider>
  );
}

export function useClientes() {
  const ctx = useContext(ClientesContext);
  if (!ctx) throw new Error('useClientes debe usarse dentro de ClientesProvider');
  return ctx;
}

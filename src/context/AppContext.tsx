import React, { createContext, useContext, useReducer, ReactNode, useEffect, useRef, useCallback } from 'react';
import {
  ConfiguracionEmpresa,
  ToastNotification,
  Documento,
  CategoriaDocumento,
} from '../types';
import { generateId } from '../utils/calculos';
import { ContabilidadProvider, useContabilidad } from './ContabilidadContext';
import { RemuneracionesProvider, useRemuneraciones } from './RemuneracionesContext';
import { FacturacionProvider, useFacturacion } from './FacturacionContext';
import { ClientesProvider, useClientes } from './ClientesContext';
import { AuditProvider, useAudit } from './AuditContext';
import { useAppStore } from '../stores/appStore';

// Re-exportar hooks especializados para acceso directo
export { useContabilidad, useRemuneraciones, useFacturacion, useClientes, useAudit };

const STORAGE_KEY = 'scc_app';
const LEGACY_KEY = 'sistemaContableChile';

// ============ ESTADO UI / CONFIG ============
interface UIState {
  configuracion: ConfiguracionEmpresa;
  archivos: Documento[];
  categorias: CategoriaDocumento[];
  indicadores?: {
    uf: number;
    utm: number;
    dolar: number;
    euro: number;
    fechaActualizacion: string;
  };
}

type UIAction =
  | { type: 'SET_CONFIGURACION'; payload: ConfiguracionEmpresa }
  | { type: 'SET_DOCUMENTOS'; payload: Documento[] }
  | { type: 'ADD_DOCUMENTO_FILE'; payload: Documento }
  | { type: 'UPDATE_DOCUMENTO_FILE'; payload: Documento }
  | { type: 'DELETE_DOCUMENTO_FILE'; payload: string }
  | { type: 'SET_CATEGORIAS'; payload: CategoriaDocumento[] }
  | { type: 'SET_INDICADORES'; payload: { uf: number; utm: number; dolar: number; euro: number; fechaActualizacion: string } }
  | { type: 'LOAD_UI'; payload: Partial<UIState> };

const uiInicial: UIState = {
  configuracion: {
    razonSocial: 'Empresa Demo Chile SpA',
    nombreFantasia: 'DemoChile',
    rut: '76.123.456-7',
    giro: 'Servicios de Consultoría',
    direccion: 'Av. Providencia 1234, Of. 501',
    comuna: 'Providencia',
    ciudad: 'Santiago',
    telefono: '+56 2 2345 6789',
    email: 'contacto@demochile.cl',
    web: 'www.demochile.cl',
    logo: '',
    actividadEconomica: '620900 - Otros servicios de tecnología y consultoría de TI',
    resoluciones: {
      factura: 'Resolución N° 80 de 2024',
      boleta: 'Resolución N° 81 de 2024',
      guia: 'Resolución N° 82 de 2024',
    },
  },
  archivos: [],
  categorias: [
    { id: 1, nombre: 'Contratos', color: '#3b82f6', icono: 'FileText' },
    { id: 2, nombre: 'Facturas', color: '#10b981', icono: 'Receipt' },
    { id: 3, nombre: 'Boletas', color: '#8b5cf6', icono: 'FileCheck' },
    { id: 4, nombre: 'Liquidaciones', color: '#f59e0b', icono: 'Calculator' },
    { id: 5, nombre: 'Certificados', color: '#06b6d4', icono: 'Award' },
    { id: 6, nombre: 'Legal', color: '#ef4444', icono: 'Scale' },
    { id: 7, nombre: 'Informes', color: '#64748b', icono: 'BarChart3' },
    { id: 8, nombre: 'Otros', color: '#6b7280', icono: 'Folder' },
  ],
};

function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'SET_CONFIGURACION':
      return { ...state, configuracion: action.payload };
    case 'SET_DOCUMENTOS':
      return { ...state, archivos: action.payload };
    case 'ADD_DOCUMENTO_FILE':
      return { ...state, archivos: [...state.archivos, action.payload] };
    case 'UPDATE_DOCUMENTO_FILE':
      return { ...state, archivos: state.archivos.map(d => d.id === action.payload.id ? action.payload : d) };
    case 'DELETE_DOCUMENTO_FILE':
      return { ...state, archivos: state.archivos.filter(d => d.id !== action.payload) };
    case 'SET_CATEGORIAS':
      return { ...state, categorias: action.payload };
    case 'SET_INDICADORES':
      return { ...state, indicadores: action.payload };
    case 'LOAD_UI':
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

// ============ UI CONTEXT ============
interface UIContextType {
  state: UIState;
  dispatch: React.Dispatch<UIAction>;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

function initUIFromStorage(): UIState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...uiInicial, ...JSON.parse(raw) };
  } catch { /* datos corruptos */ }
  return uiInicial;
}

function UIProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(uiReducer, undefined, initUIFromStorage);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  return (
    <UIContext.Provider value={{ state, dispatch }}>
      {children}
    </UIContext.Provider>
  );
}

function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI debe usarse dentro de AppProvider');
  return ctx;
}

// ============ MIGRACIÓN DESDE KEY LEGADO ============
function migrateLegacyStorage() {
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (!legacy) return;
  if (localStorage.getItem(STORAGE_KEY)) return;
  try {
    const data = JSON.parse(legacy);
    if (data.cuentas || data.asientos) {
      const { cuentas, asientos, numeroAsiento, libroVentas, libroCompras, rutCuentas } = data;
      localStorage.setItem('scc_contabilidad', JSON.stringify({ cuentas, asientos, numeroAsiento, libroVentas, libroCompras, rutCuentas }));
    }
    if (data.trabajadores) {
      localStorage.setItem('scc_remuneraciones', JSON.stringify({ trabajadores: data.trabajadores }));
    }
    if (data.documentos || data.honorarios) {
      const { documentos, numeroDocumento, honorarios } = data;
      localStorage.setItem('scc_facturacion', JSON.stringify({ documentos, numeroDocumento, honorarios }));
    }
    const { configuracion, archivos, categorias } = data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ configuracion, archivos, categorias }));
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
}

// ============ PROVIDER COMBINADO ============
export function AppProvider({ children }: { children: ReactNode }) {
  migrateLegacyStorage();
  return (
    <AuditProvider>
      <ContabilidadProvider>
        <RemuneracionesProvider>
          <FacturacionProvider>
            <ClientesProvider>
              <UIProvider>
                {children}
              </UIProvider>
            </ClientesProvider>
          </FacturacionProvider>
        </RemuneracionesProvider>
      </ContabilidadProvider>
    </AuditProvider>
  );
}

// ============ BRIDGE useApp() — COMPATIBILIDAD TOTAL ============
type AppAction =
  | Parameters<ReturnType<typeof useContabilidad>['dispatch']>[0]
  | Parameters<ReturnType<typeof useRemuneraciones>['dispatch']>[0]
  | Parameters<ReturnType<typeof useFacturacion>['dispatch']>[0]
  | UIAction
  | { type: 'LOAD_STATE'; payload: Record<string, unknown> }
  | { type: 'TOGGLE_SIDEBAR' };

const CONTABILIDAD_ACTIONS = new Set([
  'ADD_CUENTA', 'UPDATE_CUENTA', 'DELETE_CUENTA',
  'ADD_ASIENTO', 'UPDATE_ASIENTO', 'DELETE_ASIENTO',
  'ADD_REGISTRO_VENTA', 'ADD_REGISTRO_COMPRA', 'SET_RUT_CUENTA',
  'ADD_PLANTILLA', 'UPDATE_PLANTILLA', 'DELETE_PLANTILLA', 'INCREMENT_USO_PLANTILLA',
]);

const REMUNERACIONES_ACTIONS = new Set([
  'ADD_TRABAJADOR', 'UPDATE_TRABAJADOR', 'DELETE_TRABAJADOR',
  'ADD_LIQUIDACION', 'DELETE_LIQUIDACION',
]);

const FACTURACION_ACTIONS = new Set([
  'ADD_DOCUMENTO', 'BATCH_ADD_DOCUMENTOS', 'UPDATE_DOCUMENTO', 'DELETE_DOCUMENTO',
  'ADD_HONORARIO', 'UPDATE_HONORARIO', 'DELETE_HONORARIO',
]);

const CLIENTES_ACTIONS = new Set([
  'ADD_CLIENTE', 'UPDATE_CLIENTE', 'DELETE_CLIENTE',
  'ADD_CXC', 'UPDATE_CXC', 'DELETE_CXC',
  'ADD_CXP', 'UPDATE_CXP', 'DELETE_CXP',
  'ADD_NOTA', 'UPDATE_NOTA', 'DELETE_NOTA',
]);

export function useApp() {
  const { state: contabilidad, dispatch: dContabilidad } = useContabilidad();
  const { state: remuneraciones, dispatch: dRemuneraciones } = useRemuneraciones();
  const { state: facturacion, dispatch: dFacturacion } = useFacturacion();
  const { state: clientesState, dispatch: dClientes } = useClientes();
  const { state: ui, dispatch: dUI } = useUI();

  // Usar appStore de Zustand para sidebar y toasts (fuente única de verdad)
  const {
    sidebarOpen,
    toggleSidebar,
    addToast,
    notificaciones,
    addNotificacion,
    marcarLeida,
  } = useAppStore();

  const showToast = useCallback((tipo: ToastNotification['tipo'], titulo: string, mensaje: string) => {
    addToast({ type: tipo, message: `${titulo}: ${mensaje}` });
    addNotificacion({ tipo, titulo, mensaje, link: '', modulo: '' });
  }, [addToast, addNotificacion]);

  const state = {
    ...contabilidad,
    planCuentas: contabilidad.cuentas,
    plantillas: contabilidad.plantillas ?? [],
    ...remuneraciones,
    ...facturacion,
    // Módulo clientes/proveedores/CxC/CxP/notas
    clientesProveedores: clientesState.clientes,
    cuentasCobrar: clientesState.cuentasCobrar,
    cuentasPagar: clientesState.cuentasPagar,
    notasCredito: clientesState.notas,
    numeroNota: clientesState.numeroNota,
    configuracion: ui.configuracion,
    archivos: ui.archivos,
    categorias: ui.categorias,
    indicadores: ui.indicadores,
    sidebarCollapsed: !sidebarOpen,
    notificaciones,
  };

  const dispatch = (action: AppAction) => {
    const t = action.type;
    if (t === 'TOGGLE_SIDEBAR') {
      toggleSidebar();
    } else if (CONTABILIDAD_ACTIONS.has(t)) {
      dContabilidad(action as Parameters<typeof dContabilidad>[0]);
    } else if (REMUNERACIONES_ACTIONS.has(t)) {
      dRemuneraciones(action as Parameters<typeof dRemuneraciones>[0]);
    } else if (FACTURACION_ACTIONS.has(t)) {
      dFacturacion(action as Parameters<typeof dFacturacion>[0]);
    } else if (CLIENTES_ACTIONS.has(t)) {
      dClientes(action as Parameters<typeof dClientes>[0]);
    } else {
      dUI(action as UIAction);
    }
  };

  return { state, dispatch, showToast, marcarNotificacionLeida: marcarLeida };
}

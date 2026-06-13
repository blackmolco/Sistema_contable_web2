import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  Search, FileText, Users, BookOpen, Receipt, DollarSign, Command, X,
  Clock, ChevronRight, LayoutDashboard, Calculator, FileBarChart, Wallet,
  Activity, Settings, ShieldAlert, FileSpreadsheet, Database, Calendar,
  Lock, Key, RefreshCw, Sliders, PlusCircle, History, Landmark,
  Scale, ClipboardList, TrendingUp, AlertTriangle, HelpCircle, Archive, HardDrive
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const RECENT_KEY = 'scc_recent_searches';
const MAX_RECENT = 6;

function getRecentSearches(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); }
  catch { return []; }
}
function addRecentSearch(q: string) {
  const prev = getRecentSearches().filter(s => s !== q);
  localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...prev].slice(0, MAX_RECENT)));
}
function clearRecentSearches() {
  localStorage.removeItem(RECENT_KEY);
}

// Mapa de íconos Lucide
const LUCIDE_ICONS: Record<string, React.ComponentType<any>> = {
  LayoutDashboard,
  FileText,
  FileBarChart,
  Wallet,
  Calculator,
  Users,
  Receipt,
  DollarSign,
  Activity,
  Settings,
  ShieldAlert,
  FileSpreadsheet,
  Database,
  Calendar,
  Lock,
  Key,
  RefreshCw,
  Sliders,
  PlusCircle,
  History,
  Landmark,
  Scale,
  ClipboardList,
  TrendingUp,
  AlertTriangle,
  HelpCircle,
  Archive,
  HardDrive,
  BookOpen
};

interface SearchResult {
  tipo: 'modulo' | 'accion' | 'cuenta' | 'asiento' | 'trabajador' | 'documento' | 'honorario';
  id: string;
  titulo: string;
  subtitulo: string;
  ruta: string;
  categoria: string;
  actionId?: string;
  icon?: string;
}

const SYSTEM_ITEMS: Omit<SearchResult, 'tipo'>[] = [
  // --- CONTABILIDAD ---
  { id: 'm_diario', titulo: 'Libro Diario', subtitulo: 'Visualizar asientos contables ordenados cronológicamente', ruta: '/libro-diario', categoria: 'Contabilidad', icon: 'FileText' },
  { id: 'm_mayor', titulo: 'Libro Mayor', subtitulo: 'Saldos acumulados y movimientos por cuenta contable', ruta: '/libro-mayor', categoria: 'Contabilidad', icon: 'BookOpen' },
  { id: 'm_balance', titulo: 'Balance de 8 Columnas', subtitulo: 'Balance tributario de comprobación y saldos', ruta: '/balance-8-columnas', categoria: 'Contabilidad', icon: 'FileSpreadsheet' },
  { id: 'm_asientos', titulo: 'Asientos Contables', subtitulo: 'Gestión y creación de asientos del libro diario', ruta: '/asientos', categoria: 'Contabilidad', icon: 'ClipboardList' },
  { id: 'm_cuentas', titulo: 'Plan de Cuentas', subtitulo: 'Configuración del catálogo de cuentas contables', ruta: '/plan-cuentas', categoria: 'Contabilidad', icon: 'Sliders' },
  { id: 'm_cierre', titulo: 'Cierre Tributario', subtitulo: 'Determinación de la base imponible y RLI (14 D3 / 14 D8)', ruta: '/cierre-tributario', categoria: 'Contabilidad', icon: 'Scale' },
  { id: 'm_auditoria', titulo: 'Bitácora de Auditoría (Audit Log)', subtitulo: 'Registro técnico de integridad y auditoría de eventos', ruta: '/auditoria', categoria: 'Contabilidad', icon: 'History' },
  
  // --- FACTURACIÓN Y COMPRAS ---
  { id: 'm_facturacion', titulo: 'Nueva Factura (Facturación)', subtitulo: 'Módulo de facturación y emisión de DTEs', ruta: '/facturacion', categoria: 'Facturación', icon: 'PlusCircle' },
  { id: 'm_compras', titulo: 'Libro de Compras', subtitulo: 'Registro de compras recibidas y crédito fiscal IVA', ruta: '/libro-compras', categoria: 'Facturación', icon: 'Receipt' },
  { id: 'm_ventas', titulo: 'Libro de Ventas', subtitulo: 'Registro de facturas emitidas y débito fiscal IVA', ruta: '/libro-ventas', categoria: 'Facturación', icon: 'TrendingUp' },
  { id: 'm_notas', titulo: 'Notas de Crédito / Débito', subtitulo: 'Emisión de documentos rectificatorios de facturas', ruta: '/notas-credito-debito', categoria: 'Facturación', icon: 'FileText' },
  { id: 'm_documentos', titulo: 'Documentos Recibidos (OCR)', subtitulo: 'Carga de facturas XML / PDF y procesamiento OCR', ruta: '/documentos', categoria: 'Facturación', icon: 'Archive' },
  { id: 'm_clientes', titulo: 'Clientes y Proveedores', subtitulo: 'Listado de RUTs y fichas comerciales', ruta: '/clientes-proveedores', categoria: 'Facturación', icon: 'Users' },

  // --- TESORERÍA ---
  { id: 'm_flujo', titulo: 'Flujo de Caja (Cash Flow)', subtitulo: 'Análisis de ingresos, egresos y proyecciones de caja', ruta: '/flujo-caja', categoria: 'Tesorería', icon: 'Wallet' },
  { id: 'm_conciliacion', titulo: 'Conciliación Bancaria', subtitulo: 'Cuadratura de cartola bancaria con contabilidad', ruta: '/conciliacion', categoria: 'Tesorería', icon: 'Landmark' },
  { id: 'm_pagar', titulo: 'Cuentas por Pagar', subtitulo: 'Vencimientos pendientes con proveedores y egresos', ruta: '/cuentas-pagar', categoria: 'Tesorería', icon: 'DollarSign' },
  { id: 'm_cobrar', titulo: 'Cuentas por Cobrar', subtitulo: 'Cartera de cobranza activa y control de facturas vencidas', ruta: '/cuentas-cobrar', categoria: 'Tesorería', icon: 'TrendingUp' },
  { id: 'm_pago_prov', titulo: 'Pago a Proveedores', subtitulo: 'Nóminas de egreso y transferencias bancarias masivas', ruta: '/pago-proveedores', categoria: 'Tesorería', icon: 'Wallet' },

  // --- RECURSOS HUMANOS ---
  { id: 'm_remuneraciones', titulo: 'Liquidaciones de Sueldo', subtitulo: 'Cálculo de liquidaciones y nómina mensual', ruta: '/remuneraciones', categoria: 'Recursos Humanos', icon: 'Users' },
  { id: 'm_libro_rem', titulo: 'Libro de Remuneraciones LRE', subtitulo: 'Libro auxiliar mensual para reporte a la Dirección del Trabajo', ruta: '/libro-remuneraciones', categoria: 'Recursos Humanos', icon: 'FileText' },
  { id: 'm_docs_rrhh', titulo: 'Documentos y Contratos', subtitulo: 'Gestión de contratos de trabajo, anexos y licencias', ruta: '/documentos-rrhh', categoria: 'Recursos Humanos', icon: 'Archive' },
  { id: 'm_previred', titulo: 'Previred', subtitulo: 'Exportación de archivo de 105 columnas para cotizaciones', ruta: '/previred', categoria: 'Recursos Humanos', icon: 'HardDrive' },
  { id: 'm_anticipos', titulo: 'Anticipos de Sueldo', subtitulo: 'Control de egresos por adelantos de sueldos', ruta: '/anticipos', categoria: 'Recursos Humanos', icon: 'DollarSign' },
  { id: 'm_centralizacion', titulo: 'Centralización Remuneraciones', subtitulo: 'Generación del asiento contable de sueldos mensual', ruta: '/centralizacion-remuneraciones', categoria: 'Recursos Humanos', icon: 'PlusCircle' },

  // --- IMPUESTOS Y SII ---
  { id: 'm_sinc_sii', titulo: 'Sincronización SII', subtitulo: 'Descarga automática de DTEs desde el portal del SII', ruta: '/sincronizacion-sii', categoria: 'Impuestos y SII', icon: 'RefreshCw' },
  { id: 'm_f29', titulo: 'Formulario F29 (Mensual)', subtitulo: 'Declaración mensual de IVA, PPM y retenciones de 2da categoría', ruta: '/f29', categoria: 'Impuestos y SII', icon: 'FileBarChart' },
  { id: 'm_f22', titulo: 'Formulario F22 (Anual)', subtitulo: 'Asistente de Renta Anual F22 y Declaraciones Juradas (1887, 1879)', ruta: '/f22', categoria: 'Impuestos y SII', icon: 'Calculator' },
  { id: 'm_tablas_sii', titulo: 'Tablas SII', subtitulo: 'Valores de UF, UTM, UTA e IPC históricos', ruta: '/tablas-sii', categoria: 'Impuestos y SII', icon: 'Database' },
  { id: 'm_alertas_trib', titulo: 'Alertas Tributarias', subtitulo: 'Monitoreo de inconsistencias tributarias y notificaciones', ruta: '/alertas', categoria: 'Impuestos y SII', icon: 'ShieldAlert' },

  // --- ACTIVOS E INVENTARIO ---
  { id: 'm_inventario', titulo: 'Control de Inventario', subtitulo: 'Stock de mercadería, valorización FIFO/PMP y bodegas', ruta: '/inventario', categoria: 'Activos e Inventario', icon: 'Archive' },
  { id: 'm_activo_fijo', titulo: 'Activos Fijos y Depreciación', subtitulo: 'Control de bienes, depreciación lineal/tributaria e IFRS', ruta: '/activo-fijo', categoria: 'Activos e Inventario', icon: 'Scale' },

  // --- CONFIGURACIÓN ---
  { id: 'm_config', titulo: 'Ajustes del Sistema', subtitulo: 'Parámetros del sistema y cuentas predeterminadas', ruta: '/configuracion', categoria: 'Configuración', icon: 'Settings' },
  { id: 'm_config_emp', titulo: 'Configuración Empresa (Multi-Empresa)', subtitulo: 'Gestión de RUTs de empresas del holding', ruta: '/multi-empresa', categoria: 'Configuración', icon: 'Sliders' },
  { id: 'm_config_sueldos', titulo: 'Configuración de Sueldos', subtitulo: 'Parámetros previsionales (porcentajes de AFP, tope imponible)', ruta: '/config-sueldos', categoria: 'Configuración', icon: 'Sliders' },
  { id: 'm_backup', titulo: 'Respaldo de Datos (Backup)', subtitulo: 'Respaldar base de datos y restaurar configuraciones', ruta: '/backup', categoria: 'Configuración', icon: 'Database' },

  // --- ACCIONES DIRECTAS ---
  { id: 'a_crear_asiento', titulo: 'Crear Asiento Contable', subtitulo: 'Abrir directamente el módulo de asientos contables listo para registrar', ruta: '/asientos', categoria: 'Acciones', icon: 'PlusCircle', actionId: 'crear_asiento' },
  { id: 'a_sinc_banco', titulo: 'Sincronizar Banco (Fintoc)', subtitulo: 'Conectar cuenta bancaria para importar transacciones de cartola', ruta: '/conciliacion', categoria: 'Acciones', icon: 'RefreshCw', actionId: 'sincronizar_banco' },
  { id: 'a_verificar_log', titulo: 'Verificar integridad de bitácora', subtitulo: 'Correr algoritmo de integridad y firma del log de auditoría', ruta: '/auditoria', categoria: 'Acciones', icon: 'ShieldAlert', actionId: 'verificar_bitacora' },
  { id: 'a_cargar_ocr', titulo: 'Cargar Factura XML/PDF (OCR)', subtitulo: 'Arrastrar archivos DTE o PDF para procesar por OCR y registrar compras', ruta: '/documentos', categoria: 'Acciones', icon: 'Archive', actionId: 'cargar_factura' },
  { id: 'a_calcular_hon', titulo: 'Calcular Honorario Líquido', subtitulo: 'Ejecutar calculadora rápida de retención de boletas de honorarios', ruta: '/calculadora', categoria: 'Acciones', icon: 'Calculator', actionId: 'calcular_honorario' },
  { id: 'a_descargar_tablas', titulo: 'Descargar Tablas Tributarias SII', subtitulo: 'Sincronizar y actualizar UF/UTM del SII con mindicador.cl', ruta: '/tablas-sii', categoria: 'Acciones', icon: 'RefreshCw', actionId: 'descargar_tablas' },
  { id: 'a_generar_dj', titulo: 'Generar Declaración Jurada 1887', subtitulo: 'Exportar planilla de sueldos para declaración jurada anual', ruta: '/f22', categoria: 'Acciones', icon: 'FileSpreadsheet', actionId: 'generar_dj_1887' },
  { id: 'a_previred_105', titulo: 'Exportar Nómina Previred', subtitulo: 'Generar el archivo plano estructurado de 105 campos', ruta: '/previred', categoria: 'Acciones', icon: 'HardDrive', actionId: 'exportar_previred' },
  { id: 'a_ver_alertas', titulo: 'Ver Alertas Tributarias de IA', subtitulo: 'Listar advertencias y anomalías detectadas en la facturación y PPM', ruta: '/alertas', categoria: 'Acciones', icon: 'AlertTriangle', actionId: 'ver_alertas' },
];

const QUICK_LINKS = [
  { label: 'Dashboard',      path: '/',           icon: LayoutDashboard },
  { label: 'Asientos',       path: '/asientos',   icon: FileText },
  { label: 'Conciliación',   path: '/conciliacion',icon: Landmark },
  { label: 'Documentos OCR', path: '/documentos',   icon: Archive },
  { label: 'F29',            path: '/f29',        icon: FileBarChart },
  { label: 'Calculadora',    path: '/calculadora', icon: Calculator },
];

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

function groupByCategoria(results: SearchResult[]): Record<string, SearchResult[]> {
  return results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.categoria]) acc[r.categoria] = [];
    acc[r.categoria].push(r);
    return acc;
  }, {});
}

// Búsqueda combinada: comandos + módulos + base de datos local
function buscarTodo(q: string, state: ReturnType<typeof useApp>['state']): SearchResult[] {
  const cleanQ = q.trim().toLowerCase();
  if (!cleanQ) return [];

  const results: SearchResult[] = [];

  // 1. Filtrar Comandos y Módulos estáticos
  SYSTEM_ITEMS.forEach(item => {
    if (
      item.titulo.toLowerCase().includes(cleanQ) ||
      item.subtitulo.toLowerCase().includes(cleanQ) ||
      item.categoria.toLowerCase().includes(cleanQ)
    ) {
      results.push({
        ...item,
        tipo: item.actionId ? 'accion' : 'modulo',
      });
    }
  });

  // 2. Filtrar Entidades Locales de Base de Datos
  // Cuentas
  (state.cuentas ?? []).forEach(c => {
    if (c.codigo.toLowerCase().includes(cleanQ) || c.nombre.toLowerCase().includes(cleanQ)) {
      results.push({
        tipo: 'cuenta',
        id: c.id,
        titulo: `${c.codigo} — ${c.nombre}`,
        subtitulo: `Cuenta de tipo ${c.tipo ?? 'General'}`,
        ruta: '/plan-cuentas',
        categoria: 'Plan de Cuentas',
      });
    }
  });

  // Asientos
  (state.asientos ?? []).forEach(a => {
    if (a.numero.toString().includes(cleanQ) || a.glosa.toLowerCase().includes(cleanQ)) {
      results.push({
        tipo: 'asiento',
        id: a.id,
        titulo: `Asiento #${a.numero.toString().padStart(4, '0')} — ${a.glosa}`,
        subtitulo: `Fecha: ${a.fecha} | Estado: ${a.estado}`,
        ruta: '/asientos',
        categoria: 'Registros Contables',
      });
    }
  });

  // Trabajadores
  (state.trabajadores ?? []).forEach(w => {
    const nombre = `${w.nombre ?? ''} ${w.apellido ?? ''}`.trim();
    if (
      nombre.toLowerCase().includes(cleanQ) ||
      (w.rut ?? '').toLowerCase().includes(cleanQ) ||
      (w.cargo ?? '').toLowerCase().includes(cleanQ)
    ) {
      results.push({
        tipo: 'trabajador',
        id: w.id,
        titulo: nombre || w.rut,
        subtitulo: `Cargo: ${w.cargo ?? 'No definido'} | RUT: ${w.rut}`,
        ruta: '/remuneraciones',
        categoria: 'Fichas de R.R.H.H.',
      });
    }
  });

  // Documentos
  (state.documentos ?? []).forEach(d => {
    if (
      (d.numero ?? '').toString().toLowerCase().includes(cleanQ) ||
      (d.razonSocial ?? '').toLowerCase().includes(cleanQ) ||
      (d.rutEmisor ?? '').toLowerCase().includes(cleanQ)
    ) {
      results.push({
        tipo: 'documento',
        id: d.id,
        titulo: `${d.tipo?.toUpperCase() ?? 'DTE'} #${d.numero} — ${d.razonSocial ?? 'S/R'}`,
        subtitulo: `RUT: ${d.rutEmisor ?? 'N/A'} | Total: $${(d.total ?? 0).toLocaleString()}`,
        ruta: '/libro-compras',
        categoria: 'Documentos DTE',
      });
    }
  });

  // Limitar resultados
  return results.slice(0, 15);
}

export default function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const { state } = useApp();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const flatResults = useMemo(
    () => buscarTodo(query, state),
    [query, state]
  );

  // Cargar búsquedas recientes
  useEffect(() => {
    if (isOpen) {
      setRecentSearches(getRecentSearches());
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Limpiar estados
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [flatResults.length]);

  // Atajos globales
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSelect = (result: SearchResult) => {
    if (query.trim().length >= 2) addRecentSearch(query.trim());
    
    // Si tiene un actionId lo pasamos en el state para que la página destino lo lea
    if (result.actionId) {
      navigate(result.ruta, { state: { triggerAction: result.actionId } });
    } else {
      navigate(result.ruta);
    }
    
    onClose();
  };

  const handleRecentSelect = (q: string) => {
    setQuery(q);
    inputRef.current?.focus();
  };

  const handleClearRecent = () => {
    clearRecentSearches();
    setRecentSearches([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && flatResults[selectedIndex]) {
      e.preventDefault();
      handleSelect(flatResults[selectedIndex]);
    }
  };

  // Renderizador de íconos
  const renderItemIcon = (item: SearchResult) => {
    if (item.icon && LUCIDE_ICONS[item.icon]) {
      const IconComponent = LUCIDE_ICONS[item.icon];
      return <IconComponent className="w-4 h-4" />;
    }

    switch (item.tipo) {
      case 'cuenta': return <BookOpen className="w-4 h-4" />;
      case 'asiento': return <FileText className="w-4 h-4" />;
      case 'trabajador': return <Users className="w-4 h-4" />;
      case 'documento': return <Receipt className="w-4 h-4" />;
      case 'honorario': return <DollarSign className="w-4 h-4" />;
      default: return <Command className="w-4 h-4" />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Búsqueda global avanzada"
        >
          {/* Backdrop esmerilado */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-md"
          />

          {/* Panel Spotlight Command Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="relative w-full max-w-3xl bg-white/80 dark:bg-gray-900/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/80 dark:border-gray-800/80 overflow-hidden flex flex-col max-h-[80vh]"
          >
            {/* Header de Búsqueda */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200/60 dark:border-gray-800/60">
              <Search className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe un comando o busca cuentas, asientos, trabajadores, compras..."
                className="flex-1 bg-transparent outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-base"
              />
              <kbd className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400 rounded-md border border-gray-200 dark:border-gray-700">
                <Command className="w-3 h-3" />K
              </kbd>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                aria-label="Cerrar búsqueda"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Cuerpo de Resultados */}
            <div className="flex-1 overflow-y-auto min-h-[300px]">
              {/* Pantalla de Inicio (Sin Query) */}
              {query.length < 2 && (
                <div className="p-4 space-y-4">
                  {/* Búsquedas recientes */}
                  {recentSearches.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between px-3 py-1 mb-1">
                        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Búsquedas Recientes</span>
                        <button onClick={handleClearRecent} className="text-[10px] font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                          Limpiar
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                        {recentSearches.map(q => (
                          <button
                            key={q}
                            onClick={() => handleRecentSelect(q)}
                            className="flex items-center gap-3 px-3 py-2 text-left rounded-lg hover:bg-gray-100/60 dark:hover:bg-gray-800/40 text-sm text-gray-700 dark:text-gray-300 transition-colors group"
                          >
                            <Clock className="w-4 h-4 text-gray-400 group-hover:text-gray-500" />
                            <span className="truncate">{q}</span>
                            <ChevronRight className="w-3.5 h-3.5 text-gray-300 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Accesos rápidos */}
                  <div>
                    <div className="px-3 py-1 mb-1">
                      <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Módulos Frecuentes</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {QUICK_LINKS.map(link => {
                        const QIcon = link.icon;
                        return (
                          <button
                            key={link.path}
                            onClick={() => { navigate(link.path); onClose(); }}
                            className="flex flex-col items-center justify-center p-3 rounded-xl border border-gray-200/50 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-800/10 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 hover:border-blue-200 dark:hover:border-blue-900/50 transition-all group text-center"
                          >
                            <div className="w-9 h-9 rounded-lg bg-white dark:bg-gray-800 flex items-center justify-center shadow-sm border border-gray-100 dark:border-gray-700 mb-2 group-hover:scale-105 transition-transform">
                              <QIcon className="w-5 h-5 text-gray-600 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                            </div>
                            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{link.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sugerencias de Comandos Rápidos */}
                  <div>
                    <div className="px-3 py-1 mb-1">
                      <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Acciones Directas Sugeridas</span>
                    </div>
                    <div className="space-y-1">
                      {SYSTEM_ITEMS.filter(item => item.actionId).slice(0, 3).map(item => {
                        const IconComponent = item.icon ? LUCIDE_ICONS[item.icon] : Command;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              navigate(item.ruta, { state: { triggerAction: item.actionId } });
                              onClose();
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm hover:bg-gray-100/60 dark:hover:bg-gray-800/40 text-gray-700 dark:text-gray-300 group transition-colors"
                          >
                            <div className="p-1 bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-md">
                              <IconComponent className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-medium">{item.titulo}</p>
                              <p className="text-[11px] text-gray-400 dark:text-gray-500">{item.subtitulo}</p>
                            </div>
                            <span className="text-[10px] ml-auto bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded font-bold uppercase border border-gray-200/50 dark:border-gray-700 text-gray-400">Comando</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Estado: Sin Resultados */}
              {query.length >= 2 && flatResults.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <AlertTriangle className="w-12 h-12 text-amber-500 mb-3 animate-bounce" />
                  <p className="text-base font-semibold text-gray-800 dark:text-gray-200">
                    No encontramos coincidencias para &quot;{query}&quot;
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-sm">
                    Prueba buscando nombres de módulos, códigos de cuentas contables, RUTs de clientes o acciones directas.
                  </p>
                </div>
              )}

              {/* Listado de Resultados Filtrados */}
              {query.length >= 2 && flatResults.length > 0 && (
                <div className="py-3" role="listbox">
                  {Object.entries(groupByCategoria(flatResults)).map(([cat, items]) => (
                    <div key={cat} className="mb-4">
                      <div className="px-4 py-1 mb-1">
                        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                          {cat}
                        </span>
                      </div>
                      <ul className="space-y-0.5">
                        {items.map((result) => {
                          const idx = flatResults.indexOf(result);
                          const isSelected = idx === selectedIndex;
                          return (
                            <li key={`${result.tipo}-${result.id}`} role="option" aria-selected={isSelected}>
                              <button
                                onClick={() => handleSelect(result)}
                                onMouseEnter={() => setSelectedIndex(idx)}
                                className={`w-full flex items-center gap-3.5 px-4 py-2.5 text-left transition-all ${
                                  isSelected
                                    ? 'bg-[#1E3A5F]/10 dark:bg-blue-900/30 border-l-2 border-blue-600 dark:border-blue-400'
                                    : 'hover:bg-gray-50/50 dark:hover:bg-gray-800/30'
                                }`}
                              >
                                <div className={`p-1.5 rounded-lg flex-shrink-0 ${
                                  isSelected
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : result.tipo === 'accion'
                                      ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'
                                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                                }`}>
                                  {renderItemIcon(result)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate flex items-center gap-2">
                                    {result.titulo}
                                    {result.tipo === 'accion' && (
                                      <span className="text-[8px] bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-bold px-1 py-0.2 rounded uppercase">Acción</span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                                    {result.subtitulo}
                                  </div>
                                </div>
                                {isSelected && (
                                  <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-mono bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-md">
                                    enter ↵
                                  </kbd>
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer de Atajos */}
            <div className="px-5 py-3 border-t border-gray-200/60 dark:border-gray-800/60 text-[10px] text-gray-400 dark:text-gray-500 bg-gray-50/50 dark:bg-gray-950/20 flex items-center gap-5">
              <span className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-xs font-mono">↑↓</kbd>
                navegar
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-xs font-mono">↵</kbd>
                abrir
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-xs font-mono">esc</kbd>
                cerrar
              </span>
              {flatResults.length > 0 && query.length >= 2 && (
                <span className="ml-auto text-gray-400 font-medium">
                  {flatResults.length} resultado{flatResults.length !== 1 ? 's' : ''} encontrado{flatResults.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

import React, { Suspense, lazy, ComponentType, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { useAuthStore } from './stores';
import { useAppStore } from './stores/appStore';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import Login from './components/auth/Login';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import Toaster from './components/ui/Toaster';
import { ThemeProvider } from './context/ThemeContext';
import { DensityProvider } from './components/ui/TableDensity';
import { PageTransition } from './components/ui/PageTransition';
import SessionExpiredModal from './components/SessionExpiredModal';
import { ConfirmDialogProvider } from './components/ui/ConfirmDialog';
import { ShortcutsHelpModal } from './components/ui/ShortcutsHelpModal';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { fetchIndicadores } from './services/mindicador';
import { API_BASE } from './services/httpClient';

// Mantiene el backend de Render despierto enviando un ping cada 14 minutos.
// También dispara un ping inmediato al cargar para reducir el cold start.
function useBackendKeepalive() {
  useEffect(() => {
    const ping = () => fetch(`${API_BASE}/api/health`, { method: 'GET' }).catch(() => {});
    ping(); // ping inmediato al abrir la app
    const id = setInterval(ping, 14 * 60 * 1000); // cada 14 min
    return () => clearInterval(id);
  }, []);
}

// 🚀 Carga diferida (lazy loading) de páginas
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PlanCuentas = lazy(() => import('./pages/PlanCuentas'));
const AsientosContables = lazy(() => import('./pages/AsientosContables'));
const Remuneraciones = lazy(() => import('./pages/Remuneraciones'));
const Facturacion = lazy(() => import('./pages/Facturacion'));
const LibroVentas = lazy(() => import('./pages/LibroVentas'));
const Honorarios = lazy(() => import('./pages/Honorarios'));
const Documentos = lazy(() => import('./pages/Documentos'));
const LibroDiario = lazy(() => import('./pages/LibroDiario'));
const MayorContable = lazy(() => import('./pages/MayorContable'));
const BalanceOchoColumnas = lazy(() => import('./pages/BalanceOchoColumnas'));
const EstadosFinancieros = lazy(() => import('./pages/EstadosFinancieros'));
const ConciliacionBancaria = lazy(() => import('./pages/ConciliacionBancaria'));
const Tesoreria = lazy(() => import('./pages/Tesoreria'));
const AnalisisFinanciero = lazy(() => import('./pages/AnalisisFinanciero'));
const ActivoFijo = lazy(() => import('./pages/ActivoFijo'));
const Inventario = lazy(() => import('./pages/Inventario'));
const Configuracion = lazy(() => import('./pages/Configuracion'));
const Reportes = lazy(() => import('./pages/Reportes'));
const AlertasTributarias = lazy(() => import('./pages/AlertasTributarias'));
const CierreTributario = lazy(() => import('./pages/CierreTributario'));
const F29 = lazy(() => import('./pages/F29'));
const SincronizacionSII = lazy(() => import('./pages/SincronizacionSII'));
const TablasSII = lazy(() => import('./pages/TablasSII'));
const Calculadora = lazy(() => import('./pages/Calculadora'));
const Anticipos = lazy(() => import('./pages/Anticipos'));
const PagoProveedores = lazy(() => import('./pages/PagoProveedores'));
const LibroRemuneraciones = lazy(() => import('./pages/LibroRemuneraciones'));
const DocumentosRRHH = lazy(() => import('./pages/DocumentosRRHH'));
const CentralizacionLibros = lazy(() => import('./pages/CentralizacionLibros'));
const CentralizacionRemuneraciones = lazy(() => import('./pages/CentralizacionRemuneraciones'));
const ConfiguracionSueldos = lazy(() => import('./pages/ConfiguracionSueldos'));
const ConfiguracionEmpresa = lazy(() => import('./pages/ConfiguracionEmpresa'));
const BackupSettings = lazy(() => import('./pages/BackupSettings'));
const ImportarDatos = lazy(() => import('./pages/ImportarDatos'));
const Previred = lazy(() => import('./pages/Previred'));
const ClientesProveedores = lazy(() => import('./pages/ClientesProveedores'));
const CuentasCobrar = lazy(() => import('./pages/CuentasCobrar'));
const CuentasPagar = lazy(() => import('./pages/CuentasPagar'));
const NotasCreditoDebito = lazy(() => import('./pages/NotasCreditoDebito'));
const F22 = lazy(() => import('./pages/F22'));
const FlujoCaja = lazy(() => import('./pages/FlujoCaja'));
const AuditLog = lazy(() => import('./pages/AuditLog'));

// 🌀 Skeletons de carga específicos por tipo de página
const SkeletonRow = () => (
  <div className="h-4 bg-gray-200 rounded animate-pulse" />
);

const SkeletonCard = () => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
    <div className="flex items-center justify-between">
      <SkeletonRow />
      <div className="w-8 h-8 bg-gray-200 rounded-lg animate-pulse" />
    </div>
    <div className="h-8 w-1/2 bg-gray-200 rounded animate-pulse" />
    <div className="h-3 w-1/3 bg-gray-200 rounded animate-pulse" />
  </div>
);

const SkeletonTable = () => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-3">
    <div className="flex gap-4 mb-4">
      {[1,2,3,4].map(i => <div key={i} className="h-8 flex-1 bg-gray-200 rounded animate-pulse" />)}
    </div>
    {[1,2,3,4,5].map(i => (
      <div key={i} className="flex gap-4">
        {[1,2,3,4].map(j => <div key={j} className="h-6 flex-1 bg-gray-100 rounded animate-pulse" />)}
      </div>
    ))}
  </div>
);

const PageLoader = () => (
  <div className="space-y-6 animate-fadeIn">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <div className="h-7 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
      </div>
      <div className="w-24 h-9 bg-gray-200 rounded-lg animate-pulse" />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {[1,2].map(i => <SkeletonCard key={i} />)}
    </div>
    <SkeletonTable />
  </div>
);


function AppContent() {
  useBackendKeepalive();
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [darkMode, setDarkMode] = React.useState(() => {
    const stored = localStorage.getItem('dark-mode');
    return stored ? JSON.parse(stored) : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = React.useState(false);
  const { state, dispatch, showToast } = useApp();
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);

  useEffect(() => {
    localStorage.setItem('dark-mode', JSON.stringify(darkMode));
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // Cargar Indicadores Económicos desde mindicador.cl
  useEffect(() => {
    if (!isAuthenticated) return;
    const loadIndicadores = async () => {
      const hoyStr = new Date().toISOString().split('T')[0];
      if (state.indicadores?.fechaActualizacion === hoyStr) {
        return;
      }
      
      try {
        const data = await fetchIndicadores();
        if (data) {
          dispatch({
            type: 'SET_INDICADORES',
            payload: {
              uf: data.uf.valor,
              utm: data.utm.valor,
              dolar: data.dolar.valor,
              euro: data.euro.valor,
              fechaActualizacion: hoyStr,
            },
          });
          showToast('success', 'Indicadores Actualizados', `UF: $${data.uf.valor} | UTM: $${data.utm.valor}`);
        }
      } catch (err) {
        console.error('Error al actualizar indicadores:', err);
      }
    };
    
    loadIndicadores();
  }, [isAuthenticated, dispatch, state.indicadores, showToast]);

  // Atajos globales de teclado (Ctrl+K búsqueda, ? ayuda, Ctrl+B sidebar)
  useKeyboardShortcuts({
    onToggleSearch: () => setIsSearchOpen(prev => !prev),
    onToggleHelp: () => setShowShortcutHelp(prev => !prev),
    onToggleSidebar: () => setSidebarCollapsed(prev => !prev),
    onEscape: () => {
      if (isSearchOpen) setIsSearchOpen(false);
      if (showShortcutHelp) setShowShortcutHelp(false);
    },
  });

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Mobile overlay — tap outside to close sidebar */}
      {!sidebarCollapsed && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onLogout={handleLogout}
      />
      <Header
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        onOpenSearch={() => setIsSearchOpen(true)}
        onCloseSearch={() => setIsSearchOpen(false)}
        isSearchOpen={isSearchOpen}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
      />

      <main
        className="pt-16 min-h-screen transition-all duration-300"
        style={{
          marginLeft: typeof window !== 'undefined' && window.innerWidth < 768
            ? 0
            : sidebarCollapsed ? '70px' : '220px',
        }}
      >
        <div className="p-6">
          <ErrorBoundary moduleName="página">
            <Suspense fallback={<PageLoader />}>
              <PageTransition>
              <Routes>
              <Route path="/" element={<ErrorBoundary moduleName="Dashboard"><Dashboard /></ErrorBoundary>} />
              <Route path="/plan-cuentas" element={<ErrorBoundary moduleName="Plan de Cuentas"><PlanCuentas /></ErrorBoundary>} />
              <Route path="/asientos" element={<ErrorBoundary moduleName="Asientos Contables"><AsientosContables /></ErrorBoundary>} />
              <Route path="/remuneraciones" element={<ErrorBoundary moduleName="Remuneraciones"><Remuneraciones /></ErrorBoundary>} />
              <Route path="/facturacion" element={<ErrorBoundary moduleName="Facturación"><Facturacion /></ErrorBoundary>} />
              <Route path="/libro-ventas" element={<ErrorBoundary moduleName="Libro de Ventas"><LibroVentas tipo="ventas" /></ErrorBoundary>} />
              <Route path="/libro-compras" element={<ErrorBoundary moduleName="Libro de Compras"><LibroVentas tipo="compras" /></ErrorBoundary>} />
              <Route path="/honorarios" element={<ErrorBoundary moduleName="Honorarios"><Honorarios /></ErrorBoundary>} />
              <Route path="/estados-financieros" element={<ErrorBoundary moduleName="Estados Financieros"><EstadosFinancieros /></ErrorBoundary>} />
              <Route path="/calculadora" element={<ErrorBoundary moduleName="Calculadora"><Calculadora /></ErrorBoundary>} />
              <Route path="/configuracion" element={<ErrorBoundary moduleName="Configuración"><Configuracion /></ErrorBoundary>} />
              <Route path="/tesoreria" element={<ErrorBoundary moduleName="Tesorería"><Tesoreria /></ErrorBoundary>} />
              <Route path="/reportes" element={<ErrorBoundary moduleName="Reportes"><Reportes /></ErrorBoundary>} />
              <Route path="/multi-empresa" element={<ErrorBoundary moduleName="Multi-Empresa"><ConfiguracionEmpresa /></ErrorBoundary>} />
              <Route path="/conciliacion" element={<ErrorBoundary moduleName="Conciliación Bancaria"><ConciliacionBancaria /></ErrorBoundary>} />
              <Route path="/analisis" element={<ErrorBoundary moduleName="Análisis Financiero"><AnalisisFinanciero /></ErrorBoundary>} />
              <Route path="/tablas-sii" element={<ErrorBoundary moduleName="Tablas SII"><TablasSII /></ErrorBoundary>} />
              <Route path="/importar" element={<ErrorBoundary moduleName="Importar Datos"><ImportarDatos /></ErrorBoundary>} />
              <Route path="/backup" element={<ErrorBoundary moduleName="Backup"><BackupSettings /></ErrorBoundary>} />
              <Route path="/analisis-financiero" element={<ErrorBoundary moduleName="Análisis Financiero"><AnalisisFinanciero /></ErrorBoundary>} />
              <Route path="/inventario" element={<ErrorBoundary moduleName="Inventario"><Inventario /></ErrorBoundary>} />
              <Route path="/activo-fijo" element={<ErrorBoundary moduleName="Activo Fijo"><ActivoFijo /></ErrorBoundary>} />
              <Route path="/herramientas/sii" element={<ErrorBoundary moduleName="Herramientas SII"><TablasSII /></ErrorBoundary>} />
              <Route path="/balance-8-columnas" element={<ErrorBoundary moduleName="Balance 8 Columnas"><BalanceOchoColumnas /></ErrorBoundary>} />
              <Route path="/libro-mayor" element={<ErrorBoundary moduleName="Libro Mayor"><MayorContable /></ErrorBoundary>} />
              <Route path="/config-sueldos" element={<ErrorBoundary moduleName="Configuración Sueldos"><ConfiguracionSueldos /></ErrorBoundary>} />
              <Route path="/f29" element={<ErrorBoundary moduleName="F29"><F29 /></ErrorBoundary>} />
              <Route path="/libro-diario" element={<ErrorBoundary moduleName="Libro Diario"><LibroDiario /></ErrorBoundary>} />
              <Route path="/libro-remuneraciones" element={<ErrorBoundary moduleName="Libro Remuneraciones"><LibroRemuneraciones /></ErrorBoundary>} />
              <Route path="/centralizacion-remuneraciones" element={<ErrorBoundary moduleName="Centralización Remuneraciones"><CentralizacionRemuneraciones /></ErrorBoundary>} />
              <Route path="/anticipos" element={<ErrorBoundary moduleName="Anticipos"><Anticipos /></ErrorBoundary>} />
              <Route path="/documentos-rrhh" element={<ErrorBoundary moduleName="Documentos RRHH"><DocumentosRRHH /></ErrorBoundary>} />
              <Route path="/previred" element={<ErrorBoundary moduleName="Previred"><Previred /></ErrorBoundary>} />
              <Route path="/sincronizacion-sii" element={<ErrorBoundary moduleName="Sincronización SII"><SincronizacionSII /></ErrorBoundary>} />
              <Route path="/pago-proveedores" element={<ErrorBoundary moduleName="Pago Proveedores"><PagoProveedores /></ErrorBoundary>} />
              <Route path="/cierre-tributario" element={<ErrorBoundary moduleName="Cierre Tributario"><CierreTributario /></ErrorBoundary>} />
              <Route path="/alertas" element={<ErrorBoundary moduleName="Alertas Tributarias"><AlertasTributarias /></ErrorBoundary>} />
              <Route path="/centralizacion-libros" element={<ErrorBoundary moduleName="Centralización Libros"><CentralizacionLibros /></ErrorBoundary>} />
              <Route path="/documentos" element={<ErrorBoundary moduleName="Documentos"><Documentos /></ErrorBoundary>} />
              <Route path="/clientes-proveedores" element={<ErrorBoundary moduleName="Clientes y Proveedores"><ClientesProveedores /></ErrorBoundary>} />
              <Route path="/cuentas-cobrar" element={<ErrorBoundary moduleName="Cuentas por Cobrar"><CuentasCobrar /></ErrorBoundary>} />
              <Route path="/cuentas-pagar" element={<ErrorBoundary moduleName="Cuentas por Pagar"><CuentasPagar /></ErrorBoundary>} />
              <Route path="/notas-credito-debito" element={<ErrorBoundary moduleName="Notas Crédito/Débito"><NotasCreditoDebito /></ErrorBoundary>} />
              <Route path="/f22" element={<ErrorBoundary moduleName="Asistente F22"><F22 /></ErrorBoundary>} />
              <Route path="/flujo-caja" element={<ErrorBoundary moduleName="Flujo de Caja"><FlujoCaja /></ErrorBoundary>} />
              <Route path="/auditoria" element={<ErrorBoundary moduleName="Auditoría"><AuditLog /></ErrorBoundary>} />
              </Routes>
              </PageTransition>
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>

      <Toaster />

      {/* Modal de ayuda de atajos — ? o ⌘/ */}
      <ShortcutsHelpModal open={showShortcutHelp} onClose={() => setShowShortcutHelp(false)} />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <DensityProvider>
          <AppProvider>
            <ConfirmDialogProvider>
              <AppContent />
              <SessionExpiredModal />
            </ConfirmDialogProvider>
          </AppProvider>
        </DensityProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;

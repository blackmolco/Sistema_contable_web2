import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FilePen,
  Users,
  Receipt,
  CloudCog,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calculator,
  DollarSign,
  FileBarChart,
  LogOut,
  Building2,
  Database,
  Upload,
  Download,
  TrendingUp,
  Package,
  Table,
  FileSpreadsheet,
  Percent,
  Bell,
  Folder,
  CreditCard,
  FileX,
  ListTree,
  BookText,
  BookMarked,
  BookUp,
  BookDown,
  BookUser,
  Landmark,
  HandCoins,
  Banknote,
  Waves,
  GitCompareArrows,
  Combine,
  Merge,
  ShieldCheck,
  FileSignature,
  CalendarClock,
  Star,
  ScrollText,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onLogout: () => void;
}

const menuCategories = [
  {
    title: 'Principal',
    items: [
      { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { path: '/alertas', icon: Bell, label: 'Alertas Tributarias' },
      { path: '/multi-empresa', icon: Building2, label: 'Multi-Empresa' },
    ]
  },
  {
    title: 'Contabilidad',
    items: [
      { path: '/plan-cuentas', icon: ListTree, label: 'Plan de Cuentas' },
      { path: '/asientos', icon: FilePen, label: 'Asientos Contables' },
      { path: '/libro-diario', icon: BookText, label: 'Libro Diario' },
      { path: '/libro-mayor', icon: BookMarked, label: 'Libro Mayor' },
      { path: '/balance-8-columnas', icon: Table, label: 'Balance 8 Col.' },
      { path: '/estados-financieros', icon: BarChart3, label: 'Estados Financieros' },
      { path: '/analisis-financiero', icon: TrendingUp, label: 'Análisis' },
      { path: '/tesoreria', icon: Landmark, label: 'Tesorería' },
      { path: '/conciliacion', icon: GitCompareArrows, label: 'Conciliación' },
    ]
  },
  {
    title: 'Compra y Venta',
    items: [
      { path: '/facturacion', icon: Receipt, label: 'Facturación' },
      { path: '/sincronizacion-sii', icon: CloudCog, label: 'Sincronizar SII' },
      { path: '/libro-ventas', icon: BookUp, label: 'Libro Ventas' },
      { path: '/libro-compras', icon: BookDown, label: 'Libro Compras' },
      { path: '/centralizacion-libros', icon: Combine, label: 'Centralizar Libros' },
      { path: '/honorarios', icon: DollarSign, label: 'Honorarios' },
      { path: '/f29', icon: FileSpreadsheet, label: 'Borrador F29' },
      { path: '/f22', icon: FileBarChart,   label: 'Asistente F22' },
    ]
  },
  {
    title: 'Clientes y Cobros',
    items: [
      { path: '/clientes-proveedores', icon: Users,        label: 'Clientes/Proveedores' },
      { path: '/cuentas-cobrar',       icon: CreditCard,   label: 'Cuentas por Cobrar' },
      { path: '/cuentas-pagar',        icon: HandCoins,    label: 'Cuentas por Pagar' },
      { path: '/notas-credito-debito', icon: FileX,        label: 'Notas Crd./Dbt.' },
    ]
  },
  {
    title: 'Proveedores y Pagos',
    items: [
      { path: '/pago-proveedores', icon: Banknote, label: 'Pago a Proveedores' },
    ]
  },
  {
    title: 'Remuneraciones',
    items: [
      { path: '/remuneraciones', icon: Users, label: 'Liquidaciones' },
      { path: '/libro-remuneraciones', icon: BookUser, label: 'Libro Remun.' },
      { path: '/anticipos', icon: CalendarClock, label: 'Anticipos' },
      { path: '/documentos-rrhh', icon: FileSignature, label: 'Contratos y Finiq.' },
      { path: '/centralizacion-remuneraciones', icon: Merge, label: 'Centralización' },
      { path: '/previred', icon: ShieldCheck, label: 'Previred' },
      { path: '/config-sueldos', icon: Percent, label: 'Config. Sueldos' },
    ]
  },
  {
    title: 'Inventario',
    items: [
      { path: '/inventario', icon: Package, label: 'Inventario' },
      { path: '/activo-fijo', icon: Calculator, label: 'Activo Fijo' },
    ]
  },
  {
    title: 'Herramientas y Cierres',
    items: [
      { path: '/flujo-caja',          icon: Waves,         label: 'Flujo de Caja' },
      { path: '/documentos',          icon: Folder,        label: 'Documentos' },
      { path: '/cierre-tributario',   icon: FileSpreadsheet, label: 'Cierre Tributario' },
      { path: '/reportes',            icon: FileBarChart,  label: 'Reportes' },
      { path: '/calculadora',         icon: Calculator,    label: 'Calculadora' },
      { path: '/tablas-sii',          icon: Database,      label: 'Tablas SII' },
      { path: '/importar',            icon: Upload,        label: 'Importar' },
      { path: '/backup',              icon: Download,      label: 'Backup' },
      { path: '/auditoria',           icon: ScrollText,    label: 'Auditoría' },
    ]
  }
];

// Índice path → item, para resolver favoritos
const ALL_ITEMS = menuCategories.flatMap(c => c.items);

const LS_CATEGORIAS = 'sidebar_categorias_abiertas';
const LS_FAVORITOS = 'sidebar_favoritos';

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function Sidebar({ collapsed, onToggle, onLogout }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useApp();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  // ── Categorías colapsables (persistidas) ───────────────────────────────
  const [openCategories, setOpenCategories] = React.useState<Record<string, boolean>>(() =>
    loadJSON<Record<string, boolean>>(LS_CATEGORIAS, Object.fromEntries(menuCategories.map(c => [c.title, true])))
  );

  React.useEffect(() => {
    localStorage.setItem(LS_CATEGORIAS, JSON.stringify(openCategories));
  }, [openCategories]);

  // Auto-expandir la categoría que contiene la ruta activa
  React.useEffect(() => {
    const cat = menuCategories.find(c => c.items.some(i => isActive(i.path)));
    if (cat && !openCategories[cat.title]) {
      setOpenCategories(prev => ({ ...prev, [cat.title]: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const toggleCategory = (title: string) =>
    setOpenCategories(prev => ({ ...prev, [title]: !prev[title] }));

  // ── Favoritos (persistidos) ────────────────────────────────────────────
  const [favoritos, setFavoritos] = React.useState<string[]>(() =>
    loadJSON<string[]>(LS_FAVORITOS, [])
  );

  React.useEffect(() => {
    localStorage.setItem(LS_FAVORITOS, JSON.stringify(favoritos));
  }, [favoritos]);

  const toggleFavorito = (path: string) =>
    setFavoritos(prev => (prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]));

  const favoritosItems = favoritos
    .map(p => ALL_ITEMS.find(i => i.path === p))
    .filter((i): i is (typeof ALL_ITEMS)[number] => Boolean(i));

  // ── Badges de notificación ─────────────────────────────────────────────
  const today = new Date();
  const in7Days = new Date(today); in7Days.setDate(today.getDate() + 7);

  const cxcVencidas = (state.cuentasCobrar ?? []).filter(c =>
    c.estado !== 'pagada' && new Date(c.fechaVencimiento) < today
  ).length;

  const cxpProximas = (state.cuentasPagar ?? []).filter(p =>
    p.estado !== 'pagada' && new Date(p.fechaVencimiento) <= in7Days
  ).length;

  const alertasActivas = (state.alertas ?? []).filter(a => !a.leida).length;

  const BADGE_MAP: Record<string, number> = {
    '/cuentas-cobrar':   cxcVencidas,
    '/cuentas-pagar':    cxpProximas,
    '/alertas':          alertasActivas,
  };

  // ── Render de un ítem del menú ─────────────────────────────────────────
  const renderItem = (item: (typeof ALL_ITEMS)[number]) => {
    const Icon = item.icon;
    const active = isActive(item.path);
    const esFavorito = favoritos.includes(item.path);

    return (
      <li key={item.path} className="group/item relative">
        <button
          onClick={() => navigate(item.path)}
          aria-label={item.label}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg
            transition-[background-color,color] duration-150
            active:scale-[0.97] relative
            focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none
            ${active
              ? 'bg-[#10B981] text-white shadow-sm'
              : 'text-white/70 hover:bg-white/10 hover:text-white'
            }
            ${collapsed ? 'justify-center' : ''}
          `}
          title={collapsed ? item.label : undefined}
        >
          <span className="relative flex-shrink-0">
            <Icon size={18} />
            {/* Badge sobre ícono (solo cuando collapsed) */}
            {collapsed && BADGE_MAP[item.path] > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center px-0.5">
                {BADGE_MAP[item.path] > 9 ? '9+' : BADGE_MAP[item.path]}
              </span>
            )}
          </span>
          <span
            className="text-[13px] font-medium overflow-hidden whitespace-nowrap flex-1 text-left"
            style={{
              maxWidth:  collapsed ? 0      : 160,
              opacity:   collapsed ? 0      : 1,
              transition: 'max-width 250ms cubic-bezier(0.23,1,0.32,1), opacity 180ms ease-out',
            }}
          >
            {item.label}
          </span>
          {/* Badge al lado del label (solo cuando expandido) */}
          {!collapsed && BADGE_MAP[item.path] > 0 && (
            <span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full bg-red-500/90 text-white text-[9px] font-bold flex items-center justify-center px-1">
              {BADGE_MAP[item.path] > 9 ? '9+' : BADGE_MAP[item.path]}
            </span>
          )}
        </button>
        {/* Estrella de favorito (al hover, solo expandido) */}
        {!collapsed && (
          <button
            onClick={(e) => { e.stopPropagation(); toggleFavorito(item.path); }}
            aria-label={esFavorito ? `Quitar ${item.label} de favoritos` : `Agregar ${item.label} a favoritos`}
            className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded
              transition-opacity focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none
              ${esFavorito ? 'opacity-100 text-amber-400' : 'opacity-0 group-hover/item:opacity-100 text-white/40 hover:text-amber-300'}`}
          >
            <Star size={12} fill={esFavorito ? 'currentColor' : 'none'} />
          </button>
        )}
      </li>
    );
  };

  return (
    <aside
      className={`cc-sidebar fixed left-0 top-0 h-full bg-gradient-to-b from-[#1a3352] to-[#152d4a] text-white z-40 flex flex-col
        transition-[width,transform] duration-300
        ${collapsed ? 'w-[70px] md:translate-x-0 -translate-x-full' : 'w-[220px] translate-x-0'}`}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#10B981] rounded-lg flex items-center justify-center">
              <span className="font-bold text-white">CC</span>
            </div>
            <span className="font-semibold text-sm">Contable Chile</span>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 bg-[#10B981] rounded-lg flex items-center justify-center mx-auto">
            <span className="font-bold text-white">CC</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto custom-scrollbar">
        <div className="space-y-4 px-2">
          {/* Favoritos */}
          {favoritosItems.length > 0 && (
            <div>
              {!collapsed && (
                <h4 className="px-3 mb-2 text-[10px] font-bold text-amber-300/70 uppercase tracking-widest flex items-center gap-1">
                  <Star size={10} fill="currentColor" /> Favoritos
                </h4>
              )}
              {collapsed && <div className="h-4"></div>}
              <ul className="space-y-0.5">
                {favoritosItems.map(renderItem)}
              </ul>
            </div>
          )}

          {menuCategories.map((category) => {
            const isOpen = collapsed ? true : (openCategories[category.title] ?? true);
            return (
              <div key={category.title}>
                {!collapsed && (
                  <button
                    onClick={() => toggleCategory(category.title)}
                    aria-expanded={isOpen}
                    aria-label={`${isOpen ? 'Colapsar' : 'Expandir'} categoría ${category.title}`}
                    className="w-full px-3 mb-1 flex items-center justify-between text-[10px] font-bold text-white/40 uppercase tracking-widest
                      hover:text-white/70 transition-colors rounded
                      focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                  >
                    <span>{category.title}</span>
                    <ChevronDown
                      size={12}
                      className={`transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`}
                    />
                  </button>
                )}
                {collapsed && <div className="h-4"></div>}
                <div
                  className="grid transition-[grid-template-rows] duration-200 ease-out"
                  style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
                >
                  <div className="overflow-hidden">
                    <ul className="space-y-0.5">
                      {category.items.map(renderItem)}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-white/10">
        <button
          onClick={() => navigate('/configuracion')}
          aria-label="Configuración"
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/70
            hover:bg-white/10 hover:text-white active:scale-[0.97]
            transition-[background-color,color] duration-150
            focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none
            ${collapsed ? 'justify-center' : ''}
          `}
          title={collapsed ? 'Configuración' : undefined}
        >
          <Settings size={20} className="flex-shrink-0" />
          <span
            className="text-sm font-medium overflow-hidden whitespace-nowrap"
            style={{
              maxWidth:  collapsed ? 0      : 160,
              opacity:   collapsed ? 0      : 1,
              transition: 'max-width 250ms cubic-bezier(0.23,1,0.32,1), opacity 180ms ease-out',
            }}
          >
            Configuración
          </span>
        </button>

        <button
          onClick={onToggle}
          aria-label={collapsed ? 'Expandir sidebar' : 'Contraer sidebar'}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 mt-1 rounded-lg
            text-white/50 hover:bg-white/10 hover:text-white active:scale-[0.97]
            transition-[background-color,color] duration-150
            focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          <span
            className="text-xs overflow-hidden whitespace-nowrap"
            style={{
              maxWidth:  collapsed ? 0   : 60,
              opacity:   collapsed ? 0   : 1,
              transition: 'max-width 250ms cubic-bezier(0.23,1,0.32,1), opacity 180ms ease-out',
            }}
          >
            Contraer
          </span>
        </button>
      </div>

      {/* User Info */}
      <div className="p-4 border-t border-white/10">
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#10B981] rounded-full flex items-center justify-center">
              <span className="text-sm font-semibold">AD</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{state.configuracion.nombreFantasia}</p>
              <p className="text-xs text-white/50 truncate">{state.configuracion.rut}</p>
            </div>
            <button
              onClick={onLogout}
              aria-label="Cerrar sesión"
              className="p-1.5 hover:bg-white/10 rounded transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              title="Cerrar sesión"
            >
              <LogOut size={16} className="text-white/50" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-9 h-9 bg-[#10B981] rounded-full flex items-center justify-center">
              <span className="text-sm font-semibold">AD</span>
            </div>
            <button
              onClick={onLogout}
              aria-label="Cerrar sesión"
              className="p-1.5 hover:bg-white/10 rounded transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              title="Cerrar sesión"
            >
              <LogOut size={16} className="text-white/50" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, User, LogOut, Menu, ChevronDown, Moon, Sun, Settings, Building2, CalendarDays, DatabaseZap, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAppStore } from '../../stores/appStore';
import { ApiAuthService } from '../../services/apiAuth';
import { formatRUT } from '../../utils/calculos';
import GlobalSearch from '../ui/GlobalSearch';

interface HeaderProps {
  onToggleSidebar: () => void;
  onOpenSearch: () => void;
  onCloseSearch: () => void;
  isSearchOpen: boolean;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onLogout: () => void;
}

export default function Header({ onToggleSidebar, onOpenSearch, onCloseSearch, isSearchOpen, darkMode, onToggleDarkMode, onLogout }: HeaderProps) {
  const { state } = useApp();
  const empresaActiva = useAppStore((s) => s.empresaActiva);
  const usuario = ApiAuthService.getCurrentUser();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [importacionSII, setImportacionSII] = useState<{ estado: string; hecho: number; total: number; tipo?: string; nombreArchivo?: string } | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const leerEstado = () => {
      try {
        const raw = localStorage.getItem('scc_importacion_sii_estado');
        setImportacionSII(raw ? JSON.parse(raw) : null);
      } catch { setImportacionSII(null); }
    };
    leerEstado();
    window.addEventListener('scc:importacion-sii', leerEstado);
    window.addEventListener('storage', leerEstado);
    const timer = window.setInterval(leerEstado, 2000);
    return () => { window.removeEventListener('scc:importacion-sii', leerEstado); window.removeEventListener('storage', leerEstado); window.clearInterval(timer); };
  }, []);

  // Cerrar el menú al hacer clic fuera (antes quedaba "pegado" abierto)
  useEffect(() => {
    if (!showUserMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  const handleLogout = () => {
    setShowUserMenu(false);
    onLogout();
  };

  const goToPerfil = () => {
    setShowUserMenu(false);
    navigate('/configuracion');
  };

  const periodoActual = new Intl.DateTimeFormat('es-CL', { month: 'short', year: 'numeric' })
    .format(new Date())
    .replace('.', '');

  return (
    <>
      <header className="h-16 glass border-b border-gray-200/50 dark:border-gray-800/50 flex items-center justify-between px-4 lg:px-6 fixed top-0 right-0 left-[220px] z-30 transition-all duration-300"
        style={{ left: state.sidebarCollapsed ? '70px' : '220px' }}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={onToggleSidebar}
            aria-label="Abrir/cerrar menú lateral"
            className="lg:hidden p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            <Menu size={20} />
          </button>

          <div className="hidden xl:flex items-center gap-2" aria-label="Contexto de trabajo actual">
            <div className="flex items-center gap-2 rounded-lg border border-primary/15 bg-primary/5 px-3 py-1.5">
              <Building2 size={15} className="text-primary" />
              <div className="min-w-0 max-w-52">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Empresa activa</p>
                <p className="truncate text-xs font-semibold text-gray-900 dark:text-gray-100">
                  {empresaActiva?.nombreFantasia || empresaActiva?.razonSocial || 'Sin empresa seleccionada'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-gray-200/70 bg-white/60 px-3 py-1.5 dark:border-gray-700 dark:bg-gray-800/60">
              <CalendarDays size={15} className="text-primary" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Período actual</p>
                <p className="text-xs font-semibold capitalize text-gray-900 dark:text-gray-100">{periodoActual}</p>
              </div>
            </div>
          </div>

          <button
            onClick={onOpenSearch}
            aria-label="Abrir búsqueda global"
            className="hidden md:flex items-center gap-2 px-3 py-2 bg-gray-100/60 dark:bg-gray-800/60 border border-gray-200/50 dark:border-gray-700/50 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors w-64 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            <Search size={16} />
            <span className="flex-1 text-left">Buscar...</span>
            <kbd className="px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-600 rounded">⌘K</kbd>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleDarkMode}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            title={darkMode ? 'Modo claro' : 'Modo oscuro'}
            aria-label={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          {importacionSII && importacionSII.estado === 'procesando' && (
            <div className="hidden items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs text-blue-800 lg:flex" title="La carga continúa en la pestaña del sistema">
              <DatabaseZap size={15} className="animate-pulse" />
              <span className="font-medium">SII {importacionSII.hecho}/{importacionSII.total}</span>
              {importacionSII.nombreArchivo && <span className="hidden max-w-32 truncate text-[10px] text-blue-700 xl:inline" title={importacionSII.nombreArchivo}>{importacionSII.nombreArchivo}</span>}
            </div>
          )}
          {importacionSII && importacionSII.estado !== 'procesando' && (
            <div className={`hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs lg:flex ${importacionSII.estado === 'completada' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`} title="Resultado de la última carga SII">
              {importacionSII.estado === 'completada' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              <span>Importación {importacionSII.estado === 'completada' ? 'completa' : 'con revisión'}</span>
            </div>
          )}

          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              aria-label="Abrir menú de usuario"
              className="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              <div className="hidden md:flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <User size={16} className="text-white" />
                </div>
                <div className="text-left hidden lg:block">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{usuario?.nombre || 'Usuario'}</p>
                  <p className="text-xs capitalize text-gray-500 dark:text-gray-400">{usuario?.rol || 'usuario'}</p>
                </div>
                <ChevronDown size={16} className="text-gray-400" />
              </div>
              <div className="md:hidden w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <User size={16} className="text-white" />
              </div>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-2">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{usuario?.nombre || 'Usuario'}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{usuario?.email || state.configuracion.email}</p>
                  {empresaActiva && (
                    <p className="mt-2 border-t border-gray-100 pt-2 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                      {empresaActiva.razonSocial} · {formatRUT(empresaActiva.rut)}
                    </p>
                  )}
                </div>
                <div className="py-1">
                  <button
                    onClick={goToPerfil}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <User size={16} />
                    Mi Perfil
                  </button>
                  <button
                    onClick={goToPerfil}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <Settings size={16} />
                    Preferencias
                  </button>
                </div>
                <div className="border-t border-gray-100 dark:border-gray-700 py-1">
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                  >
                    <LogOut size={16} />
                    Cerrar Sesion
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <GlobalSearch
        isOpen={isSearchOpen}
        onClose={onCloseSearch}
      />
    </>
  );
}

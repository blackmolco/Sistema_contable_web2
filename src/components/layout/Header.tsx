import React, { useState } from 'react';
import { Bell, Search, User, LogOut, Menu, ChevronDown, Moon, Sun } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatRUT } from '../../utils/calculos';
import GlobalSearch from '../ui/GlobalSearch';

interface HeaderProps {
  onToggleSidebar: () => void;
  onOpenSearch: () => void;
  onCloseSearch: () => void;
  isSearchOpen: boolean;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export default function Header({ onToggleSidebar, onOpenSearch, onCloseSearch, isSearchOpen, darkMode, onToggleDarkMode }: HeaderProps) {
  const { state } = useApp();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

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

          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              aria-label="Ver notificaciones"
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg relative focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-2">
                <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">Notificaciones</h3>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  <div className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-50 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Documentos pendientes</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">3 facturas awaiting approval</p>
                  </div>
                  <div className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-50 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Pago de imposiciones</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Vence en 5 dias</p>
                  </div>
                  <div className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Nomina de sueldo</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">1 trabajador proximo a liquidar</p>
                  </div>
                </div>
                <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700">
                  <button className="text-sm text-[#1E3A5F] dark:text-blue-400 hover:underline">
                    Ver todas las notificaciones
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              aria-label="Abrir menú de usuario"
              className="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              <div className="hidden md:flex items-center gap-2">
                <div className="w-8 h-8 bg-[#1E3A5F] rounded-full flex items-center justify-center">
                  <User size={16} className="text-white" />
                </div>
                <div className="text-left hidden lg:block">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{state.configuracion.nombreFantasia}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formatRUT(state.configuracion.rut)}</p>
                </div>
                <ChevronDown size={16} className="text-gray-400" />
              </div>
              <div className="md:hidden w-8 h-8 bg-[#1E3A5F] rounded-full flex items-center justify-center">
                <User size={16} className="text-white" />
              </div>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-2">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{state.configuracion.razonSocial}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{state.configuracion.email}</p>
                </div>
                <div className="py-1">
                  <button className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                    <User size={16} />
                    Mi Perfil
                  </button>
                  <button className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                    <Bell size={16} />
                    Preferencias
                  </button>
                </div>
                <div className="border-t border-gray-100 dark:border-gray-700 py-1">
                  <button className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2">
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

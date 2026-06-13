import React, { useState, useEffect } from 'react';
import {
  Bell,
  X,
  CheckCheck,
  Info,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';
import { useAppStore, Notificacion } from '../../stores/appStore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const iconos = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
};

const colores = {
  info: 'bg-blue-50 border-blue-200 text-blue-700',
  success: 'bg-green-50 border-green-200 text-green-700',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  error: 'bg-red-50 border-red-200 text-red-700',
};

const iconColors = {
  info: 'text-blue-500',
  success: 'text-green-500',
  warning: 'text-yellow-500',
  error: 'text-red-500',
};

export const CentroNotificaciones: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { notificaciones, notificacionesNoLeidas, marcarLeida, marcarTodasLeidas, eliminarNotificacion, addNotificacion } = useAppStore();

  // Simular conexión WebSocket
  useEffect(() => {
    const interval = setInterval(() => {
      const eventos = [
        { tipo: 'info' as const, titulo: 'Recordatorio', mensaje: 'Vence próxima declaración de IVA en 5 días' },
        { tipo: 'warning' as const, titulo: 'Alerta', mensaje: 'Boleta de honorarios sin pagar del mes anterior' },
      ];
      // Comentado para no saturar: addNotificacion(eventos[Math.floor(Math.random() * eventos.length)]);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {notificacionesNoLeidas > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse">
            {notificacionesNoLeidas > 9 ? '9+' : notificacionesNoLeidas}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-xl border border-gray-200 z-20 max-h-[600px] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Notificaciones</h3>
              <div className="flex items-center gap-2">
                {notificacionesNoLeidas > 0 && (
                  <button
                    onClick={marcarTodasLeidas}
                    className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <CheckCheck className="w-3 h-3" />
                    Marcar todas leídas
                  </button>
                )}
                <button onClick={() => setIsOpen(false)}>
                  <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {notificaciones.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <Bell className="w-12 h-12 mb-3" />
                  <p className="text-sm">No hay notificaciones</p>
                </div>
              ) : (
                notificaciones.map((notif) => {
                  const Icon = iconos[notif.tipo] || Info;
                  return (
                    <div
                      key={notif.id}
                      className={`px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer
                        ${!notif.leida ? 'bg-blue-50/30' : ''}`}
                      onClick={() => marcarLeida(notif.id)}
                    >
                      <div className="flex gap-3">
                        <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${iconColors[notif.tipo]}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm ${!notif.leida ? 'font-semibold' : 'font-medium'} text-gray-900`}>
                              {notif.titulo}
                            </p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                eliminarNotificacion(notif.id);
                              }}
                              className="text-gray-300 hover:text-gray-500"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          <p className="text-xs text-gray-600 mt-0.5">{notif.mensaje}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-400">
                              {format(new Date(notif.fecha), "dd MMM HH:mm", { locale: es })}
                            </span>
                            {notif.modulo && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                                {notif.modulo}
                              </span>
                            )}
                            {notif.link && (
                              <ExternalLink className="w-3 h-3 text-blue-500" />
                            )}
                          </div>
                        </div>
                        {!notif.leida && (
                          <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {notificaciones.length > 0 && (
              <div className="px-4 py-2 border-t border-gray-100 text-center">
                <button className="text-xs text-gray-500 hover:text-gray-700">
                  Ver todas las notificaciones
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

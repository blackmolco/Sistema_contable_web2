import React from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';

export default function Toaster() {
  const { toasts, removeToast } = useAppStore();

  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  };

  const colors = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  const iconColors = {
    success: 'text-green-500',
    error: 'text-red-500',
    warning: 'text-yellow-500',
    info: 'text-blue-500',
  };

  if (!toasts?.length) return null;

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => {
        const type = toast.type as keyof typeof icons;
        const Icon = icons[type] ?? Info;
        // message puede ser "Título: Mensaje" o sólo "Mensaje"
        const parts = toast.message?.split(': ') ?? [];
        const titulo = parts.length > 1 ? parts[0] : '';
        const mensaje = parts.length > 1 ? parts.slice(1).join(': ') : toast.message;

        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 p-4 rounded-lg border shadow-lg animate-toast-in ${colors[type] ?? colors.info}`}
          >
            <Icon size={20} className={iconColors[type] ?? iconColors.info} />
            <div className="flex-1 min-w-0">
              {titulo && <p className="font-medium">{titulo}</p>}
              <p className={`text-sm ${titulo ? 'opacity-80 mt-0.5' : 'font-medium'}`}>{mensaje}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

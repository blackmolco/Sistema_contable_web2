import React from 'react';
import { Sparkles, Activity, AlertCircle } from 'lucide-react';
import type { AlertaTesoreria } from '../../services/tesoreria';

interface Props {
  alertasIA: AlertaTesoreria[];
  sugerenciasIA: string[];
}

export function WidgetAlertas({ alertasIA, sugerenciasIA }: Props) {
  return (
    <div className="space-y-4">
      {alertasIA.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={14} className="text-purple-600" />
            <span className="text-xs font-medium text-purple-700">Análisis IA</span>
          </div>
          <div className="space-y-2">
            {alertasIA.slice(0, 2).map((alerta, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border ${
                  alerta.tipo === 'danger'
                    ? 'bg-red-50 border-red-200'
                    : alerta.tipo === 'warning'
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                <p className="text-sm font-medium text-gray-900">{alerta.tipo}</p>
                <p className="text-xs text-gray-600 mt-1">{alerta.mensaje}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {sugerenciasIA.length > 0 && (
        <div className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-100">
          <div className="flex items-center gap-2 mb-2">
            <Activity size={14} className="text-purple-600" />
            <span className="text-xs font-medium text-purple-700">Sugerencias Inteligentes</span>
          </div>
          <ul className="space-y-1">
            {sugerenciasIA.slice(0, 2).map((suggestion, idx) => (
              <li key={idx} className="text-xs text-purple-800 flex items-start gap-1">
                <span>•</span>
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
          <AlertCircle className="text-amber-500 flex-shrink-0" size={16} />
          <div>
            <p className="text-xs font-medium text-amber-900">Pago de imposiciones</p>
            <p className="text-xs text-amber-700 mt-0.5">Vencen en 5 días hábiles</p>
          </div>
        </div>
        <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <AlertCircle className="text-blue-500 flex-shrink-0" size={16} />
          <div>
            <p className="text-xs font-medium text-blue-900">Declaración de IVA</p>
            <p className="text-xs text-blue-700 mt-0.5">F29 hasta el día 20</p>
          </div>
        </div>
        <div className="flex items-start gap-2 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
          <AlertCircle className="text-emerald-500 flex-shrink-0" size={16} />
          <div>
            <p className="text-xs font-medium text-emerald-900">Cumplimiento SII</p>
            <p className="text-xs text-emerald-700 mt-0.5">Libros actualizados</p>
          </div>
        </div>
      </div>
    </div>
  );
}

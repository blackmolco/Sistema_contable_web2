import React from 'react';

export interface VencimientoTributario {
  nombre: string;
  fecha: string;
  dias: number;
  tipo: string;
}

interface Props {
  vencimientos: VencimientoTributario[];
}

export function WidgetCalendario({ vencimientos }: Props) {
  return (
    <div className="space-y-2">
      {vencimientos.map((v, i) => (
        <div key={i} className="flex items-center justify-between p-2 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${v.dias <= 10 ? 'bg-red-500' : v.dias <= 20 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            <div>
              <p className="text-sm font-medium text-gray-900">{v.nombre}</p>
              <p className="text-xs text-gray-500">{v.fecha}</p>
            </div>
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full
            ${v.dias <= 10 ? 'bg-red-100 text-red-700' : v.dias <= 20 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
            {v.dias}d
          </span>
        </div>
      ))}
    </div>
  );
}

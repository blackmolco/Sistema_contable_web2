import React from 'react';
import { ArrowRight, DollarSign, FileText } from 'lucide-react';
import type { NavigateFunction } from 'react-router-dom';
import type { DocumentoTributario, AsientoContable } from '../../types';
import { formatCurrency } from '../../utils/calculos';

interface Props {
  ultimosDocumentos: DocumentoTributario[];
  ultimosAsientos: AsientoContable[];
  navigate: NavigateFunction;
}

export function WidgetActividad({ ultimosDocumentos, ultimosAsientos, navigate }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-medium text-gray-500 uppercase">Documentos</h4>
          <button
            onClick={() => navigate('/facturacion')}
            className="text-xs text-[#1E3A5F] hover:underline flex items-center gap-1"
          >
            Ver todos <ArrowRight size={10} />
          </button>
        </div>
        {ultimosDocumentos.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Sin documentos recientes</p>
        ) : (
          <div className="space-y-2">
            {ultimosDocumentos.slice(0, 3).map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <DollarSign size={14} className="text-[#1E3A5F]" />
                  <span className="text-xs font-medium">{doc.tipo.toUpperCase()} #{doc.numero}</span>
                </div>
                <span className="text-xs text-gray-600">{formatCurrency(doc.total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-medium text-gray-500 uppercase">Asientos</h4>
          <button
            onClick={() => navigate('/asientos')}
            className="text-xs text-[#1E3A5F] hover:underline flex items-center gap-1"
          >
            Ver todos <ArrowRight size={10} />
          </button>
        </div>
        {ultimosAsientos.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Sin asientos recientes</p>
        ) : (
          <div className="space-y-2">
            {ultimosAsientos.slice(0, 3).map((asiento) => (
              <div key={asiento.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-emerald-600" />
                  <span className="text-xs font-medium">Asiento #{asiento.numero}</span>
                </div>
                <span className="text-xs text-gray-600">{formatCurrency(asiento.totalDebe)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

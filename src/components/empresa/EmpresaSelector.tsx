import React, { useState } from 'react';
import { Building2, Check, ChevronDown, Plus, Settings } from 'lucide-react';
import { useAppStore, Empresa } from '../../stores/appStore';

interface EmpresaSelectorProps {
  variant?: 'sidebar' | 'header';
}

export const EmpresaSelector: React.FC<EmpresaSelectorProps> = ({
  variant = 'header',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { empresas, empresaActiva, setEmpresaActiva } = useAppStore();

  if (empresas.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500">
        <Building2 className="w-4 h-4" />
        <span>Sin empresas</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200
          ${variant === 'sidebar'
            ? 'w-full text-white hover:bg-white/10'
            : 'bg-white border border-gray-200 hover:border-blue-300 hover:shadow-sm text-gray-700'
          }`}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm
          ${variant === 'sidebar' ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-600'}`}
        >
          {empresaActiva?.nombreFantasia?.charAt(0) || 'E'}
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className={`text-sm font-medium truncate ${variant === 'sidebar' ? 'text-white' : 'text-gray-900'}`}>
            {empresaActiva?.nombreFantasia || 'Seleccionar empresa'}
          </p>
          <p className={`text-xs truncate ${variant === 'sidebar' ? 'text-white/60' : 'text-gray-500'}`}>
            {empresaActiva?.rut || ''}
          </p>
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}
          ${variant === 'sidebar' ? 'text-white/60' : 'text-gray-400'}`}
        />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className={`absolute z-20 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 py-1 ${variant === 'sidebar' ? 'left-0' : 'right-0'}`}>
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Empresas
            </div>
            {empresas.map((empresa) => (
              <button
                key={empresa.id}
                onClick={() => {
                  setEmpresaActiva(empresa);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors
                  ${empresaActiva?.id === empresa.id
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                  }`}
              >
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center font-bold text-xs text-gray-600">
                  {empresa.nombreFantasia?.charAt(0) || 'E'}
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium">{empresa.nombreFantasia}</p>
                  <p className="text-xs text-gray-500">{empresa.rut}</p>
                </div>
                {empresaActiva?.id === empresa.id && (
                  <Check className="w-4 h-4 text-blue-600" />
                )}
              </button>
            ))}
            <div className="border-t border-gray-100 mt-1 pt-1">
              <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                <Plus className="w-4 h-4" />
                <span>Agregar empresa</span>
              </button>
              <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                <Settings className="w-4 h-4" />
                <span>Configurar empresas</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

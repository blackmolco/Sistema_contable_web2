import React, { useState } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { formatearRutEnTiempo, mensajeErrorRut, validarRut } from '../../utils/rut';

interface RutInputProps {
  label?: string;
  value: string;
  onChange: (rut: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function RutInput({ label, value, onChange, required, disabled, placeholder = '12.345.678-9', className = '' }: RutInputProps) {
  const [touched, setTouched] = useState(false);
  const error = touched ? mensajeErrorRut(value) : null;
  const isValid = value.trim() !== '' && validarRut(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formateado = formatearRutEnTiempo(e.target.value);
    onChange(formateado);
  };

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label className="text-xs font-medium text-gray-700">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          onBlur={() => setTouched(true)}
          disabled={disabled}
          placeholder={placeholder}
          maxLength={12}
          className={`w-full px-3 py-2 text-sm border rounded-lg font-mono
            focus:outline-none focus:ring-2 transition-[border-color,box-shadow]
            pr-8
            ${error
              ? 'border-red-400 focus:ring-red-200 bg-red-50'
              : isValid
              ? 'border-emerald-400 focus:ring-emerald-200 bg-emerald-50/30'
              : 'border-gray-300 focus:ring-blue-200 bg-white'
            }
            ${disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}
          `}
        />
        {value.trim() !== '' && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2">
            {isValid
              ? <CheckCircle size={14} className="text-emerald-500" />
              : touched ? <AlertCircle size={14} className="text-red-400" /> : null
            }
          </span>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

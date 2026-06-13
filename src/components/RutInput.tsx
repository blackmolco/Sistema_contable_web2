// src/components/RutInput.tsx
// Input controlado de RUT chileno: formatea mientras se escribe y valida en blur.
import { useState } from 'react';
import { formatearRutEnTiempo, validarRut } from '../utils/rut';

export interface RutInputProps {
  value: string;
  onChange: (value: string, isValid: boolean) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export default function RutInput({
  value,
  onChange,
  label,
  required = false,
  disabled = false,
  placeholder = '76.543.210-K',
  className = '',
}: RutInputProps) {
  const [touched, setTouched] = useState(false);

  const esValido = validarRut(value);
  const mostrarError = touched && value.trim() !== '' && !esValido;
  const mostrarOk = touched && esValido;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formateado = formatearRutEnTiempo(e.target.value);
    onChange(formateado, validarRut(formateado));
  };

  const borde = mostrarError
    ? 'border-red-500 focus:ring-red-200 focus:border-red-500'
    : mostrarOk
      ? 'border-green-500 focus:ring-green-200 focus:border-green-500'
      : 'border-gray-300 focus:ring-blue-200 focus:border-blue-500';

  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <input
        type="text"
        inputMode="text"
        value={value}
        onChange={handleChange}
        onBlur={() => setTouched(true)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        maxLength={12}
        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors disabled:bg-gray-50 disabled:text-gray-400 ${borde}`}
      />
      {mostrarError && <p className="mt-1 text-xs text-red-600">RUT inválido</p>}
      {mostrarOk && <p className="mt-1 text-xs text-green-600">✓ RUT válido</p>}
    </div>
  );
}

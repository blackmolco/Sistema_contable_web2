import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Check } from 'lucide-react';

interface SaveButtonProps {
  onSave: () => Promise<void> | void;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

type SaveState = 'idle' | 'saving' | 'saved';

/**
 * Botón con microinteracción de guardado:
 * idle → saving (spinner) → saved (check, 1.5s) → idle
 */
export function SaveButton({ onSave, children = 'Guardar', className = '', disabled = false }: SaveButtonProps) {
  const [state, setState] = useState<SaveState>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleClick = async () => {
    if (state === 'saving') return;
    setState('saving');
    try {
      await onSave();
      setState('saved');
      timerRef.current = setTimeout(() => setState('idle'), 1500);
    } catch (err) {
      console.error('Error al guardar:', err);
      setState('idle');
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || state === 'saving'}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white
        transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none
        disabled:opacity-70 disabled:cursor-not-allowed
        ${state === 'saved' ? 'bg-green-600 hover:bg-green-600' : 'bg-primary hover:bg-primary/90'}
        ${className}`}
    >
      {state === 'saving' && (
        <>
          <Loader2 size={16} className="animate-spin" />
          Guardando...
        </>
      )}
      {state === 'saved' && (
        <>
          <Check size={16} />
          Guardado
        </>
      )}
      {state === 'idle' && children}
    </button>
  );
}

export default SaveButton;

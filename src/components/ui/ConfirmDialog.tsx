import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

type ConfirmVariant = 'danger' | 'warning' | 'info';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm debe usarse dentro de <ConfirmDialogProvider>');
  }
  return ctx;
}

interface PendingConfirm {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
}

const VARIANT_STYLES: Record<ConfirmVariant, { icon: typeof AlertTriangle; iconBg: string; iconColor: string; button: string }> = {
  danger: {
    icon: AlertTriangle,
    iconBg: 'bg-red-100 dark:bg-red-900/30',
    iconColor: 'text-red-600 dark:text-red-400',
    button: 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500',
  },
  warning: {
    icon: AlertCircle,
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    button: 'bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500',
  },
  info: {
    icon: Info,
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
    button: 'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500',
  },
};

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setPending({ options, resolve });
    });
  }, []);

  const close = useCallback((result: boolean) => {
    setPending(prev => {
      prev?.resolve(result);
      return null;
    });
  }, []);

  // Foco inicial en Cancelar (más seguro para variante danger)
  useEffect(() => {
    if (pending) {
      cancelRef.current?.focus();
    }
  }, [pending]);

  // Teclado: Escape cancela, Enter confirma, Tab cicla entre los 2 botones
  useEffect(() => {
    if (!pending) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        close(true);
      } else if (e.key === 'Tab') {
        // Focus trap básico: cicla entre Cancelar y Confirmar
        e.preventDefault();
        if (document.activeElement === cancelRef.current) {
          confirmRef.current?.focus();
        } else {
          cancelRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [pending, close]);

  const options = pending?.options;
  const variant: ConfirmVariant = options?.variant ?? 'danger';
  const styles = VARIANT_STYLES[variant];
  const Icon = styles.icon;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && options && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 animate-backdrop-in"
          onClick={() => close(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 animate-modal-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${styles.iconBg}`}>
                <Icon size={22} className={styles.iconColor} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 id="confirm-dialog-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {options.title}
                </h3>
                <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line">
                  {options.message}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                ref={cancelRef}
                onClick={() => close(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200
                  bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600
                  focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none transition-colors"
              >
                {options.cancelText ?? 'Cancelar'}
              </button>
              <button
                ref={confirmRef}
                onClick={() => close(true)}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white
                  focus-visible:ring-2 focus-visible:outline-none transition-colors ${styles.button}`}
              >
                {options.confirmText ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export default ConfirmDialogProvider;

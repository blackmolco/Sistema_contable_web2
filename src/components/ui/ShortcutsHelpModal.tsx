import React from 'react';

interface ShortcutsHelpModalProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: ['Ctrl', 'K'], desc: 'Búsqueda global' },
  { keys: ['?'], desc: 'Mostrar esta ayuda' },
  { keys: ['Ctrl', '/'], desc: 'Mostrar esta ayuda' },
  { keys: ['Ctrl', 'B'], desc: 'Colapsar sidebar' },
  { keys: ['Esc'], desc: 'Cerrar paneles / modales' },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-mono">
      {children}
    </kbd>
  );
}

export function ShortcutsHelpModal({ open, onClose }: ShortcutsHelpModalProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-backdrop-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-help-title"
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 animate-modal-in"
        onClick={e => e.stopPropagation()}
      >
        <h3 id="shortcuts-help-title" className="font-bold text-gray-900 dark:text-gray-100 mb-4 text-lg">
          Atajos de teclado
        </h3>
        <div className="space-y-2 text-sm">
          {SHORTCUTS.map((s, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-300">{s.desc}</span>
              <div className="flex items-center gap-1">
                {s.keys.map(k => <Kbd key={k}>{k}</Kbd>)}
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded-lg"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

export default ShortcutsHelpModal;

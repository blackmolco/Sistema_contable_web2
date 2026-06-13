import { useEffect } from 'react';

interface KeyboardShortcutsOptions {
  /** Abre/cierra la búsqueda global (Ctrl/Cmd+K) */
  onToggleSearch?: () => void;
  /** Abre/cierra la ayuda de atajos (? o Ctrl/Cmd+/) */
  onToggleHelp?: () => void;
  /** Colapsa/expande el sidebar (Ctrl/Cmd+B) */
  onToggleSidebar?: () => void;
  /** Cierra paneles abiertos (Escape) */
  onEscape?: () => void;
}

/** Devuelve true si el foco está en un campo editable (no interceptar atajos). */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  );
}

/**
 * Atajos globales de teclado:
 *  - Ctrl/Cmd+K → búsqueda global
 *  - ? (Shift+/) o Ctrl/Cmd+/ → ayuda de atajos
 *  - Ctrl/Cmd+B → colapsar sidebar
 *  - Escape → cerrar paneles
 */
export function useKeyboardShortcuts({
  onToggleSearch,
  onToggleHelp,
  onToggleSidebar,
  onEscape,
}: KeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      // Ctrl/Cmd+K — Búsqueda global (funciona incluso con foco en inputs)
      if (e.key === 'k' && mod) {
        e.preventDefault();
        onToggleSearch?.();
        return;
      }
      // Ctrl/Cmd+/ — Ayuda de atajos
      if (e.key === '/' && mod) {
        e.preventDefault();
        onToggleHelp?.();
        return;
      }
      // Ctrl/Cmd+B — Colapsar sidebar
      if (e.key === 'b' && mod) {
        e.preventDefault();
        onToggleSidebar?.();
        return;
      }

      // El resto de atajos se ignoran si el foco está en un campo editable
      if (isEditableTarget(e.target)) return;

      // ? — Ayuda de atajos (Shift+/)
      if (e.key === '?' && !mod) {
        e.preventDefault();
        onToggleHelp?.();
        return;
      }
      // Escape — cerrar paneles
      if (e.key === 'Escape') {
        onEscape?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleSearch, onToggleHelp, onToggleSidebar, onEscape]);
}

export default useKeyboardShortcuts;

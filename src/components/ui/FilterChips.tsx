import React from "react";
import { X } from "lucide-react";

export interface FilterChip {
  key: string;
  label: string;
  value: string;
  color?: string;
}

interface FilterChipsProps {
  chips: FilterChip[];
  onRemove: (key: string) => void;
  onClearAll?: () => void;
}

export function FilterChips({ chips, onRemove, onClearAll }: FilterChipsProps) {
  if (chips.length === 0) return null;
  return (
    <div className="flex items-center flex-wrap gap-2 py-1 animate-fade-in">
      <span className="text-xs text-gray-400 font-medium">Filtros:</span>
      {chips.map(chip => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-[#1E3A5F]/10 text-[#1E3A5F] dark:bg-blue-900/30 dark:text-blue-300 text-xs font-medium rounded-full border border-[#1E3A5F]/20 dark:border-blue-800/50"
        >
          <span className="opacity-60">{chip.label}:</span>
          <span className="font-semibold">{chip.value}</span>
          <button
            onClick={() => onRemove(chip.key)}
            className="flex-shrink-0 p-0.5 hover:bg-[#1E3A5F]/20 rounded-full transition-colors active:scale-[0.9]"
            aria-label={`Quitar filtro ${chip.label}`}
          >
            <X size={11} />
          </button>
        </span>
      ))}
      {chips.length > 1 && onClearAll && (
        <button
          onClick={onClearAll}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-2"
        >
          Limpiar todo
        </button>
      )}
    </div>
  );
}

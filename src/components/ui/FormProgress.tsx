import React from "react";

export interface FormStep {
  id: string;
  label: string;
  isComplete: boolean;
  isActive?: boolean;
}

interface FormProgressProps {
  steps: FormStep[];
  className?: string;
}

/**
 * Indicador de progreso para formularios multi-sección.
 * Muestra un porcentaje de campos completados y pasos opcionalmente.
 */
export function FormProgress({ steps, className = "" }: FormProgressProps) {
  const completed = steps.filter(s => s.isComplete).length;
  const pct = steps.length > 0 ? Math.round((completed / steps.length) * 100) : 0;

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Barra */}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
        <span className="font-medium">Progreso del formulario</span>
        <span className="font-semibold text-gray-700 dark:text-gray-300">{pct}%</span>
      </div>
      <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: pct === 100
              ? "var(--accent-color, #10B981)"
              : "var(--brand-color, #1E3A5F)",
          }}
        />
      </div>

      {/* Pasos */}
      {steps.length > 0 && (
        <div className="flex gap-1 pt-1 flex-wrap">
          {steps.map(s => (
            <div
              key={s.id}
              className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors
                ${s.isComplete
                  ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                  : s.isActive
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                }`}
            >
              {s.isComplete ? (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <div className={`w-1.5 h-1.5 rounded-full ${s.isActive ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"}`} />
              )}
              {s.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Hook para rastrear campos de un formulario automáticamente.
 * Recibe un objeto con los valores actuales y los campos requeridos.
 */
export function useFormProgress(values: Record<string, unknown>, requiredFields: string[]): number {
  const filled = requiredFields.filter(f => {
    const v = values[f];
    return v !== undefined && v !== null && v !== "" && v !== 0;
  }).length;
  return requiredFields.length > 0 ? Math.round((filled / requiredFields.length) * 100) : 0;
}

import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
}

/** Bloque base de skeleton — pulso gris con dark mode */
export function Skeleton({ className = '', width, height }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${className}`}
      style={{ width, height }}
    />
  );
}

/** Skeleton de tabla: header + filas con anchos variados */
export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  const widths = ['w-3/4', 'w-1/2', 'w-2/3', 'w-full', 'w-5/6'];
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
      {/* Header */}
      <div className="flex gap-4 pb-3 border-b border-gray-100 dark:border-gray-700">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Filas */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="flex-1">
              <Skeleton className={`h-4 ${widths[(r + c) % widths.length]}`} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Skeleton de tarjeta KPI: título corto + cifra grande + sparkline fantasma */
export function CardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6 space-y-4">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-36" />
      <div className="flex items-end gap-1 h-8">
        {[40, 65, 50, 80, 60, 90, 70, 55].map((h, i) => (
          <div
            key={i}
            className="animate-pulse rounded-sm bg-gray-200 dark:bg-gray-700 flex-1"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/** Skeleton de formulario: pares label + input */
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6 space-y-5">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <Skeleton className="h-10 w-32" />
    </div>
  );
}

export default Skeleton;

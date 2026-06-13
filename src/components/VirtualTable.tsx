// src/components/VirtualTable.tsx
// Tabla genérica con virtual scroll (@tanstack/react-virtual) para listas grandes.
// Uso: <VirtualTable data={asientos} columns={[{ key: 'fecha', header: 'Fecha' }, ...]} />
import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

export interface VirtualTableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  width?: string;
}

export interface VirtualTableProps<T extends { id: string }> {
  data: T[];
  columns: VirtualTableColumn<T>[];
  rowHeight?: number;
  containerHeight?: number;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

export default function VirtualTable<T extends { id: string }>({
  data,
  columns,
  rowHeight = 44,
  containerHeight = 480,
  onRowClick,
  emptyMessage = 'Sin registros',
}: VirtualTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800">
      {/* Header sticky */}
      <div className="flex bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        {columns.map((col) => (
          <div
            key={col.key}
            className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
            style={{ width: col.width, flex: col.width ? undefined : 1 }}
          >
            {col.header}
          </div>
        ))}
      </div>

      {/* Cuerpo virtualizado */}
      {data.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">{emptyMessage}</div>
      ) : (
        <div ref={parentRef} style={{ height: containerHeight, overflow: 'auto' }}>
          <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
            {virtualizer.getVirtualItems().map((vRow) => {
              const row = data[vRow.index];
              return (
                <div
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`flex items-center border-b border-gray-100 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 ${
                    onRowClick ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-gray-700' : ''
                  }`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: vRow.size,
                    transform: `translateY(${vRow.start}px)`,
                  }}
                >
                  {columns.map((col) => (
                    <div
                      key={col.key}
                      className="px-4 truncate"
                      style={{ width: col.width, flex: col.width ? undefined : 1 }}
                    >
                      {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer con conteo */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500">
        {data.length.toLocaleString('es-CL')} registros
      </div>
    </div>
  );
}

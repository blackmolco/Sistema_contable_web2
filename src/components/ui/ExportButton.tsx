import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Column {
  key: string;
  label: string;
  format?: (val: unknown) => string;
}

interface ExportButtonProps {
  data: Record<string, unknown>[];
  columns: Column[];
  filename?: string;
  title?: string;
  size?: 'sm' | 'md';
}

export function ExportButton({ data, columns, filename = 'export', title, size = 'sm' }: ExportButtonProps) {
  const [open, setOpen] = useState(false);

  const exportExcel = () => {
    const rows = data.map(row =>
      Object.fromEntries(
        columns.map(col => [
          col.label,
          col.format ? col.format(row[col.key]) : (row[col.key] ?? ''),
        ])
      )
    );
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, title ?? 'Datos');
    XLSX.writeFile(wb, `${filename}.xlsx`);
    setOpen(false);
  };

  const exportCSV = () => {
    const header = columns.map(c => `"${c.label}"`).join(';');
    const body = data.map(row =>
      columns.map(col => {
        const v = col.format ? col.format(row[col.key]) : (row[col.key] ?? '');
        return `"${String(v).replace(/"/g, '""')}"`;
      }).join(';')
    ).join('\n');
    const blob = new Blob(['﻿' + header + '\n' + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  const btnClass = size === 'sm'
    ? 'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 active:scale-[0.97] transition-[background-color,transform]'
    : 'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 active:scale-[0.97] transition-[background-color,transform]';

  return (
    <div className="relative">
      <button className={btnClass} onClick={() => setOpen(o => !o)}>
        <Download size={size === 'sm' ? 14 : 16} />
        Exportar
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[160px]">
            <button
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              onClick={exportExcel}
            >
              <FileSpreadsheet size={15} className="text-emerald-600" />
              Excel (.xlsx)
            </button>
            <button
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              onClick={exportCSV}
            >
              <FileText size={15} className="text-blue-600" />
              CSV (.csv)
            </button>
          </div>
        </>
      )}
    </div>
  );
}

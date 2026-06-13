import React from 'react';
import { Plus, X } from 'lucide-react';

export interface NotaRapida {
  id: string;
  contenido: string;
  color: string;
  fecha: string;
}

export const NOTA_COLORES = ['#fef3c7', '#dbeafe', '#d1fae5', '#fce7f3', '#ede9fe', '#fee2e2'];

interface Props {
  notas: NotaRapida[];
  notaColor: string;
  setNotaColor: (c: string) => void;
  newNota: string;
  setNewNota: (v: string) => void;
  addNota: () => void;
  deleteNota: (id: string) => void;
}

export function WidgetNotas({ notas, notaColor, setNotaColor, newNota, setNewNota, addNota, deleteNota }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 flex-wrap mb-2">
        {NOTA_COLORES.map(c => (
          <button
            key={c}
            onClick={() => setNotaColor(c)}
            className={`w-5 h-5 rounded-full transition-transform ${notaColor === c ? 'scale-125 ring-2 ring-gray-400' : ''}`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={newNota}
          onChange={e => setNewNota(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addNota()}
          placeholder="Nueva nota..."
          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
        />
        <button onClick={addNota} className="px-3 py-1.5 bg-[#1E3A5F] text-white rounded-lg text-sm hover:bg-[#2D5A87]">
          <Plus size={14} />
        </button>
      </div>
      <div className="space-y-2 max-h-52 overflow-y-auto">
        {notas.map(nota => (
          <div
            key={nota.id}
            className="p-3 rounded-lg relative group"
            style={{ backgroundColor: nota.color }}
          >
            <p className="text-sm text-gray-800 pr-6">{nota.contenido}</p>
            <p className="text-xs text-gray-400 mt-1">
              {new Date(nota.fecha).toLocaleDateString('es-CL')}
            </p>
            <button
              onClick={() => deleteNota(nota.id)}
              className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/50 rounded"
            >
              <X size={12} className="text-gray-500" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

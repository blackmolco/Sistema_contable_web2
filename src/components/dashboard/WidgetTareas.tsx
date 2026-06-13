import React from 'react';
import { Plus, Check, Trash2, Clock } from 'lucide-react';

export interface Tarea {
  id: string;
  titulo: string;
  descripcion: string;
  prioridad: 'alta' | 'media' | 'baja';
  fechaVencimiento: string;
  completada: boolean;
  modulo?: string;
}

interface Props {
  tareasActivas: Tarea[];
  showTareaForm: boolean;
  setShowTareaForm: (v: boolean) => void;
  newTarea: string;
  setNewTarea: (v: string) => void;
  addTarea: () => void;
  toggleTarea: (id: string) => void;
  deleteTarea: (id: string) => void;
}

export function WidgetTareas({
  tareasActivas,
  showTareaForm,
  setShowTareaForm,
  newTarea,
  setNewTarea,
  addTarea,
  toggleTarea,
  deleteTarea,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-500">
          {tareasActivas.length} pendientes
        </span>
        <button
          onClick={() => setShowTareaForm(!showTareaForm)}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
        >
          <Plus size={16} className="text-gray-500" />
        </button>
      </div>

      {showTareaForm && (
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newTarea}
            onChange={e => setNewTarea(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTarea()}
            placeholder="Nueva tarea..."
            className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
          />
          <button onClick={addTarea} className="px-3 py-1.5 bg-[#1E3A5F] text-white rounded-lg text-sm hover:bg-[#2D5A87]">
            <Plus size={14} />
          </button>
        </div>
      )}

      {tareasActivas.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No hay tareas pendientes</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {tareasActivas.slice(0, 8).map(tarea => (
            <div key={tarea.id} className="flex items-start gap-2 p-2 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
              <button
                onClick={() => toggleTarea(tarea.id)}
                className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors
                  ${tarea.completada ? 'bg-emerald-500 border-emerald-500' : tarea.prioridad === 'alta' ? 'border-red-400 hover:bg-red-50' : tarea.prioridad === 'media' ? 'border-amber-400 hover:bg-amber-50' : 'border-gray-300 hover:bg-gray-50'}`}
              >
                {tarea.completada && <Check size={10} className="text-white" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${tarea.completada ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                  {tarea.titulo}
                </p>
                {tarea.fechaVencimiento && (
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                    <Clock size={10} /> {tarea.fechaVencimiento}
                  </p>
                )}
              </div>
              <button
                onClick={() => deleteTarea(tarea.id)}
                className="p-1 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

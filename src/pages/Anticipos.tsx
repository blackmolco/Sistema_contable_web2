import React, { useState } from 'react';
import { HandCoins, Save, Search, CheckCircle } from 'lucide-react';
import { Card } from '../components/ui/Cards';
import { formatCurrency, formatDate } from '../utils/calculos';
import { useApp } from '../context/AppContext';

export default function Anticipos() {
  const { state, dispatch, showToast } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [montoAnticipo, setMontoAnticipo] = useState<number | ''>('');
  const [trabajadorSeleccionado, setTrabajadorSeleccionado] = useState<string | null>(null);

  const trabajadoresFiltrados = state.trabajadores.filter(t => 
    t.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.rut.includes(searchTerm)
  );

  const handleGuardarAnticipo = () => {
    if (!trabajadorSeleccionado || !montoAnticipo || montoAnticipo <= 0) {
      showToast('error', 'Error', 'Seleccione un trabajador y un monto válido.');
      return;
    }

    const trabajador = state.trabajadores.find(t => t.id === trabajadorSeleccionado);
    if (!trabajador) return;

    dispatch({
      type: 'UPDATE_TRABAJADOR',
      payload: { ...trabajador, anticipos: (trabajador.anticipos || 0) + Number(montoAnticipo) },
    });
    showToast('success', 'Anticipo Registrado', `Anticipo de ${formatCurrency(Number(montoAnticipo))} registrado correctamente.`);
    setMontoAnticipo('');
    setTrabajadorSeleccionado(null);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-100 rounded-lg">
            <HandCoins className="text-amber-700" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestor de Anticipos y Préstamos</h1>
            <p className="text-sm text-gray-500 mt-1">Otorga adelantos de sueldo que se descontarán automáticamente a fin de mes.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 border-amber-200">
          <h3 className="font-semibold text-gray-900 mb-4">Otorgar Nuevo Anticipo</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Buscar Trabajador</label>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="RUT o Nombre"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20" 
                />
                <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto border rounded-lg custom-scrollbar">
              {trabajadoresFiltrados.map(t => (
                <div 
                  key={t.id} 
                  onClick={() => setTrabajadorSeleccionado(t.id)}
                  className={`p-2 cursor-pointer border-b text-sm transition-colors hover:bg-amber-50 ${trabajadorSeleccionado === t.id ? 'bg-amber-100 border-amber-300' : ''}`}
                >
                  <p className="font-medium text-gray-900">{t.nombre}</p>
                  <p className="text-xs text-gray-500">{t.rut}</p>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Monto a Anticipar ($)</label>
              <input 
                type="number" 
                placeholder="Ej: 100000"
                value={montoAnticipo}
                onChange={(e) => setMontoAnticipo(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20" 
              />
            </div>

            <button 
              onClick={handleGuardarAnticipo}
              className="w-full py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center justify-center gap-2 font-medium"
            >
              <Save size={18} /> Registrar y Contabilizar
            </button>
          </div>
        </Card>

        <Card className="col-span-2">
          <h3 className="font-semibold text-gray-900 mb-4">Saldos de Anticipos Actuales</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr className="text-gray-600">
                  <th className="py-2 px-3 font-medium">Trabajador</th>
                  <th className="py-2 px-3 font-medium">RUT</th>
                  <th className="py-2 px-3 font-medium text-right">Sueldo Base</th>
                  <th className="py-2 px-3 font-medium text-right text-amber-700">Deuda Anticipo</th>
                  <th className="py-2 px-3 font-medium text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {state.trabajadores.map(t => {
                  const tieneDeuda = t.anticipos && t.anticipos > 0;
                  return (
                    <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-3 font-medium text-gray-900">{t.nombre}</td>
                      <td className="py-3 px-3 text-gray-600">{t.rut}</td>
                      <td className="py-3 px-3 text-right text-gray-600">{formatCurrency(t.sueldoBase)}</td>
                      <td className="py-3 px-3 text-right font-bold text-amber-700">{tieneDeuda ? formatCurrency(t.anticipos!) : '-'}</td>
                      <td className="py-3 px-3 text-center">
                        {tieneDeuda ? (
                          <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-1 rounded-full font-bold">POR DESCONTAR</span>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-1 rounded-full font-bold">AL DÍA</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

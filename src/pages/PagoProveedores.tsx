import React, { useState } from 'react';
import { Wallet, CheckSquare, Square, Download, Search, AlertCircle, Building2 } from 'lucide-react';
import { Card } from '../components/ui/Cards';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate } from '../utils/calculos';

export default function PagoProveedores() {
  const { state, showToast, dispatch } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [seleccionadas, setSeleccionadas] = useState<string[]>([]);
  const [banco, setBanco] = useState('santander');

  // Filtrar facturas de compra pendientes
  const facturasPendientes = state.documentos.filter(d => 
    (d.tipo === 'factura_compra' || d.tipo === 'factura') && 
    (d.estado === 'pendiente' || d.estado === 'emitido') &&
    (d.razonSocialCliente.toLowerCase().includes(searchTerm.toLowerCase()) || d.rutCliente.includes(searchTerm))
  );

  const totalSeleccionado = facturasPendientes
    .filter(f => seleccionadas.includes(f.id))
    .reduce((acc, curr) => acc + curr.total, 0);

  const toggleSeleccion = (id: string) => {
    if (seleccionadas.includes(id)) {
      setSeleccionadas(seleccionadas.filter(i => i !== id));
    } else {
      setSeleccionadas([...seleccionadas, id]);
    }
  };

  const seleccionarTodas = () => {
    if (seleccionadas.length === facturasPendientes.length) {
      setSeleccionadas([]);
    } else {
      setSeleccionadas(facturasPendientes.map(f => f.id));
    }
  };

  const generarNominaTXT = () => {
    if (seleccionadas.length === 0) {
      showToast('error', 'Sin Selección', 'Seleccione al menos una factura para pagar.');
      return;
    }

    const docs = facturasPendientes.filter(f => seleccionadas.includes(f.id));
    
    // Simular formato bancario (RUT;NOMBRE;MONTO;EMAIL;CUENTA)
    const lineas = docs.map(d => {
      const rutLimpio = d.rutCliente.replace(/\./g, '');
      return `${rutLimpio};${d.razonSocialCliente.substring(0,30)};${d.total};pagos@${d.razonSocialCliente.replace(/\s+/g,'').toLowerCase()}.cl;CTA_CTE;123456789`;
    });

    // Encabezado según banco
    let header = '';
    if (banco === 'santander') header = `NOMINA_PAGO_PROVEEDORES;${state.configuracion.rut};${formatDate(new Date())};${docs.length};${totalSeleccionado}\n`;
    if (banco === 'banco_chile') header = `PGO;${state.configuracion.rut.replace('-','')};${totalSeleccionado};${docs.length}\n`;

    const txtContent = header + lineas.join('\n');
    
    const blob = new Blob([txtContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Nomina_${banco}_${new Date().getTime()}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    // Opcional: Marcar facturas como pagadas en el estado global
    // Esto requeriría una acción UPDATE_DOCUMENTO en el contexto
    showToast('success', 'Nómina Generada', `Se generó el archivo de pago para ${docs.length} proveedores.`);
    setSeleccionadas([]);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-100 rounded-lg">
            <Wallet className="text-amber-700" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Control de Pago a Proveedores</h1>
            <p className="text-sm text-gray-500 mt-1">Selecciona facturas por vencer y genera el archivo de transferencia masiva del banco.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="col-span-1 md:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <div className="relative w-64">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Buscar proveedor o RUT..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
              />
            </div>
            
            <button 
              onClick={seleccionarTodas}
              className="text-sm text-[#1E3A5F] hover:underline font-medium"
            >
              {seleccionadas.length === facturasPendientes.length ? 'Deseleccionar Todas' : 'Seleccionar Todas'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr className="text-gray-600">
                  <th className="py-3 px-4 w-12"></th>
                  <th className="py-3 px-4 font-semibold">Proveedor</th>
                  <th className="py-3 px-4 font-semibold">Folio</th>
                  <th className="py-3 px-4 font-semibold text-center">F. Emisión</th>
                  <th className="py-3 px-4 font-semibold text-center">Estado</th>
                  <th className="py-3 px-4 font-semibold text-right">Monto a Pagar</th>
                </tr>
              </thead>
              <tbody>
                {facturasPendientes.map(f => {
                  const isSelected = seleccionadas.includes(f.id);
                  // Simular fecha de vencimiento a 30 días
                  const fechaEmision = new Date(f.fecha);
                  const fechaVencimiento = new Date(fechaEmision.getTime() + (30 * 24 * 60 * 60 * 1000));
                  const diasParaVencer = Math.ceil((fechaVencimiento.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                  const vencida = diasParaVencer < 0;

                  return (
                    <tr key={f.id} className={`border-b border-gray-100 transition-colors ${isSelected ? 'bg-amber-50/50' : 'hover:bg-gray-50'}`}>
                      <td className="py-3 px-4 text-center cursor-pointer" onClick={() => toggleSeleccion(f.id)}>
                        {isSelected ? <CheckSquare className="text-amber-600 mx-auto" size={20} /> : <Square className="text-gray-400 mx-auto" size={20} />}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-gray-900 truncate max-w-[200px]">{f.razonSocialCliente}</p>
                        <p className="text-xs text-gray-500">{f.rutCliente}</p>
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-600">#{f.numero}</td>
                      <td className="py-3 px-4 text-center text-gray-600">{formatDate(f.fecha)}</td>
                      <td className="py-3 px-4 text-center">
                        {vencida ? (
                          <span className="bg-red-100 text-red-800 text-[10px] px-2 py-1 rounded font-bold">VENCIDA ({Math.abs(diasParaVencer)}d)</span>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-1 rounded font-bold">AL DÍA ({diasParaVencer}d)</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-gray-900">{formatCurrency(f.total)}</td>
                    </tr>
                  );
                })}
                {facturasPendientes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      No hay facturas pendientes de pago registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="col-span-1 h-fit sticky top-6 border-amber-200">
          <h3 className="font-semibold text-gray-900 mb-4 border-b pb-2">Resumen de Pago</h3>
          
          <div className="space-y-4 mb-6">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Documentos:</span>
              <span className="font-bold text-gray-900">{seleccionadas.length}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Total a Pagar:</span>
              <span className="font-black text-2xl text-amber-600">{formatCurrency(totalSeleccionado)}</span>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-medium text-gray-700">Formato Bancario</label>
            <select 
              value={banco}
              onChange={(e) => setBanco(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-amber-500/20"
            >
              <option value="santander">Banco Santander (TXT)</option>
              <option value="banco_chile">Banco de Chile (TXT)</option>
              <option value="bci">Banco BCI (CSV)</option>
              <option value="estado">Banco Estado (CSV)</option>
            </select>
          </div>

          <button 
            onClick={generarNominaTXT}
            disabled={seleccionadas.length === 0}
            className={`w-full mt-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
              seleccionadas.length === 0 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-amber-600 text-white hover:bg-amber-700 shadow-sm'
            }`}
          >
            <Download size={18} /> Generar Archivo Nómina
          </button>

          <p className="text-[10px] text-gray-400 mt-4 text-center">
            Este archivo se puede subir directamente al portal empresas de tu banco para realizar la transferencia múltiple.
          </p>
        </Card>
      </div>
    </div>
  );
}

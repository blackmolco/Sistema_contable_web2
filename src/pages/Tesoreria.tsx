import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Plus,
  Edit2,
  Trash2,
  Download,
  AlertTriangle,
  DollarSign,
  Calendar,
  RefreshCw,
  Lightbulb,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Card, Badge } from '../components/ui/Cards';
import { Button, Input, Select } from '../components/ui/FormElements';
import { Modal } from '../components/ui/Modal';
import { useTesoreriaStore } from '../stores';
import type { FlujoCaja, ProyeccionFlujo, AlertaTesoreria } from '../stores';
import { formatCurrency, formatDate } from '../utils/calculos';

export default function Tesoreria() {
  const store = useTesoreriaStore();
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<FlujoCaja | null>(null);

  const [formData, setFormData] = useState<Partial<FlujoCaja>>({
    fecha: new Date().toISOString().split('T')[0],
    tipo: 'entrada',
    categoria: 'Operacional',
    descripcion: '',
    monto: 0,
    origen: 'factura',
    estado: 'proyectado',
  });

  const flujoCaja = store.flujoCaja;
  const saldoInicial = store.saldoInicial;
  const proyeccion = store.proyectarFlujo(30);
  const saldoProyectado = store.calcularSaldoProyectado();

  const abrirModalNuevo = () => {
    setEditingItem(null);
    setFormData({
      fecha: new Date().toISOString().split('T')[0],
      tipo: 'entrada',
      categoria: 'Operacional',
      descripcion: '',
      monto: 0,
      origen: 'factura',
      estado: 'proyectado',
    });
    setShowModal(true);
  };

  const abrirModalEditar = (item: FlujoCaja) => {
    setEditingItem(item);
    setFormData(item);
    setShowModal(true);
  };

  const handleSubmit = () => {
    if (!formData.descripcion || !formData.monto) return;

    if (editingItem) {
      store.actualizarMovimiento(editingItem.id, formData as FlujoCaja);
    } else {
      store.agregarMovimiento(formData as Omit<FlujoCaja, 'id'>);
    }

    setShowModal(false);
  };

  const handleEliminar = (id: string) => {
    store.eliminarMovimiento(id);
  };

  const handleActualizarSaldo = () => {
    store.setSaldoInicial(store.saldoInicial);
  };

  const totales = {
    entradas: flujoCaja.filter(f => f.tipo === 'entrada' && f.estado !== 'proyectado').reduce((s, f) => s + f.monto, 0),
    salidas: flujoCaja.filter(f => f.tipo === 'salida' && f.estado !== 'proyectado').reduce((s, f) => s + f.monto, 0),
    entradasProyectadas: flujoCaja.filter(f => f.tipo === 'entrada' && f.estado === 'proyectado').reduce((s, f) => s + f.monto, 0),
    salidasProyectadas: flujoCaja.filter(f => f.tipo === 'salida' && f.estado === 'proyectado').reduce((s, f) => s + f.monto, 0),
  };

  const alertas = useMemo(() => store.detectarAnomalias(), [flujoCaja]);
  const sugerencias = useMemo(() => store.obtenerSugerencias(), [flujoCaja]);
  const alertasAlertas = alertas.filter(a => a.tipo === 'warning');
  const alertasDanger = alertas.filter(a => a.tipo === 'danger');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tesorería</h1>
          <p className="text-sm text-gray-500 mt-1">Control de flujo de caja y proyecciones</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={handleActualizarSaldo}>
            Actualizar
          </Button>
          <Button icon={<Plus size={16} />} onClick={abrirModalNuevo}>
            Nuevo Movimiento
          </Button>
        </div>
      </div>

      {/* Saldo Principal */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#1E3A5F] rounded-lg">
              <Wallet size={20} className="text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Saldo Inicial</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(saldoInicial)}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${saldoProyectado >= 0 ? 'bg-emerald-100' : 'bg-red-100'}`}>
              <DollarSign size={20} className={saldoProyectado >= 0 ? 'text-emerald-600' : 'text-red-600'} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Saldo Proyectado</p>
              <p className={`text-xl font-bold ${saldoProyectado >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCurrency(saldoProyectado)}
              </p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 rounded-lg">
              <TrendingUp size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Entradas Confirmadas</p>
              <p className="text-xl font-bold text-emerald-600">{formatCurrency(totales.entradas)}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <TrendingDown size={20} className="text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Salidas Confirmadas</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(totales.salidas)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Alertas y Sugerencias */}
      {(alertasDanger.length > 0 || alertasAlertas.length > 0 || sugerencias.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {alertasDanger.length > 0 && (
            <Card className="border-red-300 bg-red-50">
              {alertasDanger.map((alerta) => (
                <div key={alerta.id} className="flex items-start gap-3">
                  <AlertTriangle size={20} className="text-red-600 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-red-900">{alerta.mensaje}</p>
                    {alerta.monto && <p className="text-sm text-red-700">{formatCurrency(alerta.monto)}</p>}
                  </div>
                </div>
              ))}
            </Card>
          )}
          {alertasAlertas.length > 0 && (
            <Card className="border-amber-300 bg-amber-50">
              {alertasAlertas.map((alerta) => (
                <div key={alerta.id} className="flex items-start gap-3">
                  <AlertTriangle size={20} className="text-amber-600 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-amber-900">{alerta.mensaje}</p>
                    {alerta.monto && <p className="text-sm text-amber-700">{formatCurrency(alerta.monto)}</p>}
                  </div>
                </div>
              ))}
            </Card>
          )}
          {sugerencias.length > 0 && (
            <Card className="border-blue-300 bg-blue-50">
              <div className="flex items-start gap-3">
                <Lightbulb size={20} className="text-blue-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-blue-900 mb-2">Sugerencias</p>
                  {sugerencias.map((s, i) => (
                    <p key={i} className="text-sm text-blue-700 mb-1">{s}</p>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Proyección Gráfico */}
      <Card title="Proyección de Flujo de Caja (30 días)">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={proyeccion}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="fecha"
                tickFormatter={(val) => {
                  const date = new Date(val);
                  return `${date.getDate()}/${date.getMonth() + 1}`;
                }}
                stroke="#6B7280"
                fontSize={12}
              />
              <YAxis
                stroke="#6B7280"
                fontSize={12}
                tickFormatter={(val) => `$${(val / 1000000).toFixed(1)}M`}
              />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), 'Saldo']}
                labelFormatter={(label) => `Fecha: ${formatDate(label)}`}
              />
              <Area
                type="monotone"
                dataKey="saldo"
                stroke="#10B981"
                fill="#10B981"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Flujo de Caja Detallado */}
      <Card
        title="Movimientos de Caja"
        action={
          <div className="flex gap-2">
            <span className="text-sm text-gray-500">
              Proyectado: +{formatCurrency(totales.entradasProyectadas)} / -{formatCurrency(totales.salidasProyectadas)}
            </span>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Descripción</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Origen</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Estado</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Monto</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {flujoCaja.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No hay movimientos registrados
                  </td>
                </tr>
              ) : (
                flujoCaja.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{formatDate(item.fecha)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={item.tipo === 'entrada' ? 'success' : 'danger'}>
                        {item.tipo === 'entrada' ? 'Entrada' : 'Salida'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.descripcion}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.origen}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        variant={
                          item.estado === 'realizado' ? 'success' :
                          item.estado === 'confirmado' ? 'info' : 'warning'
                        }
                      >
                        {item.estado}
                      </Badge>
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${
                      item.tipo === 'entrada' ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {item.tipo === 'entrada' ? '+' : '-'}{formatCurrency(item.monto)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => abrirModalEditar(item)} className="p-1.5 hover:bg-gray-100 rounded">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleEliminar(item.id)} className="p-1.5 hover:bg-red-50 text-red-600 rounded">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingItem ? 'Editar Movimiento' : 'Nuevo Movimiento'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSubmit}>Guardar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Fecha"
              type="date"
              value={formData.fecha || ''}
              onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
            />
            <Select
              label="Tipo"
              value={formData.tipo || 'entrada'}
              onChange={(e) => setFormData({ ...formData, tipo: e.target.value as 'entrada' | 'salida' })}
              options={[
                { value: 'entrada', label: 'Entrada' },
                { value: 'salida', label: 'Salida' },
              ]}
            />
          </div>
          <Input
            label="Descripción"
            value={formData.descripcion || ''}
            onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Monto"
              type="number"
              value={formData.monto || 0}
              onChange={(e) => setFormData({ ...formData, monto: Number(e.target.value) })}
            />
            <Select
              label="Origen"
              value={formData.origen || 'factura'}
              onChange={(e) => setFormData({ ...formData, origen: e.target.value as FlujoCaja['origen'] })}
              options={[
                { value: 'factura', label: 'Factura' },
                { value: 'honorario', label: 'Honorario' },
                { value: 'arriendo', label: 'Arriendo' },
                { value: 'sueldo', label: 'Sueldo' },
                { value: 'proveedor', label: 'Proveedor' },
                { value: 'impuesto', label: 'Impuesto' },
                { value: 'otro', label: 'Otro' },
              ]}
            />
          </div>
          <Select
            label="Estado"
            value={formData.estado || 'proyectado'}
            onChange={(e) => setFormData({ ...formData, estado: e.target.value as FlujoCaja['estado'] })}
            options={[
              { value: 'proyectado', label: 'Proyectado' },
              { value: 'confirmado', label: 'Confirmado' },
              { value: 'realizado', label: 'Realizado' },
            ]}
          />
        </div>
      </Modal>
    </div>
  );
}

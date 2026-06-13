import React, { useState, useMemo } from 'react';
import { TrendingDown, Plus, DollarSign, AlertTriangle, Trash2, CreditCard, Calendar } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card, Badge } from '../components/ui/Cards';
import { Button, Input, Select, Textarea } from '../components/ui/FormElements';
import { Modal, ConfirmDialog } from '../components/ui/Modal';
import { CuentaPagar, EstadoCxP, PagoCxP } from '../types';
import { generateId, formatDate } from '../utils/calculos';

const TIPO_DOC_OPTS = [
  { value: 'Factura', label: 'Factura' },
  { value: 'Factura Exenta', label: 'Factura Exenta' },
  { value: 'Boleta', label: 'Boleta' },
  { value: 'Otro', label: 'Otro' },
];

const FORMA_PAGO_OPTS = [
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'otro', label: 'Otro' },
];

const ESTADO_VARIANT: Record<EstadoCxP, 'success' | 'warning' | 'danger' | 'info'> = {
  pagado: 'success', parcial: 'warning', pendiente: 'info', vencido: 'danger',
};
const ESTADO_LABEL: Record<EstadoCxP, string> = {
  pagado: 'Pagado', parcial: 'Parcial', pendiente: 'Pendiente', vencido: 'Vencido',
};

function calcEstado(cxp: CuentaPagar): EstadoCxP {
  if (cxp.montoPagado >= cxp.monto) return 'pagado';
  if (cxp.montoPagado > 0) return 'parcial';
  if (new Date(cxp.fechaVencimiento) < new Date()) return 'vencido';
  return 'pendiente';
}

function diasParaVencer(fecha: string): number {
  return Math.floor((new Date(fecha).getTime() - new Date().getTime()) / 86400000);
}

const emptyForm = () => ({
  proveedorRut: '', proveedorNombre: '', tipoDocumento: 'Factura',
  numeroDocumento: '', fecha: new Date().toISOString().split('T')[0],
  fechaVencimiento: '', monto: 0, notas: '',
});

export default function CuentasPagar() {
  const { state, dispatch, showToast } = useApp();
  const [filterEstado, setFilterEstado] = useState('todos');
  const [showModalNuevo, setShowModalNuevo] = useState(false);
  const [showModalPago, setShowModalPago] = useState(false);
  const [selectedCxP, setSelectedCxP] = useState<CuentaPagar | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [pagoForm, setPagoForm] = useState({ fecha: new Date().toISOString().split('T')[0], monto: 0, formaPago: 'transferencia', banco: '', referencia: '' });

  const cxpList = useMemo(() =>
    (state.cuentasPagar ?? []).map(c => ({ ...c, estado: calcEstado(c) })),
    [state.cuentasPagar]
  );

  const filtradas = useMemo(() =>
    filterEstado === 'todos' ? cxpList : cxpList.filter(c => c.estado === filterEstado),
    [cxpList, filterEstado]
  );

  const kpis = useMemo(() => {
    const pendiente = cxpList.filter(c => c.estado !== 'pagado');
    const vencido = cxpList.filter(c => c.estado === 'vencido');
    const proximos = cxpList.filter(c => c.estado === 'pendiente' && diasParaVencer(c.fechaVencimiento) <= 7 && diasParaVencer(c.fechaVencimiento) >= 0);
    return {
      total: pendiente.reduce((s, c) => s + (c.monto - c.montoPagado), 0),
      totalVencido: vencido.reduce((s, c) => s + (c.monto - c.montoPagado), 0),
      totalProximos: proximos.reduce((s, c) => s + (c.monto - c.montoPagado), 0),
      count: pendiente.length,
    };
  }, [cxpList]);

  const formatCLP = (n: number) => `$${n.toLocaleString('es-CL')}`;

  const proveedoresOpts = [
    { value: '', label: 'Ingresar manualmente...' },
    ...(state.clientesProveedores ?? [])
      .filter(c => c.tipo === 'proveedor' || c.tipo === 'ambos')
      .map(c => ({ value: c.rut, label: `${c.rut} — ${c.razonSocial}` })),
  ];

  const handleGuardar = () => {
    if (!form.proveedorRut || !form.proveedorNombre) { showToast('error', 'Error', 'Ingresa los datos del proveedor'); return; }
    if (!form.monto || form.monto <= 0) { showToast('error', 'Error', 'El monto debe ser mayor a 0'); return; }
    if (!form.fechaVencimiento) { showToast('error', 'Error', 'La fecha de vencimiento es obligatoria'); return; }

    const nueva: CuentaPagar = {
      id: generateId(), proveedorId: '', ...form, montoPagado: 0, estado: 'pendiente', pagos: [],
    };
    dispatch({ type: 'ADD_CXP', payload: nueva });
    showToast('success', 'CxP creada', `${formatCLP(form.monto)} por pagar a ${form.proveedorNombre}`);
    setShowModalNuevo(false);
    setForm(emptyForm());
  };

  const handleRegistrarPago = () => {
    if (!selectedCxP) return;
    if (!pagoForm.monto || pagoForm.monto <= 0) { showToast('error', 'Error', 'El monto del pago debe ser mayor a 0'); return; }
    const saldo = selectedCxP.monto - selectedCxP.montoPagado;
    if (pagoForm.monto > saldo) { showToast('error', 'Error', `El pago excede el saldo (${formatCLP(saldo)})`); return; }

    const nuevoPago: PagoCxP = { id: generateId(), fecha: pagoForm.fecha, monto: pagoForm.monto, formaPago: pagoForm.formaPago as PagoCxP['formaPago'], banco: pagoForm.banco, referencia: pagoForm.referencia };
    const nuevoMontoPagado = selectedCxP.montoPagado + pagoForm.monto;
    const updated: CuentaPagar = { ...selectedCxP, montoPagado: nuevoMontoPagado, pagos: [...selectedCxP.pagos, nuevoPago], estado: calcEstado({ ...selectedCxP, montoPagado: nuevoMontoPagado }) };
    dispatch({ type: 'UPDATE_CXP', payload: updated });
    showToast('success', 'Pago registrado', `${formatCLP(pagoForm.monto)} pagado a ${selectedCxP.proveedorNombre}`);
    setShowModalPago(false);
    setSelectedCxP(null);
  };

  // Próximos vencimientos (7 días)
  const proximosVencer = useMemo(() =>
    cxpList.filter(c => c.estado === 'pendiente' || c.estado === 'parcial')
      .map(c => ({ ...c, diasRestantes: diasParaVencer(c.fechaVencimiento) }))
      .filter(c => c.diasRestantes <= 7)
      .sort((a, b) => a.diasRestantes - b.diasRestantes),
    [cxpList]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-50 rounded-lg"><TrendingDown className="text-red-600" size={24} /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cuentas por Pagar</h1>
            <p className="text-sm text-gray-500 mt-1">Control de obligaciones con proveedores</p>
          </div>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => setShowModalNuevo(true)}>Nueva CxP</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4"><p className="text-xs font-semibold text-red-700 uppercase">Total por Pagar</p><p className="text-2xl font-bold text-red-800 mt-1">{formatCLP(kpis.total)}</p><p className="text-xs text-red-600 mt-1">{kpis.count} obligación{kpis.count !== 1 ? 'es' : ''}</p></div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-semibold text-amber-700 uppercase">Vence en 7 días</p><p className="text-2xl font-bold text-amber-800 mt-1">{formatCLP(kpis.totalProximos)}</p><p className="text-xs text-amber-600 mt-1">{proximosVencer.length} pago{proximosVencer.length !== 1 ? 's' : ''} próximo{proximosVencer.length !== 1 ? 's' : ''}</p></div>
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4"><p className="text-xs font-semibold text-gray-600 uppercase">Vencido sin pagar</p><p className="text-2xl font-bold text-gray-800 mt-1">{formatCLP(kpis.totalVencido)}</p></div>
      </div>

      {/* Alerta de próximos vencimientos */}
      {proximosVencer.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-amber-600" />
            <p className="text-sm font-semibold text-amber-800">Vencimientos próximos (próximos 7 días)</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {proximosVencer.map(c => (
              <div key={c.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-amber-100">
                <div>
                  <p className="text-sm font-medium text-gray-800">{c.proveedorNombre}</p>
                  <p className="text-xs text-gray-500">{c.tipoDocumento} #{c.numeroDocumento} — vence {c.diasRestantes <= 0 ? 'hoy' : `en ${c.diasRestantes} día${c.diasRestantes !== 1 ? 's' : ''}`}</p>
                </div>
                <p className="text-sm font-bold text-amber-700">{formatCLP(c.monto - c.montoPagado)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabla */}
      <Card padding="none">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
          {(['todos', 'pendiente', 'parcial', 'vencido', 'pagado'] as const).map(e => (
            <button key={e} onClick={() => setFilterEstado(e)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterEstado === e ? 'bg-[#1E3A5F] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {e === 'todos' ? 'Todos' : ESTADO_LABEL[e as EstadoCxP]}
            </button>
          ))}
        </div>
        <table className="w-full table-modern">
          <thead><tr><th>Proveedor</th><th>Documento</th><th>Fecha</th><th>Vencimiento</th><th className="text-right">Monto</th><th className="text-right">Saldo</th><th className="text-center">Estado</th><th className="text-center">Acción</th></tr></thead>
          <tbody>
            {filtradas.length === 0 ? (
              <tr><td colSpan={8} className="py-12 text-center"><div className="flex flex-col items-center gap-2"><Calendar size={36} className="text-gray-200" /><p className="text-sm text-gray-500">Sin registros en esta categoría</p></div></td></tr>
            ) : filtradas.map(c => {
              const dias = diasParaVencer(c.fechaVencimiento);
              return (
                <tr key={c.id}>
                  <td className="px-4 py-3"><p className="text-sm font-medium text-gray-900">{c.proveedorNombre}</p><p className="text-xs text-gray-400 font-mono">{c.proveedorRut}</p></td>
                  <td className="px-4 py-3 text-sm text-gray-700">{c.tipoDocumento} #{c.numeroDocumento}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatDate(c.fecha)}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={c.estado === 'vencido' ? 'text-red-600 font-medium' : dias <= 7 ? 'text-amber-600 font-medium' : 'text-gray-600'}>{formatDate(c.fechaVencimiento)}</span>
                    {c.estado === 'pendiente' && dias <= 7 && dias >= 0 && <p className="text-xs text-amber-500">Vence en {dias === 0 ? 'hoy' : `${dias} días`}</p>}
                    {c.estado === 'vencido' && <p className="text-xs text-red-500">{Math.abs(dias)} días vencido</p>}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium">{formatCLP(c.monto)}</td>
                  <td className="px-4 py-3 text-sm text-right font-bold text-red-700">{formatCLP(c.monto - c.montoPagado)}</td>
                  <td className="px-4 py-3 text-center"><Badge variant={ESTADO_VARIANT[c.estado]} dot>{ESTADO_LABEL[c.estado]}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {c.estado !== 'pagado' && (
                        <button onClick={() => { setSelectedCxP(c); setPagoForm({ ...pagoForm, monto: c.monto - c.montoPagado }); setShowModalPago(true); }}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors active:scale-[0.95]" title="Registrar pago">
                          <DollarSign size={15} />
                        </button>
                      )}
                      <button onClick={() => setConfirmId(c.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors active:scale-[0.95]"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* Modal Nueva CxP */}
      <Modal isOpen={showModalNuevo} onClose={() => setShowModalNuevo(false)} title="Nueva Cuenta por Pagar" size="lg"
        footer={<><Button variant="secondary" onClick={() => setShowModalNuevo(false)}>Cancelar</Button><Button onClick={handleGuardar}>Guardar</Button></>}>
        <div className="space-y-4">
          <Select label="Seleccionar proveedor" value={form.proveedorRut}
            onChange={e => {
              const prov = (state.clientesProveedores ?? []).find(c => c.rut === e.target.value);
              setForm({ ...form, proveedorRut: e.target.value, proveedorNombre: prov?.razonSocial ?? form.proveedorNombre });
            }} options={proveedoresOpts} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="RUT Proveedor *" value={form.proveedorRut} onChange={e => setForm({ ...form, proveedorRut: e.target.value })} />
            <Input label="Nombre Proveedor *" value={form.proveedorNombre} onChange={e => setForm({ ...form, proveedorNombre: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Tipo Documento" value={form.tipoDocumento} onChange={e => setForm({ ...form, tipoDocumento: e.target.value })} options={TIPO_DOC_OPTS} />
            <Input label="N° Documento" value={form.numeroDocumento} onChange={e => setForm({ ...form, numeroDocumento: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Fecha" type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} />
            <Input label="Vencimiento *" type="date" value={form.fechaVencimiento} onChange={e => setForm({ ...form, fechaVencimiento: e.target.value })} />
            <Input label="Monto Total *" type="number" value={form.monto || ''} onChange={e => setForm({ ...form, monto: Number(e.target.value) })} />
          </div>
          <Textarea label="Notas" value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} rows={2} />
        </div>
      </Modal>

      {/* Modal Registrar Pago */}
      <Modal isOpen={showModalPago} onClose={() => setShowModalPago(false)} title="Registrar Pago a Proveedor" size="sm"
        footer={<><Button variant="secondary" onClick={() => setShowModalPago(false)}>Cancelar</Button><Button icon={<CreditCard size={15} />} onClick={handleRegistrarPago}>Registrar Pago</Button></>}>
        {selectedCxP && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
              <p className="font-medium text-red-800">{selectedCxP.proveedorNombre}</p>
              <p className="text-red-600">{selectedCxP.tipoDocumento} #{selectedCxP.numeroDocumento}</p>
              <p className="text-red-700 font-bold mt-1">Saldo: {formatCLP(selectedCxP.monto - selectedCxP.montoPagado)}</p>
            </div>
            <Input label="Fecha del Pago" type="date" value={pagoForm.fecha} onChange={e => setPagoForm({ ...pagoForm, fecha: e.target.value })} />
            <Input label="Monto Pagado *" type="number" value={pagoForm.monto || ''} onChange={e => setPagoForm({ ...pagoForm, monto: Number(e.target.value) })} />
            <Select label="Forma de Pago" value={pagoForm.formaPago} onChange={e => setPagoForm({ ...pagoForm, formaPago: e.target.value })} options={FORMA_PAGO_OPTS} />
            <Input label="Banco" value={pagoForm.banco} onChange={e => setPagoForm({ ...pagoForm, banco: e.target.value })} placeholder="Ej: Banco Estado, BCI..." />
            <Input label="N° de Referencia / Transferencia" value={pagoForm.referencia} onChange={e => setPagoForm({ ...pagoForm, referencia: e.target.value })} />
          </div>
        )}
      </Modal>

      <ConfirmDialog isOpen={!!confirmId} onClose={() => setConfirmId(null)} onConfirm={() => { dispatch({ type: 'DELETE_CXP', payload: confirmId! }); showToast('success', 'Eliminado', 'CxP eliminada'); setConfirmId(null); }} title="Eliminar CxP" message="¿Eliminar esta cuenta por pagar?" confirmText="Sí, eliminar" variant="danger" />
    </div>
  );
}

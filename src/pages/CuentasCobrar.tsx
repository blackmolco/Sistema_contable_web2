import React, { useState, useMemo } from 'react';
import { TrendingUp, Plus, DollarSign, AlertCircle, CheckCircle, Clock, Trash2, CreditCard, LayoutGrid, List } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card, Badge } from '../components/ui/Cards';
import { Button, Input, Select, Textarea } from '../components/ui/FormElements';
import { Modal, ConfirmDialog } from '../components/ui/Modal';
import { CuentaCobrar, EstadoCxC, PagoCxC } from '../types';
import { generateId, formatDate } from '../utils/calculos';

const TIPO_DOC_OPTS = [
  { value: 'Factura', label: 'Factura' },
  { value: 'Boleta', label: 'Boleta' },
  { value: 'Factura Exenta', label: 'Factura Exenta' },
  { value: 'Otro', label: 'Otro' },
];

const FORMA_PAGO_OPTS = [
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'otro', label: 'Otro' },
];

const ESTADO_VARIANT: Record<EstadoCxC, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  pagado: 'success', parcial: 'warning', pendiente: 'info', vencido: 'danger', incobrable: 'default',
};

const ESTADO_LABEL: Record<EstadoCxC, string> = {
  pagado: 'Pagado', parcial: 'Parcial', pendiente: 'Pendiente', vencido: 'Vencido', incobrable: 'Incobrable',
};

function calcEstado(cxc: CuentaCobrar): EstadoCxC {
  if (cxc.montoPagado >= cxc.monto) return 'pagado';
  if (cxc.montoPagado > 0) return 'parcial';
  const hoy = new Date();
  if (new Date(cxc.fechaVencimiento) < hoy) return 'vencido';
  return 'pendiente';
}

function diasVencimiento(fecha: string): number {
  return Math.floor((new Date().getTime() - new Date(fecha).getTime()) / 86400000);
}

function agingBucket(cxc: CuentaCobrar): string {
  if (cxc.estado === 'pagado') return 'pagado';
  const dias = diasVencimiento(cxc.fechaVencimiento);
  if (dias <= 0) return 'vigente';
  if (dias <= 30) return '1-30';
  if (dias <= 60) return '31-60';
  if (dias <= 90) return '61-90';
  return '+90';
}

const emptyForm = () => ({
  clienteRut: '', clienteNombre: '', tipoDocumento: 'Factura',
  numeroDocumento: '', fecha: new Date().toISOString().split('T')[0],
  fechaVencimiento: '', monto: 0, notas: '',
});

type ViewMode = 'table' | 'kanban';

const KANBAN_COLUMNS: Array<{ id: EstadoCxC | 'vigente'; label: string; color: string; bg: string }> = [
  { id: 'pendiente', label: 'Pendiente',   color: 'text-blue-700',    bg: 'bg-blue-50 dark:bg-blue-950/30' },
  { id: 'parcial',   label: 'Parcial',     color: 'text-amber-700',   bg: 'bg-amber-50 dark:bg-amber-950/30' },
  { id: 'vencido',   label: 'Vencido',     color: 'text-red-700',     bg: 'bg-red-50 dark:bg-red-950/30' },
  { id: 'pagado',    label: 'Pagado',      color: 'text-emerald-700', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
];

export default function CuentasCobrar() {
  const { state, dispatch, showToast } = useApp();
  const [filterEstado, setFilterEstado] = useState('todos');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [showModalNuevo, setShowModalNuevo] = useState(false);
  const [showModalPago, setShowModalPago] = useState(false);
  const [selectedCxC, setSelectedCxC] = useState<CuentaCobrar | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [pagoForm, setPagoForm] = useState({ fecha: new Date().toISOString().split('T')[0], monto: 0, formaPago: 'transferencia', referencia: '' });

  // Sincronizar estado calculado
  const cxcList = useMemo(() =>
    (state.cuentasCobrar ?? []).map(c => ({ ...c, estado: calcEstado(c) })),
    [state.cuentasCobrar]
  );

  const filtradas = useMemo(() =>
    filterEstado === 'todos' ? cxcList : cxcList.filter(c => c.estado === filterEstado),
    [cxcList, filterEstado]
  );

  // KPIs
  const kpis = useMemo(() => {
    const pendiente = cxcList.filter(c => c.estado !== 'pagado');
    const vencido = cxcList.filter(c => c.estado === 'vencido');
    const total = pendiente.reduce((s, c) => s + (c.monto - c.montoPagado), 0);
    const totalVencido = vencido.reduce((s, c) => s + (c.monto - c.montoPagado), 0);
    return { total, totalVencido, count: pendiente.length, countVencido: vencido.length };
  }, [cxcList]);

  // Aging
  const aging = useMemo(() => {
    const buckets: Record<string, number> = { vigente: 0, '1-30': 0, '31-60': 0, '61-90': 0, '+90': 0 };
    cxcList.filter(c => c.estado !== 'pagado').forEach(c => {
      const b = agingBucket(c);
      buckets[b] = (buckets[b] ?? 0) + (c.monto - c.montoPagado);
    });
    return buckets;
  }, [cxcList]);

  const formatCLP = (n: number) => `$${n.toLocaleString('es-CL')}`;

  // Clientes disponibles para selector rápido
  const clientesOpts = [
    { value: '', label: 'Ingresar manualmente...' },
    ...(state.clientesProveedores ?? [])
      .filter(c => c.tipo === 'cliente' || c.tipo === 'ambos')
      .map(c => ({ value: c.rut, label: `${c.rut} — ${c.razonSocial}` })),
  ];

  const handleGuardar = () => {
    if (!form.clienteRut || !form.clienteNombre) { showToast('error', 'Error', 'Ingresa los datos del cliente'); return; }
    if (!form.monto || form.monto <= 0) { showToast('error', 'Error', 'El monto debe ser mayor a 0'); return; }
    if (!form.fechaVencimiento) { showToast('error', 'Error', 'La fecha de vencimiento es obligatoria'); return; }

    const nueva: CuentaCobrar = {
      id: generateId(), clienteId: '', ...form, montoPagado: 0,
      estado: 'pendiente', pagos: [],
    };
    dispatch({ type: 'ADD_CXC', payload: nueva });
    showToast('success', 'CxC creada', `${formatCLP(form.monto)} por cobrar a ${form.clienteNombre}`);
    setShowModalNuevo(false);
    setForm(emptyForm());
  };

  const handleRegistrarPago = () => {
    if (!selectedCxC) return;
    if (!pagoForm.monto || pagoForm.monto <= 0) { showToast('error', 'Error', 'El monto del pago debe ser mayor a 0'); return; }
    const saldo = selectedCxC.monto - selectedCxC.montoPagado;
    if (pagoForm.monto > saldo) { showToast('error', 'Error', `El pago excede el saldo (${formatCLP(saldo)})`); return; }

    const nuevoPago: PagoCxC = { id: generateId(), fecha: pagoForm.fecha, monto: pagoForm.monto, formaPago: pagoForm.formaPago as PagoCxC['formaPago'], referencia: pagoForm.referencia };
    const nuevaMontoPagado = selectedCxC.montoPagado + pagoForm.monto;
    const updated: CuentaCobrar = { ...selectedCxC, montoPagado: nuevaMontoPagado, pagos: [...selectedCxC.pagos, nuevoPago], estado: calcEstado({ ...selectedCxC, montoPagado: nuevaMontoPagado }) };
    dispatch({ type: 'UPDATE_CXC', payload: updated });
    showToast('success', 'Pago registrado', `${formatCLP(pagoForm.monto)} recibido`);
    setShowModalPago(false);
    setSelectedCxC(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 rounded-lg"><TrendingUp className="text-emerald-600" size={24} /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cuentas por Cobrar</h1>
            <p className="text-sm text-gray-500 mt-1">Seguimiento de deudores y cobros pendientes</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle tabla/kanban */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('table')}
              title="Vista tabla"
              className={`p-2 rounded-md transition-colors ${viewMode === 'table' ? 'bg-white dark:bg-gray-700 shadow-sm' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
            >
              <List size={15} className="text-gray-600 dark:text-gray-400" />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              title="Vista Kanban"
              className={`p-2 rounded-md transition-colors ${viewMode === 'kanban' ? 'bg-white dark:bg-gray-700 shadow-sm' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
            >
              <LayoutGrid size={15} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>
          <Button icon={<Plus size={16} />} onClick={() => setShowModalNuevo(true)}>Nueva CxC</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><p className="text-xs font-semibold text-blue-700 uppercase">Total Pendiente</p><p className="text-2xl font-bold text-blue-800 mt-1">{formatCLP(kpis.total)}</p><p className="text-xs text-blue-600 mt-1">{kpis.count} documento{kpis.count !== 1 ? 's' : ''}</p></div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4"><p className="text-xs font-semibold text-red-700 uppercase">Vencido</p><p className="text-2xl font-bold text-red-800 mt-1">{formatCLP(kpis.totalVencido)}</p><p className="text-xs text-red-600 mt-1">{kpis.countVencido} vencido{kpis.countVencido !== 1 ? 's' : ''}</p></div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-semibold text-amber-700 uppercase">Por vencer (30 días)</p><p className="text-2xl font-bold text-amber-800 mt-1">{formatCLP(aging['vigente'] ?? 0)}</p></div>
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4"><p className="text-xs font-semibold text-gray-600 uppercase">Más de 90 días</p><p className="text-2xl font-bold text-gray-800 mt-1">{formatCLP(aging['+90'] ?? 0)}</p></div>
      </div>

      {/* Aging visual */}
      <Card title="Análisis de Antigüedad de Saldos">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[['Vigente', 'vigente', 'bg-emerald-500'], ['1-30 días', '1-30', 'bg-amber-400'], ['31-60 días', '31-60', 'bg-orange-500'], ['61-90 días', '61-90', 'bg-red-500'], ['+90 días', '+90', 'bg-red-800']].map(([label, key, color]) => {
            const monto = aging[key as string] ?? 0;
            const pct = kpis.total > 0 ? Math.round((monto / kpis.total) * 100) : 0;
            return (
              <div key={key} className="text-center">
                <div className="text-xs font-semibold text-gray-500 mb-2">{label}</div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-1"><div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} /></div>
                <div className="text-sm font-bold text-gray-800">{formatCLP(monto)}</div>
                <div className="text-xs text-gray-400">{pct}%</div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── Vista Kanban ─────────────────────────────────────────────────── */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {KANBAN_COLUMNS.map(col => {
            const items = cxcList.filter(c => c.estado === col.id);
            const total = items.reduce((s, c) => s + (c.monto - c.montoPagado), 0);
            return (
              <div key={col.id} className={`rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden`}>
                {/* Header columna */}
                <div className={`px-4 py-3 ${col.bg} border-b border-gray-200 dark:border-gray-700`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold uppercase tracking-wider ${col.color}`}>{col.label}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full bg-white/60 ${col.color}`}>
                      {items.length}
                    </span>
                  </div>
                  {total > 0 && (
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-1">{formatCLP(total)}</p>
                  )}
                </div>

                {/* Cards */}
                <div className="p-2 space-y-2 bg-gray-50/50 dark:bg-gray-900/50 min-h-[120px]">
                  {items.length === 0 ? (
                    <div className="py-6 text-center text-xs text-gray-400">Sin registros</div>
                  ) : items.map(c => (
                    <div
                      key={c.id}
                      className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{c.clienteNombre}</p>
                      <p className="text-xs text-gray-400 font-mono">{c.clienteRut}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500">{c.tipoDocumento} #{c.numeroDocumento}</span>
                        <span className="text-sm font-bold text-[#1E3A5F] dark:text-blue-300">{formatCLP(c.monto - c.montoPagado)}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Vence: {formatDate(c.fechaVencimiento)}</p>
                      {c.estado !== 'pagado' && (
                        <button
                          onClick={() => { setSelectedCxC(c); setPagoForm({ ...pagoForm, monto: c.monto - c.montoPagado }); setShowModalPago(true); }}
                          className="mt-2 w-full text-xs py-1 rounded-md bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 transition-colors font-medium"
                        >
                          Registrar pago
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Vista Tabla ───────────────────────────────────────────────────── */}
      {viewMode === 'table' && (
      <Card padding="none">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          {(['todos', 'pendiente', 'parcial', 'vencido', 'pagado'] as const).map(e => (
            <button key={e} onClick={() => setFilterEstado(e)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize ${filterEstado === e ? 'bg-[#1E3A5F] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {e === 'todos' ? 'Todos' : ESTADO_LABEL[e as EstadoCxC]}
            </button>
          ))}
        </div>
        <table className="w-full table-modern">
          <thead><tr><th>Cliente</th><th>Documento</th><th>Fecha</th><th>Vencimiento</th><th className="text-right">Monto</th><th className="text-right">Saldo</th><th className="text-center">Estado</th><th className="text-center">Acción</th></tr></thead>
          <tbody>
            {filtradas.length === 0 ? (
              <tr><td colSpan={8} className="py-12 text-center"><div className="flex flex-col items-center gap-2"><CheckCircle size={36} className="text-gray-200" /><p className="text-sm text-gray-500">Sin registros en esta categoría</p></div></td></tr>
            ) : filtradas.map(c => (
              <tr key={c.id}>
                <td className="px-4 py-3"><p className="text-sm font-medium text-gray-900">{c.clienteNombre}</p><p className="text-xs text-gray-400 font-mono">{c.clienteRut}</p></td>
                <td className="px-4 py-3 text-sm text-gray-700">{c.tipoDocumento} #{c.numeroDocumento}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{formatDate(c.fecha)}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={c.estado === 'vencido' ? 'text-red-600 font-medium' : 'text-gray-600'}>{formatDate(c.fechaVencimiento)}</span>
                  {c.estado === 'vencido' && <p className="text-xs text-red-500">{diasVencimiento(c.fechaVencimiento)} días vencido</p>}
                </td>
                <td className="px-4 py-3 text-sm text-right font-medium">{formatCLP(c.monto)}</td>
                <td className="px-4 py-3 text-sm text-right font-bold text-[#1E3A5F]">{formatCLP(c.monto - c.montoPagado)}</td>
                <td className="px-4 py-3 text-center"><Badge variant={ESTADO_VARIANT[c.estado]} dot>{ESTADO_LABEL[c.estado]}</Badge></td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1">
                    {c.estado !== 'pagado' && (
                      <button onClick={() => { setSelectedCxC(c); setPagoForm({ ...pagoForm, monto: c.monto - c.montoPagado }); setShowModalPago(true); }}
                        className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors active:scale-[0.95]" title="Registrar pago">
                        <DollarSign size={15} />
                      </button>
                    )}
                    <button onClick={() => setConfirmId(c.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors active:scale-[0.95]"><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      )}

      {/* Modal Nueva CxC */}
      <Modal isOpen={showModalNuevo} onClose={() => setShowModalNuevo(false)} title="Nueva Cuenta por Cobrar" size="lg"
        footer={<><Button variant="secondary" onClick={() => setShowModalNuevo(false)}>Cancelar</Button><Button onClick={handleGuardar}>Guardar</Button></>}>
        <div className="space-y-4">
          <Select label="Seleccionar cliente" value={form.clienteRut}
            onChange={e => {
              const cl = (state.clientesProveedores ?? []).find(c => c.rut === e.target.value);
              setForm({ ...form, clienteRut: e.target.value, clienteNombre: cl?.razonSocial ?? form.clienteNombre });
            }} options={clientesOpts} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="RUT Cliente *" value={form.clienteRut} onChange={e => setForm({ ...form, clienteRut: e.target.value })} />
            <Input label="Nombre Cliente *" value={form.clienteNombre} onChange={e => setForm({ ...form, clienteNombre: e.target.value })} />
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
      <Modal isOpen={showModalPago} onClose={() => setShowModalPago(false)} title="Registrar Pago" size="sm"
        footer={<><Button variant="secondary" onClick={() => setShowModalPago(false)}>Cancelar</Button><Button icon={<CreditCard size={15} />} onClick={handleRegistrarPago}>Registrar Pago</Button></>}>
        {selectedCxC && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
              <p className="font-medium text-blue-800">{selectedCxC.clienteNombre}</p>
              <p className="text-blue-600">{selectedCxC.tipoDocumento} #{selectedCxC.numeroDocumento}</p>
              <p className="text-blue-700 font-bold mt-1">Saldo: {formatCLP(selectedCxC.monto - selectedCxC.montoPagado)}</p>
            </div>
            <Input label="Fecha del Pago" type="date" value={pagoForm.fecha} onChange={e => setPagoForm({ ...pagoForm, fecha: e.target.value })} />
            <Input label="Monto Recibido *" type="number" value={pagoForm.monto || ''} onChange={e => setPagoForm({ ...pagoForm, monto: Number(e.target.value) })} />
            <Select label="Forma de Pago" value={pagoForm.formaPago} onChange={e => setPagoForm({ ...pagoForm, formaPago: e.target.value })} options={FORMA_PAGO_OPTS} />
            <Input label="Referencia / N° de transferencia" value={pagoForm.referencia} onChange={e => setPagoForm({ ...pagoForm, referencia: e.target.value })} />
          </div>
        )}
      </Modal>

      <ConfirmDialog isOpen={!!confirmId} onClose={() => setConfirmId(null)} onConfirm={() => { dispatch({ type: 'DELETE_CXC', payload: confirmId! }); showToast('success', 'Eliminado', 'CxC eliminada'); setConfirmId(null); }} title="Eliminar CxC" message="¿Eliminar esta cuenta por cobrar?" confirmText="Sí, eliminar" variant="danger" />
    </div>
  );
}

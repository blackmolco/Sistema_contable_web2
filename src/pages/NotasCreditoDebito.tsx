import React, { useState, useMemo } from 'react';
import { FileX, Plus, Edit2, Trash2, Search, CheckCircle, XCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card, Badge } from '../components/ui/Cards';
import { Button, Input, Select, Textarea } from '../components/ui/FormElements';
import { Modal, ConfirmDialog } from '../components/ui/Modal';
import { NotaCreditoDebito, CodigoRefNC } from '../types';
import { generateId } from '../utils/calculos';

const TIPO_OPCIONES = [
  { value: 'credito', label: 'Nota de Crédito' },
  { value: 'debito',  label: 'Nota de Débito' },
];

const CODIGO_OPCIONES = [
  { value: '1', label: '1 — Anula documento de referencia' },
  { value: '2', label: '2 — Corrige texto documento referencia' },
  { value: '3', label: '3 — Corrige montos documento referencia' },
];

const DOC_REF_OPCIONES = [
  { value: '',   label: 'Sin referencia' },
  { value: '33', label: 'Factura Electrónica (33)' },
  { value: '34', label: 'Factura No Afecta (34)' },
  { value: '39', label: 'Boleta Electrónica (39)' },
  { value: '52', label: 'Guía de Despacho (52)' },
  { value: '56', label: 'Nota de Débito (56)' },
  { value: '61', label: 'Nota de Crédito (61)' },
];

const ESTADO_VARIANT: Record<string, 'success' | 'danger'> = {
  emitida: 'success',
  anulada: 'danger',
};

const IVA_TASA = 0.19;

type FormNC = Omit<NotaCreditoDebito, 'id' | 'numero'>;

const emptyForm = (): FormNC => ({
  tipo: 'credito',
  fecha: new Date().toISOString().split('T')[0],
  rutCliente: '',
  nombreCliente: '',
  documentoReferenciaNumero: '',
  documentoReferenciaTipo: '',
  codigoReferencia: '1',
  razon: '',
  neto: 0,
  iva: 0,
  total: 0,
  estado: 'emitida',
});

export default function NotasCreditoDebito() {
  const { state, dispatch, showToast } = useApp();
  const [search, setSearch] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'credito' | 'debito'>('todos');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<NotaCreditoDebito | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [form, setForm] = useState<FormNC>(emptyForm());

  /* ─── Listas ─────────────────────────────────────────── */
  const notas: NotaCreditoDebito[] = useMemo(
    () => state.notasCredito ?? [],
    [state.notasCredito],
  );

  const lista = useMemo(() => {
    return notas.filter(n => {
      const matchTipo = filtroTipo === 'todos' || n.tipo === filtroTipo;
      const matchSearch =
        !search ||
        String(n.numero).includes(search) ||
        (n.rutCliente ?? '').includes(search) ||
        (n.nombreCliente ?? '').toLowerCase().includes(search.toLowerCase()) ||
        n.razon.toLowerCase().includes(search.toLowerCase());
      return matchTipo && matchSearch;
    });
  }, [notas, filtroTipo, search]);

  /* ─── KPIs ────────────────────────────────────────────── */
  const stats = useMemo(() => {
    const emitidas = notas.filter(n => n.estado === 'emitida');
    return {
      totalNC: emitidas.filter(n => n.tipo === 'credito').reduce((s, n) => s + n.total, 0),
      totalND: emitidas.filter(n => n.tipo === 'debito').reduce((s, n) => s + n.total, 0),
      countNC: emitidas.filter(n => n.tipo === 'credito').length,
      countND: emitidas.filter(n => n.tipo === 'debito').length,
    };
  }, [notas]);

  /* ─── Helpers ─────────────────────────────────────────── */
  const siguienteNumero = useMemo(() => (state.numeroNota ?? 1), [state.numeroNota]);

  const formatCLP = (n: number) => `$${Math.round(n).toLocaleString('es-CL')}`;

  /* ─── Handlers ────────────────────────────────────────── */
  const recalcularMontos = (neto: number) => {
    const iva = Math.round(neto * IVA_TASA);
    const total = neto + iva;
    return { iva, total };
  };

  const handleNetoChange = (val: string) => {
    const neto = Number(val) || 0;
    const { iva, total } = recalcularMontos(neto);
    setForm(f => ({ ...f, neto, iva, total }));
  };

  const abrirNuevo = () => {
    setEditing(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const abrirEditar = (n: NotaCreditoDebito) => {
    setEditing(n);
    setForm({
      tipo: n.tipo,
      fecha: n.fecha,
      rutCliente: n.rutCliente ?? '',
      nombreCliente: n.nombreCliente ?? '',
      documentoReferenciaNumero: n.documentoReferenciaNumero ?? '',
      documentoReferenciaTipo: n.documentoReferenciaTipo ?? '',
      codigoReferencia: n.codigoReferencia,
      razon: n.razon,
      neto: n.neto,
      iva: n.iva,
      total: n.total,
      estado: n.estado,
    });
    setShowModal(true);
  };

  const handleGuardar = () => {
    if (!form.razon.trim()) { showToast('error', 'Error', 'Razón es obligatoria'); return; }
    if (form.neto <= 0)     { showToast('error', 'Error', 'El monto neto debe ser mayor a 0'); return; }

    if (editing) {
      dispatch({ type: 'UPDATE_NOTA', payload: { ...editing, ...form } });
      showToast('success', 'Actualizado', `Nota N° ${editing.numero} actualizada`);
    } else {
      const nueva: NotaCreditoDebito = {
        ...form,
        id: generateId(),
        numero: siguienteNumero,
      };
      dispatch({ type: 'ADD_NOTA', payload: nueva });
      showToast('success', 'Emitida', `Nota N° ${nueva.numero} emitida`);
    }
    setShowModal(false);
  };

  const handleAnular = (id: string) => {
    const nota = notas.find(n => n.id === id);
    if (!nota) return;
    dispatch({ type: 'UPDATE_NOTA', payload: { ...nota, estado: 'anulada' } });
    showToast('warning', 'Anulada', `Nota N° ${nota.numero} anulada`);
    setConfirmId(null);
  };

  const handleEliminar = () => {
    if (!confirmId) return;
    dispatch({ type: 'DELETE_NOTA', payload: confirmId });
    showToast('success', 'Eliminado', 'Nota eliminada');
    setConfirmId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#1E3A5F]/10 rounded-lg">
            <FileX className="text-[#1E3A5F]" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notas de Crédito / Débito</h1>
            <p className="text-sm text-gray-500 mt-1">Emisión y gestión de notas electrónicas</p>
          </div>
        </div>
        <Button icon={<Plus size={16} />} onClick={abrirNuevo}>Nueva Nota</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Notas Crédito emitidas', value: stats.countNC, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
          { label: 'Total NC vigente',        value: formatCLP(stats.totalNC), color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
          { label: 'Notas Débito emitidas',   value: stats.countND, color: 'text-blue-700 bg-blue-50 border-blue-200' },
          { label: 'Total ND vigente',         value: formatCLP(stats.totalND), color: 'text-blue-700 bg-blue-50 border-blue-200' },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border p-4 ${k.color}`}>
            <p className="text-xs font-semibold uppercase opacity-70">{k.label}</p>
            <p className="text-2xl font-bold mt-1">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <Card padding="sm">
        <div className="flex flex-col md:flex-row gap-3 items-end">
          <div className="flex-1">
            <Input
              leftIcon={<Search size={14} />}
              placeholder="Buscar por N°, RUT, cliente o razón..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(['todos', 'credito', 'debito'] as const).map(t => (
              <button
                key={t}
                onClick={() => setFiltroTipo(t)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  filtroTipo === t ? 'bg-white text-[#1E3A5F] shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'todos' ? 'Todos' : t === 'credito' ? 'Crédito' : 'Débito'}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Tabla */}
      <Card padding="none">
        <table className="w-full table-modern">
          <thead>
            <tr>
              <th>N°</th>
              <th>Tipo</th>
              <th>Fecha</th>
              <th className="hidden md:table-cell">Cliente / RUT</th>
              <th className="hidden md:table-cell">Razón</th>
              <th className="hidden lg:table-cell">Doc. Ref.</th>
              <th className="text-right">Total</th>
              <th>Estado</th>
              <th className="text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                      <FileX size={22} className="text-gray-400" />
                    </div>
                    <p className="text-sm font-medium text-gray-500">No hay notas registradas</p>
                    <Button size="sm" onClick={abrirNuevo}>Emitir primera nota</Button>
                  </div>
                </td>
              </tr>
            ) : lista.map(n => (
              <tr key={n.id}>
                <td className="px-4 py-3 font-mono text-sm font-semibold text-gray-700">{n.numero}</td>
                <td className="px-4 py-3">
                  <Badge variant={n.tipo === 'credito' ? 'success' : 'info'} size="sm">
                    {n.tipo === 'credito' ? 'Crédito' : 'Débito'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{n.fecha}</td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <p className="text-sm font-medium text-gray-900 truncate max-w-[150px]">{n.nombreCliente || '—'}</p>
                  {n.rutCliente && <p className="text-xs text-gray-500 font-mono">{n.rutCliente}</p>}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell truncate max-w-[180px]">{n.razon}</td>
                <td className="px-4 py-3 text-xs text-gray-500 hidden lg:table-cell font-mono">
                  {n.documentoReferenciaTipo && n.documentoReferenciaNumero
                    ? `${n.documentoReferenciaTipo} N°${n.documentoReferenciaNumero}`
                    : '—'}
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">{formatCLP(n.total)}</td>
                <td className="px-4 py-3">
                  <Badge variant={ESTADO_VARIANT[n.estado]} size="sm" dot>
                    {n.estado === 'emitida' ? 'Emitida' : 'Anulada'}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1">
                    {n.estado === 'emitida' && (
                      <>
                        <button
                          onClick={() => abrirEditar(n)}
                          className="p-2 text-gray-400 hover:text-[#1E3A5F] hover:bg-gray-100 rounded-lg transition-colors active:scale-[0.95]"
                          title="Editar"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => setConfirmId(`anular-${n.id}`)}
                          className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors active:scale-[0.95]"
                          title="Anular"
                        >
                          <XCircle size={15} />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setConfirmId(n.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors active:scale-[0.95]"
                      title="Eliminar"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Modal Crear/Editar */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? `Editar Nota N° ${editing.numero}` : `Nueva Nota — N° ${siguienteNumero}`}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleGuardar}>{editing ? 'Actualizar' : 'Emitir'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Tipo *"
              value={form.tipo}
              onChange={e => setForm(f => ({ ...f, tipo: e.target.value as 'credito' | 'debito' }))}
              options={TIPO_OPCIONES}
            />
            <Input
              label="Fecha *"
              type="date"
              value={form.fecha}
              onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="RUT Cliente"
              value={form.rutCliente ?? ''}
              onChange={e => setForm(f => ({ ...f, rutCliente: e.target.value }))}
              placeholder="76.123.456-7"
            />
            <Input
              label="Nombre / Razón Social"
              value={form.nombreCliente ?? ''}
              onChange={e => setForm(f => ({ ...f, nombreCliente: e.target.value }))}
            />
          </div>

          {/* Documento de referencia */}
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Documento de referencia</p>
            <div className="grid grid-cols-3 gap-3">
              <Select
                label="Tipo Doc."
                value={form.documentoReferenciaTipo ?? ''}
                onChange={e => setForm(f => ({ ...f, documentoReferenciaTipo: e.target.value }))}
                options={DOC_REF_OPCIONES}
              />
              <Input
                label="N° Documento"
                value={form.documentoReferenciaNumero ?? ''}
                onChange={e => setForm(f => ({ ...f, documentoReferenciaNumero: e.target.value }))}
                placeholder="Ej: 1234"
              />
              <Select
                label="Código Ref. *"
                value={form.codigoReferencia}
                onChange={e => setForm(f => ({ ...f, codigoReferencia: e.target.value as CodigoRefNC }))}
                options={CODIGO_OPCIONES}
              />
            </div>
          </div>

          <Textarea
            label="Razón / Descripción *"
            value={form.razon}
            onChange={e => setForm(f => ({ ...f, razon: e.target.value }))}
            rows={2}
            placeholder="Ej: Se anula factura 1234 por error en monto..."
          />

          {/* Montos */}
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 space-y-3">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Montos (IVA 19%)</p>
            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Neto ($) *"
                type="number"
                min={0}
                value={form.neto || ''}
                onChange={e => handleNetoChange(e.target.value)}
              />
              <Input
                label="IVA ($)"
                type="number"
                value={form.iva}
                readOnly
                className="bg-gray-100"
              />
              <Input
                label="Total ($)"
                type="number"
                value={form.total}
                readOnly
                className="bg-gray-100 font-semibold"
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* ConfirmDialog anular */}
      <ConfirmDialog
        isOpen={!!confirmId && confirmId.startsWith('anular-')}
        onClose={() => setConfirmId(null)}
        onConfirm={() => handleAnular(confirmId!.replace('anular-', ''))}
        title="Anular nota"
        message="¿Confirmas que deseas anular esta nota? La nota quedará marcada como anulada y no podrá revertirse."
        confirmText="Sí, anular"
        variant="warning"
      />

      {/* ConfirmDialog eliminar */}
      <ConfirmDialog
        isOpen={!!confirmId && !confirmId.startsWith('anular-')}
        onClose={() => setConfirmId(null)}
        onConfirm={handleEliminar}
        title="Eliminar nota"
        message="Esta acción eliminará la nota permanentemente. ¿Confirmas?"
        confirmText="Sí, eliminar"
        variant="danger"
      />
    </div>
  );
}

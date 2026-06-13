import React, { useState, useMemo } from 'react';
import { Users, Plus, Edit2, Trash2, Search, Phone, Mail, Building2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card, Badge } from '../components/ui/Cards';
import { Button, Input, Select, Textarea } from '../components/ui/FormElements';
import { Modal, ConfirmDialog } from '../components/ui/Modal';
import { ClienteProveedor, TipoClienteProveedor } from '../types';
import { generateId } from '../utils/calculos';

const CONDICION_OPCIONES = [
  { value: '0',  label: 'Contado' },
  { value: '30', label: '30 días' },
  { value: '60', label: '60 días' },
  { value: '90', label: '90 días' },
];

const TIPO_OPCIONES = [
  { value: 'cliente',    label: 'Cliente' },
  { value: 'proveedor',  label: 'Proveedor' },
  { value: 'ambos',      label: 'Cliente y Proveedor' },
];

const TIPO_VARIANT: Record<string, 'success' | 'info' | 'warning'> = {
  cliente:   'success',
  proveedor: 'info',
  ambos:     'warning',
};

const emptyForm = (): Omit<ClienteProveedor, 'id' | 'fechaCreacion'> => ({
  tipo: 'cliente',
  rut: '',
  razonSocial: '',
  nombreFantasia: '',
  giro: '',
  direccion: '',
  comuna: '',
  ciudad: '',
  telefono: '',
  email: '',
  condicionPago: 0,
  notas: '',
  activo: true,
});

export default function ClientesProveedores() {
  const { state, dispatch, showToast } = useApp();
  const [tab, setTab] = useState<'todos' | 'cliente' | 'proveedor'>('todos');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ClienteProveedor | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());

  const lista = useMemo(() => {
    return (state.clientesProveedores ?? []).filter(c => {
      const matchTab = tab === 'todos' || c.tipo === tab || c.tipo === 'ambos';
      const matchSearch =
        !search ||
        c.rut.includes(search) ||
        c.razonSocial.toLowerCase().includes(search.toLowerCase()) ||
        (c.nombreFantasia ?? '').toLowerCase().includes(search.toLowerCase());
      return matchTab && matchSearch && c.activo;
    });
  }, [state.clientesProveedores, tab, search]);

  const stats = useMemo(() => {
    const all = state.clientesProveedores ?? [];
    return {
      clientes:   all.filter(c => c.tipo === 'cliente' || c.tipo === 'ambos').length,
      proveedores: all.filter(c => c.tipo === 'proveedor' || c.tipo === 'ambos').length,
      cxcPendiente: (state.cuentasCobrar ?? []).filter(c => c.estado !== 'pagado').reduce((s, c) => s + (c.monto - c.montoPagado), 0),
      cxpPendiente: (state.cuentasPagar ?? []).filter(c => c.estado !== 'pagado').reduce((s, c) => s + (c.monto - c.montoPagado), 0),
    };
  }, [state.clientesProveedores, state.cuentasCobrar, state.cuentasPagar]);

  const abrirNuevo = () => {
    setEditing(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const abrirEditar = (c: ClienteProveedor) => {
    setEditing(c);
    setForm({ tipo: c.tipo, rut: c.rut, razonSocial: c.razonSocial, nombreFantasia: c.nombreFantasia ?? '', giro: c.giro ?? '', direccion: c.direccion ?? '', comuna: c.comuna ?? '', ciudad: c.ciudad ?? '', telefono: c.telefono ?? '', email: c.email ?? '', condicionPago: c.condicionPago, notas: c.notas ?? '', activo: c.activo });
    setShowModal(true);
  };

  const handleGuardar = () => {
    if (!form.rut.trim()) { showToast('error', 'Error', 'RUT es obligatorio'); return; }
    if (!form.razonSocial.trim()) { showToast('error', 'Error', 'Razón social es obligatoria'); return; }

    if (editing) {
      dispatch({ type: 'UPDATE_CLIENTE', payload: { ...editing, ...form } });
      showToast('success', 'Actualizado', `${form.razonSocial} actualizado`);
    } else {
      dispatch({ type: 'ADD_CLIENTE', payload: { ...form, id: generateId(), fechaCreacion: new Date().toISOString().split('T')[0] } });
      showToast('success', 'Creado', `${form.razonSocial} agregado`);
    }
    setShowModal(false);
  };

  const handleEliminar = () => {
    if (!confirmId) return;
    dispatch({ type: 'DELETE_CLIENTE', payload: confirmId });
    showToast('success', 'Eliminado', 'Registro eliminado');
    setConfirmId(null);
  };

  const formatCLP = (n: number) => `$${n.toLocaleString('es-CL')}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#1E3A5F]/10 rounded-lg">
            <Users className="text-[#1E3A5F]" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Clientes y Proveedores</h1>
            <p className="text-sm text-gray-500 mt-1">Maestro de contactos comerciales</p>
          </div>
        </div>
        <Button icon={<Plus size={16} />} onClick={abrirNuevo}>Nuevo</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Clientes', value: stats.clientes, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
          { label: 'Proveedores', value: stats.proveedores, color: 'text-blue-700 bg-blue-50 border-blue-200' },
          { label: 'CxC Pendiente', value: formatCLP(stats.cxcPendiente), color: 'text-amber-700 bg-amber-50 border-amber-200' },
          { label: 'CxP Pendiente', value: formatCLP(stats.cxpPendiente), color: 'text-red-700 bg-red-50 border-red-200' },
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
            <Input leftIcon={<Search size={14} />} placeholder="Buscar por RUT o razón social..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(['todos', 'cliente', 'proveedor'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${tab === t ? 'bg-white text-[#1E3A5F] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {t === 'todos' ? 'Todos' : t === 'cliente' ? 'Clientes' : 'Proveedores'}
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
              <th>RUT</th>
              <th>Razón Social</th>
              <th>Tipo</th>
              <th className="hidden md:table-cell">Giro</th>
              <th className="hidden md:table-cell">Cond. Pago</th>
              <th className="hidden lg:table-cell">Contacto</th>
              <th className="text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                      <Building2 size={22} className="text-gray-400" />
                    </div>
                    <p className="text-sm font-medium text-gray-500">No hay registros</p>
                    <Button size="sm" onClick={abrirNuevo}>Agregar primero</Button>
                  </div>
                </td>
              </tr>
            ) : lista.map(c => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-mono text-sm text-gray-700">{c.rut}</td>
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-gray-900">{c.razonSocial}</p>
                  {c.nombreFantasia && <p className="text-xs text-gray-500">{c.nombreFantasia}</p>}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={TIPO_VARIANT[c.tipo]} size="sm">{c.tipo === 'ambos' ? 'Cli/Prov' : c.tipo}</Badge>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell truncate max-w-[160px]">{c.giro || '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">{c.condicionPago === 0 ? 'Contado' : `${c.condicionPago} días`}</td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <div className="flex flex-col gap-0.5">
                    {c.email && <span className="flex items-center gap-1 text-xs text-gray-500"><Mail size={11} />{c.email}</span>}
                    {c.telefono && <span className="flex items-center gap-1 text-xs text-gray-500"><Phone size={11} />{c.telefono}</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => abrirEditar(c)} className="p-2 text-gray-400 hover:text-[#1E3A5F] hover:bg-gray-100 rounded-lg transition-colors active:scale-[0.95]"><Edit2 size={15} /></button>
                    <button onClick={() => setConfirmId(c.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors active:scale-[0.95]"><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Modal Crear/Editar */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar Registro' : 'Nuevo Cliente / Proveedor'} size="lg"
        footer={<><Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button><Button onClick={handleGuardar}>{editing ? 'Actualizar' : 'Guardar'}</Button></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="RUT *" value={form.rut} onChange={e => setForm({ ...form, rut: e.target.value })} placeholder="76.123.456-7" />
            <Select label="Tipo *" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value as TipoClienteProveedor })} options={TIPO_OPCIONES} />
          </div>
          <Input label="Razón Social *" value={form.razonSocial} onChange={e => setForm({ ...form, razonSocial: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nombre Fantasía" value={form.nombreFantasia} onChange={e => setForm({ ...form, nombreFantasia: e.target.value })} />
            <Input label="Giro" value={form.giro} onChange={e => setForm({ ...form, giro: e.target.value })} />
          </div>
          <Input label="Dirección" value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Comuna" value={form.comuna} onChange={e => setForm({ ...form, comuna: e.target.value })} />
            <Input label="Ciudad" value={form.ciudad} onChange={e => setForm({ ...form, ciudad: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <Input label="Teléfono" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} />
          </div>
          <Select label="Condición de Pago" value={String(form.condicionPago)} onChange={e => setForm({ ...form, condicionPago: Number(e.target.value) })} options={CONDICION_OPCIONES} />
          <Textarea label="Notas" value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} rows={2} placeholder="Observaciones internas..." />
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!confirmId} onClose={() => setConfirmId(null)} onConfirm={handleEliminar} title="Eliminar registro" message="Esta acción eliminará el cliente/proveedor. ¿Confirmas?" confirmText="Sí, eliminar" variant="danger" />
    </div>
  );
}

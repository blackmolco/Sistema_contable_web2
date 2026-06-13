import React, { useState, useMemo, useCallback } from 'react';
import {
  Plus, Search, Edit2, Trash2, Eye, Download, FileText,
  X, TrendingUp, TrendingDown, ArrowRightLeft, FileCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card, Badge } from '../components/ui/Cards';
import { Button, Input, Select } from '../components/ui/FormElements';
import { Modal } from '../components/ui/Modal';
import {
  DocumentoTributario, TipoDocumento, LineaDetalle, Receptor,
} from '../types';
import {
  formatCurrency, formatDate, generateId, formatRUT,
} from '../utils/calculos';
import { TIPOS_DOCUMENTO_SII, CONDICIONES_PAGO } from '../data/normativa';
import { DocumentoTributarioSchema, formatZodErrors } from '../utils/schemas';
import { ExportService, exportToCSV } from '../services/export';

// ─── helpers ────────────────────────────────────────────────────────────────
const NOTA_TIPOS = new Set(['nota_credito', 'nota_debito']);
const COMPRA_TIPOS = new Set(['factura_compra']);

/** true si el documento resta (nota de crédito) */
const esNotaCredito = (tipo: string) => tipo === 'nota_credito';

/** Color/variante de badge por tipo */
function tipoBadge(tipo: string): { label: string; cls: string } {
  switch (tipo) {
    case 'nota_credito':     return { label: 'N/C',    cls: 'bg-orange-100 text-orange-700 border-orange-200' };
    case 'nota_debito':      return { label: 'N/D',    cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
    case 'factura':          return { label: 'Factura', cls: 'bg-blue-100 text-blue-700 border-blue-200' };
    case 'factura_exenta':   return { label: 'F.Exenta',cls: 'bg-indigo-100 text-indigo-700 border-indigo-200' };
    case 'factura_compra':   return { label: 'F.Compra',cls: 'bg-purple-100 text-purple-700 border-purple-200' };
    case 'boleta':
    case 'boleta_exenta':
    case 'boleta_electronica': return { label: 'Boleta',  cls: 'bg-teal-100 text-teal-700 border-teal-200' };
    case 'guia_despacho':    return { label: 'Guía',   cls: 'bg-gray-100 text-gray-600 border-gray-200' };
    default:                 return { label: tipo,     cls: 'bg-gray-100 text-gray-600 border-gray-200' };
  }
}

function getTipoLabel(tipo: string) {
  return TIPOS_DOCUMENTO_SII.find(d => d.codigo === tipo)?.nombre || tipo;
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Facturacion() {
  const { state, dispatch, showToast } = useApp();

  // Filtros
  const [searchTerm,  setSearchTerm]  = useState('');
  const [filtroTipo,  setFiltroTipo]  = useState('todos');
  const [filtroLibro, setFiltroLibro] = useState<'todos' | 'ventas' | 'compras'>('todos');

  // Modales
  const [showModal,    setShowModal]    = useState(false);
  const [showVerModal, setShowVerModal] = useState(false);
  const [editingDoc,   setEditingDoc]   = useState<DocumentoTributario | null>(null);
  const [docVer,       setDocVer]       = useState<DocumentoTributario | null>(null);

  // Formulario
  const [formData, setFormData] = useState<{
    tipo: TipoDocumento; receptor: Receptor; condicionesPago: string; detalles: LineaDetalle[];
  }>({
    tipo: 'factura',
    receptor: { rut: '', razonSocial: '', giro: '', direccion: '', comuna: '', ciudad: '', contacto: '', email: '' },
    condicionesPago: 'contado',
    detalles: [],
  });
  const [nuevaLinea, setNuevaLinea] = useState<Partial<LineaDetalle>>({
    codigo: '', descripcion: '', cantidad: 1, unidadMedida: 'UND', precioUnitario: 0, descuento: 0,
  });

  // ─── Clasificación automática del libro ────────────────────────────────────
  /** Determina si un doc es de compras aunque no tenga campo `libro` (retro-compat) */
  const esCompra = (doc: DocumentoTributario) =>
    doc.libro === 'compras' ||
    (doc.libro === undefined && (doc.condicionesPago === 'credito' || doc.estado === 'pendiente'));

  // ─── Filtrado ──────────────────────────────────────────────────────────────
  const documentosFiltrados = useMemo(() => {
    return state.documentos.filter(doc => {
      const matchSearch =
        !searchTerm ||
        doc.receptor.razonSocial.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.receptor.rut.includes(searchTerm) ||
        String(doc.numero).includes(searchTerm);

      const matchTipo = filtroTipo === 'todos' || doc.tipo === filtroTipo;

      const matchLibro =
        filtroLibro === 'todos' ||
        (filtroLibro === 'compras' && esCompra(doc)) ||
        (filtroLibro === 'ventas'  && !esCompra(doc));

      return matchSearch && matchTipo && matchLibro;
    });
  }, [state.documentos, searchTerm, filtroTipo, filtroLibro]);

  // ─── Totales (las NC restan) ────────────────────────────────────────────────
  const totales = useMemo(() => {
    return documentosFiltrados
      .filter(d => d.estado !== 'anulado')
      .reduce((acc, d) => {
        const signo = esNotaCredito(d.tipo) ? -1 : 1;
        return {
          neto  : acc.neto   + signo * (d.subtotal   || 0),
          iva   : acc.iva    + signo * (d.iva        || 0),
          exento: acc.exento + signo * (d.totalExento || 0),
          total : acc.total  + signo * (d.total      || 0),
          docs  : acc.docs   + 1,
          ncs   : acc.ncs    + (esNotaCredito(d.tipo) ? 1 : 0),
        };
      }, { neto: 0, iva: 0, exento: 0, total: 0, docs: 0, ncs: 0 });
  }, [documentosFiltrados]);

  // ─── Contadores por libro (para tabs) ─────────────────────────────────────
  const counts = useMemo(() => ({
    ventas : state.documentos.filter(d => !esCompra(d)).length,
    compras: state.documentos.filter(d =>  esCompra(d)).length,
    total  : state.documentos.length,
  }), [state.documentos]);

  // ─── Export ────────────────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    if (documentosFiltrados.length === 0) {
      showToast('error', 'Sin datos', 'No hay documentos para exportar');
      return;
    }
    const periodo = new Date().toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
    const tipoLibro = filtroLibro === 'todos' ? 'ventas' : filtroLibro;
    const data = ExportService.exportarLibro(tipoLibro, documentosFiltrados, periodo);
    const filename = `facturacion_${filtroLibro}_${new Date().toISOString().slice(0, 10)}`;
    exportToCSV(data, filename);
    showToast('success', 'Exportado', `${documentosFiltrados.length} documentos exportados a CSV`);
  }, [documentosFiltrados, filtroLibro, showToast]);

  // ─── CRUD ─────────────────────────────────────────────────────────────────
  const abrirNuevo = () => {
    setEditingDoc(null);
    setFormData({
      tipo: 'factura',
      receptor: { rut: '', razonSocial: '', giro: '', direccion: '', comuna: '', ciudad: '', contacto: '', email: '' },
      condicionesPago: 'contado',
      detalles: [],
    });
    setShowModal(true);
  };

  const abrirEditar = (doc: DocumentoTributario) => {
    setEditingDoc(doc);
    setFormData({ tipo: doc.tipo, receptor: doc.receptor, condicionesPago: doc.condicionesPago, detalles: doc.detalles });
    setShowModal(true);
  };

  const agregarLinea = () => {
    if (!nuevaLinea.descripcion || !nuevaLinea.precioUnitario) {
      showToast('error', 'Error', 'Complete descripción y precio'); return;
    }
    const linea: LineaDetalle = {
      id: generateId(),
      codigo: nuevaLinea.codigo || '',
      descripcion: nuevaLinea.descripcion!,
      cantidad: nuevaLinea.cantidad || 1,
      unidadMedida: nuevaLinea.unidadMedida || 'UND',
      precioUnitario: nuevaLinea.precioUnitario!,
      descuento: nuevaLinea.descuento || 0,
      montoTotal: (nuevaLinea.cantidad || 1) * (nuevaLinea.precioUnitario || 0) * (1 - (nuevaLinea.descuento || 0) / 100),
    };
    setFormData({ ...formData, detalles: [...formData.detalles, linea] });
    setNuevaLinea({ codigo: '', descripcion: '', cantidad: 1, unidadMedida: 'UND', precioUnitario: 0, descuento: 0 });
  };

  const calcularTotalesForm = () => {
    const subtotal = formData.detalles.reduce((s, l) => s + l.montoTotal, 0);
    const esExento = formData.tipo === 'factura_exenta' || formData.tipo === 'boleta_exenta';
    const esNC     = esNotaCredito(formData.tipo);
    const iva = esExento || esNC ? 0 : Math.round(subtotal * 0.19);
    return { subtotal, iva, total: subtotal + iva, exento: esExento ? subtotal : 0 };
  };

  const handleSubmit = () => {
    const { subtotal, iva, total, exento } = calcularTotalesForm();
    const validation = DocumentoTributarioSchema.safeParse({
      tipo: formData.tipo,
      numero: editingDoc?.numero || state.numeroDocumento,
      fecha: editingDoc?.fecha || new Date().toISOString().split('T')[0],
      rutReceptor: formData.receptor.rut,
      razonSocialReceptor: formData.receptor.razonSocial,
      subtotal: subtotal || 1, iva, total: total || 1,
    });
    if (!validation.success) {
      const errs = formatZodErrors(validation.error);
      showToast('error', 'Formulario inválido', Object.values(errs)[0] || 'Corrija los errores'); return;
    }
    if (formData.detalles.length === 0) { showToast('error', 'Error', 'Agregue al menos una línea'); return; }

    const doc: DocumentoTributario = {
      id: editingDoc?.id || generateId(),
      tipo: formData.tipo,
      numero: editingDoc?.numero || state.numeroDocumento,
      serie: 'F',
      fecha: editingDoc?.fecha || new Date().toISOString(),
      receptor: formData.receptor,
      condicionesPago: formData.condicionesPago,
      detalles: formData.detalles,
      subtotal, descuentoGlobal: 0, iva, totalExento: exento, total,
      estado: 'emitido',
      libro: COMPRA_TIPOS.has(formData.tipo) ? 'compras' : 'ventas',
    };

    dispatch({ type: editingDoc ? 'UPDATE_DOCUMENTO' : 'ADD_DOCUMENTO', payload: doc });
    showToast('success', 'Éxito', editingDoc ? 'Documento actualizado' : 'Documento emitido');
    setShowModal(false);
  };

  const handleEliminar = (doc: DocumentoTributario) => {
    dispatch({ type: 'DELETE_DOCUMENTO', payload: doc.id });
    showToast('success', 'Eliminado', 'Documento eliminado');
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  const tabCls = (v: typeof filtroLibro) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      filtroLibro === v
        ? 'bg-[#1E3A5F] text-white shadow-sm'
        : 'text-gray-600 hover:bg-gray-100'
    }`;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Facturación</h1>
          <p className="text-sm text-gray-500 mt-0.5">Registro de Compras y Ventas importado desde SII</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" icon={<Download size={16} />} onClick={handleExport}>
            Exportar CSV
          </Button>
          <Button icon={<Plus size={16} />} onClick={abrirNuevo}>
            Nuevo Documento
          </Button>
        </div>
      </div>

      {/* Tabs Ventas / Compras */}
      <div className="flex items-center gap-2 p-1 bg-gray-50 border border-gray-200 rounded-xl w-fit">
        <button className={tabCls('todos')} onClick={() => setFiltroLibro('todos')}>
          <span className="flex items-center gap-1.5">
            <ArrowRightLeft size={14} />
            Todos <span className="text-xs opacity-70">({counts.total})</span>
          </span>
        </button>
        <button className={tabCls('ventas')} onClick={() => setFiltroLibro('ventas')}>
          <span className="flex items-center gap-1.5">
            <TrendingUp size={14} />
            Ventas <span className="text-xs opacity-70">({counts.ventas})</span>
          </span>
        </button>
        <button className={tabCls('compras')} onClick={() => setFiltroLibro('compras')}>
          <span className="flex items-center gap-1.5">
            <TrendingDown size={14} />
            Compras <span className="text-xs opacity-70">({counts.compras})</span>
          </span>
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Documentos', value: totales.docs, suffix: totales.ncs > 0 ? ` (${totales.ncs} NC)` : '', currency: false },
          { label: 'Neto',   value: totales.neto,   currency: true },
          { label: 'IVA',    value: totales.iva,    currency: true },
          { label: 'Total',  value: totales.total,  currency: true, highlight: true },
        ].map(({ label, value, currency, highlight, suffix }) => (
          <Card key={label} padding="sm">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={`text-xl font-bold ${highlight ? 'text-[#1E3A5F]' : 'text-gray-900'}`}>
              {currency ? formatCurrency(value as number) : (value as number).toLocaleString('es-CL')}
              {suffix && <span className="text-xs font-normal text-orange-600 ml-1">{suffix as string}</span>}
            </p>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <Card padding="sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[220px]">
            <Input
              placeholder="Buscar por cliente, RUT o folio..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              leftIcon={<Search size={16} />}
            />
          </div>
          <div className="w-44">
            <Select
              value={filtroTipo}
              onChange={e => setFiltroTipo(e.target.value)}
              options={[
                { value: 'todos', label: 'Todos los tipos' },
                ...TIPOS_DOCUMENTO_SII.map(t => ({ value: t.codigo, label: t.nombre })),
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Tabla */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Folio</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {filtroLibro === 'compras' ? 'Proveedor' : 'Cliente / Contrapartes'}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">RUT</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Neto</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">IVA</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {documentosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-14 text-center">
                    <FileText className="mx-auto text-gray-300 mb-3" size={44} />
                    <p className="text-gray-500 font-medium">
                      {state.documentos.length === 0
                        ? 'Aún no hay documentos. Sincronice desde SII o cree uno manual.'
                        : 'Sin resultados para los filtros aplicados.'}
                    </p>
                    {state.documentos.length === 0 && (
                      <Button className="mt-3" size="sm" onClick={abrirNuevo}>Crear documento</Button>
                    )}
                  </td>
                </tr>
              ) : (
                documentosFiltrados.map(doc => {
                  const badge  = tipoBadge(doc.tipo);
                  const isNC   = esNotaCredito(doc.tipo);
                  const isComp = esCompra(doc);
                  return (
                    <tr key={doc.id} className={`hover:bg-gray-50 ${isNC ? 'bg-orange-50/30' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {/* Badge de tipo */}
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${badge.cls}`}>
                            {badge.label}
                          </span>
                          {/* Badge libro */}
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            isComp
                              ? 'bg-purple-50 text-purple-600'
                              : 'bg-blue-50 text-blue-600'
                          }`}>
                            {isComp ? '↓ C' : '↑ V'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-700">#{doc.numero}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 truncate max-w-[200px]">{doc.receptor.razonSocial || '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatRUT(doc.receptor.rut) || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(doc.fecha)}</td>
                      <td className={`px-4 py-3 text-right font-medium ${isNC ? 'text-orange-600' : 'text-gray-900'}`}>
                        {isNC ? '-' : ''}{formatCurrency(doc.subtotal)}
                      </td>
                      <td className={`px-4 py-3 text-right ${isNC ? 'text-orange-600' : 'text-gray-600'}`}>
                        {isNC ? '-' : ''}{formatCurrency(doc.iva)}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${isNC ? 'text-orange-600' : 'text-[#1E3A5F]'}`}>
                        {isNC ? '-' : ''}{formatCurrency(doc.total)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => { setDocVer(doc); setShowVerModal(true); }}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Ver">
                            <Eye size={15} />
                          </button>
                          <button onClick={() => abrirEditar(doc)}
                            className="p-1.5 text-gray-400 hover:text-[#1E3A5F] hover:bg-gray-100 rounded-lg transition-colors" title="Editar">
                            <Edit2 size={15} />
                          </button>
                          <button onClick={() => handleEliminar(doc)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {documentosFiltrados.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-200">
                  <td colSpan={5} className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
                    Total ({documentosFiltrados.length} docs{totales.ncs > 0 ? `, ${totales.ncs} NC` : ''})
                  </td>
                  <td className="px-4 py-2 text-right font-bold text-gray-900">{formatCurrency(totales.neto)}</td>
                  <td className="px-4 py-2 text-right font-bold text-gray-900">{formatCurrency(totales.iva)}</td>
                  <td className="px-4 py-2 text-right font-bold text-[#1E3A5F]">{formatCurrency(totales.total)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {/* ── Modal Nuevo/Editar ────────────────────────────────────────────── */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingDoc ? 'Editar Documento' : 'Nuevo Documento'}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSubmit}>{editingDoc ? 'Actualizar' : 'Emitir'}</Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Select label="Tipo de Documento" value={formData.tipo}
              onChange={e => setFormData({ ...formData, tipo: e.target.value as TipoDocumento })}
              options={TIPOS_DOCUMENTO_SII.map(t => ({ value: t.codigo, label: t.nombre }))}
            />
            <Select label="Condición de Pago" value={formData.condicionesPago}
              onChange={e => setFormData({ ...formData, condicionesPago: e.target.value })}
              options={CONDICIONES_PAGO.map(c => ({ value: c.codigo, label: c.nombre }))}
            />
          </div>

          {/* Nota de crédito — aviso */}
          {esNotaCredito(formData.tipo) && (
            <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800">
              <X size={16} className="mt-0.5 flex-shrink-0" />
              <span>Este documento <strong>resta</strong> del total. El monto se mostrará en negativo en el resumen.</span>
            </div>
          )}

          {/* Receptor */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">
              {COMPRA_TIPOS.has(formData.tipo) ? 'Datos del Proveedor' : 'Datos del Receptor'}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {([
                ['RUT', 'rut', 'text', '12345678-9'],
                ['Razón Social', 'razonSocial', 'text', ''],
                ['Giro', 'giro', 'text', ''],
                ['Dirección', 'direccion', 'text', ''],
                ['Comuna', 'comuna', 'text', ''],
                ['Ciudad', 'ciudad', 'text', ''],
                ['Email', 'email', 'email', ''],
              ] as const).map(([label, field, type, placeholder]) => (
                <Input key={field} label={label} type={type} placeholder={placeholder}
                  value={(formData.receptor as any)[field]}
                  onChange={e => setFormData({ ...formData, receptor: { ...formData.receptor, [field]: e.target.value } })}
                />
              ))}
            </div>
          </div>

          {/* Líneas */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Detalle</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Código','Descripción','Cant.','Und.','P.Unit','Dto%','Total',''].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {formData.detalles.map(l => (
                    <tr key={l.id}>
                      <td className="px-3 py-2">{l.codigo}</td>
                      <td className="px-3 py-2">{l.descripcion}</td>
                      <td className="px-3 py-2 text-center">{l.cantidad}</td>
                      <td className="px-3 py-2 text-center">{l.unidadMedida}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(l.precioUnitario)}</td>
                      <td className="px-3 py-2 text-center">{l.descuento}%</td>
                      <td className="px-3 py-2 text-right font-medium">{formatCurrency(l.montoTotal)}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => setFormData({ ...formData, detalles: formData.detalles.filter(x => x.id !== l.id) })}
                          className="p-1 text-red-400 hover:bg-red-50 rounded">
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Agregar línea */}
              <div className="p-3 bg-gray-50 border-t">
                <div className="grid grid-cols-7 gap-2">
                  <input placeholder="Código" value={nuevaLinea.codigo || ''} onChange={e => setNuevaLinea({ ...nuevaLinea, codigo: e.target.value })} className="px-2 py-1.5 border rounded text-sm" />
                  <input placeholder="Descripción" value={nuevaLinea.descripcion || ''} onChange={e => setNuevaLinea({ ...nuevaLinea, descripcion: e.target.value })} className="px-2 py-1.5 border rounded text-sm col-span-2" />
                  <input type="number" placeholder="Cant." value={nuevaLinea.cantidad || ''} onChange={e => setNuevaLinea({ ...nuevaLinea, cantidad: +e.target.value })} className="px-2 py-1.5 border rounded text-sm text-center" />
                  <input placeholder="Und." value={nuevaLinea.unidadMedida || ''} onChange={e => setNuevaLinea({ ...nuevaLinea, unidadMedida: e.target.value })} className="px-2 py-1.5 border rounded text-sm text-center" />
                  <input type="number" placeholder="P.Unit" value={nuevaLinea.precioUnitario || ''} onChange={e => setNuevaLinea({ ...nuevaLinea, precioUnitario: +e.target.value })} className="px-2 py-1.5 border rounded text-sm" />
                  <Button size="sm" onClick={agregarLinea}>Agregar</Button>
                </div>
              </div>
            </div>
          </div>

          {/* Totales form */}
          <div className="flex justify-end">
            <div className="w-64 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span>{formatCurrency(calcularTotalesForm().subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">IVA (19%)</span><span>{formatCurrency(calcularTotalesForm().iva)}</span></div>
              <div className="flex justify-between text-base font-bold border-t pt-2">
                <span>Total</span>
                <span className={esNotaCredito(formData.tipo) ? 'text-orange-600' : 'text-[#1E3A5F]'}>
                  {esNotaCredito(formData.tipo) ? '-' : ''}{formatCurrency(calcularTotalesForm().total)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Modal Ver ─────────────────────────────────────────────────────── */}
      <Modal
        isOpen={showVerModal}
        onClose={() => setShowVerModal(false)}
        title={docVer ? `${getTipoLabel(docVer.tipo)} #${docVer.numero}` : ''}
        size="lg"
      >
        {docVer && (
          <div className="space-y-5">
            {esNotaCredito(docVer.tipo) && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800 font-medium text-center">
                Nota de Crédito — Este documento reduce el monto de una operación anterior
              </div>
            )}
            <div className="flex justify-between">
              <div>
                <p className="font-bold text-gray-900">{state.configuracion.razonSocial}</p>
                <p className="text-sm text-gray-500">{state.configuracion.giro}</p>
                <p className="text-sm text-gray-500">RUT: {formatRUT(state.configuracion.rut)}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-[#1E3A5F]">{getTipoLabel(docVer.tipo)}</p>
                <p className="font-semibold">N° {docVer.numero}</p>
                <p className="text-sm text-gray-500">{formatDate(docVer.fecha)}</p>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${esCompra(docVer) ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                  {esCompra(docVer) ? '↓ Compra' : '↑ Venta'}
                </span>
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg text-sm">
              <p className="text-xs text-gray-500 mb-1">{esCompra(docVer) ? 'Proveedor' : 'Cliente'}</p>
              <p className="font-semibold">{docVer.receptor.razonSocial}</p>
              <p className="text-gray-600">{docVer.receptor.giro}</p>
              <p className="text-gray-600">RUT: {formatRUT(docVer.receptor.rut)}</p>
            </div>
            {docVer.detalles.length > 0 && (
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left">Descripción</th>
                    <th className="px-3 py-2 text-center">Cant.</th>
                    <th className="px-3 py-2 text-right">P.Unit</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {docVer.detalles.map(d => (
                    <tr key={d.id}>
                      <td className="px-3 py-2">{d.descripcion}</td>
                      <td className="px-3 py-2 text-center">{d.cantidad}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(d.precioUnitario)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(d.montoTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="flex justify-end">
              <div className="w-56 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-600">Neto</span><span>{formatCurrency(docVer.subtotal)}</span></div>
                {docVer.totalExento > 0 && <div className="flex justify-between"><span className="text-gray-600">Exento</span><span>{formatCurrency(docVer.totalExento)}</span></div>}
                <div className="flex justify-between"><span className="text-gray-600">IVA</span><span>{formatCurrency(docVer.iva)}</span></div>
                <div className="flex justify-between text-base font-bold border-t pt-1.5">
                  <span>Total</span>
                  <span className={esNotaCredito(docVer.tipo) ? 'text-orange-600' : 'text-[#1E3A5F]'}>
                    {esNotaCredito(docVer.tipo) ? '-' : ''}{formatCurrency(docVer.total)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

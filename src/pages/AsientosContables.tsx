import React, { useState } from 'react';
import { Plus, Search, Edit2, Trash2, CheckCircle, AlertCircle, Bookmark, BookmarkPlus, Copy } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card, Badge } from '../components/ui/Cards';
import { Button, Input, Select, Textarea } from '../components/ui/FormElements';
import { Modal, ConfirmDialog } from '../components/ui/Modal';
import { AsientoContable, DetalleAsiento, PlantillaAsiento } from '../types';
import { formatCurrency, formatDate, generateId } from '../utils/calculos';
import { AsientoContableSchema, formatZodErrors } from '../utils/schemas';

export default function AsientosContables() {
  const { state, dispatch, showToast } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingAsiento, setEditingAsiento] = useState<AsientoContable | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    glosa: '',
    detalles: [] as DetalleAsiento[],
  });

  const [nuevaLinea, setNuevaLinea] = useState({
    cuentaId: '',
    debe: 0,
    haber: 0,
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showPlantillasModal, setShowPlantillasModal] = useState(false);
  const [showGuardarPlantillaModal, setShowGuardarPlantillaModal] = useState(false);
  const [nombrePlantilla, setNombrePlantilla] = useState('');

  const plantillas: PlantillaAsiento[] = state.plantillas ?? [];

  // Filtrar asientos
  const asientosFiltrados = (state.asientos ?? []).filter((a) => {
    return (
      searchTerm === '' ||
      a.glosa.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.numero.toString().includes(searchTerm)
    );
  });

  // Cuentas disponibles como options para Select
  const cuentasDisponibles = (state.cuentas ?? []).filter((c) => c.permiteMovimiento);
  const cuentasOptions = [
    { value: '', label: 'Seleccionar cuenta...' },
    ...cuentasDisponibles.map((c) => ({ value: c.id, label: `${c.codigo} - ${c.nombre}` })),
  ];

  const abrirModalNuevo = () => {
    setEditingAsiento(null);
    setFormData({
      fecha: new Date().toISOString().split('T')[0],
      glosa: '',
      detalles: [],
    });
    setNuevaLinea({ cuentaId: '', debe: 0, haber: 0 });
    setFormErrors({});
    setShowModal(true);
  };

  const abrirModalEditar = (asiento: AsientoContable) => {
    setEditingAsiento(asiento);
    setFormData({
      fecha: asiento.fecha,
      glosa: asiento.glosa,
      detalles: [...asiento.detalles],
    });
    setFormErrors({});
    setShowModal(true);
  };

  const agregarLinea = () => {
    if (!nuevaLinea.cuentaId) {
      showToast('error', 'Error', 'Seleccione una cuenta');
      return;
    }
    if (nuevaLinea.debe === 0 && nuevaLinea.haber === 0) {
      showToast('error', 'Error', 'Ingrese monto en debe o haber');
      return;
    }
    if (nuevaLinea.debe > 0 && nuevaLinea.haber > 0) {
      showToast('error', 'Error', 'No puede ingresar monto en ambos lados');
      return;
    }

    const cuenta = state.cuentas.find((c) => c.id === nuevaLinea.cuentaId);
    if (!cuenta) return;

    const linea: DetalleAsiento = {
      cuentaId: cuenta.id,
      cuentaCodigo: cuenta.codigo,
      cuentaNombre: cuenta.nombre,
      debe: nuevaLinea.debe,
      haber: nuevaLinea.haber,
    };

    setFormData({ ...formData, detalles: [...formData.detalles, linea] });
    setNuevaLinea({ cuentaId: '', debe: 0, haber: 0 });
  };

  const eliminarLinea = (index: number) => {
    const nuevosDetalles = [...formData.detalles];
    nuevosDetalles.splice(index, 1);
    setFormData({ ...formData, detalles: nuevosDetalles });
  };

  const totales = {
    debe: formData.detalles.reduce((sum, d) => sum + d.debe, 0),
    haber: formData.detalles.reduce((sum, d) => sum + d.haber, 0),
  };

  const balanceado = Math.abs(totales.debe - totales.haber) < 1;

  const handleSubmit = () => {
    const result = AsientoContableSchema.safeParse({
      fecha: formData.fecha,
      descripcion: formData.glosa,
      detalles: formData.detalles,
    });

    if (!result.success) {
      const errors = formatZodErrors(result.error);
      setFormErrors(errors);
      const firstMsg = result.error.issues[0]?.message ?? 'Corrija los errores del formulario';
      showToast('error', 'Formulario inválido', firstMsg);
      return;
    }

    setFormErrors({});

    const nuevoAsiento: AsientoContable = {
      id: editingAsiento?.id || generateId(),
      fecha: formData.fecha,
      numero: editingAsiento?.numero || state.numeroAsiento,
      glosa: formData.glosa,
      detalles: formData.detalles,
      totalDebe: totales.debe,
      totalHaber: totales.haber,
      estado: 'aprobado',
    };

    if (editingAsiento) {
      dispatch({ type: 'UPDATE_ASIENTO', payload: nuevoAsiento });
      showToast('success', 'Éxito', 'Asiento actualizado');
    } else {
      dispatch({ type: 'ADD_ASIENTO', payload: nuevoAsiento });
      showToast('success', 'Éxito', 'Asiento creado');
    }

    setShowModal(false);
  };

  const handleConfirmDelete = () => {
    if (!confirmDeleteId) return;
    dispatch({ type: 'DELETE_ASIENTO', payload: confirmDeleteId });
    showToast('success', 'Éxito', 'Asiento eliminado');
    setConfirmDeleteId(null);
  };

  // ── Plantillas ──────────────────────────────────────────
  const aplicarPlantilla = (plantilla: PlantillaAsiento) => {
    setFormData({
      fecha: new Date().toISOString().split('T')[0],
      glosa: plantilla.glosa,
      detalles: plantilla.detalles.map(d => ({
        cuentaId: d.cuentaId,
        cuentaCodigo: d.cuentaCodigo,
        cuentaNombre: d.cuentaNombre,
        debe: d.debe,
        haber: d.haber,
      })),
    });
    dispatch({ type: 'INCREMENT_USO_PLANTILLA', payload: plantilla.id });
    setShowPlantillasModal(false);
    showToast('success', 'Plantilla aplicada', plantilla.nombre);
  };

  const guardarComoPlantilla = () => {
    if (!nombrePlantilla.trim()) { showToast('error', 'Error', 'Ingresa un nombre'); return; }
    if (formData.detalles.length === 0) { showToast('error', 'Error', 'El asiento no tiene líneas'); return; }
    const plantilla: PlantillaAsiento = {
      id: generateId(),
      nombre: nombrePlantilla.trim(),
      glosa: formData.glosa,
      detalles: formData.detalles.map(d => ({
        cuentaId: d.cuentaId,
        cuentaCodigo: d.cuentaCodigo,
        cuentaNombre: d.cuentaNombre,
        debe: d.debe,
        haber: d.haber,
      })),
      creadoEn: new Date().toISOString(),
      usosCount: 0,
    };
    dispatch({ type: 'ADD_PLANTILLA', payload: plantilla });
    showToast('success', 'Plantilla guardada', nombrePlantilla.trim());
    setShowGuardarPlantillaModal(false);
    setNombrePlantilla('');
  };

  const clonarAsiento = (asiento: AsientoContable) => {
    setEditingAsiento(null);
    setFormData({
      fecha: new Date().toISOString().split('T')[0],
      glosa: `Copia — ${asiento.glosa}`,
      detalles: [...asiento.detalles],
    });
    setFormErrors({});
    setShowModal(true);
  };
  // ────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Asientos Contables</h1>
          <p className="text-sm text-gray-500 mt-1">Registro de movimientos contables</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" icon={<Bookmark size={15} />} onClick={() => setShowPlantillasModal(true)}>
            Plantillas {plantillas.length > 0 && <span className="ml-1 bg-[#1E3A5F] text-white text-xs rounded-full px-1.5 py-0.5">{plantillas.length}</span>}
          </Button>
          <Button icon={<Plus size={16} />} onClick={abrirModalNuevo}>
            Nuevo Asiento
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card padding="sm">
        <Input
          placeholder="Buscar por número o glosa..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          leftIcon={<Search size={16} />}
        />
        {searchTerm && (
          <p className="text-xs text-gray-500 mt-2">
            {asientosFiltrados.length} resultado{asientosFiltrados.length !== 1 ? 's' : ''} para &quot;{searchTerm}&quot;
          </p>
        )}
      </Card>

      {/* Lista */}
      <Card padding="none">
        <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
        <table className="w-full table-modern">
          <thead className="sticky top-0 z-10 bg-white dark:bg-gray-800">
            <tr>
              <th>N°</th>
              <th>Fecha</th>
              <th>Glosa</th>
              <th className="text-right">Debe</th>
              <th className="text-right">Haber</th>
              <th className="text-center">Estado</th>
              <th className="text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {asientosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                      <CheckCircle size={22} className="text-gray-300" />
                    </div>
                    <p className="text-sm font-medium text-gray-500">No hay asientos registrados</p>
                    <Button size="sm" onClick={abrirModalNuevo}>
                      Crear primer asiento
                    </Button>
                  </div>
                </td>
              </tr>
            ) : (
              asientosFiltrados.map((asiento) => (
                <tr key={asiento.id} className="odd:bg-gray-50/50 dark:odd:bg-gray-800/30 hover:bg-blue-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    #{asiento.numero}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDate(asiento.fecha)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{asiento.glosa}</td>
                  <td className="px-4 py-3 text-sm text-right tnum text-gray-900">
                    {formatCurrency(asiento.totalDebe)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right tnum text-gray-900">
                    {formatCurrency(asiento.totalHaber)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge
                      variant={asiento.estado === 'aprobado' ? 'success' : 'warning'}
                      dot
                    >
                      {asiento.estado === 'aprobado' ? 'Aprobado' : 'Pendiente'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => abrirModalEditar(asiento)}
                        className="p-2 text-gray-400 hover:text-[#1E3A5F] hover:bg-gray-100 rounded-lg
                          transition-[background-color,color] duration-150 active:scale-[0.95]"
                        title="Editar"
                        aria-label={`Editar asiento #${asiento.numero}`}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => clonarAsiento(asiento)}
                        className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg
                          transition-[background-color,color] duration-150 active:scale-[0.95]"
                        title="Clonar asiento"
                        aria-label={`Clonar asiento #${asiento.numero}`}
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(asiento.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg
                          transition-[background-color,color] duration-150 active:scale-[0.95]"
                        title="Eliminar"
                        aria-label={`Eliminar asiento #${asiento.numero}`}
                      >
                        <Trash2 size={16} />
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

      {/* Modal Asiento */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingAsiento ? `Editar Asiento #${editingAsiento.numero}` : 'Nuevo Asiento'}
        size="xl"
        closeOnBackdrop={false}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!balanceado || formData.detalles.length === 0}
              title={
                formData.detalles.length === 0
                  ? 'Agrega al menos una línea'
                  : !balanceado
                  ? `Diferencia: ${formatCurrency(Math.abs(totales.debe - totales.haber))}`
                  : undefined
              }
            >
              {editingAsiento ? 'Actualizar' : 'Crear Asiento'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Datos cabecera */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Fecha"
              type="date"
              value={formData.fecha}
              onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
            />
            <Input
              label="Número"
              value={String(editingAsiento?.numero ?? state.numeroAsiento)}
              disabled
              hint="Se asigna automáticamente"
            />
          </div>
          <div>
            <Textarea
              label="Glosa"
              value={formData.glosa}
              onChange={(e) => {
                setFormData({ ...formData, glosa: e.target.value });
                if (formErrors.descripcion) setFormErrors({ ...formErrors, descripcion: '' });
              }}
              placeholder="Descripción del asiento contable"
              rows={2}
              error={formErrors.descripcion}
            />
          </div>

          {/* Líneas del asiento */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Cuenta</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase w-28">Debe</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase w-28">Haber</th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {formData.detalles.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-xs text-gray-400">
                      Agrega cuentas usando el formulario de abajo
                    </td>
                  </tr>
                ) : (
                  formData.detalles.map((detalle, index) => (
                    <tr key={index} className="hover:bg-gray-50/80">
                      <td className="px-3 py-2">
                        <span className="font-mono text-xs text-gray-400 mr-2">{detalle.cuentaCodigo}</span>
                        <span className="text-gray-800">{detalle.cuentaNombre}</span>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-900">
                        {detalle.debe > 0 ? formatCurrency(detalle.debe) : ''}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-900">
                        {detalle.haber > 0 ? formatCurrency(detalle.haber) : ''}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => eliminarLinea(index)}
                          className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded
                            transition-[background-color,color] duration-150 active:scale-[0.93]"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr className="font-semibold text-gray-700">
                  <td className="px-3 py-2 text-xs uppercase">Totales</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(totales.debe)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(totales.haber)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>

            {/* Agregar línea */}
            <div className="p-3 bg-gray-50/50 border-t border-gray-200">
              <div className="grid grid-cols-4 gap-2 items-end">
                <div className="col-span-2">
                  <Select
                    value={nuevaLinea.cuentaId}
                    onChange={(e) => setNuevaLinea({ ...nuevaLinea, cuentaId: e.target.value })}
                    options={cuentasOptions}
                    placeholder="Seleccionar cuenta..."
                  />
                </div>
                <Input
                  type="number"
                  placeholder="Debe"
                  value={nuevaLinea.debe || ''}
                  onChange={(e) =>
                    setNuevaLinea({ ...nuevaLinea, debe: Number(e.target.value), haber: 0 })
                  }
                  className="text-right"
                />
                <Input
                  type="number"
                  placeholder="Haber"
                  value={nuevaLinea.haber || ''}
                  onChange={(e) =>
                    setNuevaLinea({ ...nuevaLinea, haber: Number(e.target.value), debe: 0 })
                  }
                  className="text-right"
                />
              </div>
              <div className="mt-2 flex justify-end">
                <Button size="sm" variant="secondary" onClick={agregarLinea}>
                  + Agregar línea
                </Button>
              </div>
            </div>
          </div>

          {/* Indicador de balance */}
          <div
            className={`p-3 rounded-lg flex items-center justify-center gap-2 text-sm font-medium ${
              balanceado && formData.detalles.length > 0
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : formData.detalles.length === 0
                ? 'bg-gray-50 text-gray-400 border border-gray-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {balanceado && formData.detalles.length > 0 ? (
              <>
                <CheckCircle size={16} />
                Asiento balanceado
              </>
            ) : formData.detalles.length === 0 ? (
              <>
                <AlertCircle size={16} />
                Agrega al menos dos líneas
              </>
            ) : (
              <>
                <AlertCircle size={16} />
                Diferencia: {formatCurrency(Math.abs(totales.debe - totales.haber))}
              </>
            )}
          </div>

          {(formErrors[''] || formErrors.detalles) && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertCircle size={12} />
              {formErrors[''] || formErrors.detalles}
            </p>
          )}

          {/* Guardar como plantilla */}
          {formData.detalles.length > 0 && (
            <div className="flex justify-start">
              <button
                type="button"
                onClick={() => setShowGuardarPlantillaModal(true)}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#1E3A5F] transition-colors"
              >
                <BookmarkPlus size={13} />
                Guardar como plantilla reutilizable
              </button>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal — Biblioteca de plantillas */}
      <Modal
        isOpen={showPlantillasModal}
        onClose={() => setShowPlantillasModal(false)}
        title="Plantillas de asientos"
        size="lg"
        footer={<Button variant="secondary" onClick={() => setShowPlantillasModal(false)}>Cerrar</Button>}
      >
        {plantillas.length === 0 ? (
          <div className="py-12 text-center">
            <Bookmark size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No hay plantillas guardadas</p>
            <p className="text-xs text-gray-400 mt-1">Crea un asiento y usa "Guardar como plantilla"</p>
          </div>
        ) : (
          <div className="space-y-2">
            {plantillas.map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-900">{p.nombre}</p>
                  <p className="text-xs text-gray-500">{p.glosa} · {p.detalles.length} líneas · usado {p.usosCount}x</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => { aplicarPlantilla(p); setShowModal(true); }}>
                    Usar
                  </Button>
                  <button
                    onClick={() => dispatch({ type: 'DELETE_PLANTILLA', payload: p.id })}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    title="Eliminar plantilla"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Modal — Guardar como plantilla */}
      <Modal
        isOpen={showGuardarPlantillaModal}
        onClose={() => setShowGuardarPlantillaModal(false)}
        title="Guardar como plantilla"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowGuardarPlantillaModal(false)}>Cancelar</Button>
            <Button onClick={guardarComoPlantilla}>Guardar</Button>
          </>
        }
      >
        <Input
          label="Nombre de la plantilla *"
          value={nombrePlantilla}
          onChange={e => setNombrePlantilla(e.target.value)}
          placeholder="Ej: Depreciación mensual activos"
          autoFocus
        />
        <p className="text-xs text-gray-400 mt-2">La glosa y todas las líneas del asiento actual se guardarán como plantilla.</p>
      </Modal>

      {/* Confirmación de eliminación */}
      <ConfirmDialog
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={handleConfirmDelete}
        title="Eliminar asiento"
        message="Esta acción eliminará el asiento permanentemente y no se puede deshacer. ¿Confirmas?"
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
        variant="danger"
      />
    </div>
  );
}

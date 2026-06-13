import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  Filter,
  Download,
  FolderOpen,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card, Badge, DataTable } from '../components/ui/Cards';
import { Button, Input, Select } from '../components/ui/FormElements';
import { Modal } from '../components/ui/Modal';
import { Cuenta, TipoCuenta } from '../types';
import { formatCurrency } from '../utils/calculos';

export default function PlanCuentas() {
  const { state, dispatch, showToast } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [showModal, setShowModal] = useState(false);
  const [editingCuenta, setEditingCuenta] = useState<Cuenta | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['1', '2', '3', '4', '5', '6']));
  const [showModalElimnar, setShowModalElimnar] = useState(false);
  const [cuentaAEliminar, setCuentaAEliminar] = useState<Cuenta | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    tipo: 'activo' as TipoCuenta,
    naturaleza: 'deudora' as 'deudora' | 'acreedora',
    permiteMovimiento: true,
    padreId: '',
  });

  // Filtrar cuentas
  const cuentasFiltradas = useMemo(() => {
    return state.cuentas.filter((cuenta) => {
      const matchesSearch =
        searchTerm === '' ||
        cuenta.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cuenta.nombre.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesTipo =
        filtroTipo === 'todos' || cuenta.tipo === filtroTipo;

      return matchesSearch && matchesTipo;
    });
  }, [state.cuentas, searchTerm, filtroTipo]);

  // Agrupar cuentas por tipo
  const grupos = useMemo(() => {
    const gruposMap: Record<string, Cuenta[]> = {
      '1': [],
      '2': [],
      '3': [],
      '4': [],
      '5': [],
      '6': [],
    };

    cuentasFiltradas.forEach((cuenta) => {
      const grupoKey = cuenta.codigo.split('-')[0];
      if (gruposMap[grupoKey]) {
        gruposMap[grupoKey].push(cuenta);
      }
    });

    return gruposMap;
  }, [cuentasFiltradas]);

  const toggleGroup = (grupo: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(grupo)) {
      newExpanded.delete(grupo);
    } else {
      newExpanded.add(grupo);
    }
    setExpandedGroups(newExpanded);
  };

  const abrirModalNueva = () => {
    setEditingCuenta(null);
    setFormData({
      codigo: '',
      nombre: '',
      tipo: 'activo',
      naturaleza: 'deudora',
      permiteMovimiento: true,
      padreId: '',
    });
    setShowModal(true);
  };

  const abrirModalEditar = (cuenta: Cuenta) => {
    setEditingCuenta(cuenta);
    setFormData({
      codigo: cuenta.codigo,
      nombre: cuenta.nombre,
      tipo: cuenta.tipo,
      naturaleza: cuenta.naturaleza,
      permiteMovimiento: cuenta.permiteMovimiento,
      padreId: cuenta.padreId || '',
    });
    setShowModal(true);
  };

  const handleSubmit = () => {
    if (!formData.codigo || !formData.nombre) {
      showToast('error', 'Error', 'Código y nombre son requeridos');
      return;
    }

    if (editingCuenta) {
      dispatch({
        type: 'UPDATE_CUENTA',
        payload: {
          ...editingCuenta,
          ...formData,
        },
      });
      showToast('success', 'Éxito', 'Cuenta actualizada correctamente');
    } else {
      const nuevaCuenta: Cuenta = {
        id: `${Date.now()}`,
        ...formData,
        nivel: formData.padreId ? 2 : 1,
      };
      dispatch({ type: 'ADD_CUENTA', payload: nuevaCuenta });
      showToast('success', 'Éxito', 'Cuenta creada correctamente');
    }

    setShowModal(false);
  };

  const confirmarEliminar = (cuenta: Cuenta) => {
    if (!cuenta.permiteMovimiento) {
      showToast('warning', 'Aviso', 'No se puede eliminar una cuenta padre');
      return;
    }
    setCuentaAEliminar(cuenta);
    setShowModalElimnar(true);
  };

  const handleEliminar = () => {
    if (cuentaAEliminar) {
      dispatch({ type: 'DELETE_CUENTA', payload: cuentaAEliminar.id });
      showToast('success', 'Éxito', 'Cuenta eliminada correctamente');
      setShowModalElimnar(false);
      setCuentaAEliminar(null);
    }
  };

  const nombreGrupo = (grupo: string) => {
    const nombres: Record<string, string> = {
      '1': 'Activos',
      '2': 'Pasivos',
      '3': 'Patrimonio',
      '4': 'Ingresos',
      '5': 'Costos y Gastos',
      '6': 'Otros',
    };
    return nombres[grupo] || grupo;
  };

  const colorGrupo = (grupo: string) => {
    const colores: Record<string, string> = {
      '1': 'bg-blue-100 text-blue-700',
      '2': 'bg-red-100 text-red-700',
      '3': 'bg-purple-100 text-purple-700',
      '4': 'bg-emerald-100 text-emerald-700',
      '5': 'bg-amber-100 text-amber-700',
      '6': 'bg-gray-100 text-gray-700',
    };
    return colores[grupo] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plan de Cuentas</h1>
          <p className="text-sm text-gray-500 mt-1">
            Catálogo contable conforme a normativa chilena
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" icon={<Download size={16} />}>
            Exportar
          </Button>
          <Button icon={<Plus size={16} />} onClick={abrirModalNueva}>
            Nueva Cuenta
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[250px]">
            <Input
              placeholder="Buscar por código o nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search size={18} />}
            />
          </div>
          <div className="w-48">
            <Select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              options={[
                { value: 'todos', label: 'Todos los tipos' },
                { value: 'activo', label: 'Activo' },
                { value: 'pasivo', label: 'Pasivo' },
                { value: 'patrimonio', label: 'Patrimonio' },
                { value: 'ingreso', label: 'Ingreso' },
                { value: 'gasto', label: 'Gasto' },
              ]}
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>{state.cuentas.length} cuentas</span>
          </div>
        </div>
      </Card>

      {/* Tree View */}
      <Card padding="none">
        <div className="divide-y divide-gray-100">
          {Object.entries(grupos).map(([grupo, cuentas]) => {
            if (cuentas.length === 0) return null;

            return (
              <div key={grupo}>
                {/* Group Header */}
                <button
                  onClick={() => toggleGroup(grupo)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${colorGrupo(grupo)}`}>
                      <FolderOpen size={18} />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-gray-900">{nombreGrupo(grupo)}</p>
                      <p className="text-xs text-gray-500">
                        {cuentas.length} cuentas • {grupo}xx
                      </p>
                    </div>
                  </div>
                  {expandedGroups.has(grupo) ? (
                    <ChevronDown size={20} className="text-gray-400" />
                  ) : (
                    <ChevronRight size={20} className="text-gray-400" />
                  )}
                </button>

                {/* Group Items */}
                {expandedGroups.has(grupo) && (
                  <div className="bg-gray-50/50">
                    {cuentas.map((cuenta) => (
                      <div
                        key={cuenta.id}
                        className={`flex items-center justify-between px-5 py-2.5 hover:bg-white transition-colors
                          ${cuenta.nivel === 0 ? 'bg-gray-100' : ''}
                        `}
                      >
                        <div className="flex items-center gap-4">
                          <span
                            className={`font-mono text-sm w-28 ${
                              cuenta.nivel === 0
                                ? 'font-bold text-gray-700'
                                : cuenta.nivel === 1
                                ? 'font-semibold text-gray-600'
                                : 'text-gray-500'
                            }`}
                          >
                            {cuenta.codigo}
                          </span>
                          <span
                            className={`${
                              cuenta.nivel === 0
                                ? 'font-bold text-gray-900'
                                : cuenta.nivel === 1
                                ? 'font-semibold text-gray-700'
                                : 'text-gray-600'
                            }`}
                          >
                            {cuenta.nombre}
                          </span>
                          {cuenta.permiteMovimiento && (
                            <Badge variant="info" size="sm">Activa</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge
                            variant={
                              cuenta.naturaleza === 'deudora'
                                ? 'warning'
                                : 'success'
                            }
                            size="sm"
                          >
                            {cuenta.naturaleza === 'deudora' ? 'Deudora' : 'Acreedora'}
                          </Badge>
                          {cuenta.padreId && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => abrirModalEditar(cuenta)}
                                className="p-1.5 text-gray-400 hover:text-[#1E3A5F] hover:bg-gray-200 rounded-lg transition-colors"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => confirmarEliminar(cuenta)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Modal Nueva/Editar Cuenta */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingCuenta ? 'Editar Cuenta' : 'Nueva Cuenta'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>
              {editingCuenta ? 'Actualizar' : 'Crear'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Código"
              value={formData.codigo}
              onChange={(e) =>
                setFormData({ ...formData, codigo: e.target.value })
              }
              placeholder="Ej: 1-1-01"
              hint="Código jerárquico de la cuenta"
            />
            <Select
              label="Tipo"
              value={formData.tipo}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  tipo: e.target.value as TipoCuenta,
                })
              }
              options={[
                { value: 'activo', label: 'Activo' },
                { value: 'pasivo', label: 'Pasivo' },
                { value: 'patrimonio', label: 'Patrimonio' },
                { value: 'ingreso', label: 'Ingreso' },
                { value: 'gasto', label: 'Gasto' },
              ]}
            />
          </div>
          <Input
            label="Nombre"
            value={formData.nombre}
            onChange={(e) =>
              setFormData({ ...formData, nombre: e.target.value })
            }
            placeholder="Nombre descriptivo de la cuenta"
          />
          <Select
            label="Naturaleza"
            value={formData.naturaleza}
            onChange={(e) =>
              setFormData({
                ...formData,
                naturaleza: e.target.value as 'deudora' | 'acreedora',
              })
            }
            options={[
              { value: 'deudora', label: 'Deudora' },
              { value: 'acreedora', label: 'Acreedora' },
            ]}
          />
          <Select
            label="Cuenta Padre"
            value={formData.padreId || ''}
            onChange={(e) =>
              setFormData({ ...formData, padreId: e.target.value })
            }
            options={[
              { value: '', label: 'Sin padre (cuenta principal)' },
              ...state.cuentas
                .filter((c) => c.permiteMovimiento === false && c.nivel < 2)
                .map((c) => ({ value: c.id, label: `${c.codigo} - ${c.nombre}` })),
            ]}
          />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="permiteMovimiento"
              checked={formData.permiteMovimiento}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  permiteMovimiento: e.target.checked,
                })
              }
              className="w-4 h-4 rounded border-gray-300"
            />
            <label htmlFor="permiteMovimiento" className="text-sm text-gray-700">
              Permite movimientos (cuenta de detalle)
            </label>
          </div>
        </div>
      </Modal>

      {/* Modal Eliminar */}
      <Modal
        isOpen={showModalElimnar}
        onClose={() => setShowModalElimnar(false)}
        title="Eliminar Cuenta"
        size="sm"
      >
        <p className="text-gray-600">
          ¿Está seguro de eliminar la cuenta <strong>{cuentaAEliminar?.nombre}</strong>?
          Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setShowModalElimnar(false)}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleEliminar}>
            Eliminar
          </Button>
        </div>
      </Modal>
    </div>
  );
}

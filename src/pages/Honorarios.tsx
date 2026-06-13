import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  DollarSign,
  Calculator,
  FileText,
  Check,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card, Badge } from '../components/ui/Cards';
import { Button, Input, Select } from '../components/ui/FormElements';
import { Modal } from '../components/ui/Modal';
import RutInput from '../components/RutInput';
import { Honorario } from '../types';
import { formatCurrency, formatDate, formatRUT, generateId, validarRUT } from '../utils/calculos';
import { calcularHonorarios, calcularHonorariosDesdeLiquido } from '../utils/calculos';

export default function Honorarios() {
  const { state, dispatch, showToast } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showCalculadora, setShowCalculadora] = useState(false);
  const [editingHonorario, setEditingHonorario] = useState<Honorario | null>(null);
  const [modoCalculadora, setModoCalculadora] = useState<'bruto' | 'liquido'>('liquido');

  // Form state
  const [formData, setFormData] = useState<Partial<Honorario>>({
    rut: '',
    nombre: '',
    direccion: '',
    periodo: '',
    montoBruto: 0,
    fechaPago: '',
    estado: 'pendiente',
  });

  // Calculadora
  const [montoCalculadora, setMontoCalculadora] = useState(0);
  const [resultadoCalculadora, setResultadoCalculadora] = useState<{
    bruto: number;
    retencion: number;
    liquido: number;
  } | null>(null);

  // Filtrar honorarios
  const honorariosFiltrados = useMemo(() => {
    return state.honorarios.filter((h) => {
      const matchesSearch =
        searchTerm === '' ||
        h.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.rut.includes(searchTerm);
      return matchesSearch;
    });
  }, [state.honorarios, searchTerm]);

  // Totales
  const totales = useMemo(() => {
    const pendientes = honorariosFiltrados.filter((h) => h.estado === 'pendiente');
    const pagados = honorariosFiltrados.filter((h) => h.estado === 'pagado');

    return {
      pendientes: pendientes.reduce((sum, h) => sum + h.montoLiquido, 0),
      pagados: pagados.reduce((sum, h) => sum + h.montoLiquido, 0),
      retenciones: state.honorarios.reduce((sum, h) => sum + h.retencion, 0),
    };
  }, [honorariosFiltrados, state.honorarios]);

  const abrirModalNuevo = () => {
    setEditingHonorario(null);
    setFormData({
      rut: '',
      nombre: '',
      direccion: '',
      periodo: new Date().toISOString().slice(0, 7),
      montoBruto: 0,
      fechaPago: new Date().toISOString().split('T')[0],
      estado: 'pendiente',
    });
    setShowModal(true);
  };

  const abrirModalEditar = (honorario: Honorario) => {
    setEditingHonorario(honorario);
    setFormData(honorario);
    setShowModal(true);
  };

  const abrirCalculadora = (modo: 'bruto' | 'liquido') => {
    setModoCalculadora(modo);
    setMontoCalculadora(0);
    setResultadoCalculadora(null);
    setShowCalculadora(true);
  };

  const calcular = () => {
    if (montoCalculadora <= 0) return;

    if (modoCalculadora === 'bruto') {
      const resultado = calcularHonorarios(montoCalculadora);
      setResultadoCalculadora({
        bruto: montoCalculadora,
        retencion: resultado.retencion,
        liquido: resultado.liquido,
      });
    } else {
      const resultado = calcularHonorariosDesdeLiquido(montoCalculadora);
      setResultadoCalculadora({
        bruto: resultado.bruto,
        retencion: resultado.retencion,
        liquido: montoCalculadora,
      });
    }
  };

  const handleSubmit = () => {
    if (!formData.nombre || !formData.rut || !formData.montoBruto) {
      showToast('error', 'Error', 'Complete todos los campos requeridos');
      return;
    }

    if (!validarRUT(formData.rut)) {
      showToast('error', 'RUT inválido', 'El RUT ingresado no es válido');
      return;
    }

    const { retencion, liquido } = calcularHonorarios(formData.montoBruto!);

    const nuevoHonorario: Honorario = {
      id: editingHonorario?.id || generateId(),
      rut: formData.rut!,
      nombre: formData.nombre!,
      direccion: formData.direccion || '',
      periodo: formData.periodo || new Date().toISOString().slice(0, 7),
      montoBruto: formData.montoBruto!,
      retencion,
      montoLiquido: liquido,
      fechaPago: formData.fechaPago || '',
      estado: formData.estado || 'pendiente',
    };

    if (editingHonorario) {
      dispatch({ type: 'UPDATE_HONORARIO', payload: nuevoHonorario });
      showToast('success', 'Éxito', 'Honorario actualizado');
    } else {
      dispatch({ type: 'ADD_HONORARIO', payload: nuevoHonorario });
      showToast('success', 'Éxito', 'Honorario registrado');
    }

    setShowModal(false);
  };

  const marcarPagado = (honorario: Honorario) => {
    dispatch({
      type: 'UPDATE_HONORARIO',
      payload: { ...honorario, estado: 'pagado', fechaPago: new Date().toISOString().split('T')[0] },
    });
    showToast('success', 'Éxito', 'Marcado como pagado');
  };

  const handleEliminar = (honorario: Honorario) => {
    dispatch({ type: 'DELETE_HONORARIO', payload: honorario.id });
    showToast('success', 'Éxito', 'Honorario eliminado');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Honorarios</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestión de boletas de honorarios (Art. 42 N°2 LIR)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            icon={<Calculator size={16} />}
            onClick={() => abrirCalculadora('liquido')}
          >
            Calc. Líquido
          </Button>
          <Button
            variant="secondary"
            icon={<Calculator size={16} />}
            onClick={() => abrirCalculadora('bruto')}
          >
            Calc. Bruto
          </Button>
          <Button icon={<Plus size={16} />} onClick={abrirModalNuevo}>
            Nuevo Honorario
          </Button>
        </div>
      </div>

      {/* Info Box */}
      <Card>
        <div className="flex items-start gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <FileText size={24} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900">Retención de Honorarios</p>
            <p className="text-sm text-blue-700 mt-1">
              Los honorarios están afectos a una retención del 13.75% en calidad de impuesto único de segunda categoría
              (Art. 42 N°2 LIR). El beneficiario debe declarar sus ingresos en su declaración anual de impuestos.
            </p>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 rounded-lg">
              <DollarSign size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totales.pendientes)}</p>
              <p className="text-sm text-gray-500">Pendientes de pago</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 rounded-lg">
              <Check size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totales.pagados)}</p>
              <p className="text-sm text-gray-500">Pagados</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <DollarSign size={20} className="text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totales.retenciones)}</p>
              <p className="text-sm text-gray-500">Retenciones (13.75%)</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <Card padding="sm">
        <Input
          placeholder="Buscar por nombre o RUT..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          leftIcon={<Search size={18} />}
        />
      </Card>

      {/* Lista */}
      <Card padding="none">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Profesional</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">RUT</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Período</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Bruto</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Retención</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Líquido</th>
              <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Estado</th>
              <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {honorariosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center">
                  <DollarSign className="mx-auto text-gray-300 mb-3" size={48} />
                  <p className="text-gray-500">No hay boletas de honorarios registradas</p>
                  <Button className="mt-3" onClick={abrirModalNuevo}>
                    Registrar honorario
                  </Button>
                </td>
              </tr>
            ) : (
              honorariosFiltrados.map((honorario) => (
                <tr key={honorario.id} className="hover:bg-gray-50">
                  <td className="px-5 py-4">
                    <p className="font-medium text-gray-900">{honorario.nombre}</p>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600">{formatRUT(honorario.rut)}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">{honorario.periodo}</td>
                  <td className="px-5 py-4 text-right text-gray-900">{formatCurrency(honorario.montoBruto)}</td>
                  <td className="px-5 py-4 text-right text-red-600">{formatCurrency(honorario.retencion)}</td>
                  <td className="px-5 py-4 text-right font-medium text-emerald-600">{formatCurrency(honorario.montoLiquido)}</td>
                  <td className="px-5 py-4 text-center">
                    <Badge variant={honorario.estado === 'pagado' ? 'success' : 'warning'}>
                      {honorario.estado === 'pagado' ? 'Pagado' : 'Pendiente'}
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-center gap-2">
                      {honorario.estado === 'pendiente' && (
                        <button
                          onClick={() => marcarPagado(honorario)}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Marcar como pagado"
                        >
                          <Check size={18} />
                        </button>
                      )}
                      <button
                        onClick={() => abrirModalEditar(honorario)}
                        className="p-2 text-gray-400 hover:text-[#1E3A5F] hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleEliminar(honorario)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {/* Modal Honorario */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingHonorario ? 'Editar Honorario' : 'Nuevo Honorario'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>{editingHonorario ? 'Actualizar' : 'Guardar'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <RutInput
              label="RUT"
              value={formData.rut || ''}
              onChange={(value) => setFormData({ ...formData, rut: value })}
              placeholder="12.345.678-9"
              required
            />
            <Input
              label="Nombre / Razón Social"
              value={formData.nombre || ''}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
            />
          </div>
          <Input
            label="Dirección"
            value={formData.direccion || ''}
            onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Período"
              type="month"
              value={formData.periodo || ''}
              onChange={(e) => setFormData({ ...formData, periodo: e.target.value })}
            />
            <Input
              label="Fecha de Pago"
              type="date"
              value={formData.fechaPago || ''}
              onChange={(e) => setFormData({ ...formData, fechaPago: e.target.value })}
            />
          </div>
          <Input
            label="Monto Bruto"
            type="number"
            value={formData.montoBruto || 0}
            onChange={(e) => setFormData({ ...formData, montoBruto: Number(e.target.value) })}
            hint="Monto antes de la retención del 13.75%"
          />
          <Select
            label="Estado"
            value={formData.estado || 'pendiente'}
            onChange={(e) => setFormData({ ...formData, estado: e.target.value as 'pendiente' | 'pagado' })}
            options={[
              { value: 'pendiente', label: 'Pendiente' },
              { value: 'pagado', label: 'Pagado' },
            ]}
          />

          {/* Preview */}
          {formData.montoBruto && formData.montoBruto > 0 && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Vista Previa</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Honorario Bruto</span>
                  <span className="font-medium">{formatCurrency(formData.montoBruto)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Retención 13.75%</span>
                  <span>- {formatCurrency(calcularHonorarios(formData.montoBruto).retencion)}</span>
                </div>
                <div className="flex justify-between font-bold border-t pt-2">
                  <span>Líquido a Pagar</span>
                  <span className="text-emerald-600">
                    {formatCurrency(calcularHonorarios(formData.montoBruto).liquido)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal Calculadora */}
      <Modal
        isOpen={showCalculadora}
        onClose={() => setShowCalculadora(false)}
        title={`Calculadora de Honorarios - ${modoCalculadora === 'bruto' ? 'Desde Bruto' : 'Desde Líquido'}`}
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setModoCalculadora('bruto');
                setResultadoCalculadora(null);
              }}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                modoCalculadora === 'bruto'
                  ? 'bg-[#1E3A5F] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Desde Bruto
            </button>
            <button
              onClick={() => {
                setModoCalculadora('liquido');
                setResultadoCalculadora(null);
              }}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                modoCalculadora === 'liquido'
                  ? 'bg-[#1E3A5F] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Desde Líquido
            </button>
          </div>

          <Input
            label={modoCalculadora === 'bruto' ? 'Monto Bruto' : 'Monto Líquido Deseado'}
            type="number"
            value={montoCalculadora || ''}
            onChange={(e) => setMontoCalculadora(Number(e.target.value))}
            placeholder="Ingrese el monto"
          />

          <Button className="w-full" onClick={calcular}>
            Calcular
          </Button>

          {resultadoCalculadora && (
            <div className="p-4 bg-emerald-50 rounded-lg space-y-3">
              <div className="flex justify-between">
                <span className="text-emerald-700">Honorario Bruto</span>
                <span className="font-semibold text-emerald-900">{formatCurrency(resultadoCalculadora.bruto)}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>Retención 13.75%</span>
                <span>- {formatCurrency(resultadoCalculadora.retencion)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t border-emerald-200 pt-3">
                <span className="text-emerald-700">Líquido a Pagar</span>
                <span className="text-emerald-900">{formatCurrency(resultadoCalculadora.liquido)}</span>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

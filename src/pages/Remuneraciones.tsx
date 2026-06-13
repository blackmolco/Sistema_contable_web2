import React, { useState } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Calculator,
  Download,
  FileText,
  Users,
  DollarSign,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Calendar,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card, Badge } from '../components/ui/Cards';
import { Button, Input, Select } from '../components/ui/FormElements';
import { Modal } from '../components/ui/Modal';
import { Trabajador, TipoContrato, EstadoTrabajador, LiquidacionPeriodo, LiquidacionLinea, ResultadoSueldoLiquido } from '../types';
import { AFP_DATA, ISAPRES, COTIZACIONES, UTM_2026_MAYO, UF_2026_MAYO_REFERENCIAL } from '../data/normativa';
import {
  formatCurrency,
  formatRUT,
  calcularSueldoLiquido,
  getNombreMes,
  generateId,
} from '../utils/calculos';
import { generarPDFLiquidacion, generarPDFLiquidacionDesdeLinea } from '../services/reportesPdf';
import { TrabajadorSchema, formatZodErrors } from '../utils/schemas';

export default function Remuneraciones() {
  const { state, dispatch, showToast } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [showModalTrabajador, setShowModalTrabajador] = useState(false);
  const [showModalLiquido, setShowModalLiquido] = useState(false);
  const [editingTrabajador, setEditingTrabajador] = useState<Trabajador | null>(null);
  const [trabajadorSeleccionado, setTrabajadorSeleccionado] = useState<Trabajador | null>(null);
  const [resultadoLiquido, setResultadoLiquido] = useState<ResultadoSueldoLiquido | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [filtroEstado, setFiltroEstado] = useState<EstadoTrabajador | 'todos'>('todos');
  const [procesandoMes, setProcesandoMes] = useState(new Date().getMonth() + 1);
  const [procesandoAnio, setProcesandoAnio] = useState(new Date().getFullYear());
  const [confirmEliminar, setConfirmEliminar] = useState<string | null>(null);
  const [periodoVista, setPeriodoVista] = useState<string | null>(null);
  const [showModalPrevio, setShowModalPrevio] = useState(false);

  // Ajustes variables por trabajador: anticipos y horas extras
  const [ajustesMap, setAjustesMap] = useState<Record<string, { anticipos: number; horasExtras: number; diasTrabajados: number }>>({})

  const trabajadoresActivos = state.trabajadores.filter(t => (t.estado ?? 'activo') === 'activo');

  // Formateador de montos en pesos chilenos (separador de miles con punto)
  const fmtPesos = (n: number | undefined) => formatCurrency(n ?? 0);
  const parsePesos = (s: string) => {
    const clean = s.replace(/\./g, '').replace(/[^\d]/g, '');
    return clean === '' ? 0 : parseInt(clean, 10);
  };

  const abrirModalPrevio = () => {
    if (trabajadoresActivos.length === 0) {
      showToast('warning', 'Sin trabajadores', 'No hay trabajadores activos para procesar');
      return;
    }
    // Inicializar ajustes con valores en 0 por cada trabajador activo
    const init: Record<string, { anticipos: number; horasExtras: number; diasTrabajados: number }> = {};
    trabajadoresActivos.forEach(t => {
      init[t.id] = ajustesMap[t.id] ?? { anticipos: 0, horasExtras: 0, diasTrabajados: 30 };
    });
    setAjustesMap(init);
    setShowModalPrevio(true);
  };

  const setAjuste = (id: string, campo: 'anticipos' | 'horasExtras' | 'diasTrabajados', valor: number) => {
    setAjustesMap(prev => ({ ...prev, [id]: { ...prev[id], [campo]: valor } }));
  };

  const liquidaciones: LiquidacionPeriodo[] = (state as any).liquidaciones ?? [];

  const procesarLiquidacionMes = () => {
    if (trabajadoresActivos.length === 0) {
      showToast('warning', 'Sin trabajadores', 'No hay trabajadores activos para procesar');
      return;
    }
    const periodoStr = `${procesandoAnio}-${String(procesandoMes).padStart(2, '0')}`;
    const lineas: LiquidacionLinea[] = trabajadoresActivos.map(t => {
      const afp = AFP_DATA.find(a => a.id === t.afpId);
      const comisionAfp = afp?.comisionVariable ?? 1.40;
      const cotizaAfp = afp?.cotizaAfp !== false; // false solo para 'afp_ninguna'
      const aj = ajustesMap[t.id] ?? { anticipos: 0, horasExtras: 0, diasTrabajados: 30 };
      const resultado = calcularSueldoLiquido({
        sueldoBase: t.sueldoBase,
        colacion: t.colacion ?? 0,
        movilizacion: t.movilizacion ?? 0,
        bonificacion: t.bonificacion ?? 0,
        comisionAfp,
        tipoContrato: t.tipoContrato,
        cargaCivil: t.cargaCivil ?? 0,
        cargaMilitar: t.cargaMilitar ?? 0,
        horasExtras: aj.horasExtras,
        anticipos: aj.anticipos,
        periodo: periodoStr,
        cotizaAfp,
        horasSemanales: t.horasSemanales,
      });
      const imponible = resultado.imponible;
      const gratificacion = resultado.gratificacion;
      // SIS empleador = 0 cuando no hay afiliación AFP
      const sisEmpleador = cotizaAfp
        ? Math.round(imponible * (COTIZACIONES.SIS_EMPLEADOR / 100))
        : 0;
      const afcEmpleadorTasa = t.tipoContrato === 'plazo'
        ? COTIZACIONES.AFC_EMPLEADOR_PLAZO
        : COTIZACIONES.AFC_EMPLEADOR_INDEFINIDO;
      const afcEmpleador = Math.round(imponible * (afcEmpleadorTasa / 100));
      const mutual = Math.round(imponible * 0.0093);
      const totalAportesEmpleador = sisEmpleador + afcEmpleador + mutual;
      const costoTotalEmpresa = resultado.totalHaberes + totalAportesEmpleador;
      return {
        trabajadorId: t.id,
        rut: t.rut,
        nombre: t.nombre,
        apellidos: t.apellidos,
        cargo: t.cargo,
        tipoContrato: t.tipoContrato,
        afpNombre: afp?.nombre ?? t.afpId,
        sueldoBase: t.sueldoBase,
        horasExtras: resultado.horasExtras ?? 0,
        montoHorasExtras: resultado.montoHorasExtras ?? 0,
        gratificacion,
        totalImponible: imponible,
        colacion: t.colacion ?? 0,
        movilizacion: t.movilizacion ?? 0,
        bonificacion: t.bonificacion ?? 0,
        totalHaberes: resultado.totalHaberes,
        afpAhorro: resultado.cotizaciones.afpAhorro,
        afpComision: resultado.cotizaciones.afpComision,
        totalAfp: resultado.cotizaciones.totalAfp,
        salud: resultado.cotizaciones.salud,
        afc: resultado.cotizaciones.afc,
        totalCotizaciones: resultado.cotizaciones.total,
        impuestoUnico: resultado.impuestoUnico,
        anticipos: aj.anticipos,
        totalDescuentos: resultado.cotizaciones.total + resultado.impuestoUnico + aj.anticipos,
        sueldoLiquido: resultado.sueldoLiquido,
        sisEmpleador,
        afcEmpleador,
        mutual,
        totalAportesEmpleador,
        costoTotalEmpresa,
        diasTrabajados: aj.diasTrabajados,
      };
    });
    const nuevaLiquidacion: LiquidacionPeriodo = {
      id: generateId(),
      periodo: periodoStr,
      fechaProceso: new Date().toISOString(),
      uf: UF_2026_MAYO_REFERENCIAL,
      utm: UTM_2026_MAYO,
      lineas,
    };
    dispatch({ type: 'ADD_LIQUIDACION', payload: nuevaLiquidacion } as any);
    setShowModalPrevio(false);
    setPeriodoVista(periodoStr);
    showToast('success', 'Liquidaciones procesadas', `${getNombreMes(procesandoMes)} ${procesandoAnio} — ${lineas.length} trabajadores`);
  };

  // Form state
  const [formData, setFormData] = useState<Partial<Trabajador>>({
    rut: '',
    nombre: '',
    apellidos: '',
    fechaNacimiento: '',
    cargo: '',
    departamento: '',
    fechaIngreso: '',
    tipoContrato: 'indefinido',
    sueldoBase: 500000,
    colacion: 50000,
    movilizacion: 35000,
    bonificacion: 0,
    afpId: 'afp_habitat',
    isapreId: 'fonasa',
    pensionado: false,
    cargaCivil: 0,
    cargaMilitar: 0,
    estado: 'activo',
    fechaTermino: '',
    horasSemanales: 42,
  });

  // Helpers de estado
  const ESTADO_CONFIG: Record<EstadoTrabajador, { label: string; color: string; dot: string }> = {
    activo:           { label: 'Activo',                color: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' },
    finiquitado:      { label: 'Finiquitado',           color: 'bg-red-100 text-red-800',         dot: 'bg-red-500'     },
    licencia:         { label: 'Licencia',              color: 'bg-amber-100 text-amber-800',     dot: 'bg-amber-500'   },
    permiso_sin_goce: { label: 'Permiso sin goce',      color: 'bg-gray-100 text-gray-700',       dot: 'bg-gray-400'    },
  };
  const getEstado = (t: Trabajador): EstadoTrabajador => t.estado ?? 'activo';

  // Conteo por estado
  const conteos = {
    todos:           state.trabajadores.length,
    activo:          state.trabajadores.filter(t => getEstado(t) === 'activo').length,
    licencia:        state.trabajadores.filter(t => getEstado(t) === 'licencia').length,
    permiso_sin_goce: state.trabajadores.filter(t => getEstado(t) === 'permiso_sin_goce').length,
    finiquitado:     state.trabajadores.filter(t => getEstado(t) === 'finiquitado').length,
  };

  // Filtrar trabajadores
  const trabajadoresFiltrados = state.trabajadores.filter((t) => {
    const matchesSearch =
      searchTerm === '' ||
      t.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.apellidos.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.rut.includes(searchTerm);
    const matchesEstado = filtroEstado === 'todos' || getEstado(t) === filtroEstado;
    return matchesSearch && matchesEstado;
  });

  const abrirModalNueva = () => {
    setEditingTrabajador(null);
    setFormData({
      rut: '',
      nombre: '',
      apellidos: '',
      fechaNacimiento: '',
      cargo: '',
      departamento: '',
      fechaIngreso: '',
      tipoContrato: 'indefinido',
      sueldoBase: 500000,
      colacion: 50000,
      movilizacion: 35000,
      bonificacion: 0,
      afpId: 'afp_habitat',
      isapreId: 'fonasa',
      pensionado: false,
      cargaCivil: 0,
      cargaMilitar: 0,
      estado: 'activo',
      fechaTermino: '',
      horasSemanales: 42,
    });
    setShowModalTrabajador(true);
  };

  const abrirModalEditar = (trabajador: Trabajador) => {
    setEditingTrabajador(trabajador);
    setFormData(trabajador);
    setShowModalTrabajador(true);
  };

  const abrirCalculoLiquido = (trabajador: Trabajador) => {
    setTrabajadorSeleccionado(trabajador);
    const afp = AFP_DATA.find((a) => a.id === trabajador.afpId);

    const resultado = calcularSueldoLiquido({
      sueldoBase: trabajador.sueldoBase,
      colacion: trabajador.colacion,
      movilizacion: trabajador.movilizacion,
      bonificacion: trabajador.bonificacion,
      comisionAfp: afp?.comisionFija || 1.27,
      tipoContrato: trabajador.tipoContrato,
      cargaCivil: trabajador.cargaCivil,
      cargaMilitar: trabajador.cargaMilitar,
      horasSemanales: trabajador.horasSemanales,
    });

    setResultadoLiquido(resultado);
    setShowModalLiquido(true);
  };

  const imprimirLiquidacion = () => {
    if (!trabajadorSeleccionado || !resultadoLiquido) return;
    const hoy = new Date();
    const mes = getNombreMes(hoy.getMonth() + 1);
    const anio = hoy.getFullYear();
    const periodoKey = `${anio}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    generarPDFLiquidacion(trabajadorSeleccionado, resultadoLiquido, `${mes} ${anio}`, state.configuracion, periodoKey);
  };

  const handleSubmit = () => {
    const result = TrabajadorSchema.safeParse({
      nombre: formData.nombre,
      apellidos: formData.apellidos,
      rut: formData.rut,
      cargo: formData.cargo,
      departamento: formData.departamento,
      fechaIngreso: formData.fechaIngreso,
      sueldoBase: formData.sueldoBase,
      afp: formData.afpId,
      salud: formData.isapreId === 'fonasa' ? 'fonasa' : 'isapre',
      contrato: formData.tipoContrato,
    });

    if (!result.success) {
      setFormErrors(formatZodErrors(result.error));
      showToast('error', 'Formulario inválido', 'Corrija los errores marcados');
      return;
    }
    setFormErrors({});

    if (editingTrabajador) {
      dispatch({
        type: 'UPDATE_TRABAJADOR',
        payload: { ...editingTrabajador, ...formData } as Trabajador,
      });
      showToast('success', 'Éxito', 'Trabajador actualizado correctamente');
    } else {
      const nuevoTrabajador: Trabajador = {
        id: `${Date.now()}`,
        ...formData,
      } as Trabajador;
      dispatch({ type: 'ADD_TRABAJADOR', payload: nuevoTrabajador });
      showToast('success', 'Éxito', 'Trabajador agregado correctamente');
    }

    setShowModalTrabajador(false);
  };

  const handleEliminar = (trabajador: Trabajador) => {
    dispatch({ type: 'DELETE_TRABAJADOR', payload: trabajador.id });
    showToast('success', 'Éxito', 'Trabajador eliminado correctamente');
  };

  const getNombreAFP = (id: string) => {
    const afp = AFP_DATA.find((a) => a.id === id);
    return afp?.nombre || id;
  };

  const getNombreIsapre = (id: string) => {
    const isapre = ISAPRES.find((i) => i.id === id);
    return isapre?.nombre || id;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Remuneraciones</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestión de personal y proceso de liquidaciones mensuales (normativa chilena)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button icon={<Plus size={16} />} onClick={abrirModalNueva}>
            Nuevo Trabajador
          </Button>
        </div>
      </div>

      {/* Panel Proceso de Liquidaciones */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-indigo-100 rounded-lg"><Calendar size={20} className="text-indigo-600" /></div>
          <div>
            <h2 className="font-semibold text-gray-800">Proceso de Liquidaciones Mensuales</h2>
            <p className="text-xs text-gray-500">Selecciona el mes y año, luego procesa para generar las liquidaciones de todos los trabajadores activos.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Mes a procesar</label>
            <select
              value={procesandoMes}
              onChange={e => setProcesandoMes(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              {['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((m,i) => (
                <option key={i+1} value={i+1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Año</label>
            <input
              type="number"
              value={procesandoAnio}
              onChange={e => setProcesandoAnio(Number(e.target.value))}
              className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <button
            onClick={abrirModalPrevio}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <PlayCircle size={18} /> Procesar Liquidaciones
          </button>
        </div>

        {/* Historial de períodos procesados */}
        {liquidaciones.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Períodos procesados</p>
            <div className="flex flex-wrap gap-2">
              {[...liquidaciones].sort((a,b) => b.periodo.localeCompare(a.periodo)).map(liq => {
                const [ay, am] = liq.periodo.split('-');
                const esVista = periodoVista === liq.periodo;
                return (
                  <div key={liq.periodo} className={`flex items-center gap-2 border rounded-lg px-3 py-1.5 transition-all ${
                    esVista ? 'bg-indigo-50 border-indigo-300' : 'bg-emerald-50 border-emerald-200'
                  }`}>
                    <CheckCircle2 size={14} className={esVista ? 'text-indigo-600' : 'text-emerald-600'} />
                    <span className={`text-sm font-medium ${esVista ? 'text-indigo-800' : 'text-emerald-800'}`}>{getNombreMes(Number(am))} {ay}</span>
                    <span className="text-xs text-gray-500">{liq.lineas.length} trab.</span>
                    <button
                      onClick={() => setPeriodoVista(esVista ? null : liq.periodo)}
                      className={`text-xs px-2 py-0.5 rounded font-medium transition-colors ${
                        esVista
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                    >
                      {esVista ? 'Cerrar' : 'Ver'}
                    </button>
                    <button
                      onClick={() => setConfirmEliminar(liq.periodo)}
                      className="ml-1 text-gray-400 hover:text-red-500 transition-colors"
                      title="Eliminar período"
                    >
                      <XCircle size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Vista de liquidaciones del período seleccionado */}
      {periodoVista && (() => {
        const liq = liquidaciones.find(l => l.periodo === periodoVista);
        if (!liq) return null;
        const [ay, am] = liq.periodo.split('-');
        const periodoLabel = `${getNombreMes(Number(am))} ${ay}`;
        const totLiquido = liq.lineas.reduce((s, l) => s + l.sueldoLiquido, 0);
        const totCosto = liq.lineas.reduce((s, l) => s + l.costoTotalEmpresa, 0);
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Liquidaciones — {periodoLabel}</h2>
                <p className="text-sm text-gray-500">
                  {liq.lineas.length} trabajadores · Total líquido: <strong className="text-emerald-700">{formatCurrency(totLiquido)}</strong> · Costo empresa: <strong className="text-purple-700">{formatCurrency(totCosto)}</strong>
                </p>
              </div>
              <button
                onClick={() => liq.lineas.forEach(l => generarPDFLiquidacionDesdeLinea(l, periodoLabel, state.configuracion, liq.periodo, liq.uf, liq.utm))}
                className="flex items-center gap-2 px-4 py-2 bg-[#1E3A5F] text-white rounded-lg text-sm font-medium hover:bg-[#2D5A87] transition-colors"
              >
                <Download size={16} /> Descargar Todos los PDFs
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {liq.lineas.map((linea, idx) => (
                <div key={idx} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                  {/* Header tarjeta */}
                  <div className="bg-[#1E3A5F] px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">
                        {linea.nombre[0]}{linea.apellidos[0]}
                      </div>
                      <div>
                        <p className="text-white font-semibold text-sm">{linea.nombre} {linea.apellidos}</p>
                        <p className="text-blue-200 text-xs">{linea.rut}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => generarPDFLiquidacionDesdeLinea(linea, periodoLabel, state.configuracion, liq.periodo, liq.uf, liq.utm)}
                      className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                      title="Descargar PDF"
                    >
                      <FileText size={16} />
                    </button>
                  </div>

                  {/* Cargo */}
                  <div className="px-4 pt-3 pb-1">
                    <p className="text-xs text-gray-500">{linea.cargo} · {linea.afpNombre} · {linea.diasTrabajados} días</p>
                  </div>

                  {/* Cifras principales */}
                  <div className="grid grid-cols-3 gap-0 border-t border-gray-100 mt-2">
                    <div className="px-3 py-3 text-center border-r border-gray-100">
                      <p className="text-xs text-gray-400 mb-0.5">Imponible</p>
                      <p className="text-sm font-semibold text-blue-700">{formatCurrency(linea.totalImponible)}</p>
                    </div>
                    <div className="px-3 py-3 text-center border-r border-gray-100">
                      <p className="text-xs text-gray-400 mb-0.5">Descuentos</p>
                      <p className="text-sm font-semibold text-red-600">{formatCurrency(linea.totalDescuentos)}</p>
                    </div>
                    <div className="px-3 py-3 text-center bg-emerald-50">
                      <p className="text-xs text-gray-400 mb-0.5">Líquido</p>
                      <p className="text-sm font-bold text-emerald-700">{formatCurrency(linea.sueldoLiquido)}</p>
                    </div>
                  </div>

                  {/* Detalle descuentos */}
                  <div className="px-4 py-3 space-y-1 border-t border-gray-100">
                    <div className="flex justify-between text-xs text-gray-500">
                    <span>AFP ({linea.afpNombre})</span><span>{formatCurrency(linea.totalAfp)}</span>

                      <span>Salud (7%)</span><span>{formatCurrency(linea.salud)}</span>

                      <span>AFC</span><span>{formatCurrency(linea.afc)}</span>

                      <span>Impuesto Único</span><span>{formatCurrency(linea.impuestoUnico)}</span>
                    </div>
                  </div>

                  {/* Costo empresa */}
                  <div className="px-4 py-2 bg-purple-50 border-t border-purple-100 flex justify-between items-center">
                    <span className="text-xs text-purple-600 font-medium">Costo Empresa</span>
                    <span className="text-sm font-bold text-purple-800">{formatCurrency(linea.costoTotalEmpresa)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{conteos.activo}</p>
              <p className="text-sm text-gray-500">Activos</p>
              {conteos.licencia + conteos.permiso_sin_goce > 0 && (
                <p className="text-xs text-amber-600 mt-0.5">
                  {conteos.licencia + conteos.permiso_sin_goce} con ausencia
                </p>
              )}
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 rounded-lg">
              <DollarSign size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(
                  state.trabajadores.reduce((sum, t) => sum + t.sueldoBase, 0)
                )}
              </p>
              <p className="text-sm text-gray-500">Total Sueldos</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 rounded-lg">
              <Calculator size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(
                  state.trabajadores.reduce((sum, t) => sum + t.sueldoBase, 0) * 1.3
                )}
              </p>
              <p className="text-sm text-gray-500">Costo Empresa</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <FileText size={20} className="text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(
                  state.trabajadores.reduce((sum, t) => sum + t.sueldoBase, 0) * 0.1
                )}
              </p>
              <p className="text-sm text-gray-500">Cotizaciones</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search + Filtro estado */}
      <Card padding="sm">
        <div className="space-y-3">
          <Input
            placeholder="Buscar por nombre, apellido o RUT..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search size={18} />}
          />
          {/* Tabs de estado */}
          <div className="flex flex-wrap gap-2">
            {([
              { key: 'todos',           label: 'Todos',              color: 'bg-gray-100 text-gray-700 hover:bg-gray-200'       },
              { key: 'activo',          label: 'Activos',            color: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' },
              { key: 'licencia',        label: 'Licencia',           color: 'bg-amber-100 text-amber-800 hover:bg-amber-200'    },
              { key: 'permiso_sin_goce',label: 'Permiso sin goce',   color: 'bg-gray-100 text-gray-700 hover:bg-gray-200'       },
              { key: 'finiquitado',     label: 'Finiquitados',       color: 'bg-red-100 text-red-800 hover:bg-red-200'          },
            ] as const).map(({ key, label, color }) => (
              <button
                key={key}
                onClick={() => setFiltroEstado(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${color} ${
                  filtroEstado === key ? 'ring-2 ring-offset-1 ring-current' : ''
                }`}
              >
                {label}
                <span className="ml-1.5 bg-white bg-opacity-60 rounded-full px-1.5 py-0.5 text-xs">
                  {conteos[key]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Lista de Trabajadores */}
      <Card padding="none">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Trabajador</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">RUT</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cargo</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">AFP</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Salud</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Estado</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Sueldo Base</th>
              <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {trabajadoresFiltrados.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center">
                  <Users className="mx-auto text-gray-300 mb-3" size={48} />
                  <p className="text-gray-500">No hay trabajadores registrados</p>
                  <Button className="mt-3" onClick={abrirModalNueva}>
                    Agregar Trabajador
                  </Button>
                </td>
              </tr>
            ) : (
              trabajadoresFiltrados.map((trabajador) => (
                <tr key={trabajador.id} className="hover:bg-gray-50">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#1E3A5F] rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {trabajador.nombre[0]}
                          {trabajador.apellidos[0]}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {trabajador.nombre} {trabajador.apellidos}
                        </p>
                        <p className="text-xs text-gray-500">{trabajador.departamento}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600">{formatRUT(trabajador.rut)}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">{trabajador.cargo}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">{getNombreAFP(trabajador.afpId)}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">{getNombreIsapre(trabajador.isapreId)}</td>
                  <td className="px-5 py-4">
                    {(() => {
                      const est = getEstado(trabajador);
                      const cfg = ESTADO_CONFIG[est];
                      return (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-5 py-4 text-right font-medium text-gray-900">{formatCurrency(trabajador.sueldoBase)}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => abrirCalculoLiquido(trabajador)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Calcular líquido"
                      >
                        <Calculator size={18} />
                      </button>
                      <button
                        onClick={() => abrirModalEditar(trabajador)}
                        className="p-2 text-gray-400 hover:text-[#1E3A5F] hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleEliminar(trabajador)}
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

      {/* Modal Trabajador */}
      <Modal
        isOpen={showModalTrabajador}
        onClose={() => setShowModalTrabajador(false)}
        title={editingTrabajador ? 'Editar Trabajador' : 'Nuevo Trabajador'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModalTrabajador(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>{editingTrabajador ? 'Actualizar' : 'Guardar'}</Button>
          </>
        }
      >
        <div className="space-y-6">
          {/* Datos Personales */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Datos Personales</h3>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="RUT"
                value={formData.rut || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, rut: e.target.value }))}
                placeholder="12345678-9"
              />
              <Input
                label="Fecha de Nacimiento"
                type="date"
                value={formData.fechaNacimiento || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, fechaNacimiento: e.target.value }))}
              />
              <Input
                label="Nombre"
                value={formData.nombre || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
              />
              <Input
                label="Apellidos"
                value={formData.apellidos || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, apellidos: e.target.value }))}
              />
            </div>
          </div>

          {/* Datos Laborales */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Datos Laborales</h3>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Cargo"
                value={formData.cargo || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, cargo: e.target.value }))}
              />
              <Input
                label="Departamento"
                value={formData.departamento || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, departamento: e.target.value }))}
              />
              <Input
                label="Fecha de Ingreso"
                type="date"
                value={formData.fechaIngreso || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, fechaIngreso: e.target.value }))}
              />
              <Select
                label="Tipo de Contrato"
                value={formData.tipoContrato || 'indefinido'}
                onChange={(e) => setFormData(prev => ({ ...prev, tipoContrato: e.target.value as TipoContrato }))}
                options={[
                  { value: 'indefinido', label: 'Indefinido' },
                  { value: 'plazo', label: 'A Plazo Fijo' },
                  { value: 'honorarios', label: 'Honorarios' },
                ]}
              />
              {/* Estado — select nativo para evitar conflictos de id */}
              <div className="w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Estado
                </label>
                <select
                  value={formData.estado ?? 'activo'}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    estado: e.target.value as EstadoTrabajador,
                  }))}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F] cursor-pointer"
                >
                  <option value="activo">Activo</option>
                  <option value="licencia">Licencia médica</option>
                  <option value="permiso_sin_goce">Permiso sin goce de sueldo</option>
                  <option value="finiquitado">Finiquitado</option>
                </select>
              </div>
              {formData.estado === 'finiquitado' && (
                <Input
                  label="Fecha de término"
                  type="date"
                  value={formData.fechaTermino || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, fechaTermino: e.target.value }))}
                />
              )}
            </div>
          </div>

          {/* Remuneración */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Remuneración</h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Inputs monetarios con formato miles chileno ($500.000) */}
              {[
                { label: 'Sueldo Base', field: 'sueldoBase' as const },
                { label: 'Colación', field: 'colacion' as const },
                { label: 'Movilización', field: 'movilizacion' as const },
                { label: 'Bonificación', field: 'bonificacion' as const },
              ].map(({ label, field }) => (
                <div key={field} className="w-full">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={fmtPesos(formData[field] as number)}
                      onChange={(e) => setFormData(prev => ({ ...prev, [field]: parsePesos(e.target.value) }))}
                      className="w-full pl-6 pr-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F] text-right"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Previsionales */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Cotizaciones Previsionales</h3>
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="AFP"
                value={formData.afpId || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, afpId: e.target.value }))}
                options={AFP_DATA.map((afp) => ({
                  value: afp.id,
                  label: afp.cotizaAfp === false
                    ? afp.nombre
                    : `${afp.nombre} (${afp.comisionFija}%)`,
                }))}
              />
              <Select
                label="Salud"
                value={formData.isapreId || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, isapreId: e.target.value }))}
                options={ISAPRES.map((isapre) => ({
                  value: isapre.id,
                  label: isapre.nombre,
                }))}
              />
              <Input
                label="Cargas Civiles"
                type="number"
                value={formData.cargaCivil || 0}
                onChange={(e) => setFormData(prev => ({ ...prev, cargaCivil: Number(e.target.value) }))}
              />
              <Input
                label="Cargas Militares"
                type="number"
                value={formData.cargaMilitar || 0}
                onChange={(e) => setFormData(prev => ({ ...prev, cargaMilitar: Number(e.target.value) }))}
              />
              <Select
                label="Jornada Semanal (Horas)"
                value={String(formData.horasSemanales || 42)}
                onChange={(e) => setFormData(prev => ({ ...prev, horasSemanales: Number(e.target.value) }))}
                options={[
                  { value: '45', label: '45 Horas (Jornada Antigua)' },
                  { value: '44', label: '44 Horas (Transición)' },
                  { value: '42', label: '42 Horas (Vigente 2026)' },
                  { value: '40', label: '40 Horas (Ley 40 Horas)' },
                ]}
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal Cálculo Sueldo Líquido */}
      <Modal
        isOpen={showModalLiquido}
        onClose={() => setShowModalLiquido(false)}
        title={`Cálculo Sueldo Líquido - ${trabajadorSeleccionado?.nombre} ${trabajadorSeleccionado?.apellidos}`}
        size="lg"
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setShowModalLiquido(false)}>Cerrar</Button>
            <Button
              icon={<Download size={16} />}
              onClick={imprimirLiquidacion}
            >
              Imprimir / PDF
            </Button>
          </div>
        }
      >
        {resultadoLiquido && (
          <div className="space-y-6">
            {/* Encabezado Resumen */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-3 text-center border">
                <p className="text-xs text-gray-500 mb-1">Sueldo Base</p>
                <p className="text-lg font-bold text-gray-800">{formatCurrency(resultadoLiquido.sueldoBruto)}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-100">
                <p className="text-xs text-blue-600 mb-1">Total Haberes</p>
                <p className="text-lg font-bold text-blue-900">{formatCurrency(resultadoLiquido.totalHaberes)}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center border border-red-100">
                <p className="text-xs text-red-600 mb-1">Total Descuentos</p>
                <p className="text-lg font-bold text-red-900">{formatCurrency(resultadoLiquido.totalHaberes + resultadoLiquido.asignacionFamiliar - resultadoLiquido.sueldoLiquido)}</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3 text-center border border-emerald-100 shadow-sm">
                <p className="text-xs text-emerald-600 mb-1">Alcance Líquido</p>
                <p className="text-xl font-bold text-emerald-900">{formatCurrency(resultadoLiquido.sueldoLiquido)}</p>
              </div>
            </div>

            {/* Detalle Haberes y Descuentos */}
            <div className="grid grid-cols-2 gap-6">
              {/* Columna Haberes */}
              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-2 border-b pb-1">HABERES</h3>
                <div className="space-y-1">
                  {resultadoLiquido.desglose.filter(d => d.tipo === 'haber').map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm py-1">
                      <span className="text-gray-600">{item.concepto}</span>
                      <span className="font-medium text-gray-900">{formatCurrency(item.monto)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm py-2 mt-2 border-t font-bold text-blue-800">
                    <span>TOTAL HABERES</span>
                    <span>{formatCurrency(resultadoLiquido.totalHaberes + resultadoLiquido.asignacionFamiliar)}</span>
                  </div>
                </div>
              </div>

              {/* Columna Descuentos */}
              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-2 border-b pb-1">DESCUENTOS</h3>
                <div className="space-y-1">
                  {resultadoLiquido.desglose.filter(d => d.tipo === 'descuento').map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm py-1">
                      <span className="text-gray-600">{item.concepto}</span>
                      <span className="font-medium text-gray-900">{formatCurrency(item.monto)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm py-2 mt-2 border-t font-bold text-red-800">
                    <span>TOTAL DESCUENTOS</span>
                    <span>{formatCurrency(resultadoLiquido.totalHaberes + resultadoLiquido.asignacionFamiliar - resultadoLiquido.sueldoLiquido)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Base Tributable y Tramo */}
            <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border text-sm">
              <div>
                <span className="text-gray-500 mr-2">Base Imponible:</span>
                <span className="font-medium">{formatCurrency(resultadoLiquido.imponible)}</span>
              </div>
              <div>
                <span className="text-gray-500 mr-2">Base Tributable:</span>
                <span className="font-medium">{formatCurrency(resultadoLiquido.sueldoImponible)}</span>
              </div>
              {resultadoLiquido.detalleImpuesto && (
                <div>
                  <span className="text-gray-500 mr-2">Tramo Impuesto:</span>
                  <Badge variant="info">{resultadoLiquido.detalleImpuesto.nombre}</Badge>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Previo — Datos variables antes de procesar */}
      <Modal
        isOpen={showModalPrevio}
        onClose={() => setShowModalPrevio(false)}
        title={`Datos variables — ${getNombreMes(procesandoMes)} ${procesandoAnio}`}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModalPrevio(false)}>Cancelar</Button>
            <Button icon={<PlayCircle size={16} />} onClick={procesarLiquidacionMes}>
              Procesar Liquidaciones
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <strong>Revisa los datos variables del período.</strong> Ingresa anticipos y/o horas extras si corresponde. Los campos en blanco se consideran $0 / 0 horas.
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Trabajador</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Sueldo Base</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase">Días Trab.</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-amber-700 uppercase bg-amber-50">HH. Extras</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-red-700 uppercase bg-red-50">Anticipos ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {trabajadoresActivos.map(t => {
                  const aj = ajustesMap[t.id] ?? { anticipos: 0, horasExtras: 0, diasTrabajados: 30 };
                  return (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#1E3A5F] flex items-center justify-center text-white text-xs font-bold">
                            {t.nombre[0]}{t.apellidos[0]}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{t.nombre} {t.apellidos}</p>
                            <p className="text-xs text-gray-400">{t.cargo}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-gray-700">{formatCurrency(t.sueldoBase)}</td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={aj.diasTrabajados}
                          onChange={e => setAjuste(t.id, 'diasTrabajados', Number(e.target.value))}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        />
                      </td>
                      <td className="px-3 py-2 text-center bg-amber-50/30">
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          value={aj.horasExtras}
                          onChange={e => setAjuste(t.id, 'horasExtras', Number(e.target.value))}
                          className="w-20 px-2 py-1 border border-amber-300 rounded text-center text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-3 py-2 text-center bg-red-50/30">
                        <div className="relative inline-flex items-center">
                          <span className="absolute left-2 text-gray-400 text-xs">$</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={fmtPesos(aj.anticipos)}
                            onChange={e => setAjuste(t.id, 'anticipos', parsePesos(e.target.value))}
                            className="w-32 pl-5 pr-2 py-1 border border-red-300 rounded text-right text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                            placeholder="0"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-400">
            Las horas extras se calculan con recargo 50% (Art. 32 CT). La gratificación legal (25% sueldo base, tope $213.354) se incluye automáticamente en el imponible.
          </p>
        </div>
      </Modal>

      {/* Confirm eliminar período */}
      {confirmEliminar && (
        <Modal
          isOpen={!!confirmEliminar}
          onClose={() => setConfirmEliminar(null)}
          title="Eliminar período"
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmEliminar(null)}>Cancelar</Button>
              <Button variant="danger" onClick={() => {
                dispatch({ type: 'DELETE_LIQUIDACION', payload: confirmEliminar } as any);
                showToast('success', 'Período eliminado', confirmEliminar);
                setConfirmEliminar(null);
              }}>Eliminar</Button>
            </>
          }
        >
          <p className="text-gray-600">¿Eliminar las liquidaciones del período <strong>{confirmEliminar}</strong>? Esta acción no se puede deshacer.</p>
        </Modal>
      )}
    </div>
  );
}


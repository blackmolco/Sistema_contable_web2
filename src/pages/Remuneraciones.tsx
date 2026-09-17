import React, { useState, useEffect, useCallback } from 'react';
import { Wallet, Plus, Save, Calculator, Landmark, ChevronDown, ChevronUp, CheckCircle2, Pencil, Trash2, Search, History, FileDown, Undo2 } from 'lucide-react';
import { Card } from '../components/ui/Cards';
import { Button, Input, SearchSelect } from '../components/ui/FormElements';
import { Modal } from '../components/ui/Modal';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { formatCurrency } from '../utils/calculos';
import { useApp } from '../context/AppContext';
import { useAppStore } from '../stores/appStore';
import { useAuthStore } from '../stores/authStore';
import { apiFetch, apiFetchRaw } from '../services/httpClient';
import { getErrorMessage } from '../services/errorHandler';
import { AFP_DATA, UF_2026_MAYO_REFERENCIAL, UTM_2026_MAYO, SUELDO_MINIMO, ASIGNACION_FAMILIAR, COTIZACIONES } from '../data/normativa';
import { generarPDFLiquidacionRemuneraciones } from '../services/reportesPdf';

interface Trabajador {
  id: string;
  rut: string;
  nombres: string;
  apellidos: string;
  cargo: string | null;
  fechaIngreso: string;
  tipoContrato: string;
  sueldoBase: number;
  colacion: number;
  movilizacion: number;
  afp: string;
  tasaAfp: number;
  isapre: string | null;
  saludPactado: number;
  tramoAsignacionFamiliar: 'A' | 'B' | 'C' | 'D';
  cargasSimples: number;
  cargasMaternales: number;
  cargasInvalidez: number;
  tipoTrabajadorPrevired: string;
  estado: string;
}

interface Indice {
  periodo: string;
  valorUf: number;
  valorUtm: number;
  sueldoMinimo: number;
  topeAfpSaludUf: number;
  topeCesantiaUf: number;
  tasaSis: number;
  valorTramoA: number;
  valorTramoB: number;
  valorTramoC: number;
}

interface EmpresaInfo {
  id: string;
  razonSocial: string;
  rut: string;
  mutualNombre: string | null;
  mutualTasaPct: number | null;
}

interface CuentaConcepto {
  concepto: string;
  label: string;
  codigoDefault: string;
  cuentaId: string | null;
  cuentaCodigo: string | null;
  cuentaNombre: string | null;
  esPersonalizada: boolean;
}

interface CuentaOpcion {
  id: string;
  codigo: string;
  nombre: string;
}

interface Liquidacion {
  id: string;
  trabajadorId: string;
  periodo: string;
  sueldoBase: number;
  horasExtras: number;
  montoHorasExtras: number;
  gratificacion: number;
  colacion: number;
  movilizacion: number;
  asignacionFamiliar: number;
  totalHaberes?: number;
  totalImponible: number;
  descuentoAFP: number;
  descuentoSalud: number;
  descuentoAFC: number;
  descuentoImpuesto: number;
  anticipos: number;
  prestamos: number;
  totalDescuentos: number;
  sueldoLiquido: number;
  estado: string;
  asientoId: string | null;
}

const periodoActual = () => new Date().toISOString().slice(0, 7);

const initialTrabajadorForm = {
  rut: '', nombres: '', apellidos: '', cargo: '', fechaIngreso: new Date().toISOString().split('T')[0],
  tipoContrato: 'indefinido', sueldoBase: '', colacion: 0, movilizacion: 0,
  afp: AFP_DATA[0]?.nombre || '', tasaAfp: (10 + (AFP_DATA[0]?.comisionFija || 0)) / 100,
  esFonasa: true, isapre: '', saludPactado: 0,
  tramoAsignacionFamiliar: 'D' as 'A' | 'B' | 'C' | 'D', cargasSimples: 0, cargasMaternales: 0, cargasInvalidez: 0,
  tipoTrabajadorPrevired: '0',
};

const initialIndicesForm = {
  valorUf: UF_2026_MAYO_REFERENCIAL, valorUtm: UTM_2026_MAYO, sueldoMinimo: SUELDO_MINIMO.GENERAL,
  topeAfpSaludUf: 90, topeCesantiaUf: 135.2, tasaSis: COTIZACIONES.SIS_EMPLEADOR / 100,
  valorTramoA: ASIGNACION_FAMILIAR.TRAMO_A.monto, valorTramoB: ASIGNACION_FAMILIAR.TRAMO_B.monto, valorTramoC: ASIGNACION_FAMILIAR.TRAMO_C.monto,
};

const initialEntradaForm = { diasTrabajados: 30, bonos: 0, aguinaldo: 0, horasExtra: 0, anticipos: 0, prestamos: 0 };

const MUTUALES = ['ACHS', 'Mutual de Seguridad CChC', 'IST', 'ISL (Estado)', 'Otra'];
const initialMutualForm = { mutualNombre: MUTUALES[0], mutualTasaPct: 0.90 };

export default function Remuneraciones() {
  const { showToast } = useApp();
  const confirmDialog = useConfirm();
  const empresaId = useAppStore(s => s.empresaActiva?.id ?? null);
  const rol = useAuthStore(s => s.user?.rol);
  const esAdminGlobal = rol === 'admin' || rol === 'administrador';
  // Mutual es config "de administrador de la empresa": admin global o el
  // supervisor de esa misma empresa pueden editarla (igual que Usuarios,
  // Periodos y Auditoría — ver backend/routes/empresas.js).
  const puedeConfigurarMutual = esAdminGlobal || rol === 'supervisor';

  const [periodo, setPeriodo] = useState(periodoActual());
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [liquidaciones, setLiquidaciones] = useState<Record<string, Liquidacion>>({});
  const [indice, setIndice] = useState<Indice | null | undefined>(undefined); // undefined = cargando
  const [loading, setLoading] = useState(false);

  const [mostrarFormTrabajador, setMostrarFormTrabajador] = useState(false);
  const [formTrabajador, setFormTrabajador] = useState(initialTrabajadorForm);
  const [guardandoTrabajador, setGuardandoTrabajador] = useState(false);
  const [editandoTrabajadorId, setEditandoTrabajadorId] = useState<string | null>(null);
  const [cambiandoEstadoId, setCambiandoEstadoId] = useState<string | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

  const [mostrarFormIndices, setMostrarFormIndices] = useState(false);
  const [formIndices, setFormIndices] = useState(initialIndicesForm);
  const [guardandoIndices, setGuardandoIndices] = useState(false);

  const [mutual, setMutual] = useState<EmpresaInfo | null>(null);
  const [mostrarFormMutual, setMostrarFormMutual] = useState(false);
  const [formMutual, setFormMutual] = useState(initialMutualForm);
  const [guardandoMutual, setGuardandoMutual] = useState(false);

  const [filaAbierta, setFilaAbierta] = useState<string | null>(null);
  const [entradas, setEntradas] = useState<Record<string, typeof initialEntradaForm>>({});
  const [calculando, setCalculando] = useState<string | null>(null);

  const [centralizando, setCentralizando] = useState(false);
  const [descentralizando, setDescentralizando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [historialTrabajador, setHistorialTrabajador] = useState<Trabajador | null>(null);
  const [historialLiquidaciones, setHistorialLiquidaciones] = useState<Liquidacion[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [generandoPdfId, setGenerandoPdfId] = useState<string | null>(null);
  const [eliminandoLiqId, setEliminandoLiqId] = useState<string | null>(null);

  const [cuentasConfig, setCuentasConfig] = useState<CuentaConcepto[]>([]);
  const [cuentasDisponibles, setCuentasDisponibles] = useState<CuentaOpcion[]>([]);
  const [mostrarCuentasConfig, setMostrarCuentasConfig] = useState(false);
  const [guardandoConcepto, setGuardandoConcepto] = useState<string | null>(null);

  const cargarTodo = useCallback(async () => {
    if (!empresaId) { setTrabajadores([]); return; }
    setLoading(true);
    try {
      const [dataTrab, dataIndice, dataLiq, dataEmpresas] = await Promise.all([
        apiFetch<Trabajador[] | { data: Trabajador[] }>(`/api/trabajadores?empresaId=${encodeURIComponent(empresaId)}`),
        apiFetch<Indice | null>(`/api/indices-previsionales?periodo=${periodo}`),
        apiFetch<Liquidacion[] | { data: Liquidacion[] }>(`/api/trabajadores/liquidaciones?empresaId=${encodeURIComponent(empresaId)}&periodo=${periodo}`),
        apiFetch<EmpresaInfo[]>('/api/empresas'),
      ]);
      setTrabajadores(Array.isArray(dataTrab) ? dataTrab : (dataTrab as { data: Trabajador[] }).data ?? []);
      setIndice(dataIndice ?? null);
      const liqArray = Array.isArray(dataLiq) ? dataLiq : (dataLiq as { data: Liquidacion[] }).data ?? [];
      setLiquidaciones(Object.fromEntries(liqArray.map(l => [l.trabajadorId, l])));
      setMutual(dataEmpresas.find(e => e.id === empresaId) ?? null);
    } catch (err) {
      showToast('error', 'Error', `No se pudo cargar la información: ${getErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, periodo]);

  useEffect(() => { cargarTodo(); }, [cargarTodo]);

  const cargarCuentasConfig = useCallback(async () => {
    if (!empresaId) return;
    try {
      const [config, cuentas] = await Promise.all([
        apiFetch<CuentaConcepto[]>(`/api/empresas/${empresaId}/cuentas-remuneraciones`),
        apiFetch<CuentaOpcion[] | { data: CuentaOpcion[] }>(`/api/cuentas?empresaId=${encodeURIComponent(empresaId)}&limit=100`),
      ]);
      setCuentasConfig(config);
      setCuentasDisponibles(Array.isArray(cuentas) ? cuentas : (cuentas as { data: CuentaOpcion[] }).data ?? []);
    } catch (err) {
      showToast('error', 'Error', `No se pudo cargar la configuración de cuentas: ${getErrorMessage(err)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  useEffect(() => { if (mostrarCuentasConfig) cargarCuentasConfig(); }, [mostrarCuentasConfig, cargarCuentasConfig]);

  const guardarCuentaConcepto = async (concepto: string, cuentaId: string) => {
    if (!empresaId) return;
    setGuardandoConcepto(concepto);
    try {
      const res = await apiFetchRaw(`/api/empresas/${empresaId}/cuentas-remuneraciones`, {
        method: 'PATCH',
        body: JSON.stringify({ [concepto]: cuentaId || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      cargarCuentasConfig();
    } catch (err) {
      showToast('error', 'Error al guardar', getErrorMessage(err));
    } finally {
      setGuardandoConcepto(null);
    }
  };

  const guardarTrabajador = async () => {
    if (!formTrabajador.rut || !formTrabajador.nombres || !formTrabajador.apellidos || !formTrabajador.sueldoBase) {
      showToast('error', 'Datos incompletos', 'RUT, nombres, apellidos y sueldo base son obligatorios.');
      return;
    }
    if (!empresaId) { showToast('error', 'Sin empresa', 'Selecciona una empresa primero.'); return; }
    setGuardandoTrabajador(true);
    try {
      const body = {
        rut: formTrabajador.rut,
        nombres: formTrabajador.nombres,
        apellidos: formTrabajador.apellidos,
        cargo: formTrabajador.cargo || null,
        fechaIngreso: formTrabajador.fechaIngreso,
        tipoContrato: formTrabajador.tipoContrato,
        sueldoBase: Number(formTrabajador.sueldoBase),
        colacion: Number(formTrabajador.colacion) || 0,
        movilizacion: Number(formTrabajador.movilizacion) || 0,
        afp: formTrabajador.afp,
        tasaAfp: Number(formTrabajador.tasaAfp),
        isapre: formTrabajador.esFonasa ? null : (formTrabajador.isapre || null),
        saludPactado: formTrabajador.esFonasa ? 0 : Number(formTrabajador.saludPactado) || 0,
        tramoAsignacionFamiliar: formTrabajador.tramoAsignacionFamiliar,
        cargasSimples: Number(formTrabajador.cargasSimples) || 0,
        cargasMaternales: Number(formTrabajador.cargasMaternales) || 0,
        cargasInvalidez: Number(formTrabajador.cargasInvalidez) || 0,
        tipoTrabajadorPrevired: formTrabajador.tipoTrabajadorPrevired,
        empresaId,
      };
      const editando = editandoTrabajadorId;
      const res = await apiFetchRaw(editando ? `/api/trabajadores/${editando}` : '/api/trabajadores', {
        method: editando ? 'PUT' : 'POST',
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      setTrabajadores(t => editando ? t.map(x => x.id === editando ? data : x) : [...t, data]);
      setMostrarFormTrabajador(false);
      setEditandoTrabajadorId(null);
      setFormTrabajador(initialTrabajadorForm);
      showToast('success', editando ? 'Trabajador actualizado' : 'Trabajador agregado', `${data.nombres} ${data.apellidos} quedó ${editando ? 'actualizado' : 'registrado'}.`);
    } catch (err) {
      showToast('error', 'Error al guardar', getErrorMessage(err));
    } finally {
      setGuardandoTrabajador(false);
    }
  };

  const iniciarEdicionTrabajador = (t: Trabajador) => {
    setEditandoTrabajadorId(t.id);
    setFormTrabajador({
      rut: t.rut, nombres: t.nombres, apellidos: t.apellidos, cargo: t.cargo || '', fechaIngreso: t.fechaIngreso.slice(0, 10),
      tipoContrato: t.tipoContrato, sueldoBase: String(t.sueldoBase), colacion: t.colacion, movilizacion: t.movilizacion,
      afp: t.afp, tasaAfp: t.tasaAfp,
      esFonasa: !t.isapre, isapre: t.isapre || '', saludPactado: t.saludPactado,
      tramoAsignacionFamiliar: t.tramoAsignacionFamiliar, cargasSimples: t.cargasSimples, cargasMaternales: t.cargasMaternales, cargasInvalidez: t.cargasInvalidez,
      tipoTrabajadorPrevired: t.tipoTrabajadorPrevired,
    });
    setMostrarFormTrabajador(true);
  };

  const cambiarEstadoTrabajador = async (t: Trabajador, nuevoEstado: string) => {
    setCambiandoEstadoId(t.id);
    try {
      const res = await apiFetchRaw(`/api/trabajadores/${t.id}`, { method: 'PUT', body: JSON.stringify({ estado: nuevoEstado }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      setTrabajadores(ts => ts.map(x => x.id === t.id ? data : x));
    } catch (err) {
      showToast('error', 'Error al cambiar estado', getErrorMessage(err));
    } finally {
      setCambiandoEstadoId(null);
    }
  };

  const eliminarTrabajador = async (t: Trabajador) => {
    const ok = await confirmDialog({
      title: 'Eliminar trabajador',
      message: `¿Eliminar a ${t.nombres} ${t.apellidos}? Si ya tiene liquidaciones registradas no se puede borrar sin perder ese historial — en ese caso se marcará como desvinculado en vez de eliminarse.`,
      confirmText: 'Eliminar',
      variant: 'danger',
    });
    if (!ok) return;
    setEliminandoId(t.id);
    try {
      const res = await apiFetchRaw(`/api/trabajadores/${t.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      if (data.borrado) {
        setTrabajadores(ts => ts.filter(x => x.id !== t.id));
        showToast('success', 'Trabajador eliminado', `${t.nombres} ${t.apellidos} fue eliminado.`);
      } else {
        showToast('warning', 'No se pudo eliminar', data.message);
        cargarTodo();
      }
    } catch (err) {
      showToast('error', 'Error al eliminar', getErrorMessage(err));
    } finally {
      setEliminandoId(null);
    }
  };

  const guardarIndices = async () => {
    setGuardandoIndices(true);
    try {
      const res = await apiFetchRaw('/api/indices-previsionales', { method: 'POST', body: JSON.stringify({ periodo, ...formIndices }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      setIndice(data);
      setMostrarFormIndices(false);
      showToast('success', 'Índices cargados', `Índices previsionales de ${periodo} guardados.`);
    } catch (err) {
      showToast('error', 'Error al guardar', getErrorMessage(err));
    } finally {
      setGuardandoIndices(false);
    }
  };

  const guardarMutual = async () => {
    if (!empresaId) return;
    setGuardandoMutual(true);
    try {
      const res = await apiFetchRaw(`/api/empresas/${empresaId}/mutual`, { method: 'PATCH', body: JSON.stringify(formMutual) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      setMutual(data);
      setMostrarFormMutual(false);
      showToast('success', 'Mutual actualizada', `Se guardó ${formMutual.mutualNombre} — ${formMutual.mutualTasaPct}%.`);
    } catch (err) {
      showToast('error', 'Error al guardar', getErrorMessage(err));
    } finally {
      setGuardandoMutual(false);
    }
  };

  const abrirFila = (trabajadorId: string) => {
    setFilaAbierta(actual => actual === trabajadorId ? null : trabajadorId);
    setEntradas(e => e[trabajadorId] ? e : { ...e, [trabajadorId]: initialEntradaForm });
  };

  const calcularLiquidacion = async (trabajadorId: string) => {
    if (!empresaId || !indice) return;
    setCalculando(trabajadorId);
    try {
      const entrada = entradas[trabajadorId] || initialEntradaForm;
      const body = { trabajadorId, periodo, empresaId, ...entrada };
      const res = await apiFetchRaw('/api/trabajadores/liquidaciones/calcular', { method: 'POST', body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      setLiquidaciones(l => ({ ...l, [trabajadorId]: data }));
      showToast('success', 'Liquidación calculada', `Líquido a pagar: ${formatCurrency(data.sueldoLiquido)}`);
    } catch (err) {
      showToast('error', 'Error al calcular', getErrorMessage(err));
    } finally {
      setCalculando(null);
    }
  };

  const centralizar = async () => {
    if (!empresaId) return;
    const pendientes = trabajadores.filter(t => liquidaciones[t.id] && !liquidaciones[t.id].asientoId);
    if (pendientes.length === 0) {
      showToast('warning', 'Nada que centralizar', 'No hay liquidaciones calculadas y sin centralizar para este período.');
      return;
    }
    setCentralizando(true);
    try {
      const res = await apiFetchRaw('/api/trabajadores/liquidaciones/centralizar', { method: 'POST', body: JSON.stringify({ empresaId, periodo }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      showToast('success', 'Remuneraciones centralizadas', `Asiento N° ${data.numero} generado con ${pendientes.length} liquidación(es).`);
      cargarTodo();
    } catch (err) {
      showToast('error', 'Error al centralizar', getErrorMessage(err));
    } finally {
      setCentralizando(false);
    }
  };

  const descentralizar = async () => {
    if (!empresaId) return;
    const ok = await confirmDialog({
      title: 'Deshacer centralización',
      message: `Esto anula el asiento contable de ${periodo} y libera esas liquidaciones para que se puedan recalcular. Solo funciona si el período contable sigue abierto.`,
      confirmText: 'Deshacer',
      variant: 'warning',
    });
    if (!ok) return;
    setDescentralizando(true);
    try {
      const res = await apiFetchRaw('/api/trabajadores/liquidaciones/descentralizar', { method: 'POST', body: JSON.stringify({ empresaId, periodo }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      showToast('success', 'Centralización deshecha', `Se liberaron ${data.liquidacionesLiberadas} liquidación(es) de ${periodo}.`);
      cargarTodo();
    } catch (err) {
      showToast('error', 'Error al descentralizar', getErrorMessage(err));
    } finally {
      setDescentralizando(false);
    }
  };

  const verHistorial = async (t: Trabajador) => {
    setHistorialTrabajador(t);
    setCargandoHistorial(true);
    try {
      const data = await apiFetch<Liquidacion[] | { data: Liquidacion[] }>(`/api/trabajadores/liquidaciones?trabajadorId=${t.id}`);
      setHistorialLiquidaciones(Array.isArray(data) ? data : (data as { data: Liquidacion[] }).data ?? []);
    } catch (err) {
      showToast('error', 'Error', `No se pudo cargar el historial: ${getErrorMessage(err)}`);
    } finally {
      setCargandoHistorial(false);
    }
  };

  const descargarPdf = async (t: Trabajador, liq: Liquidacion) => {
    setGenerandoPdfId(t.id);
    try {
      // Los índices del período de la liquidación, no los del selector de
      // arriba — pueden no coincidir si se descarga desde el historial.
      const indiceDelPeriodo = liq.periodo === periodo && indice ? indice : await apiFetch<Indice | null>(`/api/indices-previsionales?periodo=${liq.periodo}`);
      if (!indiceDelPeriodo) {
        showToast('error', 'Faltan índices', `No hay índices previsionales cargados para ${liq.periodo}.`);
        return;
      }
      generarPDFLiquidacionRemuneraciones(t, liq, liq.periodo, mutual, indiceDelPeriodo);
    } catch (err) {
      showToast('error', 'Error al generar PDF', getErrorMessage(err));
    } finally {
      setGenerandoPdfId(null);
    }
  };

  const eliminarLiquidacion = async (t: Trabajador, liq: Liquidacion) => {
    const ok = await confirmDialog({
      title: 'Eliminar liquidación',
      message: `¿Eliminar la liquidación de ${liq.periodo} de ${t.nombres} ${t.apellidos}? Se puede volver a calcular después si hace falta.`,
      confirmText: 'Eliminar',
      variant: 'danger',
    });
    if (!ok) return;
    setEliminandoLiqId(liq.id);
    try {
      const res = await apiFetchRaw(`/api/trabajadores/liquidaciones/${liq.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      setLiquidaciones(ls => { const next = { ...ls }; delete next[t.id]; return next; });
      showToast('success', 'Liquidación eliminada', `Se eliminó la liquidación de ${liq.periodo}.`);
    } catch (err) {
      showToast('error', 'Error al eliminar', getErrorMessage(err));
    } finally {
      setEliminandoLiqId(null);
    }
  };

  const totalCalculadas = trabajadores.filter(t => liquidaciones[t.id]).length;
  const totalPendientesCentralizar = trabajadores.filter(t => liquidaciones[t.id] && !liquidaciones[t.id].asientoId).length;
  const totalCentralizados = trabajadores.filter(t => liquidaciones[t.id]?.asientoId).length;
  const busquedaNorm = busqueda.trim().toLowerCase();
  const trabajadoresFiltrados = busquedaNorm
    ? trabajadores.filter(t => `${t.nombres} ${t.apellidos} ${t.rut}`.toLowerCase().includes(busquedaNorm))
    : trabajadores;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-lg">
            <Wallet className="text-primary" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Remuneraciones</h1>
            <p className="text-sm text-gray-500 mt-1">Liquidar sueldos del mes y centralizar el gasto en la contabilidad.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600">Período</label>
          <input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary/20" />
        </div>
      </div>

      {/* Índices previsionales del período */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Landmark size={18} className="text-gray-500" />
            <h3 className="font-semibold text-gray-800">Índices previsionales — {periodo}</h3>
          </div>
          {esAdminGlobal && (
            <button onClick={() => { setFormIndices(indice ? { ...indice } : initialIndicesForm); setMostrarFormIndices(true); }} className="text-xs text-primary hover:underline">
              {indice ? 'Editar' : 'Cargar índices de este mes'}
            </button>
          )}
        </div>
        {indice === undefined ? (
          <p className="text-sm text-gray-400">Cargando...</p>
        ) : indice ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <div><p className="text-[10px] text-gray-500 uppercase">UF</p><p className="font-bold">{formatCurrency(indice.valorUf)}</p></div>
            <div><p className="text-[10px] text-gray-500 uppercase">UTM</p><p className="font-bold">{formatCurrency(indice.valorUtm)}</p></div>
            <div><p className="text-[10px] text-gray-500 uppercase">Sueldo Mínimo</p><p className="font-bold">{formatCurrency(indice.sueldoMinimo)}</p></div>
            <div><p className="text-[10px] text-gray-500 uppercase">Tasa SIS</p><p className="font-bold">{(indice.tasaSis * 100).toFixed(2)}%</p></div>
            <div><p className="text-[10px] text-gray-500 uppercase">Tope AFP/Salud</p><p className="font-bold">{indice.topeAfpSaludUf} UF</p></div>
          </div>
        ) : (
          <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Aún no se cargan los índices previsionales de {periodo}
            {esAdminGlobal ? ' — cárgalos con el botón de arriba antes de calcular liquidaciones.' : '. Pide a tu administrador que los cargue antes de calcular liquidaciones.'}
          </p>
        )}
      </Card>

      {/* Mutual de Seguridad de esta empresa */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Landmark size={18} className="text-gray-500" />
            <h3 className="font-semibold text-gray-800">Mutual de Seguridad</h3>
          </div>
          {puedeConfigurarMutual && (
            <button
              onClick={() => { setFormMutual(mutual?.mutualTasaPct != null ? { mutualNombre: mutual.mutualNombre || MUTUALES[0], mutualTasaPct: mutual.mutualTasaPct } : initialMutualForm); setMostrarFormMutual(true); }}
              className="text-xs text-primary hover:underline"
            >
              {mutual?.mutualTasaPct != null ? 'Editar' : 'Configurar tasa real'}
            </button>
          )}
        </div>
        {mutual?.mutualTasaPct != null ? (
          <p className="text-sm text-gray-700">{mutual.mutualNombre || 'Mutual'} — <strong>{mutual.mutualTasaPct}%</strong> (tasa real de esta empresa)</p>
        ) : (
          <p className="text-sm text-gray-500">
            Usando el piso legal <strong>0,90%</strong> (Ley 16.744) — si esta empresa tiene una tasa adicional propia con su Mutual (según rubro o siniestralidad),
            {puedeConfigurarMutual ? ' configúrala con el botón de arriba.' : ' pide a tu administrador que la configure.'}
          </p>
        )}
      </Card>

      {/* Cuentas usadas al centralizar */}
      <Card>
        <button type="button" onClick={() => setMostrarCuentasConfig(v => !v)} className="w-full flex items-center justify-between text-left">
          <div className="flex items-center gap-2">
            <Landmark size={18} className="text-gray-500" />
            <h3 className="font-semibold text-gray-800">Cuentas de Centralización</h3>
          </div>
          {mostrarCuentasConfig ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>
        {mostrarCuentasConfig && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-gray-500 mb-2">
              Qué cuenta de tu plan de cuentas se usa por cada concepto al centralizar. Por defecto usa el código estándar
              {puedeConfigurarMutual ? ' — puedes cambiarla si tu plan de cuentas es distinto.' : '.'}
            </p>
            {cuentasConfig.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Cargando...</p>
            ) : (
              cuentasConfig.map(cc => (
                <div key={cc.concepto} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                  <div className="w-1/3 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{cc.label}</p>
                    <p className="text-[10px] text-gray-400">Por defecto: {cc.codigoDefault}</p>
                  </div>
                  {puedeConfigurarMutual ? (
                    <div className="flex-1">
                      <SearchSelect
                        value={cc.cuentaId ?? ''}
                        onChange={(cuentaId) => guardarCuentaConcepto(cc.concepto, cuentaId)}
                        options={cuentasDisponibles.map(c => ({ value: c.id, label: `${c.codigo} — ${c.nombre}` }))}
                        placeholder="Buscar cuenta..."
                      />
                    </div>
                  ) : (
                    <p className="flex-1 text-sm text-gray-600">
                      {cc.cuentaCodigo ? `${cc.cuentaCodigo} — ${cc.cuentaNombre}` : <span className="text-amber-600">No existe en el plan de cuentas</span>}
                    </p>
                  )}
                  {cc.esPersonalizada && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 flex-shrink-0">Personalizada</span>}
                  {guardandoConcepto === cc.concepto && <span className="text-[10px] text-gray-400 flex-shrink-0">Guardando...</span>}
                </div>
              ))
            )}
          </div>
        )}
      </Card>

      {/* Trabajadores + liquidaciones del período */}
      <Card
        title={`Trabajadores (${trabajadoresFiltrados.length}${busqueda ? ` de ${trabajadores.length}` : ''})`}
        action={<Button size="sm" icon={<Plus size={14} />} onClick={() => { setEditandoTrabajadorId(null); setFormTrabajador(initialTrabajadorForm); setMostrarFormTrabajador(true); }}>Nuevo Trabajador</Button>}
      >
        {trabajadores.length > 0 && (
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o RUT..."
              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20"
            />
          </div>
        )}
        {loading ? (
          <div className="py-8 text-center text-gray-400 text-sm">Cargando...</div>
        ) : trabajadores.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm">No hay trabajadores registrados para esta empresa.</div>
        ) : trabajadoresFiltrados.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm">Ningún trabajador coincide con "{busqueda}".</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {trabajadoresFiltrados.map(t => {
              const liq = liquidaciones[t.id];
              const abierta = filaAbierta === t.id;
              const entrada = entradas[t.id] || initialEntradaForm;
              const inactivo = t.estado !== 'activo';
              return (
                <div key={t.id} className={`py-3 ${inactivo ? 'opacity-60' : ''}`}>
                  <div className="w-full flex items-center justify-between gap-2">
                    <button onClick={() => abrirFila(t.id)} className="flex-1 min-w-0 flex items-center justify-between text-left">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {t.nombres} {t.apellidos}
                          {inactivo && <span className="ml-2 inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-gray-200 text-gray-600 align-middle">{t.estado === 'suspendido' ? 'Suspendido' : 'Desvinculado'}</span>}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{t.cargo || 'Sin cargo'} · {t.afp}{t.isapre ? ` · ${t.isapre}` : ' · Fonasa'}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                        {liq ? (
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${liq.asientoId ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {liq.asientoId && <CheckCircle2 size={12} />}
                            Líquido: {formatCurrency(liq.sueldoLiquido)}{liq.asientoId ? ' (centralizado)' : ''}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Sin calcular</span>
                        )}
                        {abierta ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                      </div>
                    </button>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => cambiarEstadoTrabajador(t, inactivo ? 'activo' : 'desvinculado')}
                        disabled={cambiandoEstadoId === t.id}
                        title={inactivo ? 'Reactivar' : 'Marcar como desvinculado'}
                        className="px-2 py-1 text-[11px] rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {inactivo ? 'Reactivar' : 'Desvincular'}
                      </button>
                      {liq && indice && (
                        <button type="button" onClick={() => descargarPdf(t, liq)} disabled={generandoPdfId === t.id} title="Descargar liquidación en PDF" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50">
                          <FileDown size={15} />
                        </button>
                      )}
                      <button type="button" onClick={() => verHistorial(t)} title="Historial de liquidaciones" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700">
                        <History size={15} />
                      </button>
                      <button type="button" onClick={() => iniciarEdicionTrabajador(t)} title="Editar" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700">
                        <Pencil size={15} />
                      </button>
                      <button type="button" onClick={() => eliminarTrabajador(t)} disabled={eliminandoId === t.id} title="Eliminar" className="p-1.5 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  {abierta && (
                    <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                      {liq?.asientoId && (
                        <p className="col-span-2 md:col-span-3 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                          Esta liquidación ya fue centralizada — para recalcularla, primero hay que descentralizarla (pídeselo a tu administrador).
                        </p>
                      )}
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-1">Días trabajados</label>
                        <input type="number" min={0} max={31} value={entrada.diasTrabajados} onChange={e => setEntradas(x => ({ ...x, [t.id]: { ...entrada, diasTrabajados: Number(e.target.value) } }))} className="w-full px-2 py-1.5 border rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-1">Bonos imponibles</label>
                        <input type="number" min={0} value={entrada.bonos} onChange={e => setEntradas(x => ({ ...x, [t.id]: { ...entrada, bonos: Number(e.target.value) } }))} className="w-full px-2 py-1.5 border rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-1">Aguinaldo</label>
                        <input type="number" min={0} value={entrada.aguinaldo} onChange={e => setEntradas(x => ({ ...x, [t.id]: { ...entrada, aguinaldo: Number(e.target.value) } }))} className="w-full px-2 py-1.5 border rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-1">Horas extra</label>
                        <input type="number" min={0} value={entrada.horasExtra} onChange={e => setEntradas(x => ({ ...x, [t.id]: { ...entrada, horasExtra: Number(e.target.value) } }))} className="w-full px-2 py-1.5 border rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-1">Anticipos</label>
                        <input type="number" min={0} value={entrada.anticipos} onChange={e => setEntradas(x => ({ ...x, [t.id]: { ...entrada, anticipos: Number(e.target.value) } }))} className="w-full px-2 py-1.5 border rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-1">Préstamos</label>
                        <input type="number" min={0} value={entrada.prestamos} onChange={e => setEntradas(x => ({ ...x, [t.id]: { ...entrada, prestamos: Number(e.target.value) } }))} className="w-full px-2 py-1.5 border rounded text-sm" />
                      </div>
                      <div className="col-span-2 md:col-span-3 flex items-center justify-between gap-3 pt-2 border-t border-gray-200">
                        {liq && (
                          <p className="text-xs text-gray-600">
                            Imponible {formatCurrency(liq.totalImponible)} · Descuentos {formatCurrency(liq.totalDescuentos)} · <strong>Líquido {formatCurrency(liq.sueldoLiquido)}</strong>
                          </p>
                        )}
                        <div className="ml-auto flex items-center gap-2">
                          {liq && !liq.asientoId && (
                            <Button
                              size="sm"
                              variant="secondary"
                              icon={<Trash2 size={14} />}
                              disabled={eliminandoLiqId === liq.id}
                              onClick={() => eliminarLiquidacion(t, liq)}
                            >
                              {eliminandoLiqId === liq.id ? 'Eliminando...' : 'Eliminar'}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            icon={<Calculator size={14} />}
                            disabled={!indice || calculando === t.id || Boolean(liq?.asientoId)}
                            onClick={() => calcularLiquidacion(t.id)}
                          >
                            {calculando === t.id ? 'Calculando...' : liq ? 'Recalcular' : 'Calcular liquidación'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {trabajadores.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div>
            <p className="font-semibold text-gray-800 text-sm">{totalCalculadas} de {trabajadores.length} liquidaciones calculadas este período</p>
            <p className="text-xs text-gray-500">
              {totalPendientesCentralizar} pendiente(s) de centralizar
              {totalCentralizados > 0 ? ` · ${totalCentralizados} ya centralizada(s)` : ''} en la contabilidad.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {totalCentralizados > 0 && (
              <Button variant="secondary" onClick={descentralizar} disabled={descentralizando} icon={<Undo2 size={16} />}>
                {descentralizando ? 'Deshaciendo...' : 'Descentralizar'}
              </Button>
            )}
            <Button onClick={centralizar} disabled={centralizando || totalPendientesCentralizar === 0} icon={<Landmark size={16} />}>
              {centralizando ? 'Centralizando...' : `Centralizar ${periodo}`}
            </Button>
          </div>
        </div>
      )}

      {/* Modal: nuevo/editar trabajador */}
      <Modal isOpen={mostrarFormTrabajador} onClose={() => { setMostrarFormTrabajador(false); setEditandoTrabajadorId(null); }} title={editandoTrabajadorId ? 'Editar Trabajador' : 'Nuevo Trabajador'} size="lg" closeOnBackdrop={false}
        footer={<>
          <Button variant="secondary" onClick={() => { setMostrarFormTrabajador(false); setEditandoTrabajadorId(null); }}>Cancelar</Button>
          <Button onClick={guardarTrabajador} disabled={guardandoTrabajador} icon={<Save size={16} />}>{guardandoTrabajador ? 'Guardando...' : 'Guardar'}</Button>
        </>}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="RUT" value={formTrabajador.rut} onChange={e => setFormTrabajador(f => ({ ...f, rut: e.target.value }))} placeholder="12.345.678-9" />
          <Input label="Cargo" value={formTrabajador.cargo} onChange={e => setFormTrabajador(f => ({ ...f, cargo: e.target.value }))} />
          <Input label="Nombres" value={formTrabajador.nombres} onChange={e => setFormTrabajador(f => ({ ...f, nombres: e.target.value }))} />
          <Input label="Apellidos" value={formTrabajador.apellidos} onChange={e => setFormTrabajador(f => ({ ...f, apellidos: e.target.value }))} />
          <Input label="Fecha de ingreso" type="date" value={formTrabajador.fechaIngreso} onChange={e => setFormTrabajador(f => ({ ...f, fechaIngreso: e.target.value }))} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo de contrato</label>
            <select value={formTrabajador.tipoContrato} onChange={e => setFormTrabajador(f => ({ ...f, tipoContrato: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="indefinido">Indefinido</option>
              <option value="plazo_fijo">Plazo Fijo</option>
              <option value="por_obra">Por Obra/Faena</option>
            </select>
          </div>
          <Input label="Sueldo base ($)" type="number" value={formTrabajador.sueldoBase} onChange={e => setFormTrabajador(f => ({ ...f, sueldoBase: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <Input label="Colación ($)" type="number" value={formTrabajador.colacion} onChange={e => setFormTrabajador(f => ({ ...f, colacion: Number(e.target.value) }))} />
            <Input label="Movilización ($)" type="number" value={formTrabajador.movilizacion} onChange={e => setFormTrabajador(f => ({ ...f, movilizacion: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">AFP</label>
            <select
              value={formTrabajador.afp}
              onChange={e => {
                const afp = AFP_DATA.find(a => a.nombre === e.target.value);
                setFormTrabajador(f => ({ ...f, afp: e.target.value, tasaAfp: afp ? (10 + afp.comisionFija) / 100 : f.tasaAfp }));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              {AFP_DATA.map(a => <option key={a.id} value={a.nombre}>{a.nombre}</option>)}
            </select>
          </div>
          <Input label="Tasa AFP (ej: 0.1144 = 11.44%)" type="number" step="0.0001" value={formTrabajador.tasaAfp} onChange={e => setFormTrabajador(f => ({ ...f, tasaAfp: Number(e.target.value) }))} />
          <div className="md:col-span-2 flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="radio" checked={formTrabajador.esFonasa} onChange={() => setFormTrabajador(f => ({ ...f, esFonasa: true }))} /> Fonasa (7%)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="radio" checked={!formTrabajador.esFonasa} onChange={() => setFormTrabajador(f => ({ ...f, esFonasa: false }))} /> Isapre
            </label>
          </div>
          {!formTrabajador.esFonasa && (
            <>
              <Input label="Nombre Isapre" value={formTrabajador.isapre} onChange={e => setFormTrabajador(f => ({ ...f, isapre: e.target.value }))} />
              <Input label="Plan pactado (UF)" type="number" step="0.01" value={formTrabajador.saludPactado} onChange={e => setFormTrabajador(f => ({ ...f, saludPactado: Number(e.target.value) }))} />
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tramo asignación familiar</label>
            <select value={formTrabajador.tramoAsignacionFamiliar} onChange={e => setFormTrabajador(f => ({ ...f, tramoAsignacionFamiliar: e.target.value as 'A' | 'B' | 'C' | 'D' }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="D">D — Sin derecho (renta sobre el tope)</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Input label="Cargas simples" type="number" min={0} value={formTrabajador.cargasSimples} onChange={e => setFormTrabajador(f => ({ ...f, cargasSimples: Number(e.target.value) }))} />
            <Input label="Maternales" type="number" min={0} value={formTrabajador.cargasMaternales} onChange={e => setFormTrabajador(f => ({ ...f, cargasMaternales: Number(e.target.value) }))} />
            <Input label="Inválidas" type="number" min={0} value={formTrabajador.cargasInvalidez} onChange={e => setFormTrabajador(f => ({ ...f, cargasInvalidez: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Situación previsional (Previred)</label>
            <select value={formTrabajador.tipoTrabajadorPrevired} onChange={e => setFormTrabajador(f => ({ ...f, tipoTrabajadorPrevired: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="0">Cotiza normal</option>
              <option value="1">Pensionado y cotiza</option>
              <option value="2">Pensionado, no cotiza</option>
              <option value="8">Exento (mujer 60+/hombre 65+/extranjero)</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* Modal: índices previsionales */}
      <Modal isOpen={mostrarFormIndices} onClose={() => setMostrarFormIndices(false)} title={`Índices previsionales — ${periodo}`} size="md" closeOnBackdrop={false}
        footer={<>
          <Button variant="secondary" onClick={() => setMostrarFormIndices(false)}>Cancelar</Button>
          <Button onClick={guardarIndices} disabled={guardandoIndices} icon={<Save size={16} />}>{guardandoIndices ? 'Guardando...' : 'Guardar'}</Button>
        </>}
      >
        <div className="grid grid-cols-2 gap-4">
          <Input label="Valor UF" type="number" step="0.01" value={formIndices.valorUf} onChange={e => setFormIndices(f => ({ ...f, valorUf: Number(e.target.value) }))} />
          <Input label="Valor UTM" type="number" value={formIndices.valorUtm} onChange={e => setFormIndices(f => ({ ...f, valorUtm: Number(e.target.value) }))} />
          <Input label="Sueldo Mínimo" type="number" value={formIndices.sueldoMinimo} onChange={e => setFormIndices(f => ({ ...f, sueldoMinimo: Number(e.target.value) }))} />
          <Input label="Tasa SIS (ej: 0.0162 = 1.62%)" type="number" step="0.0001" value={formIndices.tasaSis} onChange={e => setFormIndices(f => ({ ...f, tasaSis: Number(e.target.value) }))} />
          <Input label="Tope AFP/Salud (UF)" type="number" step="0.1" value={formIndices.topeAfpSaludUf} onChange={e => setFormIndices(f => ({ ...f, topeAfpSaludUf: Number(e.target.value) }))} />
          <Input label="Tope Cesantía (UF)" type="number" step="0.1" value={formIndices.topeCesantiaUf} onChange={e => setFormIndices(f => ({ ...f, topeCesantiaUf: Number(e.target.value) }))} />
          <Input label="Asignación Familiar Tramo A" type="number" value={formIndices.valorTramoA} onChange={e => setFormIndices(f => ({ ...f, valorTramoA: Number(e.target.value) }))} />
          <Input label="Asignación Familiar Tramo B" type="number" value={formIndices.valorTramoB} onChange={e => setFormIndices(f => ({ ...f, valorTramoB: Number(e.target.value) }))} />
          <Input label="Asignación Familiar Tramo C" type="number" value={formIndices.valorTramoC} onChange={e => setFormIndices(f => ({ ...f, valorTramoC: Number(e.target.value) }))} />
        </div>
        <p className="text-[11px] text-gray-400 mt-3">Valores precargados con la referencia más reciente conocida — confírmalos con el boletín de Previred del mes antes de guardar.</p>
      </Modal>

      {/* Modal: Mutual de Seguridad */}
      <Modal isOpen={mostrarFormMutual} onClose={() => setMostrarFormMutual(false)} title="Mutual de Seguridad" size="sm" closeOnBackdrop={false}
        footer={<>
          <Button variant="secondary" onClick={() => setMostrarFormMutual(false)}>Cancelar</Button>
          <Button onClick={guardarMutual} disabled={guardandoMutual} icon={<Save size={16} />}>{guardandoMutual ? 'Guardando...' : 'Guardar'}</Button>
        </>}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Mutual afiliada</label>
            <select value={formMutual.mutualNombre} onChange={e => setFormMutual(f => ({ ...f, mutualNombre: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
              {MUTUALES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <Input label="Tasa real (%) — piso legal + adicional propia" type="number" step="0.01" min={0.9} value={formMutual.mutualTasaPct} onChange={e => setFormMutual(f => ({ ...f, mutualTasaPct: Number(e.target.value) }))} />
          <p className="text-[11px] text-gray-400">El piso legal es 0,90% — pon el total que efectivamente cobra la Mutual a esta empresa (viene en su comunicación de tasa anual, o en la liquidación de cotizaciones que envían).</p>
        </div>
      </Modal>

      {/* Modal: historial de liquidaciones de un trabajador */}
      <Modal isOpen={!!historialTrabajador} onClose={() => setHistorialTrabajador(null)} title={`Historial — ${historialTrabajador?.nombres ?? ''} ${historialTrabajador?.apellidos ?? ''}`} size="md">
        {cargandoHistorial ? (
          <p className="text-sm text-gray-400 text-center py-6">Cargando...</p>
        ) : historialLiquidaciones.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Este trabajador no tiene liquidaciones calculadas todavía.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {historialLiquidaciones.map(l => (
              <div key={l.id} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">{l.periodo}</p>
                  <p className="text-xs text-gray-500">
                    Imponible {formatCurrency(l.totalImponible)} · Descuentos {formatCurrency(l.totalDescuentos)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${l.asientoId ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {l.asientoId && <CheckCircle2 size={12} />}
                    {formatCurrency(l.sueldoLiquido)}
                  </span>
                  {historialTrabajador && (
                    <button
                      type="button"
                      onClick={() => descargarPdf(historialTrabajador, l)}
                      title="Descargar PDF"
                      className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    >
                      <FileDown size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

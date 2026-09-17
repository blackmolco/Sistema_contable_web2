import React, { useState, useEffect, useCallback } from 'react';
import { Package, Plus, Calculator, X, Save } from 'lucide-react';
import { Card } from '../components/ui/Cards';
import { formatCurrency, formatDate, generateId } from '../utils/calculos';
import { useApp } from '../context/AppContext';
import { useAppStore } from '../stores/appStore';
import { apiFetch, apiFetchRaw } from '../services/httpClient';
import { getErrorMessage } from '../services/errorHandler';

type TipoActivo = 'computacional' | 'vehiculo' | 'mueble' | 'maquinaria' | 'inmueble';
type MetodoTributario = 'normal' | 'acelerada' | 'instantanea';

interface Activo {
  id: string;
  codigo: string;
  nombre: string;
  tipo: TipoActivo;
  fechaCompra: string;
  valorAdquisicion: number;
  vidaUtilMeses: number;
  depreciacionAcumuladaPrevia: number;
  // Depreciación tributaria (SII) — se calcula en paralelo a la financiera
  // de arriba, nunca se deriva de ella. Ver nota en backend/prisma/schema.prisma.
  metodoTributario: MetodoTributario;
  vidaUtilMesesTributaria: number | null;
  depreciacionMensualTributaria: number;
  depreciacionAcumuladaTributaria: number;
}

// Vida útil en AÑOS (convención de este formulario) — se convierte a meses
// solo al hablar con el backend, que guarda todo en meses.
const VIDA_UTIL_DEFAULT: Record<TipoActivo, { normal: number; acelerada: number }> = {
  computacional: { normal: 3, acelerada: 1 },
  vehiculo: { normal: 7, acelerada: 2 },
  mueble: { normal: 7, acelerada: 2 },
  maquinaria: { normal: 15, acelerada: 5 },
  inmueble: { normal: 50, acelerada: 17 },
};

// La depreciación instantánea (Pro Pyme 14 D N°3: 100% de gasto tributario
// el año de adquisición) no aplica a terrenos ni inmuebles — mismo criterio
// que valida el backend en calcularDepreciacionTributaria().
const CATEGORIAS_SIN_INSTANTANEA = new Set<TipoActivo>(['inmueble']);

function mesesTranscurridosDesde(fecha: string): number {
  const f = new Date(fecha);
  const hoy = new Date();
  let meses = (hoy.getFullYear() - f.getFullYear()) * 12;
  meses -= f.getMonth() + 1;
  meses += hoy.getMonth() + 1;
  return Math.max(0, meses);
}

function mapActivoDelBackend(a: Record<string, any>): Activo {
  return {
    id: a.id,
    codigo: a.codigo,
    nombre: a.descripcion,
    tipo: (a.categoria as TipoActivo) || 'computacional',
    fechaCompra: a.fechaAdquisicion?.split('T')[0] || new Date().toISOString().split('T')[0],
    valorAdquisicion: a.valorAdquisicion,
    vidaUtilMeses: a.vidaUtilMeses || 36,
    depreciacionAcumuladaPrevia: a.depreciacionAcumulada || 0,
    metodoTributario: (a.metodoTributario as MetodoTributario) || 'normal',
    vidaUtilMesesTributaria: a.vidaUtilMesesTributaria ?? null,
    depreciacionMensualTributaria: a.depreciacionMensualTributaria || 0,
    depreciacionAcumuladaTributaria: a.depreciacionAcumuladaTributaria || 0,
  };
}

export default function ActivoFijo() {
  const { state, dispatch, showToast } = useApp();
  const empresaId = useAppStore(s => s.empresaActiva?.id ?? null);
  const [activos, setActivos] = useState<Activo[]>([]);
  const [loading, setLoading] = useState(false);
  const [metodo, setMetodo] = useState<'normal' | 'acelerada'>('normal');
  const [ipcPorcentaje, setIpcPorcentaje] = useState(3.5);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [nuevoActivo, setNuevoActivo] = useState<{
    nombre: string;
    tipo: TipoActivo;
    fechaCompra: string;
    valorAdquisicion: number | '';
    vidaUtilAnosNormal: number;
    depreciacionAcumuladaPrevia: number;
    metodoTributario: MetodoTributario;
    vidaUtilAnosTributaria: number;
  }>({
    nombre: '',
    tipo: 'computacional',
    fechaCompra: new Date().toISOString().split('T')[0],
    valorAdquisicion: '',
    vidaUtilAnosNormal: VIDA_UTIL_DEFAULT.computacional.normal,
    depreciacionAcumuladaPrevia: 0,
    metodoTributario: 'normal',
    vidaUtilAnosTributaria: VIDA_UTIL_DEFAULT.computacional.normal,
  });

  const cargarActivos = useCallback(async () => {
    if (!empresaId) { setActivos([]); return; }
    setLoading(true);
    try {
      const data = await apiFetch<Record<string, any>[] | { data: Record<string, any>[] }>(`/api/activos-fijos?empresaId=${encodeURIComponent(empresaId)}`);
      const items = Array.isArray(data) ? data : (data as { data: Record<string, any>[] }).data ?? [];
      setActivos(items.map(mapActivoDelBackend));
    } catch (err) {
      showToast('error', 'Error', `No se pudieron cargar los activos fijos: ${getErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  useEffect(() => { cargarActivos(); }, [cargarActivos]);

  const calcularDepreciacionAnual = (activo: Activo) => {
    const vidaUtilAnos = (metodo === 'normal' ? activo.vidaUtilMeses : Math.max(1, Math.ceil(activo.vidaUtilMeses / 3))) / 12;
    return activo.valorAdquisicion / vidaUtilAnos;
  };

  const calcularDepreciacionAcumulada = (activo: Activo) => {
    const depAnual = calcularDepreciacionAnual(activo);
    const mesesUso = mesesTranscurridosDesde(activo.fechaCompra);
    const depMensual = depAnual / 12;
    const acumuladaSistema = depMensual * mesesUso;
    const acumuladaTotal = acumuladaSistema + (activo.depreciacionAcumuladaPrevia || 0);
    return Math.min(acumuladaTotal, activo.valorAdquisicion - 1);
  };

  // Tributaria: independiente del toggle "metodo" de arriba (ese es solo
  // para el reporte financiero) — cada activo ya trae su propio método
  // tributario elegido al crearlo.
  const calcularAcumuladaTributaria = (activo: Activo) => {
    if (activo.metodoTributario === 'instantanea') return activo.valorAdquisicion;
    const mesesUso = mesesTranscurridosDesde(activo.fechaCompra);
    const acumulada = activo.depreciacionMensualTributaria * mesesUso;
    return Math.min(acumulada, activo.valorAdquisicion - 1);
  };

  const buscarCuenta = (codigo: string, defaultNombre: string, defaultId: string) => {
    const c = state.cuentas?.find(x => x.codigo === codigo);
    return {
      cuentaId: c?.id || defaultId,
      cuentaCodigo: c?.codigo || codigo,
      cuentaNombre: c?.nombre || defaultNombre
    };
  };

  const getCuentaActivo = (tipo: Activo['tipo']) => {
    switch (tipo) {
      case 'computacional': return buscarCuenta('1-2-010', 'Equipos Computacionales', 'a-computacionales');
      case 'vehiculo': return buscarCuenta('1-2-020', 'Vehículos', 'a-vehiculos');
      case 'mueble': return buscarCuenta('1-2-030', 'Muebles y Útiles', 'a-muebles');
      case 'maquinaria': return buscarCuenta('1-2-040', 'Maquinarias', 'a-maquinarias');
      case 'inmueble': return buscarCuenta('1-2-050', 'Edificios e Inmuebles', 'a-inmuebles');
    }
  };

  const getCuentaDepAcumulada = (tipo: Activo['tipo']) => {
    switch (tipo) {
      case 'computacional': return buscarCuenta('1-2-011', 'Depreciación Acumulada Equipos Computacionales', 'da-computacionales');
      case 'vehiculo': return buscarCuenta('1-2-021', 'Depreciación Acumulada Vehículos', 'da-vehiculos');
      case 'mueble': return buscarCuenta('1-2-031', 'Depreciación Acumulada Muebles y Útiles', 'da-muebles');
      case 'maquinaria': return buscarCuenta('1-2-041', 'Depreciación Acumulada Maquinarias', 'da-maquinarias');
      case 'inmueble': return buscarCuenta('1-2-051', 'Depreciación Acumulada Edificios e Inmuebles', 'da-inmuebles');
    }
  };

  const contabilizarRevalorizacionIPC = () => {
    if (activos.length === 0) {
      showToast('error', 'Sin datos', 'No hay activos fijos registrados para revalorizar.');
      return;
    }

    const anioActual = new Date().getFullYear();
    const glosaBuscada = `Reajuste de Activos Fijos por IPC - Año ${anioActual}`;
    const asientoExistente = (state.asientos || []).find(
      a => a.glosa === glosaBuscada && a.estado !== 'anulado'
    );

    if (asientoExistente) {
      showToast('warning', 'Ya contabilizado', 'El reajuste por IPC de este año ya ha sido contabilizado.');
      return;
    }

    const revalActivoMap = new Map<string, { cuenta: any, monto: number }>();
    const revalDepMap = new Map<string, { cuenta: any, monto: number }>();

    activos.forEach(activo => {
      const revalAct = Math.round(activo.valorAdquisicion * (ipcPorcentaje / 100));
      const acumulada = calcularDepreciacionAcumulada(activo);
      const revalDep = Math.round(acumulada * (ipcPorcentaje / 100));

      if (revalAct > 0) {
        const cActivo = getCuentaActivo(activo.tipo);
        const prev = revalActivoMap.get(cActivo.cuentaCodigo) || { cuenta: cActivo, monto: 0 };
        revalActivoMap.set(cActivo.cuentaCodigo, { cuenta: cActivo, monto: prev.monto + revalAct });
      }

      if (revalDep > 0) {
        const cDep = getCuentaDepAcumulada(activo.tipo);
        const prev = revalDepMap.get(cDep.cuentaCodigo) || { cuenta: cDep, monto: 0 };
        revalDepMap.set(cDep.cuentaCodigo, { cuenta: cDep, monto: prev.monto + revalDep });
      }
    });

    const detallesAsiento: any[] = [];
    let totalActivosReval = 0;
    let totalDepReval = 0;

    revalActivoMap.forEach(val => {
      detallesAsiento.push({
        ...val.cuenta,
        debe: val.monto,
        haber: 0
      });
      totalActivosReval += val.monto;
    });

    revalDepMap.forEach(val => {
      detallesAsiento.push({
        ...val.cuenta,
        debe: 0,
        haber: val.monto
      });
      totalDepReval += val.monto;
    });

    if (detallesAsiento.length === 0) {
      showToast('info', 'Sin cambios', 'La revalorización por IPC no genera montos significativos.');
      return;
    }

    const cCorrecMonetaria = buscarCuenta('5-1-130', 'Corrección Monetaria', 'g-correc-monetaria');
    const diff = totalActivosReval - totalDepReval;

    if (diff > 0) {
      detallesAsiento.push({
        ...cCorrecMonetaria,
        debe: 0,
        haber: diff
      });
    } else if (diff < 0) {
      detallesAsiento.push({
        ...cCorrecMonetaria,
        debe: Math.abs(diff),
        haber: 0
      });
    }

    const tDebe = detallesAsiento.reduce((acc, d) => acc + d.debe, 0);
    const tHaber = detallesAsiento.reduce((acc, d) => acc + d.haber, 0);

    const nuevoAsiento = {
      id: generateId(),
      fecha: `${anioActual}-12-31`,
      numero: state.numeroAsiento || 1,
      glosa: glosaBuscada,
      detalles: detallesAsiento,
      totalDebe: tDebe,
      totalHaber: tHaber,
      estado: 'pendiente' as const,
      tipo: 'traspaso'
    };

    dispatch({ type: 'ADD_ASIENTO', payload: nuevoAsiento });
    showToast('success', 'IPC Contabilizado', `Se generó el asiento de Corrección Monetaria por IPC (${ipcPorcentaje}%) en el Libro Diario.`);
  };

  const contabilizarDepreciacion = () => {
    if (activos.length === 0) {
      showToast('error', 'Sin datos', 'No hay activos fijos registrados para depreciar.');
      return;
    }

    const anioActual = new Date().getFullYear();
    const glosaBuscada = `Depreciación Activos Fijos - Año ${anioActual}`;
    const asientoExistente = (state.asientos || []).find(
      a => a.glosa === glosaBuscada && a.estado !== 'anulado'
    );

    if (asientoExistente) {
      showToast('warning', 'Ya contabilizado', 'La depreciación de activos fijos de este año ya ha sido contabilizada.');
      return;
    }

    const depAnualMap = new Map<string, { cuenta: any, monto: number }>();
    let totalGastoDep = 0;

    activos.forEach(activo => {
      const depAnual = Math.round(calcularDepreciacionAnual(activo));
      const acumulada = calcularDepreciacionAcumulada(activo);
      const valorLibro = activo.valorAdquisicion - acumulada;
      const gastoAno = Math.min(depAnual, valorLibro - 1);

      if (gastoAno > 0) {
        const cDep = getCuentaDepAcumulada(activo.tipo);
        const prev = depAnualMap.get(cDep.cuentaCodigo) || { cuenta: cDep, monto: 0 };
        depAnualMap.set(cDep.cuentaCodigo, { cuenta: cDep, monto: prev.monto + gastoAno });
        totalGastoDep += gastoAno;
      }
    });

    if (totalGastoDep === 0) {
      showToast('info', 'Sin depreciación', 'No hay activos fijos con saldo disponible para depreciar este año.');
      return;
    }

    const cGastoDep = buscarCuenta('5-1-120', 'Gasto Depreciación Activo Fijo', 'g-depreciacion');
    const detallesAsiento: any[] = [
      {
        ...cGastoDep,
        debe: totalGastoDep,
        haber: 0
      }
    ];

    depAnualMap.forEach(val => {
      detallesAsiento.push({
        ...val.cuenta,
        debe: 0,
        haber: val.monto
      });
    });

    const tDebe = detallesAsiento.reduce((acc, d) => acc + d.debe, 0);
    const tHaber = detallesAsiento.reduce((acc, d) => acc + d.haber, 0);

    const nuevoAsiento = {
      id: generateId(),
      fecha: `${anioActual}-12-31`,
      numero: state.numeroAsiento || 1,
      glosa: glosaBuscada,
      detalles: detallesAsiento,
      totalDebe: tDebe,
      totalHaber: tHaber,
      estado: 'pendiente' as const,
      tipo: 'traspaso'
    };

    dispatch({ type: 'ADD_ASIENTO', payload: nuevoAsiento });
    showToast('success', 'Depreciación Contabilizada', `Se generó el asiento de depreciación anual en el Libro Diario por un total de ${formatCurrency(totalGastoDep)}.`);
  };

  const cambiarTipo = (t: TipoActivo) => {
    const vu = VIDA_UTIL_DEFAULT[t];
    setNuevoActivo(f => ({
      ...f,
      tipo: t,
      vidaUtilAnosNormal: vu.normal,
      vidaUtilAnosTributaria: f.metodoTributario === 'acelerada' ? vu.acelerada : vu.normal,
      // La instantánea no aplica a inmuebles — si el usuario cambia a
      // "Inmueble" teniendo instantánea seleccionada, se vuelve a 'normal'.
      metodoTributario: CATEGORIAS_SIN_INSTANTANEA.has(t) && f.metodoTributario === 'instantanea' ? 'normal' : f.metodoTributario,
    }));
  };

  const cambiarMetodoTributario = (m: MetodoTributario) => {
    setNuevoActivo(f => {
      const vu = VIDA_UTIL_DEFAULT[f.tipo];
      return {
        ...f,
        metodoTributario: m,
        vidaUtilAnosTributaria: m === 'acelerada' ? vu.acelerada : vu.normal,
      };
    });
  };

  const handleGuardarActivo = async () => {
    if (!nuevoActivo.nombre || !nuevoActivo.valorAdquisicion) {
      showToast('error', 'Error', 'El nombre y el valor de adquisición son obligatorios.');
      return;
    }
    if (!empresaId) {
      showToast('error', 'Sin empresa', 'Selecciona una empresa antes de registrar un activo fijo.');
      return;
    }
    setGuardando(true);
    try {
      const body: Record<string, unknown> = {
        codigo: `AF-${Date.now().toString(36).toUpperCase()}`,
        descripcion: nuevoActivo.nombre,
        categoria: nuevoActivo.tipo,
        fechaAdquisicion: nuevoActivo.fechaCompra,
        valorAdquisicion: Number(nuevoActivo.valorAdquisicion),
        vidaUtilMeses: Math.round(nuevoActivo.vidaUtilAnosNormal * 12),
        depreciacionAcumulada: Number(nuevoActivo.depreciacionAcumuladaPrevia || 0),
        metodoTributario: nuevoActivo.metodoTributario,
        empresaId,
      };
      if (nuevoActivo.metodoTributario !== 'instantanea') {
        body.vidaUtilMesesTributaria = Math.round(nuevoActivo.vidaUtilAnosTributaria * 12);
      }
      const res = await apiFetchRaw('/api/activos-fijos', { method: 'POST', body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);

      setActivos(a => [...a, mapActivoDelBackend(data)]);
      setMostrarFormulario(false);
      setNuevoActivo({
        nombre: '', tipo: 'computacional', fechaCompra: new Date().toISOString().split('T')[0],
        valorAdquisicion: '', vidaUtilAnosNormal: VIDA_UTIL_DEFAULT.computacional.normal,
        depreciacionAcumuladaPrevia: 0, metodoTributario: 'normal',
        vidaUtilAnosTributaria: VIDA_UTIL_DEFAULT.computacional.normal,
      });
      showToast('success', 'Activo Agregado', 'El nuevo activo fijo ha sido registrado con éxito.');
    } catch (err) {
      showToast('error', 'Error al guardar', getErrorMessage(err));
    } finally {
      setGuardando(false);
    }
  };

  const instantaneaBloqueada = CATEGORIAS_SIN_INSTANTANEA.has(nuevoActivo.tipo);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-lg">
            <Package className="text-primary" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Control de Activo Fijo</h1>
            <p className="text-sm text-gray-500 mt-1">Depreciación financiera y tributaria en paralelo, por activo.</p>
          </div>
        </div>
        <button onClick={() => setMostrarFormulario(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2">
          <Plus size={18} /> Nuevo Activo
        </button>
      </div>

      {mostrarFormulario && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="font-bold text-gray-900">Registrar Nuevo Activo Fijo</h3>
              <button onClick={() => setMostrarFormulario(false)} className="text-gray-400 hover:text-red-500"><X size={20} /></button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
              <div className="space-y-4 md:border-r border-gray-100 md:pr-4">
                <h4 className="font-semibold text-sm text-primary border-b pb-1">Datos de Adquisición</h4>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nombre / Descripción del Bien</label>
                  <input type="text" placeholder="Ej: Computador HP EliteBook" value={nuevoActivo.nombre} onChange={(e) => setNuevoActivo(f => ({ ...f, nombre: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de Activo</label>
                  <select value={nuevoActivo.tipo} onChange={(e) => cambiarTipo(e.target.value as TipoActivo)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary/20">
                    <option value="computacional">Equipo Computacional (3 años)</option>
                    <option value="vehiculo">Vehículo (7 años)</option>
                    <option value="mueble">Mueble u Oficina (7 años)</option>
                    <option value="maquinaria">Maquinaria (15 años)</option>
                    <option value="inmueble">Inmueble / Edificio (50 años)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Fecha de Ingreso / Compra</label>
                  <input type="date" value={nuevoActivo.fechaCompra} onChange={(e) => setNuevoActivo(f => ({ ...f, fechaCompra: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Valor de Adquisición ($)</label>
                  <input type="number" value={nuevoActivo.valorAdquisicion} onChange={(e) => setNuevoActivo(f => ({ ...f, valorAdquisicion: e.target.value === '' ? '' : Number(e.target.value) }))} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Depreciación Acumulada Anterior ($)</label>
                  <input type="number" placeholder="Solo si viene de otro sistema" value={nuevoActivo.depreciacionAcumuladaPrevia || ''} onChange={(e) => setNuevoActivo(f => ({ ...f, depreciacionAcumuladaPrevia: Number(e.target.value) }))} className="w-full px-3 py-2 border rounded-lg text-sm bg-amber-50 focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="font-semibold text-sm text-emerald-700 border-b pb-1">Depreciación Tributaria (SII)</h4>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Método</label>
                  <select value={nuevoActivo.metodoTributario} onChange={(e) => cambiarMetodoTributario(e.target.value as MetodoTributario)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary/20">
                    <option value="normal">Normal (tabla vida útil SII)</option>
                    <option value="acelerada">Acelerada (1/3 de la vida útil)</option>
                    <option value="instantanea" disabled={instantaneaBloqueada}>
                      Instantánea (Pro Pyme — 100% al año de compra){instantaneaBloqueada ? ' — no aplica a inmuebles' : ''}
                    </option>
                  </select>
                </div>
                {nuevoActivo.metodoTributario === 'instantanea' ? (
                  <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 leading-snug">
                    Se reconoce el 100% del valor de adquisición como gasto tributario en el año de compra
                    (bienes muebles, tope UF 25.000/año agregado — verifica el tope si hay varios activos este año).
                  </p>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Vida útil tributaria (años)</label>
                    <input
                      type="number"
                      min={1}
                      value={nuevoActivo.vidaUtilAnosTributaria}
                      onChange={(e) => setNuevoActivo(f => ({ ...f, vidaUtilAnosTributaria: Number(e.target.value) || 1 }))}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary/20"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                      Por defecto se iguala a la vida útil financiera — ajústala si la tabla del SII para esta categoría es distinta.
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
              <button onClick={() => setMostrarFormulario(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">Cancelar</button>
              <button onClick={handleGuardarActivo} disabled={guardando} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-60">
                <Save size={16} /> {guardando ? 'Guardando...' : 'Guardar Activo'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 md:col-span-3 border-primary/20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Método Financiero para Reportes (Normal/Acelerada)</label>
              <select value={metodo} onChange={(e) => setMetodo(e.target.value as 'normal' | 'acelerada')} className="w-full px-4 py-2 border rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-primary/20">
                <option value="normal">Depreciación Lineal Normal</option>
                <option value="acelerada">Depreciación Acelerada (1/3 Vida Útil)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Factor Reajuste IPC Anual (%)</label>
              <input
                type="number"
                step="0.1"
                value={ipcPorcentaje}
                onChange={(e) => setIpcPorcentaje(Number(e.target.value))}
                className="w-full px-4 py-2 border rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={contabilizarRevalorizacionIPC}
                className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-xs font-semibold"
              >
                <Calculator size={14} /> Revalorizar IPC
              </button>
              <button
                onClick={contabilizarDepreciacion}
                className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-xs font-semibold"
              >
                <Calculator size={14} /> Depreciar Ejercicio
              </button>
            </div>
          </div>
        </Card>

        <div className="col-span-1 md:col-span-3 bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-100 border-b-2 border-gray-300">
              <tr className="text-gray-700">
                <th className="py-3 px-4 font-semibold">Activo Fijo</th>
                <th className="py-3 px-4 font-semibold text-center">F. Adquisición</th>
                <th className="py-3 px-4 font-semibold text-right">Valor Inicial</th>
                <th className="py-3 px-4 font-semibold text-right text-red-700">Dep. Financiera Acum.</th>
                <th className="py-3 px-4 font-semibold text-right text-blue-800">Valor Libro Financiero</th>
                <th className="py-3 px-4 font-semibold text-right text-red-700">Dep. Tributaria Acum.</th>
                <th className="py-3 px-4 font-semibold text-right text-emerald-800">Valor Libro Tributario</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="py-8 text-center text-gray-400">Cargando activos fijos...</td></tr>
              )}
              {!loading && activos.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-gray-500">
                  <Package size={40} className="mx-auto mb-3 text-gray-300" />
                  <p>No hay activos fijos registrados</p>
                  <p className="text-xs mt-1">Haga clic en "Nuevo Activo" para agregar uno</p>
                </td></tr>
              )}
              {activos.map((activo) => {
                const acumulada = calcularDepreciacionAcumulada(activo);
                const valorLibro = activo.valorAdquisicion - acumulada;
                const acumuladaTrib = calcularAcumuladaTributaria(activo);
                const valorLibroTrib = activo.valorAdquisicion - acumuladaTrib;
                const METODO_LABEL: Record<MetodoTributario, string> = { normal: 'Normal', acelerada: 'Acelerada', instantanea: 'Instantánea' };
                return (
                  <tr key={activo.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{activo.nombre}</p>
                        {activo.depreciacionAcumuladaPrevia ? <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded font-bold">MIGRADO</span> : null}
                      </div>
                      <p className="text-[10px] text-gray-500 uppercase">{activo.tipo} · Tributario: {METODO_LABEL[activo.metodoTributario]}</p>
                    </td>
                    <td className="py-3 px-4 text-center text-gray-600">{formatDate(activo.fechaCompra)}</td>
                    <td className="py-3 px-4 text-right font-medium">{formatCurrency(activo.valorAdquisicion)}</td>
                    <td className="py-3 px-4 text-right font-medium text-red-600">
                      -{formatCurrency(acumulada)}
                      {activo.depreciacionAcumuladaPrevia ? <p className="text-[9px] text-amber-600">Incluye arrastre</p> : null}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-primary">{formatCurrency(valorLibro)}</td>
                    <td className="py-3 px-4 text-right font-medium text-red-600">-{formatCurrency(acumuladaTrib)}</td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-700">{formatCurrency(valorLibroTrib)}</td>
                  </tr>
                );
              })}
            </tbody>
            {activos.length > 0 && (
              <tfoot className="bg-gray-50 font-bold border-t border-gray-300">
                <tr>
                  <td colSpan={2} className="py-3 px-4 text-right uppercase">Suma Total de Activos:</td>
                  <td className="py-3 px-4 text-right">{formatCurrency(activos.reduce((acc, a) => acc + a.valorAdquisicion, 0))}</td>
                  <td className="py-3 px-4 text-right text-red-600">-{formatCurrency(activos.reduce((acc, a) => acc + calcularDepreciacionAcumulada(a), 0))}</td>
                  <td className="py-3 px-4 text-right text-primary">{formatCurrency(activos.reduce((acc, a) => acc + (a.valorAdquisicion - calcularDepreciacionAcumulada(a)), 0))}</td>
                  <td className="py-3 px-4 text-right text-red-600">-{formatCurrency(activos.reduce((acc, a) => acc + calcularAcumuladaTributaria(a), 0))}</td>
                  <td className="py-3 px-4 text-right text-emerald-700">{formatCurrency(activos.reduce((acc, a) => acc + (a.valorAdquisicion - calcularAcumuladaTributaria(a)), 0))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

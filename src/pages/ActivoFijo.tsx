import React, { useState, useEffect } from 'react';
import { Package, Plus, Calculator, X, Save } from 'lucide-react';
import { Card } from '../components/ui/Cards';
import { formatCurrency, formatDate, generateId } from '../utils/calculos';
import { useApp } from '../context/AppContext';

interface Activo {
  id: string;
  nombre: string;
  tipo: 'computacional' | 'vehiculo' | 'mueble' | 'maquinaria' | 'inmueble';
  fechaCompra: string;
  valorAdquisicion: number;
  vidaUtilNormal: number;
  vidaUtilAcelerada: number;
  depreciacionAcumuladaPrevia?: number;
  mesesUsoPrevio?: number;
}

const VIDA_UTIL_DEFAULT: Record<string, { normal: number; acelerada: number }> = {
  computacional: { normal: 3, acelerada: 1 },
  vehiculo: { normal: 7, acelerada: 2 },
  mueble: { normal: 7, acelerada: 2 },
  maquinaria: { normal: 15, acelerada: 5 },
  inmueble: { normal: 50, acelerada: 17 },
};

const STORAGE_KEY = 'scc_activos_fijos';

function loadActivos(): Activo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveActivos(activos: Activo[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(activos));
}

export default function ActivoFijo() {
  const { state, dispatch, showToast } = useApp();
  const [activos, setActivos] = useState<Activo[]>(loadActivos);
  const [metodo, setMetodo] = useState<'normal' | 'acelerada'>('normal');
  const [ipcPorcentaje, setIpcPorcentaje] = useState(3.5);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [nuevoActivo, setNuevoActivo] = useState<Partial<Activo>>({
    tipo: 'computacional',
    fechaCompra: new Date().toISOString().split('T')[0],
    vidaUtilNormal: 3,
    vidaUtilAcelerada: 1,
    depreciacionAcumuladaPrevia: 0,
    mesesUsoPrevio: 0,
  });

  useEffect(() => {
    saveActivos(activos);
  }, [activos]);

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    fetch(`${apiUrl}/api/activos-fijos`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('auth-storage') ? JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.token : ''}` },
    })
      .then(r => r.json())
      .then(data => {
        const items = data.data || data;
        if (Array.isArray(items) && items.length > 0) {
          const mapped: Activo[] = items.map((a: any) => ({
            id: a.id,
            nombre: a.descripcion,
            tipo: a.categoria as Activo['tipo'] || 'computacional',
            fechaCompra: a.fechaAdquisicion?.split('T')[0] || new Date().toISOString().split('T')[0],
            valorAdquisicion: a.valorAdquisicion,
            vidaUtilNormal: Math.round(a.valorAdquisicion / (a.depreciacionMensual || 1) / 12) || 3,
            vidaUtilAcelerada: Math.ceil(Math.round(a.valorAdquisicion / (a.depreciacionMensual || 1) / 12) / 3),
            depreciacionAcumuladaPrevia: a.depreciacionAcumulada || 0,
          }));
          setActivos(mapped);
        }
      })
      .catch(() => {});
  }, []);

  const calcularDepreciacionAnual = (activo: Activo) => {
    const vidaUtilAnos = metodo === 'normal' ? activo.vidaUtilNormal : activo.vidaUtilAcelerada;
    return activo.valorAdquisicion / vidaUtilAnos;
  };

  const calcularDepreciacionAcumulada = (activo: Activo) => {
    const depAnual = calcularDepreciacionAnual(activo);
    const fechaCompra = new Date(activo.fechaCompra);
    const fechaActual = new Date();
    let mesesUso = (fechaActual.getFullYear() - fechaCompra.getFullYear()) * 12;
    mesesUso -= fechaCompra.getMonth() + 1;
    mesesUso += fechaActual.getMonth() + 1;
    if (mesesUso < 0) mesesUso = 0;
    const depMensual = depAnual / 12;
    const acumuladaSistema = depMensual * mesesUso;
    const acumuladaTotal = acumuladaSistema + (activo.depreciacionAcumuladaPrevia || 0);
    return Math.min(acumuladaTotal, activo.valorAdquisicion - 1);
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
      estado: 'aprobado' as const,
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
      estado: 'aprobado' as const,
      tipo: 'traspaso'
    };

    dispatch({ type: 'ADD_ASIENTO', payload: nuevoAsiento });
    showToast('success', 'Depreciación Contabilizada', `Se generó el asiento de depreciación anual en el Libro Diario por un total de ${formatCurrency(totalGastoDep)}.`);
  };

  const handleGuardarActivo = () => {
    if (!nuevoActivo.nombre || !nuevoActivo.valorAdquisicion) {
      showToast('error', 'Error', 'El nombre y el valor de adquisicion son obligatorios.');
      return;
    }
    const tipo = nuevoActivo.tipo as Activo['tipo'];
    const vidaUtil = VIDA_UTIL_DEFAULT[tipo] || { normal: 3, acelerada: 1 };

    const activoAAgregar: Activo = {
      id: generateId(),
      nombre: nuevoActivo.nombre,
      tipo,
      fechaCompra: nuevoActivo.fechaCompra!,
      valorAdquisicion: Number(nuevoActivo.valorAdquisicion),
      vidaUtilNormal: Number(nuevoActivo.vidaUtilNormal) || vidaUtil.normal,
      vidaUtilAcelerada: Number(nuevoActivo.vidaUtilAcelerada) || vidaUtil.acelerada,
      depreciacionAcumuladaPrevia: Number(nuevoActivo.depreciacionAcumuladaPrevia || 0),
      mesesUsoPrevio: Number(nuevoActivo.mesesUsoPrevio || 0),
    };

    setActivos([...activos, activoAAgregar]);
    setMostrarFormulario(false);
    setNuevoActivo({ tipo: 'computacional', fechaCompra: new Date().toISOString().split('T')[0], vidaUtilNormal: 3, vidaUtilAcelerada: 1, depreciacionAcumuladaPrevia: 0, mesesUsoPrevio: 0 });
    showToast('success', 'Activo Agregado', 'El nuevo activo fijo ha sido registrado con exito.');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#1E3A5F]/10 rounded-lg">
            <Package className="text-[#1E3A5F]" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Control de Activo Fijo</h1>
            <p className="text-sm text-gray-500 mt-1">Gestion de bienes e importacion de saldos anteriores.</p>
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
                <h4 className="font-semibold text-sm text-[#1E3A5F] border-b pb-1">Datos de Adquisicion</h4>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nombre / Descripcion del Bien</label>
                  <input type="text" placeholder="Ej: Computador HP EliteBook" value={nuevoActivo.nombre || ''} onChange={(e) => setNuevoActivo({ ...nuevoActivo, nombre: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#1E3A5F]/20" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de Activo</label>
                  <select value={nuevoActivo.tipo} onChange={(e) => {
                    const t = e.target.value as Activo['tipo'];
                    const vu = VIDA_UTIL_DEFAULT[t];
                    setNuevoActivo({ ...nuevoActivo, tipo: t, vidaUtilNormal: vu.normal, vidaUtilAcelerada: vu.acelerada });
                  }} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#1E3A5F]/20">
                    <option value="computacional">Equipo Computacional (3 anos)</option>
                    <option value="vehiculo">Vehiculo (7 anos)</option>
                    <option value="mueble">Mueble u Oficina (7 anos)</option>
                    <option value="maquinaria">Maquinaria (15 anos)</option>
                    <option value="inmueble">Inmueble / Edificio (50 anos)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Fecha de Ingreso / Compra</label>
                  <input type="date" value={nuevoActivo.fechaCompra} onChange={(e) => setNuevoActivo({ ...nuevoActivo, fechaCompra: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#1E3A5F]/20" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Valor de Adquisicion ($)</label>
                  <input type="number" value={nuevoActivo.valorAdquisicion || ''} onChange={(e) => setNuevoActivo({ ...nuevoActivo, valorAdquisicion: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#1E3A5F]/20" />
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="font-semibold text-sm text-emerald-700 border-b pb-1">Migracion de Sistema Anterior (Opcional)</h4>
                <p className="text-[10px] text-gray-500 leading-tight mb-2">Complete estos datos solo si esta registrando un activo que ya estaba en uso en otro software contable.</p>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Depreciacion Acumulada Anterior ($)</label>
                  <input type="number" placeholder="Monto ya depreciado" value={nuevoActivo.depreciacionAcumuladaPrevia || ''} onChange={(e) => setNuevoActivo({ ...nuevoActivo, depreciacionAcumuladaPrevia: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg text-sm bg-amber-50 focus:ring-2 focus:ring-[#1E3A5F]/20" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Meses de Vida Util ya Consumidos</label>
                  <input type="number" placeholder="Ej: 12 meses" value={nuevoActivo.mesesUsoPrevio || ''} onChange={(e) => setNuevoActivo({ ...nuevoActivo, mesesUsoPrevio: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg text-sm bg-amber-50 focus:ring-2 focus:ring-[#1E3A5F]/20" />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
              <button onClick={() => setMostrarFormulario(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">Cancelar</button>
              <button onClick={handleGuardarActivo} className="px-4 py-2 bg-[#1E3A5F] text-white rounded-lg text-sm font-medium hover:bg-[#2D5A87] transition-colors flex items-center gap-2"><Save size={16} /> Guardar Activo</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 md:col-span-3 border-[#1E3A5F]/20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Método Tributario de Cálculo</label>
              <select value={metodo} onChange={(e) => setMetodo(e.target.value as 'normal' | 'acelerada')} className="w-full px-4 py-2 border rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-[#1E3A5F]/20">
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
                className="w-full px-4 py-2 border rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-[#1E3A5F]/20" 
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
                className="flex-1 px-4 py-2.5 bg-[#1E3A5F] hover:bg-[#2D5A87] text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-xs font-semibold"
              >
                <Calculator size={14} /> Depreciar Ejercicio
              </button>
            </div>
          </div>
        </Card>

        <div className="col-span-1 md:col-span-3 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-100 border-b-2 border-gray-300">
              <tr className="text-gray-700">
                <th className="py-3 px-4 font-semibold">Activo Fijo</th>
                <th className="py-3 px-4 font-semibold text-center">F. Adquisicion</th>
                <th className="py-3 px-4 font-semibold text-center">Vida Util (Anos)</th>
                <th className="py-3 px-4 font-semibold text-right">Valor Inicial</th>
                <th className="py-3 px-4 font-semibold text-right text-red-700">Dep. Acumulada</th>
                <th className="py-3 px-4 font-semibold text-right text-blue-800">Valor Libro Actual</th>
              </tr>
            </thead>
            <tbody>
              {activos.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-gray-500">
                  <Package size={40} className="mx-auto mb-3 text-gray-300" />
                  <p>No hay activos fijos registrados</p>
                  <p className="text-xs mt-1">Haga clic en "Nuevo Activo" para agregar uno</p>
                </td></tr>
              )}
              {activos.map((activo) => {
                const acumulada = calcularDepreciacionAcumulada(activo);
                const valorLibro = activo.valorAdquisicion - acumulada;
                const vidaUtilDisplay = metodo === 'normal' ? activo.vidaUtilNormal : activo.vidaUtilAcelerada;
                return (
                  <tr key={activo.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{activo.nombre}</p>
                        {activo.depreciacionAcumuladaPrevia ? <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded font-bold">MIGRADO</span> : null}
                      </div>
                      <p className="text-[10px] text-gray-500 uppercase">{activo.tipo}</p>
                    </td>
                    <td className="py-3 px-4 text-center text-gray-600">{formatDate(activo.fechaCompra)}</td>
                    <td className="py-3 px-4 text-center font-bold text-gray-700">{vidaUtilDisplay}</td>
                    <td className="py-3 px-4 text-right font-medium">{formatCurrency(activo.valorAdquisicion)}</td>
                    <td className="py-3 px-4 text-right font-medium text-red-600">
                      -{formatCurrency(acumulada)}
                      {activo.depreciacionAcumuladaPrevia ? <p className="text-[9px] text-amber-600">Incluye arrastre</p> : null}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-[#1E3A5F]">{formatCurrency(valorLibro)}</td>
                  </tr>
                );
              })}
            </tbody>
            {activos.length > 0 && (
              <tfoot className="bg-gray-50 font-bold border-t border-gray-300">
                <tr>
                  <td colSpan={3} className="py-3 px-4 text-right uppercase">Suma Total de Activos:</td>
                  <td className="py-3 px-4 text-right">{formatCurrency(activos.reduce((acc, a) => acc + a.valorAdquisicion, 0))}</td>
                  <td className="py-3 px-4 text-right text-red-600">-{formatCurrency(activos.reduce((acc, a) => acc + calcularDepreciacionAcumulada(a), 0))}</td>
                  <td className="py-3 px-4 text-right text-[#1E3A5F]">{formatCurrency(activos.reduce((acc, a) => acc + (a.valorAdquisicion - calcularDepreciacionAcumulada(a)), 0))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

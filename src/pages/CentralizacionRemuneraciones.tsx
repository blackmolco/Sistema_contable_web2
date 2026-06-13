import React, { useState } from 'react';
import { RefreshCw, Save, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatCurrency, generateId } from '../utils/calculos';
import { Card } from '../components/ui/Cards';
import { DetalleAsiento } from '../types';

export default function CentralizacionRemuneraciones() {
  const { state, dispatch, showToast } = useApp();
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1);
  const [anio, setAnio] = useState<number>(new Date().getFullYear());

  const periodKey = `${anio}-${String(mes).padStart(2, '0')}`;
  
  // Buscar liquidación del periodo seleccionado
  const liquidacionPeriodo = (state.liquidaciones || []).find(l => l.periodo === periodKey);

  // Verificar si ya existe un asiento contable de centralización para este periodo
  const glosaBuscada = `Centralización de Remuneraciones Mes ${mes}/${anio}`;
  const asientoExistente = (state.asientos || []).find(
    a => a.glosa === glosaBuscada && a.estado !== 'anulado'
  );

  // Helper para buscar cuenta contable en el plan de cuentas o retornar fallback
  const buscarCuenta = (codigo: string, defaultNombre: string, defaultId: string) => {
    const c = state.cuentas?.find(x => x.codigo === codigo);
    return {
      cuentaId: c?.id || defaultId,
      cuentaCodigo: c?.codigo || codigo,
      cuentaNombre: c?.nombre || defaultNombre
    };
  };

  // Cálculo de totales reales si existe la liquidación
  const hasData = !!liquidacionPeriodo && liquidacionPeriodo.lineas.length > 0;

  const totalTrabajadores = hasData ? liquidacionPeriodo.lineas.length : 0;
  
  // Haberes imponibles y no imponibles
  const sueldoBaseTotal = hasData ? liquidacionPeriodo.lineas.reduce((acc, l) => acc + (l.sueldoBase || 0), 0) : 0;
  const horasExtrasTotal = hasData ? liquidacionPeriodo.lineas.reduce((acc, l) => acc + (l.montoHorasExtras || 0), 0) : 0;
  const gratificacionTotal = hasData ? liquidacionPeriodo.lineas.reduce((acc, l) => acc + (l.gratificacion || 0), 0) : 0;
  const bonificacionTotal = hasData ? liquidacionPeriodo.lineas.reduce((acc, l) => acc + (l.bonificacion || 0), 0) : 0;
  
  const colacionTotal = hasData ? liquidacionPeriodo.lineas.reduce((acc, l) => acc + (l.colacion || 0), 0) : 0;
  const movilizacionTotal = hasData ? liquidacionPeriodo.lineas.reduce((acc, l) => acc + (l.movilizacion || 0), 0) : 0;
  
  const imponibleTotal = sueldoBaseTotal + horasExtrasTotal + gratificacionTotal + bonificacionTotal;
  const asignacionesTotal = colacionTotal + movilizacionTotal;
  
  const totalHaberesReal = imponibleTotal + asignacionesTotal;

  // Aportes Empleador (Gastos adicionales)
  const afcEmpleador = hasData ? liquidacionPeriodo.lineas.reduce((acc, l) => acc + (l.afcEmpleador || 0), 0) : 0;
  const mutualSeguridad = hasData ? liquidacionPeriodo.lineas.reduce((acc, l) => acc + (l.mutual || 0), 0) : 0;
  const sisEmpleador = hasData ? liquidacionPeriodo.lineas.reduce((acc, l) => acc + (l.sisEmpleador || 0), 0) : 0;
  
  const gastoLeyesSociales = afcEmpleador + mutualSeguridad + sisEmpleador;

  // Retenciones a pagar (Pasivos)
  const afpTrabajador = hasData ? liquidacionPeriodo.lineas.reduce((acc, l) => acc + (l.totalAfp || 0), 0) : 0;
  const saludTrabajador = hasData ? liquidacionPeriodo.lineas.reduce((acc, l) => acc + (l.salud || 0), 0) : 0;
  const afcTrabajador = hasData ? liquidacionPeriodo.lineas.reduce((acc, l) => acc + (l.afc || 0), 0) : 0;
  
  const impuestoUnicoTotal = hasData ? liquidacionPeriodo.lineas.reduce((acc, l) => acc + (l.impuestoUnico || 0), 0) : 0;
  const anticiposTotal = hasData ? liquidacionPeriodo.lineas.reduce((acc, l) => acc + (l.anticipos || 0), 0) : 0;
  
  const totalLeyesSocialesPagar = afpTrabajador + saludTrabajador + afcTrabajador + afcEmpleador + mutualSeguridad + sisEmpleador;
  const sueldoLiquidoPagar = hasData ? liquidacionPeriodo.lineas.reduce((acc, l) => acc + (l.sueldoLiquido || 0), 0) : 0;

  // Cuentas contables para el asiento
  const cSueldos = buscarCuenta('5-1-100', 'Sueldos y Salarios', 'g-sueldos');
  const cLeyesGasto = buscarCuenta('5-1-110', 'Leyes Sociales (Aporte Empleador)', 'g-leyes');
  const cLeyesPagar = buscarCuenta('2-1-200', 'Leyes Sociales por Pagar', 'p-leyes');
  const cImpuestoPagar = buscarCuenta('2-1-210', 'Impuesto Único por Pagar', 'p-impuesto');
  const cAnticipos = buscarCuenta('1-1-400', 'Anticipos al Personal', 'a-anticipos');
  const cSueldosPagar = buscarCuenta('2-1-100', 'Sueldos por Pagar', 'p-sueldos');

  // Detalle visual y para asiento
  const detalles: DetalleAsiento[] = hasData ? [
    { ...cSueldos, debe: totalHaberesReal, haber: 0 },
    { ...cLeyesGasto, debe: gastoLeyesSociales, haber: 0 },
    { ...cLeyesPagar, debe: 0, haber: totalLeyesSocialesPagar },
    { ...cImpuestoPagar, debe: 0, haber: impuestoUnicoTotal },
    { ...cAnticipos, debe: 0, haber: anticiposTotal },
    { ...cSueldosPagar, debe: 0, haber: sueldoLiquidoPagar }
  ].filter(d => d.debe > 0 || d.haber > 0) : [];

  const totalDebe = detalles.reduce((acc, d) => acc + d.debe, 0);
  const totalHaber = detalles.reduce((acc, d) => acc + d.haber, 0);

  const generarCentralizacion = () => {
    if (!hasData) {
      showToast('error', 'Sin datos', 'No hay liquidaciones procesadas para este período.');
      return;
    }

    if (asientoExistente) {
      showToast('warning', 'Ya contabilizado', 'Este período ya ha sido centralizado en el Libro Diario.');
      return;
    }

    const nuevoAsiento = {
      id: generateId(),
      fecha: new Date(anio, mes, 0).toISOString().split('T')[0], // Último día del mes
      numero: state.numeroAsiento || 1,
      glosa: glosaBuscada,
      detalles,
      totalDebe,
      totalHaber,
      estado: 'aprobado' as const,
      tipo: 'traspaso'
    };

    dispatch({ type: 'ADD_ASIENTO', payload: nuevoAsiento });
    showToast('success', 'Centralización Exitosa', `El asiento de remuneraciones Mes ${mes}/${anio} fue ingresado al Libro Diario.`);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-[#1E3A5F]/10 rounded-lg">
          <RefreshCw className="text-[#1E3A5F]" size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Centralización Contable de Remuneraciones</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Contabiliza automáticamente el Libro de Remuneraciones procesado del mes en el Libro Diario.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-[#1E3A5F]/20 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Periodo</label>
                <select 
                  value={mes} 
                  onChange={(e) => setMes(Number(e.target.value))} 
                  className="w-40 px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value={1}>Enero</option>
                  <option value={2}>Febrero</option>
                  <option value={3}>Marzo</option>
                  <option value={4}>Abril</option>
                  <option value={5}>Mayo</option>
                  <option value={6}>Junio</option>
                  <option value={7}>Julio</option>
                  <option value={8}>Agosto</option>
                  <option value={9}>Septiembre</option>
                  <option value={10}>Octubre</option>
                  <option value={11}>Noviembre</option>
                  <option value={12}>Diciembre</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Año</label>
                <input 
                  type="number" 
                  value={anio} 
                  onChange={(e) => setAnio(Number(e.target.value))} 
                  className="w-28 px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                />
              </div>
            </div>

            {asientoExistente ? (
              <div className="px-6 py-3 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 rounded-lg flex items-center gap-2 font-medium border border-emerald-300 dark:border-emerald-800">
                <CheckCircle2 size={18} /> Centralizado (Asiento N° {asientoExistente.numero})
              </div>
            ) : hasData ? (
              <button 
                onClick={generarCentralizacion} 
                className="px-6 py-3 bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2D5A87] transition-colors flex items-center gap-2 font-medium shadow-sm"
              >
                <Save size={18} /> Centralizar Remuneraciones en Libro Diario
              </button>
            ) : (
              <div className="px-6 py-3 bg-amber-50 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400 rounded-lg flex items-center gap-2 font-medium border border-amber-200 dark:border-amber-900">
                <AlertTriangle size={18} /> Sin liquidaciones en el periodo
              </div>
            )}
          </div>
        </Card>

        {/* Resumen del Período */}
        {hasData && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
              <span className="text-xs text-gray-500 block">Trabajadores</span>
              <span className="text-xl font-bold text-gray-800 dark:text-white">{totalTrabajadores}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
              <span className="text-xs text-gray-500 block">Total Imponible</span>
              <span className="text-xl font-bold text-gray-800 dark:text-white">{formatCurrency(imponibleTotal)}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
              <span className="text-xs text-gray-500 block">Leyes Sociales (Cotizaciones)</span>
              <span className="text-xl font-bold text-gray-800 dark:text-white">{formatCurrency(totalLeyesSocialesPagar)}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
              <span className="text-xs text-gray-500 block">Sueldo Líquido Total</span>
              <span className="text-xl font-bold text-[#1E3A5F] dark:text-blue-400">{formatCurrency(sueldoLiquidoPagar)}</span>
            </div>
          </div>
        )}

        {!hasData ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center space-y-4">
            <AlertTriangle className="text-amber-500" size={48} />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Falta procesar liquidaciones</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md">
              No se han calculado liquidaciones de sueldo para el período <b>{mes}/{anio}</b>.
              Debe ir a la sección de Remuneraciones, calcular los sueldos y guardar el período antes de centralizar.
            </p>
            <a 
              href="#/remuneraciones" 
              onClick={(e) => {
                // Si la app usa un ruteador hash o similar, o simplemente redirige por link
                // Si no, redirección clásica.
              }}
              className="px-6 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-lg font-medium inline-flex items-center gap-2 text-sm transition-colors"
            >
              Ir a Remuneraciones <ArrowRight size={16} />
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Vista Previa de Asiento Contable de Sueldos</h3>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">Glosa: {glosaBuscada}</span>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                    <tr className="text-xs uppercase text-gray-600 dark:text-gray-400">
                      <th className="p-4 font-semibold w-1/6">Código</th>
                      <th className="p-4 font-semibold w-2/6">Cuenta Contable</th>
                      <th className="p-4 text-right font-semibold w-1.5/6">Cargos (Debe)</th>
                      <th className="p-4 text-right font-semibold w-1.5/6">Abonos (Haber)</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-gray-100 dark:divide-gray-700">
                    {/* Fila Sueldos Gasto */}
                    <tr className="dark:hover:bg-gray-750">
                      <td className="p-4 font-mono text-gray-500 dark:text-gray-400">{cSueldos.cuentaCodigo}</td>
                      <td className="p-4 font-medium text-gray-900 dark:text-white">{cSueldos.cuentaNombre}</td>
                      <td className="p-4 text-right font-medium text-blue-600 dark:text-blue-400">{formatCurrency(totalHaberesReal)}</td>
                      <td className="p-4 text-right"></td>
                    </tr>
                    
                    {/* Fila Aporte Empleador Gasto */}
                    {gastoLeyesSociales > 0 && (
                      <tr className="dark:hover:bg-gray-750">
                        <td className="p-4 font-mono text-gray-500 dark:text-gray-400">{cLeyesGasto.cuentaCodigo}</td>
                        <td className="p-4 font-medium text-gray-900 dark:text-white">{cLeyesGasto.cuentaNombre}</td>
                        <td className="p-4 text-right font-medium text-blue-600 dark:text-blue-400">{formatCurrency(gastoLeyesSociales)}</td>
                        <td className="p-4 text-right"></td>
                      </tr>
                    )}
                    
                    {/* Fila Leyes Sociales Pagar */}
                    {totalLeyesSocialesPagar > 0 && (
                      <tr className="dark:hover:bg-gray-750 bg-gray-50/20 dark:bg-gray-900/10">
                        <td className="p-4 font-mono text-gray-500 dark:text-gray-400">{cLeyesPagar.cuentaCodigo}</td>
                        <td className="p-4 text-gray-700 dark:text-gray-300 pl-8">{cLeyesPagar.cuentaNombre}</td>
                        <td className="p-4 text-right"></td>
                        <td className="p-4 text-right font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(totalLeyesSocialesPagar)}</td>
                      </tr>
                    )}
                    
                    {/* Fila Impuesto Único */}
                    {impuestoUnicoTotal > 0 && (
                      <tr className="dark:hover:bg-gray-750 bg-gray-50/20 dark:bg-gray-900/10">
                        <td className="p-4 font-mono text-gray-500 dark:text-gray-400">{cImpuestoPagar.cuentaCodigo}</td>
                        <td className="p-4 text-gray-700 dark:text-gray-300 pl-8">{cImpuestoPagar.cuentaNombre}</td>
                        <td className="p-4 text-right"></td>
                        <td className="p-4 text-right font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(impuestoUnicoTotal)}</td>
                      </tr>
                    )}
                    
                    {/* Fila Anticipos */}
                    {anticiposTotal > 0 && (
                      <tr className="dark:hover:bg-gray-750 bg-gray-50/20 dark:bg-gray-900/10">
                        <td className="p-4 font-mono text-gray-500 dark:text-gray-400">{cAnticipos.cuentaCodigo}</td>
                        <td className="p-4 text-gray-700 dark:text-gray-300 pl-8">{cAnticipos.cuentaNombre}</td>
                        <td className="p-4 text-right"></td>
                        <td className="p-4 text-right font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(anticiposTotal)}</td>
                      </tr>
                    )}
                    
                    {/* Fila Sueldos Pagar */}
                    {sueldoLiquidoPagar > 0 && (
                      <tr className="dark:hover:bg-gray-750 bg-gray-50/20 dark:bg-gray-900/10">
                        <td className="p-4 font-mono text-gray-500 dark:text-gray-400">{cSueldosPagar.cuentaCodigo}</td>
                        <td className="p-4 text-gray-700 dark:text-gray-300 pl-8">{cSueldosPagar.cuentaNombre}</td>
                        <td className="p-4 text-right"></td>
                        <td className="p-4 text-right font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(sueldoLiquidoPagar)}</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-gray-100 dark:bg-gray-900 border-t-2 border-gray-300 dark:border-gray-700 font-bold">
                    <tr>
                      <td colSpan={2} className="p-4 text-right uppercase text-xs text-gray-700 dark:text-gray-300">Total Asiento:</td>
                      <td className="p-4 text-right text-gray-900 dark:text-white border-r border-gray-300 dark:border-gray-700">{formatCurrency(totalDebe)}</td>
                      <td className="p-4 text-right text-gray-900 dark:text-white">{formatCurrency(totalHaber)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


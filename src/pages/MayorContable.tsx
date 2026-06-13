import React, { useState, useMemo, useEffect } from 'react';
import { BookOpen, Search, RefreshCw, Printer, Calendar } from 'lucide-react';
import { Card } from '../components/ui/Cards';
import { Button, Input } from '../components/ui/FormElements';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate } from '../utils/calculos';
import { generarPDFMayorContable } from '../services/reportesPdf';

interface MovimientoMayor {
  fecha: string;
  numeroAsiento: number;
  glosa: string;
  debe: number;
  haber: number;
  saldo: number;
}

export default function MayorContable() {
  const { state, showToast } = useApp();
  const [cuentaBusqueda, setCuentaBusqueda] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState<string>('');
  const [vistaT, setVistaT] = useState(false);

  // 1. Extraer todas las cuentas únicas que tienen movimientos
  const cuentasUnicas = useMemo(() => {
    const map = new Map<string, { codigo: string; nombre: string }>();
    state.asientos.forEach((a) => {
      a.detalles.forEach((d) => {
        if (!map.has(d.cuentaCodigo)) {
          map.set(d.cuentaCodigo, { codigo: d.cuentaCodigo, nombre: d.cuentaNombre });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [state.asientos]);

  // 2. Filtrar por buscador
  const cuentasFiltradas = cuentasUnicas.filter(
    (c) =>
      c.codigo.includes(cuentaBusqueda) ||
      c.nombre.toLowerCase().includes(cuentaBusqueda.toLowerCase())
  );

  // Auto-seleccionar la primera cuenta disponible
  useEffect(() => {
    if (!cuentaSeleccionada && cuentasUnicas.length > 0) {
      setCuentaSeleccionada(cuentasUnicas[0].codigo);
    }
  }, [cuentasUnicas]);

  // 3. Generar movimientos para la cuenta seleccionada
  const movimientosMayor = useMemo(() => {
    if (!cuentaSeleccionada) return [];

    const movimientos: MovimientoMayor[] = [];
    let saldoAcumulado = 0;

    const asientosFiltrados = state.asientos
      .filter((a) => {
        if (fechaDesde && new Date(a.fecha) < new Date(fechaDesde)) return false;
        if (fechaHasta && new Date(a.fecha) > new Date(fechaHasta)) return false;
        return true;
      })
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

    asientosFiltrados.forEach((asiento) => {
      const lineasCuenta = asiento.detalles.filter(
        (d) => d.cuentaCodigo === cuentaSeleccionada
      );
      lineasCuenta.forEach((linea) => {
        saldoAcumulado += linea.debe - linea.haber;
        movimientos.push({
          fecha: asiento.fecha,
          numeroAsiento: asiento.numero,
          glosa: asiento.glosa,
          debe: linea.debe,
          haber: linea.haber,
          saldo: saldoAcumulado,
        });
      });
    });

    return movimientos;
  }, [state.asientos, cuentaSeleccionada, fechaDesde, fechaHasta]);

  const handlePrint = () => {
    if (!cuentaSeleccionada) {
      showToast('warning', 'Sin cuenta', 'Selecciona una cuenta en el panel izquierdo');
      return;
    }
    generarPDFMayorContable(
      cuentaSeleccionada,
      infoCuenta?.nombre ?? cuentaSeleccionada,
      movimientosMayor,
      fechaDesde || undefined,
      fechaHasta || undefined
    );
  };

  const infoCuenta = cuentasUnicas.find((c) => c.codigo === cuentaSeleccionada);
  const saldoFinal = movimientosMayor.at(-1)?.saldo ?? null;
  const totalDebe = movimientosMayor.reduce((acc, m) => acc + m.debe, 0);
  const totalHaber = movimientosMayor.reduce((acc, m) => acc + m.haber, 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto mayor-container">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .mayor-container, .mayor-container * { visibility: visible; }
          .mayor-container { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#1E3A5F]/10 rounded-lg">
            <BookOpen className="text-[#1E3A5F]" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Libro Mayor</h1>
            <p className="text-sm text-gray-500 mt-1">
              Busca una cuenta para ver su historial de movimientos y saldo exacto.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200">
            <button
              type="button"
              onClick={() => setVistaT(false)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                !vistaT ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-805'
              }`}
            >
              Vista Tabla
            </button>
            <button
              type="button"
              onClick={() => setVistaT(true)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                vistaT ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-850'
              }`}
            >
              Cuenta T
            </button>
          </div>
          <Button variant="secondary" icon={<Printer size={16} />} onClick={handlePrint}>
            Imprimir Mayor
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Panel Izquierdo: Selector de Cuentas */}
        <div className="lg:col-span-1 space-y-4 no-print">
          <Card title="Cuentas con movimientos" padding="sm">
            <div className="mb-3">
              <Input
                placeholder="Buscar cuenta o código..."
                value={cuentaBusqueda}
                onChange={(e) => setCuentaBusqueda(e.target.value)}
                leftIcon={<Search size={14} />}
              />
            </div>

            <div className="max-h-[500px] overflow-y-auto space-y-0.5 pr-1 custom-scrollbar">
              {cuentasFiltradas.length === 0 ? (
                <p className="text-xs text-center text-gray-500 py-4">
                  No se encontraron cuentas con movimientos.
                </p>
              ) : (
                cuentasFiltradas.map((c) => {
                  const isActive = cuentaSeleccionada === c.codigo;
                  return (
                    <button
                      key={c.codigo}
                      onClick={() => setCuentaSeleccionada(c.codigo)}
                      className={`w-full text-left p-2.5 rounded-lg text-xs
                        transition-[background-color,color,transform] duration-150
                        active:scale-[0.97]
                        ${isActive
                          ? 'bg-[#1E3A5F] text-white shadow-sm'
                          : 'hover:bg-gray-100 text-gray-700'
                        }`}
                    >
                      <span className="font-mono block text-[11px] opacity-75">{c.codigo}</span>
                      <span className="font-medium truncate block">{c.nombre}</span>
                    </button>
                  );
                })
              )}
            </div>
          </Card>
        </div>

        {/* Panel Derecho: Filtros + Tabla */}
        <div className="lg:col-span-3 space-y-4">
          {/* Filtro de fechas */}
          <Card className="no-print">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[160px]">
                <Input
                  label="Fecha Desde"
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  leftIcon={<Calendar size={14} />}
                />
              </div>
              <div className="flex-1 min-w-[160px]">
                <Input
                  label="Fecha Hasta"
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  leftIcon={<Calendar size={14} />}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon={<RefreshCw size={14} />}
                onClick={() => { setFechaDesde(''); setFechaHasta(''); }}
                disabled={!fechaDesde && !fechaHasta}
              >
                Limpiar
              </Button>
            </div>
          </Card>

          {/* Tabla del Mayor */}
          {cuentaSeleccionada ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 print:border-none print:shadow-none">
              {/* Cabecera del documento */}
              <div className="p-5 border-b border-gray-200 text-center">
                <h2 className="text-xl font-bold uppercase text-gray-900">LIBRO MAYOR</h2>
                <p className="text-base font-bold text-[#1E3A5F] mt-1">
                  {infoCuenta?.codigo} — {infoCuenta?.nombre}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {fechaDesde && fechaHasta
                    ? `Desde ${fechaDesde} hasta ${fechaHasta}`
                    : 'Todos los movimientos históricos'}
                </p>
              </div>

              {/* Saldo final destacado */}
              {saldoFinal !== null && (
                <div className={`mx-5 mt-4 mb-1 flex items-center gap-3 p-3 rounded-lg border ${
                  saldoFinal >= 0
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-red-50 border-red-200'
                }`}>
                  <span className="text-sm text-gray-600">Saldo actual:</span>
                  <span className={`text-lg font-bold ${saldoFinal >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {formatCurrency(saldoFinal)}
                  </span>
                  <span className="text-xs text-gray-400 ml-auto">
                    {movimientosMayor.length} movimiento{movimientosMayor.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}

              {!vistaT ? (
                <div className="overflow-x-auto overflow-y-auto max-h-[70vh] p-0 pb-0">
                  <table className="w-full table-modern">
                    <thead className="sticky top-0 z-10 bg-white dark:bg-gray-800">
                      <tr>
                        <th className="w-24">Fecha</th>
                        <th className="w-24">N° Comp.</th>
                        <th>Glosa</th>
                        <th className="text-right w-28">Debe</th>
                        <th className="text-right w-28">Haber</th>
                        <th className="text-right w-28">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movimientosMayor.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-10 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <BookOpen size={32} className="text-gray-200" />
                              <p className="text-sm text-gray-500">
                                No hay movimientos para esta cuenta en el período seleccionado.
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        movimientosMayor.map((mov, idx) => (
                          <tr key={idx} className="odd:bg-gray-50/50 dark:odd:bg-gray-800/30 hover:bg-blue-50 dark:hover:bg-gray-700/50">
                            <td className="py-2 px-4 text-xs">{formatDate(mov.fecha)}</td>
                            <td className="py-2 px-4 font-mono text-xs text-[#1E3A5F] font-bold">
                              #{mov.numeroAsiento}
                            </td>
                            <td className="py-2 px-4 text-xs text-gray-700">{mov.glosa}</td>
                            <td className="py-2 px-4 text-right tnum text-sm font-medium text-gray-900">
                              {mov.debe > 0 ? formatCurrency(mov.debe) : ''}
                            </td>
                            <td className="py-2 px-4 text-right tnum text-sm font-medium text-gray-900">
                              {mov.haber > 0 ? formatCurrency(mov.haber) : ''}
                            </td>
                            <td
                              className={`py-2 px-4 text-right tnum text-sm font-bold ${
                                mov.saldo < 0 ? 'text-red-600' : 'text-emerald-700'
                              }`}
                            >
                              {formatCurrency(mov.saldo)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {movimientosMayor.length > 0 && (
                      <tfoot className="sticky bottom-0 border-t-2 border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 font-semibold">
                        <tr className="font-semibold text-gray-800 dark:text-gray-100">
                          <td colSpan={3} className="py-3 px-4 text-right uppercase text-xs">
                            Sumas Totales y Saldo Final:
                          </td>
                          <td className="py-3 px-4 text-right tnum text-emerald-700">
                            {formatCurrency(totalDebe)}
                          </td>
                          <td className="py-3 px-4 text-right tnum text-red-600">
                            {formatCurrency(totalHaber)}
                          </td>
                          <td
                            className={`py-3 px-4 text-right tnum text-base font-bold ${
                              (saldoFinal ?? 0) < 0 ? 'text-red-700' : 'text-emerald-700'
                            }`}
                          >
                            {saldoFinal !== null ? formatCurrency(saldoFinal) : ''}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              ) : (
                <div className="p-6">
                  {/* The T layout body */}
                  <div className="grid grid-cols-2 gap-0 relative min-h-[250px]">
                    {/* Vertical Divider */}
                    <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-gray-405 -translate-x-1/2"></div>
                    
                    {/* Left Column: DEBE */}
                    <div className="pr-6">
                      <div className="text-center font-bold uppercase text-gray-700 pb-2 border-b-2 border-gray-400 mb-2 text-sm">
                        Debe (Débitos)
                      </div>
                      <div className="space-y-1 divide-y divide-gray-100 max-h-[400px] overflow-y-auto pr-1">
                        {movimientosMayor.filter(m => m.debe > 0).length === 0 ? (
                          <p className="text-center text-xs text-gray-400 py-10">Sin cargos</p>
                        ) : (
                          movimientosMayor.filter(m => m.debe > 0).map((mov, idx) => (
                            <div key={idx} className="py-2 text-xs hover:bg-gray-50 px-2 rounded transition-colors">
                              <div className="flex justify-between items-start gap-2">
                                <span className="font-mono text-[#1E3A5F] font-semibold">#{mov.numeroAsiento}</span>
                                <span className="font-bold text-gray-900">{formatCurrency(mov.debe)}</span>
                              </div>
                              <div className="flex justify-between items-center text-[10px] text-gray-500 mt-0.5">
                                <span className="truncate max-w-[150px] md:max-w-[200px]" title={mov.glosa}>{mov.glosa}</span>
                                <span>{formatDate(mov.fecha)}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Right Column: HABER */}
                    <div className="pl-6">
                      <div className="text-center font-bold uppercase text-gray-700 pb-2 border-b-2 border-gray-400 mb-2 text-sm">
                        Haber (Créditos)
                      </div>
                      <div className="space-y-1 divide-y divide-gray-100 max-h-[400px] overflow-y-auto pr-1">
                        {movimientosMayor.filter(m => m.haber > 0).length === 0 ? (
                          <p className="text-center text-xs text-gray-400 py-10">Sin abonos</p>
                        ) : (
                          movimientosMayor.filter(m => m.haber > 0).map((mov, idx) => (
                            <div key={idx} className="py-2 text-xs hover:bg-gray-50 px-2 rounded transition-colors">
                              <div className="flex justify-between items-start gap-2">
                                <span className="font-mono text-[#1E3A5F] font-semibold">#{mov.numeroAsiento}</span>
                                <span className="font-bold text-gray-900">{formatCurrency(mov.haber)}</span>
                              </div>
                              <div className="flex justify-between items-center text-[10px] text-gray-500 mt-0.5">
                                <span className="truncate max-w-[150px] md:max-w-[200px]" title={mov.glosa}>{mov.glosa}</span>
                                <span>{formatDate(mov.fecha)}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Totals under columns */}
                  <div className="grid grid-cols-2 gap-0 border-t-2 border-gray-400 pt-3 relative">
                    <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-gray-405 -translate-x-1/2"></div>
                    <div className="pr-6 text-right">
                      <span className="text-[10px] text-gray-500 uppercase block font-semibold">Suma Debe</span>
                      <span className="font-bold text-sm text-gray-900">{formatCurrency(totalDebe)}</span>
                    </div>
                    <div className="pl-6 text-right">
                      <span className="text-[10px] text-gray-500 uppercase block font-semibold">Suma Haber</span>
                      <span className="font-bold text-sm text-gray-900">{formatCurrency(totalHaber)}</span>
                    </div>
                  </div>

                  {/* Net Balance (Saldo) under the larger side */}
                  <div className="grid grid-cols-2 gap-0 border-t border-dashed border-gray-300 mt-3 pt-3 relative">
                    <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-gray-405 -translate-x-1/2"></div>
                    <div className="pr-6">
                      {saldoFinal !== null && saldoFinal >= 0 ? (
                        <div className="text-right">
                          <span className="text-[10px] text-emerald-600 uppercase font-bold block">Saldo Deudor</span>
                          <span className="font-extrabold text-base text-emerald-700">{formatCurrency(saldoFinal)}</span>
                        </div>
                      ) : null}
                    </div>
                    <div className="pl-6">
                      {saldoFinal !== null && saldoFinal < 0 ? (
                        <div className="text-right">
                          <span className="text-[10px] text-red-600 uppercase font-bold block">Saldo Acreedor</span>
                          <span className="font-extrabold text-base text-red-700">{formatCurrency(Math.abs(saldoFinal))}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-300 no-print">
              <BookOpen size={48} className="text-gray-300 mb-4" />
              <p className="text-gray-500 font-medium text-lg">
                Selecciona una cuenta en el panel izquierdo
              </p>
              <p className="text-gray-400 text-sm mt-1">
                Podrás visualizar e imprimir su Libro Mayor
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import { Download, AlertCircle, CheckCircle } from 'lucide-react';
import { Card } from '../components/ui/Cards';
import { Button, Input } from '../components/ui/FormElements';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/calculos';

// ── Helpers ────────────────────────────────────────────────────────────────────

function toDate(s: string) {
  return new Date(s + 'T00:00:00');
}

// ── Tipos internos ─────────────────────────────────────────────────────────────

interface FilaBalance {
  codigo: string;
  nombre: string;
  tipo: string;
  saldoAnt:   { debe: number; haber: number };
  movimiento: { debe: number; haber: number };
  saldoAct:   { debe: number; haber: number };
}

// ── Componente ─────────────────────────────────────────────────────────────────

export default function BalanceOchoColumnas() {
  const { state } = useApp();

  const hoy = new Date();
  const primerDiaAnio = new Date(hoy.getFullYear(), 0, 1).toISOString().split('T')[0];
  const [fechaInicio, setFechaInicio] = useState(primerDiaAnio);
  const [fechaFin, setFechaFin] = useState(hoy.toISOString().split('T')[0]);

  // ── Cálculo del balance ──────────────────────────────────────────────────────

  const filas = useMemo<FilaBalance[]>(() => {
    const mapa = new Map<string, {
      nombre: string; tipo: string;
      antD: number; antH: number;
      movD: number; movH: number;
    }>();

    const tipoPorCodigo = new Map<string, string>();
    state.cuentas.forEach((c) => tipoPorCodigo.set(c.codigo, c.tipo));

    const ini = fechaInicio ? toDate(fechaInicio) : null;
    const fin = fechaFin ? toDate(fechaFin) : null;

    state.asientos
      .filter((a) => a.estado !== 'anulado')
      .forEach((asiento) => {
        const fAsiento = toDate(asiento.fecha);
        const esAnterior = ini ? fAsiento < ini : false;
        const esMovimiento =
          (!ini || fAsiento >= ini) && (!fin || fAsiento <= fin);

        if (!esAnterior && !esMovimiento) return;

        asiento.detalles.forEach((d) => {
          if (!mapa.has(d.cuentaCodigo)) {
            mapa.set(d.cuentaCodigo, {
              nombre: d.cuentaNombre,
              tipo: tipoPorCodigo.get(d.cuentaCodigo) ?? 'activo',
              antD: 0, antH: 0, movD: 0, movH: 0,
            });
          }
          const r = mapa.get(d.cuentaCodigo)!;
          if (esAnterior) {
            r.antD += d.debe;
            r.antH += d.haber;
          } else {
            r.movD += d.debe;
            r.movH += d.haber;
          }
        });
      });

    return Array.from(mapa.entries())
      .map(([codigo, v]) => ({
        codigo,
        nombre: v.nombre,
        tipo: v.tipo,
        saldoAnt:   { debe: Math.round(v.antD), haber: Math.round(v.antH) },
        movimiento: { debe: Math.round(v.movD), haber: Math.round(v.movH) },
        saldoAct:   {
          debe:  Math.round(v.antD + v.movD),
          haber: Math.round(v.antH + v.movH),
        },
      }))
      .filter(
        (f) =>
          f.saldoAnt.debe || f.saldoAnt.haber ||
          f.movimiento.debe || f.movimiento.haber
      )
      .sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [state.asientos, state.cuentas, fechaInicio, fechaFin]);

  // ── Totales generales ────────────────────────────────────────────────────────

  const totales = useMemo(() => {
    const sum = (fn: (f: FilaBalance) => number) => filas.reduce((s, f) => s + fn(f), 0);
    return {
      saldoAnt:   { debe: sum((f) => f.saldoAnt.debe),   haber: sum((f) => f.saldoAnt.haber)   },
      movimiento: { debe: sum((f) => f.movimiento.debe), haber: sum((f) => f.movimiento.haber) },
      saldoAct:   { debe: sum((f) => f.saldoAct.debe),   haber: sum((f) => f.saldoAct.haber)   },
    };
  }, [filas]);

  // ── Estado de Resultados ─────────────────────────────────────────────────────

  const estadoResultados = useMemo(() => {
    const ingresos = filas
      .filter((f) => f.tipo === 'ingreso')
      .map((f) => ({ nombre: f.nombre, monto: f.saldoAct.haber - f.saldoAct.debe }));
    const gastos = filas
      .filter((f) => f.tipo === 'gasto')
      .map((f) => ({ nombre: f.nombre, monto: f.saldoAct.debe - f.saldoAct.haber }));
    const totalIngresos = ingresos.reduce((s, x) => s + x.monto, 0);
    const totalGastos   = gastos.reduce((s, x) => s + x.monto, 0);
    return { ingresos, gastos, totalIngresos, totalGastos, utilidad: totalIngresos - totalGastos };
  }, [filas]);

  // ── Balance General ──────────────────────────────────────────────────────────

  const balanceGeneral = useMemo(() => {
    const saldoNeto = (f: FilaBalance) => f.saldoAct.debe - f.saldoAct.haber;
    const activos    = filas.filter((f) => f.tipo === 'activo').map((f) => ({ nombre: f.nombre, monto: saldoNeto(f) }));
    const pasivos    = filas.filter((f) => f.tipo === 'pasivo').map((f) => ({ nombre: f.nombre, monto: -(saldoNeto(f)) }));
    const patrimonio = filas.filter((f) => f.tipo === 'patrimonio').map((f) => ({ nombre: f.nombre, monto: -(saldoNeto(f)) }));
    const totalActivos    = activos.reduce((s, x) => s + x.monto, 0);
    const totalPasivos    = pasivos.reduce((s, x) => s + x.monto, 0);
    const totalPatrimonio = patrimonio.reduce((s, x) => s + x.monto, 0) + estadoResultados.utilidad;
    return { activos, pasivos, patrimonio, totalActivos, totalPasivos, totalPatrimonio };
  }, [filas, estadoResultados.utilidad]);

  const balanceCuadra = Math.abs(totales.saldoAct.debe - totales.saldoAct.haber) <= 1;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Balance de 8 Columnas</h1>
          <p className="text-sm text-gray-500 mt-1">
            Calculado desde los asientos del Libro Diario
          </p>
        </div>
        <Button onClick={() => window.print()} icon={<Download size={16} />} variant="secondary">
          Exportar PDF
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[160px]">
            <Input
              type="date"
              label="Fecha inicio del período"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <Input
              type="date"
              label="Fecha fin del período"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
            />
          </div>
          <div className="text-xs text-gray-500 self-end pb-2">
            <strong>Saldo Anterior</strong> = movimientos antes de la fecha inicio<br />
            <strong>Movimiento</strong> = movimientos dentro del período
          </div>
        </div>
      </Card>

      {/* Sin datos */}
      {filas.length === 0 && (
        <Card>
          <div className="flex flex-col items-center py-12 text-gray-400 gap-3">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <AlertCircle size={22} className="text-gray-400" />
            </div>
            <p className="font-medium text-gray-500">No hay asientos en el período seleccionado</p>
            <p className="text-sm text-gray-400">Ingresa asientos en el Libro Diario para ver el balance.</p>
          </div>
        </Card>
      )}

      {/* Tabla de 8 Columnas */}
      {filas.length > 0 && (
        <Card padding="none">
          <div className="overflow-x-auto overflow-y-auto max-h-[65vh] rounded-xl">
            <table className="w-full text-xs tnum border-separate border-spacing-0">
              <thead>
                <tr className="sticky top-0 z-10 bg-gray-900 text-white">
                  <th className="py-3 px-2 text-left border border-gray-700" colSpan={2}>Cuenta</th>
                  <th className="py-3 px-2 text-center border border-gray-700" colSpan={2}>Saldo Anterior</th>
                  <th className="py-3 px-2 text-center border border-gray-700" colSpan={2}>Movimiento del Período</th>
                  <th className="py-3 px-2 text-center border border-gray-700" colSpan={2}>Saldo Acumulado</th>
                </tr>
                <tr className="sticky top-[45px] z-10 bg-gray-800 text-white/90 text-right">
                  <th className="py-2 px-2 text-left border border-gray-700">Código</th>
                  <th className="py-2 px-2 text-left border border-gray-700">Nombre</th>
                  <th className="py-2 px-2 border border-gray-700">Debe</th>
                  <th className="py-2 px-2 border border-gray-700">Haber</th>
                  <th className="py-2 px-2 border border-gray-700">Debe</th>
                  <th className="py-2 px-2 border border-gray-700">Haber</th>
                  <th className="py-2 px-2 border border-gray-700">Debe</th>
                  <th className="py-2 px-2 border border-gray-700">Haber</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f, i) => (
                  <tr
                    key={f.codigo}
                    className={`transition-colors duration-100 hover:bg-blue-50/40 ${
                      i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'
                    }`}
                  >
                    <td className="py-2 px-2 border border-gray-200 font-mono text-gray-600">{f.codigo}</td>
                    <td className="py-2 px-2 border border-gray-200 text-gray-800">{f.nombre}</td>
                    <td className="py-2 px-2 border border-gray-200 text-right text-blue-700">
                      {f.saldoAnt.debe > 0 ? formatCurrency(f.saldoAnt.debe) : ''}
                    </td>
                    <td className="py-2 px-2 border border-gray-200 text-right text-blue-700">
                      {f.saldoAnt.haber > 0 ? formatCurrency(f.saldoAnt.haber) : ''}
                    </td>
                    <td className="py-2 px-2 border border-gray-200 text-right text-gray-700">
                      {f.movimiento.debe > 0 ? formatCurrency(f.movimiento.debe) : ''}
                    </td>
                    <td className="py-2 px-2 border border-gray-200 text-right text-gray-700">
                      {f.movimiento.haber > 0 ? formatCurrency(f.movimiento.haber) : ''}
                    </td>
                    <td className="py-2 px-2 border border-gray-200 text-right font-semibold text-gray-900">
                      {f.saldoAct.debe > 0 ? formatCurrency(f.saldoAct.debe) : ''}
                    </td>
                    <td className="py-2 px-2 border border-gray-200 text-right font-semibold text-gray-900">
                      {f.saldoAct.haber > 0 ? formatCurrency(f.saldoAct.haber) : ''}
                    </td>
                  </tr>
                ))}

              </tbody>
              {/* Fila de totales al pie */}
              <tfoot>
                <tr className="bg-gray-900 text-white font-bold text-right">
                  <td className="py-3 px-2 border border-gray-700 text-left" colSpan={2}>TOTALES</td>
                  <td className="py-3 px-2 border border-gray-700">{formatCurrency(totales.saldoAnt.debe)}</td>
                  <td className="py-3 px-2 border border-gray-700">{formatCurrency(totales.saldoAnt.haber)}</td>
                  <td className="py-3 px-2 border border-gray-700">{formatCurrency(totales.movimiento.debe)}</td>
                  <td className="py-3 px-2 border border-gray-700">{formatCurrency(totales.movimiento.haber)}</td>
                  <td className="py-3 px-2 border border-gray-700">{formatCurrency(totales.saldoAct.debe)}</td>
                  <td className="py-3 px-2 border border-gray-700">{formatCurrency(totales.saldoAct.haber)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Indicador cuadre */}
          <div className="px-5 py-3">
            {balanceCuadra ? (
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-sm">
                <CheckCircle size={16} />
                Balance cuadrado correctamente
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm">
                <AlertCircle size={16} />
                El saldo acumulado no cuadra (Debe ≠ Haber). Revisa que todos los asientos estén balanceados.
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Estado de Resultados + Balance General */}
      {filas.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Estado de Resultados */}
          <Card title="Estado de Resultados">
            {estadoResultados.ingresos.length === 0 && estadoResultados.gastos.length === 0 ? (
              <p className="text-sm text-gray-400 italic">
                Sin cuentas de ingreso/gasto en el período.<br />
                Asegúrate de que las cuentas en el Plan de Cuentas tengan tipo &quot;ingreso&quot; o &quot;gasto&quot;.
              </p>
            ) : (
              <div className="space-y-1 text-sm">
                {estadoResultados.ingresos.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Ingresos</p>
                    {estadoResultados.ingresos.map((x) => (
                      <div key={x.nombre} className="flex justify-between py-0.5">
                        <span className="text-gray-600 truncate pr-2">{x.nombre}</span>
                        <span className="font-medium text-emerald-700 shrink-0">{formatCurrency(x.monto)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-gray-200 pt-2 mt-1 font-semibold text-emerald-700">
                      <span>Total Ingresos</span>
                      <span>{formatCurrency(estadoResultados.totalIngresos)}</span>
                    </div>
                  </>
                )}

                {estadoResultados.gastos.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-gray-500 uppercase mt-4 mb-2">Gastos</p>
                    {estadoResultados.gastos.map((x) => (
                      <div key={x.nombre} className="flex justify-between py-0.5">
                        <span className="text-gray-600 truncate pr-2">{x.nombre}</span>
                        <span className="font-medium text-red-600 shrink-0">({formatCurrency(x.monto)})</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-gray-200 pt-2 mt-1 font-semibold text-red-600">
                      <span>Total Gastos</span>
                      <span>({formatCurrency(estadoResultados.totalGastos)})</span>
                    </div>
                  </>
                )}

                <div
                  className={`flex justify-between border-t-2 border-gray-300 pt-3 mt-2 font-bold text-base ${
                    estadoResultados.utilidad >= 0 ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  <span>
                    {estadoResultados.utilidad >= 0 ? 'Utilidad del Ejercicio' : 'Pérdida del Ejercicio'}
                  </span>
                  <span>{formatCurrency(Math.abs(estadoResultados.utilidad))}</span>
                </div>
              </div>
            )}
          </Card>

          {/* Balance General */}
          <Card title="Balance General">
            {balanceGeneral.activos.length === 0 && balanceGeneral.pasivos.length === 0 ? (
              <p className="text-sm text-gray-400 italic">
                Sin cuentas de activo/pasivo/patrimonio en el período.<br />
                Verifica los tipos de cuenta en el Plan de Cuentas.
              </p>
            ) : (
              <div className="space-y-1 text-sm">
                {/* Activos */}
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Activos</p>
                {balanceGeneral.activos.map((x) => (
                  <div key={x.nombre} className="flex justify-between py-0.5">
                    <span className="text-gray-600 truncate pr-2">{x.nombre}</span>
                    <span className="font-medium shrink-0">{formatCurrency(x.monto)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-gray-200 pt-2 mt-1 font-semibold text-blue-700">
                  <span>Total Activos</span>
                  <span>{formatCurrency(balanceGeneral.totalActivos)}</span>
                </div>

                {/* Pasivos */}
                {balanceGeneral.pasivos.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-gray-500 uppercase mt-4 mb-2">Pasivos</p>
                    {balanceGeneral.pasivos.map((x) => (
                      <div key={x.nombre} className="flex justify-between py-0.5">
                        <span className="text-gray-600 truncate pr-2">{x.nombre}</span>
                        <span className="font-medium shrink-0">{formatCurrency(x.monto)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-gray-200 pt-2 mt-1 font-semibold text-red-600">
                      <span>Total Pasivos</span>
                      <span>{formatCurrency(balanceGeneral.totalPasivos)}</span>
                    </div>
                  </>
                )}

                {/* Patrimonio */}
                <p className="text-xs font-semibold text-gray-500 uppercase mt-4 mb-2">Patrimonio</p>
                {balanceGeneral.patrimonio.map((x) => (
                  <div key={x.nombre} className="flex justify-between py-0.5">
                    <span className="text-gray-600 truncate pr-2">{x.nombre}</span>
                    <span className="font-medium shrink-0">{formatCurrency(x.monto)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-0.5">
                  <span className="text-gray-600">
                    {estadoResultados.utilidad >= 0 ? 'Utilidad del Ejercicio' : 'Pérdida del Ejercicio'}
                  </span>
                  <span
                    className={`font-medium shrink-0 ${
                      estadoResultados.utilidad >= 0 ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    {formatCurrency(estadoResultados.utilidad)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-2 mt-1 font-semibold text-emerald-700">
                  <span>Total Patrimonio</span>
                  <span>{formatCurrency(balanceGeneral.totalPatrimonio)}</span>
                </div>

                {/* Total Pasivo + Patrimonio */}
                <div className="flex justify-between border-t-2 border-blue-300 mt-3 pt-3 font-bold text-blue-700">
                  <span>Total Pasivo + Patrimonio</span>
                  <span>{formatCurrency(balanceGeneral.totalPasivos + balanceGeneral.totalPatrimonio)}</span>
                </div>

                {/* Alerta cuadre */}
                {Math.abs(balanceGeneral.totalActivos - (balanceGeneral.totalPasivos + balanceGeneral.totalPatrimonio)) > 100 && (
                  <div className="mt-3 flex items-center gap-1.5 text-amber-600 text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <AlertCircle size={13} />
                    El balance no cuadra. Activos ≠ Pasivo + Patrimonio.
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

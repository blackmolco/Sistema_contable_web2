import React, { useMemo } from 'react';
import { Download, AlertCircle } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { Card } from '../components/ui/Cards';
import { Button } from '../components/ui/FormElements';
import { formatCurrency } from '../utils/calculos';
import { generarPDFEstadoFinanciero } from '../services/reportesPdf';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Devuelve los dos primeros segmentos del código jerárquico, ej. "1-01" */
function subgrupo(codigo: string): string {
  const parts = codigo.split('-');
  return parts.length >= 2 ? `${parts[0]}-${parts[1]}` : parts[0];
}

function esActivoCorriente(codigo: string): boolean {
  const sg = subgrupo(codigo);
  return sg === '1-01' || sg === '1-02';
}

function esPasivoCorriente(codigo: string): boolean {
  return subgrupo(codigo) === '2-01';
}

// ── Tipos internos ─────────────────────────────────────────────────────────────

interface FilaCuenta {
  codigo: string;
  nombre: string;
  tipo: string;
  saldo: number; // positivo = saldo normal según naturaleza de la cuenta
}

// ── Componente ─────────────────────────────────────────────────────────────────

export default function EstadosFinancieros() {
  const { state } = useApp();

  // 1. Calcular saldos acumulados por cuenta desde asientos (excluir anulados)
  const saldosPorCuenta = useMemo(() => {
    const mapa = new Map<string, { debe: number; haber: number }>();
    for (const asiento of state.asientos) {
      if (asiento.estado === 'anulado') continue;
      for (const det of asiento.detalles) {
        const prev = mapa.get(det.cuentaCodigo) ?? { debe: 0, haber: 0 };
        mapa.set(det.cuentaCodigo, {
          debe: prev.debe + det.debe,
          haber: prev.haber + det.haber,
        });
      }
    }
    return mapa;
  }, [state.asientos]);

  // 2. Saldo neto por cuenta (según su naturaleza)
  const filas = useMemo((): FilaCuenta[] => {
    const resultado: FilaCuenta[] = [];
    for (const cuenta of state.cuentas) {
      if (!cuenta.permiteMovimiento) continue;
      const mov = saldosPorCuenta.get(cuenta.codigo);
      if (!mov) continue;
      const saldo =
        cuenta.naturaleza === 'deudora'
          ? mov.debe - mov.haber
          : mov.haber - mov.debe;
      if (saldo === 0) continue;
      resultado.push({
        codigo: cuenta.codigo,
        nombre: cuenta.nombre,
        tipo: cuenta.tipo,
        saldo,
      });
    }
    return resultado.sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [state.cuentas, saldosPorCuenta]);

  // 3. Agrupar por categoría contable
  const activosCorrientes   = useMemo(() => filas.filter(f => f.tipo === 'activo'     &&  esActivoCorriente(f.codigo)), [filas]);
  const activosNoCorrientes = useMemo(() => filas.filter(f => f.tipo === 'activo'     && !esActivoCorriente(f.codigo)), [filas]);
  const pasivosCorrientes   = useMemo(() => filas.filter(f => f.tipo === 'pasivo'     &&  esPasivoCorriente(f.codigo)), [filas]);
  const pasivosNoCorrientes = useMemo(() => filas.filter(f => f.tipo === 'pasivo'     && !esPasivoCorriente(f.codigo)), [filas]);
  const cuentasPatrimonio   = useMemo(() => filas.filter(f => f.tipo === 'patrimonio'), [filas]);
  const cuentasIngresos     = useMemo(() => filas.filter(f => f.tipo === 'ingreso'),    [filas]);
  const cuentasGastos       = useMemo(() => filas.filter(f => f.tipo === 'gasto'),      [filas]);

  // 4. Totales
  const totalActivoCorriente   = activosCorrientes.reduce((s, f)   => s + f.saldo, 0);
  const totalActivoNoCorriente = activosNoCorrientes.reduce((s, f) => s + f.saldo, 0);
  const totalActivos           = totalActivoCorriente + totalActivoNoCorriente;

  const totalPasivoCorriente   = pasivosCorrientes.reduce((s, f)   => s + f.saldo, 0);
  const totalPasivoNoCorriente = pasivosNoCorrientes.reduce((s, f) => s + f.saldo, 0);
  const totalPasivos           = totalPasivoCorriente + totalPasivoNoCorriente;

  const totalPatrimonio      = cuentasPatrimonio.reduce((s, f) => s + f.saldo, 0);
  const totalIngresos        = cuentasIngresos.reduce((s, f)   => s + f.saldo, 0);
  const totalGastos          = cuentasGastos.reduce((s, f)     => s + f.saldo, 0);
  const resultadoEjercicio   = totalIngresos - totalGastos;

  const totalPasivosPatrimonio = totalPasivos + totalPatrimonio + resultadoEjercicio;
  const equilibrado            = Math.abs(totalActivos - totalPasivosPatrimonio) < 1;

  // 5. Indicadores financieros
  const razonCorriente = totalPasivoCorriente > 0 ? totalActivoCorriente / totalPasivoCorriente : null;
  const endeudamiento  = totalActivos > 0 ? (totalPasivos / totalActivos) * 100 : null;
  const rentabilidad   = totalActivos > 0 ? (resultadoEjercicio / totalActivos) * 100 : null;
  const roe            = (totalPatrimonio + resultadoEjercicio) !== 0
    ? (resultadoEjercicio / (totalPatrimonio + resultadoEjercicio)) * 100
    : null;

  // 6. Evolución mensual para gráfico (últimos 6 meses con movimientos)
  const datosEvolucion = useMemo(() => {
    const porMes = new Map<string, { ingresos: number; gastos: number }>();
    for (const asiento of state.asientos) {
      if (asiento.estado === 'anulado') continue;
      const mes = asiento.fecha.substring(0, 7); // "YYYY-MM"
      if (!porMes.has(mes)) porMes.set(mes, { ingresos: 0, gastos: 0 });
      const m = porMes.get(mes)!;
      for (const det of asiento.detalles) {
        const cuenta = state.cuentas.find(c => c.codigo === det.cuentaCodigo);
        if (!cuenta) continue;
        if (cuenta.tipo === 'ingreso') m.ingresos += det.haber - det.debe;
        if (cuenta.tipo === 'gasto')   m.gastos   += det.debe  - det.haber;
      }
    }
    return [...porMes.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([mes, v]) => ({
        mes: new Date(mes + '-01T12:00:00').toLocaleDateString('es-CL', { month: 'short', year: '2-digit' }),
        ingresos: Math.round(v.ingresos / 1000),
        gastos:   Math.round(v.gastos   / 1000),
        resultado: Math.round((v.ingresos - v.gastos) / 1000),
      }));
  }, [state.asientos, state.cuentas]);

  const hasDatos = filas.length > 0;

  // ── Sin datos ────────────────────────────────────────────────────────────────
  if (!hasDatos) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estados Financieros</h1>
          <p className="text-sm text-gray-500 mt-1">Balance General y Estado de Resultados</p>
        </div>
        <Card>
          <div className="py-16 text-center">
            <AlertCircle className="mx-auto mb-4 text-gray-300" size={48} />
            <h3 className="text-lg font-medium text-gray-500 mb-2">Sin movimientos contables</h3>
            <p className="text-sm text-gray-400">
              Ingrese asientos contables para generar los estados financieros.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // ── Con datos ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estados Financieros</h1>
          <p className="text-sm text-gray-500 mt-1">Balance General y Estado de Resultados</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {!equilibrado && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle size={16} className="text-red-600" />
              <span className="text-sm text-red-700 font-medium">
                Desbalance: Activo ≠ Pasivo + Patrimonio
              </span>
            </div>
          )}
          <Button
            variant="secondary"
            icon={<Download size={16} />}
            onClick={() => {
              generarPDFEstadoFinanciero(
                'Balance General',
                [
                  { label: 'Activo Corriente',    valor: totalActivoCorriente },
                  { label: 'Activo No Corriente', valor: totalActivoNoCorriente },
                  { label: 'TOTAL ACTIVOS',        valor: totalActivos },
                  { label: 'Pasivo Corriente',     valor: totalPasivoCorriente },
                  { label: 'Pasivo No Corriente',  valor: totalPasivoNoCorriente },
                  { label: 'TOTAL PASIVOS',        valor: totalPasivos },
                  { label: 'Patrimonio',           valor: totalPatrimonio },
                  { label: 'Resultado Ejercicio',  valor: resultadoEjercicio },
                  { label: 'TOTAL PAS. + PAT.',    valor: totalPasivosPatrimonio },
                ],
                'Balance General',
              );
            }}
          >
            Balance PDF
          </Button>
          <Button
            variant="secondary"
            icon={<Download size={16} />}
            onClick={() => {
              generarPDFEstadoFinanciero(
                'Estado de Resultados',
                [
                  ...cuentasIngresos.map(i => ({ label: i.nombre, valor:  i.saldo })),
                  { label: 'TOTAL INGRESOS',         valor: totalIngresos },
                  ...cuentasGastos.map(g => ({ label: g.nombre,   valor:  g.saldo })),
                  { label: 'TOTAL GASTOS',           valor: totalGastos },
                  { label: 'RESULTADO DEL EJERCICIO', valor: resultadoEjercicio },
                ],
                'Estado de Resultados',
              );
            }}
          >
            ER PDF
          </Button>
        </div>
      </div>

      {/* ── Balance General ─────────────────────────────────────────────────── */}
      <Card title="Balance General" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <tbody>

              {/* ACTIVOS */}
              <tr className="bg-[#1E3A5F] text-white">
                <td colSpan={2} className="px-4 py-3 font-bold text-lg">ACTIVOS</td>
              </tr>

              <tr className="bg-blue-50">
                <td className="px-4 py-2 font-semibold text-gray-700">Activo Corriente</td>
                <td className="px-4 py-2 text-right font-semibold text-gray-900 w-44">
                  {formatCurrency(totalActivoCorriente)}
                </td>
              </tr>
              {activosCorrientes.map(f => (
                <tr key={f.codigo}>
                  <td className="px-8 py-1.5 text-sm text-gray-600">{f.nombre}</td>
                  <td className="px-4 py-1.5 text-right text-sm text-gray-600">
                    {formatCurrency(f.saldo)}
                  </td>
                </tr>
              ))}
              {activosCorrientes.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-8 py-1.5 text-sm text-gray-400 italic">
                    Sin movimientos
                  </td>
                </tr>
              )}

              <tr className="bg-blue-50">
                <td className="px-4 py-2 font-semibold text-gray-700">Activo No Corriente</td>
                <td className="px-4 py-2 text-right font-semibold text-gray-900">
                  {formatCurrency(totalActivoNoCorriente)}
                </td>
              </tr>
              {activosNoCorrientes.map(f => (
                <tr key={f.codigo}>
                  <td className="px-8 py-1.5 text-sm text-gray-600">{f.nombre}</td>
                  <td className="px-4 py-1.5 text-right text-sm text-gray-600">
                    {formatCurrency(f.saldo)}
                  </td>
                </tr>
              ))}
              {activosNoCorrientes.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-8 py-1.5 text-sm text-gray-400 italic">
                    Sin movimientos
                  </td>
                </tr>
              )}

              <tr className="bg-[#1E3A5F] text-white font-bold">
                <td className="px-4 py-3">TOTAL ACTIVOS</td>
                <td className="px-4 py-3 text-right">{formatCurrency(totalActivos)}</td>
              </tr>

              {/* PASIVOS */}
              <tr className="bg-red-600 text-white">
                <td colSpan={2} className="px-4 py-3 font-bold text-lg">PASIVOS</td>
              </tr>

              <tr className="bg-red-50">
                <td className="px-4 py-2 font-semibold text-gray-700">Pasivo Corriente</td>
                <td className="px-4 py-2 text-right font-semibold text-gray-900">
                  {formatCurrency(totalPasivoCorriente)}
                </td>
              </tr>
              {pasivosCorrientes.map(f => (
                <tr key={f.codigo}>
                  <td className="px-8 py-1.5 text-sm text-gray-600">{f.nombre}</td>
                  <td className="px-4 py-1.5 text-right text-sm text-gray-600">
                    {formatCurrency(f.saldo)}
                  </td>
                </tr>
              ))}
              {pasivosCorrientes.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-8 py-1.5 text-sm text-gray-400 italic">
                    Sin movimientos
                  </td>
                </tr>
              )}

              <tr className="bg-red-50">
                <td className="px-4 py-2 font-semibold text-gray-700">Pasivo No Corriente</td>
                <td className="px-4 py-2 text-right font-semibold text-gray-900">
                  {formatCurrency(totalPasivoNoCorriente)}
                </td>
              </tr>
              {pasivosNoCorrientes.map(f => (
                <tr key={f.codigo}>
                  <td className="px-8 py-1.5 text-sm text-gray-600">{f.nombre}</td>
                  <td className="px-4 py-1.5 text-right text-sm text-gray-600">
                    {formatCurrency(f.saldo)}
                  </td>
                </tr>
              ))}
              {pasivosNoCorrientes.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-8 py-1.5 text-sm text-gray-400 italic">
                    Sin movimientos
                  </td>
                </tr>
              )}

              <tr className="bg-red-600 text-white font-bold">
                <td className="px-4 py-3">TOTAL PASIVOS</td>
                <td className="px-4 py-3 text-right">{formatCurrency(totalPasivos)}</td>
              </tr>

              {/* PATRIMONIO */}
              <tr className="bg-emerald-600 text-white">
                <td colSpan={2} className="px-4 py-3 font-bold text-lg">PATRIMONIO</td>
              </tr>
              {cuentasPatrimonio.map(f => (
                <tr key={f.codigo}>
                  <td className="px-8 py-1.5 text-sm text-gray-600">{f.nombre}</td>
                  <td className="px-4 py-1.5 text-right text-sm text-gray-600">
                    {formatCurrency(f.saldo)}
                  </td>
                </tr>
              ))}
              {cuentasPatrimonio.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-8 py-1.5 text-sm text-gray-400 italic">
                    Sin movimientos
                  </td>
                </tr>
              )}
              <tr>
                <td className="px-8 py-1.5 text-sm text-gray-600">Resultado del Ejercicio</td>
                <td
                  className={`px-4 py-1.5 text-right text-sm font-medium ${
                    resultadoEjercicio >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {formatCurrency(resultadoEjercicio)}
                </td>
              </tr>
              <tr className="bg-emerald-600 text-white font-bold">
                <td className="px-4 py-3">TOTAL PATRIMONIO</td>
                <td className="px-4 py-3 text-right">
                  {formatCurrency(totalPatrimonio + resultadoEjercicio)}
                </td>
              </tr>

              {/* Verificación */}
              <tr className={`font-bold ${equilibrado ? 'bg-gray-100' : 'bg-red-100'}`}>
                <td className="px-4 py-3 text-gray-900">TOTAL PASIVOS + PATRIMONIO</td>
                <td
                  className={`px-4 py-3 text-right ${
                    equilibrado ? 'text-[#1E3A5F]' : 'text-red-600'
                  }`}
                >
                  {formatCurrency(totalPasivosPatrimonio)}
                </td>
              </tr>

            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Estado de Resultados ─────────────────────────────────────────────── */}
      <Card title="Estado de Resultados" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <tbody>

              <tr className="bg-[#1E3A5F] text-white">
                <td colSpan={2} className="px-4 py-3 font-bold text-lg">INGRESOS</td>
              </tr>
              {cuentasIngresos.map(f => (
                <tr key={f.codigo}>
                  <td className="px-8 py-1.5 text-sm text-gray-600">{f.nombre}</td>
                  <td className="px-4 py-1.5 text-right text-sm text-gray-600">
                    {formatCurrency(f.saldo)}
                  </td>
                </tr>
              ))}
              {cuentasIngresos.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-8 py-1.5 text-sm text-gray-400 italic">
                    Sin ingresos registrados
                  </td>
                </tr>
              )}
              <tr className="bg-emerald-50 font-semibold">
                <td className="px-4 py-2 text-emerald-700">Total Ingresos</td>
                <td className="px-4 py-2 text-right text-emerald-700">
                  {formatCurrency(totalIngresos)}
                </td>
              </tr>

              <tr className="bg-red-600 text-white">
                <td colSpan={2} className="px-4 py-3 font-bold text-lg">GASTOS</td>
              </tr>
              {cuentasGastos.map(f => (
                <tr key={f.codigo}>
                  <td className="px-8 py-1.5 text-sm text-gray-600">{f.nombre}</td>
                  <td className="px-4 py-1.5 text-right text-sm text-gray-600">
                    ({formatCurrency(f.saldo)})
                  </td>
                </tr>
              ))}
              {cuentasGastos.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-8 py-1.5 text-sm text-gray-400 italic">
                    Sin gastos registrados
                  </td>
                </tr>
              )}
              <tr className="bg-red-50 font-semibold">
                <td className="px-4 py-2 text-red-700">Total Gastos</td>
                <td className="px-4 py-2 text-right text-red-700">
                  ({formatCurrency(totalGastos)})
                </td>
              </tr>

              <tr
                className={`font-bold text-white ${
                  resultadoEjercicio >= 0 ? 'bg-[#10B981]' : 'bg-red-500'
                }`}
              >
                <td className="px-4 py-3">RESULTADO DEL EJERCICIO</td>
                <td className="px-4 py-3 text-right">{formatCurrency(resultadoEjercicio)}</td>
              </tr>

            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Gráfico evolución mensual ────────────────────────────────────────── */}
      {datosEvolucion.length >= 2 && (
        <Card title="Evolución Mensual (miles $)">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={datosEvolucion}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="mes" stroke="#6B7280" fontSize={12} />
                <YAxis stroke="#6B7280" fontSize={12} tickFormatter={v => `$${v}k`} />
                <Tooltip formatter={(value: number) => [`$${value}k`, '']} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="ingresos"
                  stroke="#10B981"
                  strokeWidth={2}
                  name="Ingresos"
                  dot={{ fill: '#10B981' }}
                />
                <Line
                  type="monotone"
                  dataKey="gastos"
                  stroke="#EF4444"
                  strokeWidth={2}
                  name="Gastos"
                  dot={{ fill: '#EF4444' }}
                />
                <Line
                  type="monotone"
                  dataKey="resultado"
                  stroke="#1E3A5F"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Resultado"
                  dot={{ fill: '#1E3A5F' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* ── Indicadores Financieros ──────────────────────────────────────────── */}
      <Card title="Indicadores Financieros">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-sm text-gray-500 mb-1">Razón Corriente</p>
            <p className="text-2xl font-bold text-gray-900">
              {razonCorriente !== null ? `${razonCorriente.toFixed(1)}x` : '—'}
            </p>
            <p className="text-xs text-gray-400 mt-1">Activo C. / Pasivo C.</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-sm text-gray-500 mb-1">Endeudamiento</p>
            <p className="text-2xl font-bold text-gray-900">
              {endeudamiento !== null ? `${endeudamiento.toFixed(1)}%` : '—'}
            </p>
            <p className="text-xs text-gray-400 mt-1">Pasivos / Activos</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-sm text-gray-500 mb-1">Rentabilidad</p>
            <p
              className={`text-2xl font-bold ${
                rentabilidad !== null
                  ? rentabilidad >= 0
                    ? 'text-emerald-600'
                    : 'text-red-600'
                  : 'text-gray-900'
              }`}
            >
              {rentabilidad !== null ? `${rentabilidad.toFixed(1)}%` : '—'}
            </p>
            <p className="text-xs text-gray-400 mt-1">Resultado / Activos</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-sm text-gray-500 mb-1">ROE</p>
            <p
              className={`text-2xl font-bold ${
                roe !== null
                  ? roe >= 0
                    ? 'text-emerald-600'
                    : 'text-red-600'
                  : 'text-gray-900'
              }`}
            >
              {roe !== null ? `${roe.toFixed(1)}%` : '—'}
            </p>
            <p className="text-xs text-gray-400 mt-1">Resultado / Patrimonio</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

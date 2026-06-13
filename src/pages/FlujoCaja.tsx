import React, { useState, useMemo } from 'react';
import { Wallet, TrendingUp, TrendingDown, AlertTriangle, ChevronRight, Info } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { Card, Badge } from '../components/ui/Cards';
import { Select } from '../components/ui/FormElements';

const HORIZONTE_OPCIONES = [
  { value: '30',  label: 'Próximos 30 días' },
  { value: '60',  label: 'Próximos 60 días' },
  { value: '90',  label: 'Próximos 90 días' },
];

const fmt = (n: number) =>
  `$${Math.round(Math.abs(n)).toLocaleString('es-CL')}`;

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toISO(d: Date) {
  return d.toISOString().split('T')[0];
}

interface Evento {
  fecha: string;
  tipo: 'cobro' | 'pago';
  descripcion: string;
  monto: number;
  estado: string;
}

export default function FlujoCaja() {
  const { state } = useApp();
  const [horizonte, setHorizonte] = useState('60');
  const hoy = useMemo(() => new Date(), []);
  const limite = useMemo(() => addDays(hoy, Number(horizonte)), [hoy, horizonte]);

  // Saldo inicial: tesorería (no tenemos un único campo, usamos 0 como base editable)
  const [saldoInicial, setSaldoInicial] = useState<number>(0);

  /* ─── Cobros esperados (CxC pendiente) ─────────────────── */
  const cobros: Evento[] = useMemo(() => {
    return (state.cuentasCobrar ?? [])
      .filter(c => c.estado !== 'pagado' && c.estado !== 'incobrable')
      .filter(c => {
        const fv = new Date(c.fechaVencimiento);
        return fv >= hoy && fv <= limite;
      })
      .map(c => ({
        fecha: c.fechaVencimiento,
        tipo: 'cobro' as const,
        descripcion: `CxC — ${c.clienteNombre} N°${c.numeroDocumento}`,
        monto: c.monto - c.montoPagado,
        estado: c.estado,
      }));
  }, [state.cuentasCobrar, hoy, limite]);

  /* ─── Pagos esperados (CxP pendiente) ───────────────────── */
  const pagos: Evento[] = useMemo(() => {
    return (state.cuentasPagar ?? [])
      .filter(c => c.estado !== 'pagado')
      .filter(c => {
        const fv = new Date(c.fechaVencimiento);
        return fv >= hoy && fv <= limite;
      })
      .map(c => ({
        fecha: c.fechaVencimiento,
        tipo: 'pago' as const,
        descripcion: `CxP — ${c.proveedorNombre} N°${c.numeroDocumento}`,
        monto: c.monto - c.montoPagado,
        estado: c.estado,
      }));
  }, [state.cuentasPagar, hoy, limite]);

  /* ─── Timeline acumulado para gráfico ───────────────────── */
  const timeline = useMemo(() => {
    const dias = Number(horizonte);
    const todos = [...cobros, ...pagos].sort((a, b) => a.fecha.localeCompare(b.fecha));

    // Generar puntos cada 7 días
    const puntos: { fecha: string; saldo: number; cobros: number; pagos: number }[] = [];
    let acumulado = saldoInicial;

    for (let d = 0; d <= dias; d += (dias > 60 ? 7 : dias > 30 ? 3 : 1)) {
      const fechaPunto = toISO(addDays(hoy, d));
      const eventosDia = todos.filter(e => e.fecha <= fechaPunto && e.fecha > toISO(addDays(hoy, d - (dias > 60 ? 7 : dias > 30 ? 3 : 1))));
      const cobrosDia = eventosDia.filter(e => e.tipo === 'cobro').reduce((s, e) => s + e.monto, 0);
      const pagosDia = eventosDia.filter(e => e.tipo === 'pago').reduce((s, e) => s + e.monto, 0);
      acumulado += cobrosDia - pagosDia;
      puntos.push({ fecha: fechaPunto, saldo: acumulado, cobros: cobrosDia, pagos: pagosDia });
    }
    return puntos;
  }, [cobros, pagos, saldoInicial, hoy, horizonte]);

  const totalCobros = cobros.reduce((s, e) => s + e.monto, 0);
  const totalPagos = pagos.reduce((s, e) => s + e.monto, 0);
  const saldoFinal = saldoInicial + totalCobros - totalPagos;
  const quiebreProyectado = timeline.find(p => p.saldo < 0);
  const vencidosSinPagar = (state.cuentasPagar ?? []).filter(c => {
    return c.estado !== 'pagado' && new Date(c.fechaVencimiento) < hoy;
  });

  /* ─── Render ─────────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#1E3A5F]/10 rounded-lg">
            <Wallet className="text-[#1E3A5F]" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Flujo de Caja Proyectado</h1>
            <p className="text-sm text-gray-500 mt-1">Proyección basada en CxC y CxP pendientes</p>
          </div>
        </div>
        <Select
          value={horizonte}
          onChange={e => setHorizonte(e.target.value)}
          options={HORIZONTE_OPCIONES}
        />
      </div>

      {/* Alerta quiebre */}
      {quiebreProyectado && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-800">
            <p className="font-semibold">Quiebre de caja proyectado el {quiebreProyectado.fecha}</p>
            <p>Con el saldo inicial ingresado, los pagos superarán los ingresos proyectados. Revisa las fechas de cobro.</p>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border p-4 bg-white">
          <p className="text-xs font-semibold uppercase text-gray-500">Saldo inicial</p>
          <input
            type="number"
            className="mt-1 w-full text-2xl font-bold text-gray-900 bg-transparent border-b border-dashed border-gray-300 focus:outline-none focus:border-[#1E3A5F]"
            value={saldoInicial}
            onChange={e => setSaldoInicial(Number(e.target.value) || 0)}
            title="Editar saldo inicial"
          />
          <p className="text-xs text-gray-400 mt-1">Editable</p>
        </div>
        <div className="rounded-xl border p-4 bg-emerald-50 border-emerald-200">
          <p className="text-xs font-semibold uppercase text-emerald-600">Cobros esperados</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{fmt(totalCobros)}</p>
          <p className="text-xs text-emerald-500">{cobros.length} documentos</p>
        </div>
        <div className="rounded-xl border p-4 bg-red-50 border-red-200">
          <p className="text-xs font-semibold uppercase text-red-600">Pagos comprometidos</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{fmt(totalPagos)}</p>
          <p className="text-xs text-red-400">{pagos.length} documentos</p>
        </div>
        <div className={`rounded-xl border p-4 ${saldoFinal >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
          <p className={`text-xs font-semibold uppercase ${saldoFinal >= 0 ? 'text-blue-600' : 'text-red-600'}`}>Saldo proyectado</p>
          <p className={`text-2xl font-bold mt-1 ${saldoFinal >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{fmt(saldoFinal)}</p>
          <p className="text-xs text-gray-400">En {horizonte} días</p>
        </div>
      </div>

      {/* Gráfico */}
      <Card>
        <h3 className="font-semibold text-gray-800 mb-4">Evolución del saldo proyectado</h3>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={timeline} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <defs>
              <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1E3A5F" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#1E3A5F" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="fecha" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(5)} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => [fmt(v), 'Saldo']} labelFormatter={l => `Fecha: ${l}`} />
            <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
            <Area type="monotone" dataKey="saldo" stroke="#1E3A5F" strokeWidth={2} fill="url(#colorSaldo)" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Tablas cobros / pagos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cobros */}
        <Card padding="none">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-600" />Cobros esperados
            </h3>
            <Badge variant="success" size="sm">{cobros.length}</Badge>
          </div>
          <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
            {cobros.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Sin cobros en el período</p>
            ) : cobros.map((e, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-800 truncate max-w-[200px]">{e.descripcion}</p>
                  <p className="text-xs text-gray-400">{e.fecha}</p>
                </div>
                <span className="text-sm font-semibold text-emerald-700">{fmt(e.monto)}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Pagos */}
        <Card padding="none">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <TrendingDown size={16} className="text-red-500" />Pagos comprometidos
            </h3>
            <Badge variant="danger" size="sm">{pagos.length}</Badge>
          </div>
          <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
            {pagos.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Sin pagos en el período</p>
            ) : pagos.map((e, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-800 truncate max-w-[200px]">{e.descripcion}</p>
                  <p className="text-xs text-gray-400">{e.fecha}</p>
                </div>
                <span className="text-sm font-semibold text-red-600">{fmt(e.monto)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Vencidos sin pagar */}
      {vencidosSinPagar.length > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <Info size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {vencidosSinPagar.length} obligaciones vencidas no incluidas en la proyección
            </p>
            <p className="text-sm text-amber-700 mt-0.5">
              Total: {fmt(vencidosSinPagar.reduce((s, c) => s + (c.monto - c.montoPagado), 0))} ya venció pero aún no se ha pagado.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

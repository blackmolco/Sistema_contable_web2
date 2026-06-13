import React, { useState, useMemo } from 'react';
import { FileSpreadsheet, Info, AlertCircle, CheckCircle, Printer, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card } from '../components/ui/Cards';
import { Button, Input, Select } from '../components/ui/FormElements';

// Tasa impuesto de primera categoría por año tributario
const TASA_PRIMERA_CATEGORIA: Record<number, number> = {
  2022: 0.25,
  2023: 0.27,
  2024: 0.27,
  2025: 0.27,
  2026: 0.27,
};

const AÑO_ACTUAL = new Date().getFullYear();
const AÑOS_OPCIONES = [AÑO_ACTUAL, AÑO_ACTUAL - 1, AÑO_ACTUAL - 2].map(y => ({
  value: String(y),
  label: `AT ${y} (año comercial ${y - 1})`,
}));

interface F22State {
  añoTributario: number;
  // Sección ingresos
  ingresosExplotacion: number;
  otrosIngresos: number;
  // Sección gastos
  costoVentas: number;
  gastosAdm: number;
  otrosGastos: number;
  // Ajustes
  correccionMonetaria: number;
  // Créditos y pagos
  ppmAcumulado: number;
  creditoActivo: number;       // inversiones, zonas francas, etc.
  // Socios/accionistas
  honorariosPagados: number;
}

const emptyState = (año: number): F22State => ({
  añoTributario: año,
  ingresosExplotacion: 0,
  otrosIngresos: 0,
  costoVentas: 0,
  gastosAdm: 0,
  otrosGastos: 0,
  correccionMonetaria: 0,
  ppmAcumulado: 0,
  creditoActivo: 0,
  honorariosPagados: 0,
});

export default function F22() {
  const { state, showToast } = useApp();

  const [añoSel, setAñoSel] = useState(AÑO_ACTUAL);
  const [manual, setManual] = useState<F22State>(emptyState(AÑO_ACTUAL));
  const [modoEdicion, setModoEdicion] = useState(false);

  /* ─── Pre-carga desde asientos ──────────────────────────── */
  const datosSistema = useMemo(() => {
    const añoComercial = añoSel - 1;
    const asientos = (state.asientos ?? []).filter(a => {
      const año = new Date(a.fecha).getFullYear();
      return año === añoComercial && a.estado !== 'anulado';
    });

    let ingresos = 0;
    let gastos = 0;

    asientos.forEach(asiento => {
      asiento.detalles.forEach(d => {
        const cuenta = (state.cuentas ?? []).find(c => c.id === d.cuentaId);
        if (!cuenta) return;
        if (cuenta.tipo === 'ingreso') {
          // Cuentas de ingresos: el haber aumenta, el debe disminuye
          ingresos += d.haber - d.debe;
        } else if (cuenta.tipo === 'gasto') {
          // Cuentas de gastos: el debe aumenta, el haber disminuye
          gastos += d.debe - d.haber;
        }
      });
    });

    // Honorarios del año
    const honorarios = (state.honorarios ?? []).filter(h => {
      const año = new Date(h.fecha ?? '').getFullYear();
      return año === añoComercial;
    }).reduce((s, h) => s + (h.honorario ?? h.honorarioBruto ?? 0), 0);

    return { ingresos: Math.max(0, ingresos), gastos: Math.max(0, gastos), honorarios };
  }, [añoSel, state.asientos, state.cuentas, state.honorarios]);

  /* ─── Valores efectivos (manual override si modoEdicion) ── */
  const vals = modoEdicion ? manual : {
    ...emptyState(añoSel),
    ingresosExplotacion: datosSistema.ingresos,
    gastos: datosSistema.gastos,
    honorariosPagados: datosSistema.honorarios,
  };

  /* ─── Cálculo F22 ─────────────────────────────────────── */
  const calc = useMemo(() => {
    const tasa = TASA_PRIMERA_CATEGORIA[añoSel] ?? 0.27;

    const totalIngresos    = vals.ingresosExplotacion + vals.otrosIngresos;
    const totalGastos      = vals.costoVentas + vals.gastosAdm + vals.otrosGastos + vals.honorariosPagados;
    const baseImponible    = Math.max(0, totalIngresos - totalGastos + vals.correccionMonetaria);
    const impuesto         = Math.round(baseImponible * tasa);
    const impuestoNeto     = Math.max(0, impuesto - vals.creditoActivo);
    const resultado        = impuestoNeto - vals.ppmAcumulado;

    return {
      tasa,
      totalIngresos,
      totalGastos,
      baseImponible,
      impuesto,
      impuestoNeto,
      resultado,
    };
  }, [vals, añoSel]);

  /* ─── Helpers ─────────────────────────────────────────── */
  const formatCLP  = (n: number) => `$${Math.abs(Math.round(n)).toLocaleString('es-CL')}`;
  const pct        = (n: number) => `${(n * 100).toFixed(0)}%`;

  const handleAño = (v: string) => {
    const año = Number(v);
    setAñoSel(año);
    setManual(emptyState(año));
    setModoEdicion(false);
  };

  const setField = (key: keyof F22State, val: string) => {
    setManual(f => ({ ...f, [key]: Number(val) || 0 }));
  };

  const cargarDesistema = () => {
    setManual({
      ...emptyState(añoSel),
      ingresosExplotacion: datosSistema.ingresos,
      costoVentas: 0,
      gastosAdm: datosSistema.gastos,
      honorariosPagados: datosSistema.honorarios,
    });
    setModoEdicion(true);
  };

  /* ─── Sección helper ─────────────────────────────────── */
  const Row = ({ label, value, highlight, negative }: { label: string; value: number; highlight?: boolean; negative?: boolean }) => (
    <div className={`flex items-center justify-between py-2 px-3 rounded-lg ${highlight ? 'bg-[#1E3A5F] text-white' : 'hover:bg-gray-50'}`}>
      <span className={`text-sm ${highlight ? 'font-semibold text-white' : 'text-gray-700'}`}>{label}</span>
      <span className={`font-mono text-sm font-semibold ${highlight ? 'text-white' : negative ? 'text-red-600' : 'text-gray-900'}`}>
        {negative && value !== 0 ? `-${formatCLP(value)}` : formatCLP(value)}
      </span>
    </div>
  );

  const InputRow = ({ label, fieldKey }: { label: string; fieldKey: keyof F22State }) => (
    <div className="flex items-center gap-4">
      <span className="text-sm text-gray-700 flex-1">{label}</span>
      <div className="w-40">
        <Input
          type="number"
          min={0}
          value={(manual[fieldKey] as number) || ''}
          onChange={e => setField(fieldKey, e.target.value)}
          placeholder="0"
        />
      </div>
    </div>
  );

  const [tabActiva, setTabActiva] = useState<'f22' | 'ddjj'>('f22');
  const [djSeleccionada, setDjSeleccionada] = useState<'1887' | '1879'>('1887');

  /* ─── Agregación para DJ 1887 (Sueldos) ───────────────── */
  const datosDJ1887 = useMemo(() => {
    const comYear = añoSel - 1;
    const liquidacionesAnuales = (state.liquidaciones ?? []).filter(l => l.periodo.startsWith(String(comYear)));
    
    const map = new Map<string, {
      rut: string;
      nombreCompleto: string;
      imponible: number;
      impuesto: number;
      leyesSociales: number;
      liquido: number;
      mesesActivo: number;
    }>();

    liquidacionesAnuales.forEach(p => {
      p.lineas.forEach(l => {
        const key = l.rut;
        const exist = map.get(key) || {
          rut: l.rut,
          nombreCompleto: `${l.nombre} ${l.apellidos}`,
          imponible: 0,
          impuesto: 0,
          leyesSociales: 0,
          liquido: 0,
          mesesActivo: 0,
        };
        exist.imponible += l.totalImponible || 0;
        exist.impuesto += l.impuestoUnico || 0;
        exist.leyesSociales += l.totalCotizaciones || 0;
        exist.liquido += l.sueldoLiquido || 0;
        exist.mesesActivo += 1;
        map.set(key, exist);
      });
    });

    return Array.from(map.values());
  }, [añoSel, state.liquidaciones]);

  /* ─── Agregación para DJ 1879 (Honorarios) ────────────── */
  const datosDJ1879 = useMemo(() => {
    const comYear = añoSel - 1;
    const honorariosAnuales = (state.honorarios ?? []).filter(h => {
      const f = h.fechaPago || h.periodo;
      const año = new Date(f).getFullYear();
      return año === comYear;
    });

    const map = new Map<string, {
      rut: string;
      nombre: string;
      bruto: number;
      retencion: number;
      liquido: number;
      cantidadBoletas: number;
    }>();

    honorariosAnuales.forEach(h => {
      const key = h.rut;
      const exist = map.get(key) || {
        rut: h.rut,
        nombre: h.nombre,
        bruto: 0,
        retencion: 0,
        liquido: 0,
        cantidadBoletas: 0,
      };
      exist.bruto += h.montoBruto || 0;
      exist.retencion += h.retencion || 0;
      exist.liquido += h.montoLiquido || 0;
      exist.cantidadBoletas += 1;
      map.set(key, exist);
    });

    return Array.from(map.values());
  }, [añoSel, state.honorarios]);

  const descargarDJ1887 = () => {
    if (datosDJ1887.length === 0) {
      showToast('warning', 'Sin datos', 'No hay datos de remuneraciones para el año seleccionado.');
      return;
    }
    let csv = "RUT Trabajador;Nombre Completo;Sueldo Imponible Anual;Leyes Sociales Anual;Impuesto Unico Retenido;Sueldo Liquido Anual;Meses Trabajados\r\n";
    datosDJ1887.forEach(d => {
      csv += `${d.rut};${d.nombreCompleto};${Math.round(d.imponible)};${Math.round(d.leyesSociales)};${Math.round(d.impuesto)};${Math.round(d.liquido)};${d.mesesActivo}\r\n`;
    });
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `DJ_1887_AT${añoSel}_${state.configuracion?.rut || 'empresa'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const descargarDJ1879 = () => {
    if (datosDJ1879.length === 0) {
      showToast('warning', 'Sin datos', 'No hay boletas de honorarios registradas para el año seleccionado.');
      return;
    }
    let csv = "RUT Receptor;Nombre Razon Social;Monto Bruto Anual;Retencion Impuesto Anual;Monto Liquido Anual;Cantidad Boletas\r\n";
    datosDJ1879.forEach(d => {
      csv += `${d.rut};${d.nombre};${Math.round(d.bruto)};${Math.round(d.retencion)};${Math.round(d.liquido)};${d.cantidadBoletas}\r\n`;
    });
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `DJ_1879_AT${añoSel}_${state.configuracion?.rut || 'empresa'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#1E3A5F]/10 rounded-lg">
            <FileSpreadsheet className="text-[#1E3A5F]" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Operación Renta F22 y DDJJ</h1>
            <p className="text-sm text-gray-500 mt-1">Gestión del Impuesto de Primera Categoría y Declaraciones Juradas del SII</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={String(añoSel)}
            onChange={e => handleAño(e.target.value)}
            options={AÑOS_OPCIONES}
          />
          <Button variant="secondary" icon={<Printer size={15} />} onClick={() => window.print()}>
            Imprimir
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setTabActiva('f22')}
          className={`py-3 px-6 font-semibold text-sm transition-colors border-b-2 ${
            tabActiva === 'f22'
              ? 'border-[#1E3A5F] text-[#1E3A5F] dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Asistente Formulario 22
        </button>
        <button
          onClick={() => setTabActiva('ddjj')}
          className={`py-3 px-6 font-semibold text-sm transition-colors border-b-2 ${
            tabActiva === 'ddjj'
              ? 'border-[#1E3A5F] text-[#1E3A5F] dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Declaraciones Juradas (SII)
        </button>
      </div>

      {tabActiva === 'f22' ? (
        <>
          {/* Banner info */}
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <Info size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold mb-1">Estimación orientativa — no reemplaza declaración oficial</p>
              <p>Los valores se pre-cargan desde los asientos contables del año comercial {añoSel - 1}.
                Puedes ajustarlos manualmente activando el <strong>Modo Edición</strong>. La tasa aplicada
                es {pct(TASA_PRIMERA_CATEGORIA[añoSel] ?? 0.27)} (Primera Categoría AT {añoSel}).</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ─── Panel izquierdo: datos ─────────────────────── */}
            <div className="space-y-4">
              {/* Controles edición */}
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">Datos del año comercial {añoSel - 1}</h3>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<RefreshCw size={13} />}
                      onClick={cargarDesistema}
                    >
                      Cargar del sistema
                    </Button>
                    <Button
                      size="sm"
                      variant={modoEdicion ? 'primary' : 'secondary'}
                      onClick={() => { if (!modoEdicion) cargarDesistema(); else setModoEdicion(false); }}
                    >
                      {modoEdicion ? 'Editando...' : 'Modo Edición'}
                    </Button>
                  </div>
                </div>

                {modoEdicion ? (
                  <div className="space-y-5">
                    {/* Ingresos */}
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Ingresos</p>
                      <div className="space-y-3">
                        <InputRow label="Ingresos de explotación" fieldKey="ingresosExplotacion" />
                        <InputRow label="Otros ingresos" fieldKey="otrosIngresos" />
                      </div>
                    </div>

                    {/* Gastos */}
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Gastos y Costos</p>
                      <div className="space-y-3">
                        <InputRow label="Costo de ventas" fieldKey="costoVentas" />
                        <InputRow label="Gastos de administración" fieldKey="gastosAdm" />
                        <InputRow label="Otros gastos" fieldKey="otrosGastos" />
                        <InputRow label="Honorarios pagados" fieldKey="honorariosPagados" />
                      </div>
                    </div>

                    {/* Ajustes */}
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Ajustes y Créditos</p>
                      <div className="space-y-3">
                        <InputRow label="Corrección monetaria (neta)" fieldKey="correccionMonetaria" />
                        <InputRow label="PPM acumulado pagado" fieldKey="ppmAcumulado" />
                        <InputRow label="Crédito activo fijo / zonas" fieldKey="creditoActivo" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-1.5 border-b border-dashed border-gray-200 dark:border-gray-700">
                      <span className="text-gray-600 dark:text-gray-400">Ingresos desde asientos</span>
                      <span className="font-mono font-semibold dark:text-gray-100">{formatCLP(datosSistema.ingresos)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-dashed border-gray-200 dark:border-gray-700">
                      <span className="text-gray-600 dark:text-gray-400">Gastos desde asientos</span>
                      <span className="font-mono font-semibold dark:text-gray-100">{formatCLP(datosSistema.gastos)}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-gray-600 dark:text-gray-400">Honorarios pagados</span>
                      <span className="font-mono font-semibold dark:text-gray-100">{formatCLP(datosSistema.honorarios)}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      Activa <strong>Modo Edición</strong> para ajustar valores y agregar créditos / PPM.
                    </p>
                  </div>
                )}
              </Card>
            </div>

            {/* ─── Panel derecho: resultado ────────────────────── */}
            <div className="space-y-4">
              <Card>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Estimación F22 — AT {añoSel}
                  <span className="ml-2 text-xs font-normal text-gray-400">Tasa {pct(calc.tasa)}</span>
                </h3>

                <div className="space-y-1">
                  {/* Ingresos */}
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-3 pt-2 pb-1">Ingresos</p>
                  <Row label="Ingresos de explotación" value={vals.ingresosExplotacion} />
                  <Row label="Otros ingresos"           value={vals.otrosIngresos} />
                  <Row label="Total ingresos"           value={calc.totalIngresos} highlight />

                  {/* Gastos */}
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-3 pt-3 pb-1">Gastos y Costos</p>
                  <Row label="Costo de ventas"          value={vals.costoVentas}       negative />
                  <Row label="Gastos administración"    value={vals.gastosAdm}         negative />
                  <Row label="Otros gastos"             value={vals.otrosGastos}       negative />
                  <Row label="Honorarios"               value={vals.honorariosPagados} negative />
                  <Row label="Corrección monetaria"     value={vals.correccionMonetaria} />

                  {/* Base */}
                  <div className="my-2 border-t border-gray-200 dark:border-gray-700" />
                  <Row label="Renta líquida imponible"  value={calc.baseImponible} highlight />

                  {/* Impuesto */}
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-3 pt-3 pb-1">Impuesto</p>
                  <Row label={`Impuesto 1ª categoría (${pct(calc.tasa)})`} value={calc.impuesto} />
                  <Row label="Crédito activo fijo/zonas" value={vals.creditoActivo} negative />
                  <Row label="Impuesto neto"            value={calc.impuestoNeto} />

                  {/* Créditos */}
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-3 pt-3 pb-1">Créditos y Pagos</p>
                  <Row label="PPM acumulado pagado"     value={vals.ppmAcumulado} negative />
                </div>

                {/* Resultado */}
                <div className={`mt-4 rounded-xl p-4 flex items-center gap-4 ${
                  calc.resultado > 0
                    ? 'bg-red-50 border border-red-200'
                    : calc.resultado < 0
                    ? 'bg-emerald-50 border border-emerald-200'
                    : 'bg-gray-50 border border-gray-200'
                }`}>
                  {calc.resultado > 0 ? (
                    <AlertCircle size={28} className="text-red-500 flex-shrink-0" />
                  ) : calc.resultado < 0 ? (
                    <CheckCircle size={28} className="text-emerald-500 flex-shrink-0" />
                  ) : (
                    <CheckCircle size={28} className="text-gray-400 flex-shrink-0" />
                  )}
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-wide mb-0.5 ${
                      calc.resultado > 0 ? 'text-red-600' : calc.resultado < 0 ? 'text-emerald-600' : 'text-gray-500'
                    }`}>
                      {calc.resultado > 0 ? 'Impuesto a pagar' : calc.resultado < 0 ? 'Saldo a favor (devolución)' : 'Equilibrado'}
                    </p>
                    <p className={`text-3xl font-bold font-mono ${
                      calc.resultado > 0 ? 'text-red-700' : calc.resultado < 0 ? 'text-emerald-700' : 'text-gray-700'
                    }`}>
                      {formatCLP(Math.abs(calc.resultado))}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Notas informativas */}
              <Card>
                <h4 className="font-semibold text-gray-700 dark:text-gray-200 text-sm mb-3">Fechas clave AT {añoSel}</h4>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  {[
                    { fecha: `30/04/${añoSel}`, desc: 'Vencimiento declaración F22 (personas naturales)' },
                    { fecha: `31/05/${añoSel}`, desc: 'Vencimiento declaración F22 (empresas)' },
                    { fecha: 'Enero–Marzo',     desc: 'Operación Renta — preparación antecedentes' },
                    { fecha: 'Febrero',         desc: 'Propuesta SII disponible en portal web' },
                  ].map(item => (
                    <li key={item.fecha} className="flex items-start gap-2">
                      <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 rounded px-1.5 py-0.5 flex-shrink-0 mt-0.5">{item.fecha}</span>
                      <span>{item.desc}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        </>
      ) : (
        /* ─── PESTAÑA DECLARACIONES JURADAS (SII) ─────────────── */
        <div className="space-y-6">
          <Card>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-700 pb-4 mb-4">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100 text-lg">Exportador de Declaraciones Juradas (DDJJ)</h3>
                <p className="text-sm text-gray-500">Selecciona la declaración del año comercial {añoSel - 1} a exportar en formato oficial.</p>
              </div>
              <div className="flex gap-2">
                <select
                  value={djSeleccionada}
                  onChange={e => setDjSeleccionada(e.target.value as '1887' | '1879')}
                  className="px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 font-medium text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20"
                >
                  <option value="1887">DJ 1887 (Sueldos y Remuneraciones)</option>
                  <option value="1879">DJ 1879 (Retenciones de Honorarios)</option>
                </select>
                <Button
                  variant="primary"
                  onClick={djSeleccionada === '1887' ? descargarDJ1887 : descargarDJ1879}
                >
                  Exportar CSV Oficial
                </Button>
              </div>
            </div>

            {djSeleccionada === '1887' ? (
              <div>
                <div className="mb-4 flex items-center justify-between bg-blue-50 dark:bg-blue-950/40 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <p className="font-bold">Declaración Jurada 1887: Remuneraciones anuales</p>
                    <p className="text-xs mt-1">Resume todos los sueldos imponibles y cotizaciones del año comercial {añoSel - 1}.</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-400 block uppercase font-semibold">Total Empleados</span>
                    <span className="text-2xl font-black text-[#1E3A5F] dark:text-blue-400">{datosDJ1887.length}</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 uppercase text-xs">
                        <th className="py-3 px-4">RUT</th>
                        <th className="py-3 px-4">Nombre Completo</th>
                        <th className="py-3 px-4 text-right">Imponible Anual</th>
                        <th className="py-3 px-4 text-right">Leyes Sociales</th>
                        <th className="py-3 px-4 text-right">Impuesto Retenido</th>
                        <th className="py-3 px-4 text-right">Sueldo Líquido</th>
                        <th className="py-3 px-4 text-center">Meses</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {datosDJ1887.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-10 text-gray-400">Sin liquidaciones de sueldos procesadas en el año comercial {añoSel - 1}</td>
                        </tr>
                      ) : (
                        datosDJ1887.map(d => (
                          <tr key={d.rut} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                            <td className="py-3 px-4 font-mono font-medium">{d.rut}</td>
                            <td className="py-3 px-4">{d.nombreCompleto}</td>
                            <td className="py-3 px-4 text-right font-mono">{formatCLP(d.imponible)}</td>
                            <td className="py-3 px-4 text-right font-mono">{formatCLP(d.leyesSociales)}</td>
                            <td className="py-3 px-4 text-right font-mono text-red-600">{formatCLP(d.impuesto)}</td>
                            <td className="py-3 px-4 text-right font-mono text-emerald-600">{formatCLP(d.liquido)}</td>
                            <td className="py-3 px-4 text-center font-mono">{d.mesesActivo}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-4 flex items-center justify-between bg-blue-50 dark:bg-blue-950/40 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <p className="font-bold">Declaración Jurada 1879: Retención de boletas de honorarios</p>
                    <p className="text-xs mt-1">Resume todas las retenciones sobre boletas de honorarios (segunda categoría) del año comercial {añoSel - 1}.</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-400 block uppercase font-semibold">Total Prestadores</span>
                    <span className="text-2xl font-black text-[#1E3A5F] dark:text-blue-400">{datosDJ1879.length}</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 uppercase text-xs">
                        <th className="py-3 px-4">RUT</th>
                        <th className="py-3 px-4">Razón Social / Nombre</th>
                        <th className="py-3 px-4 text-right">Monto Bruto Anual</th>
                        <th className="py-3 px-4 text-right">Retención (13.75%)</th>
                        <th className="py-3 px-4 text-right">Monto Líquido</th>
                        <th className="py-3 px-4 text-center">Boletas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {datosDJ1879.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-10 text-gray-400">Sin boletas de honorarios registradas en el año comercial {añoSel - 1}</td>
                        </tr>
                      ) : (
                        datosDJ1879.map(d => (
                          <tr key={d.rut} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                            <td className="py-3 px-4 font-mono font-medium">{d.rut}</td>
                            <td className="py-3 px-4">{d.nombre}</td>
                            <td className="py-3 px-4 text-right font-mono">{formatCLP(d.bruto)}</td>
                            <td className="py-3 px-4 text-right font-mono text-red-600">{formatCLP(d.retencion)}</td>
                            <td className="py-3 px-4 text-right font-mono text-emerald-600">{formatCLP(d.liquido)}</td>
                            <td className="py-3 px-4 text-center font-mono">{d.cantidadBoletas}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

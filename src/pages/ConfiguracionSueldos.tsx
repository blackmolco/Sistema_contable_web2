import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  DollarSign,
  RefreshCw,
  Save,
  TrendingUp,
  Info,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ExternalLink,
  Upload,
} from 'lucide-react';
import { Card, Button } from '../components/ui/Cards';
import { PreviRedService, DatosPreviRed } from '../services/PreviRedService';
import {
  SUELDO_MINIMO,
  ASIGNACION_FAMILIAR,
  TOPES_LEGALES,
  COTIZACIONES,
  JORNADA_LABORAL,
} from '../data/normativa';

// â”€â”€â”€ tipos locales â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface CalcHorasExtras {
  sueldoBase: number;
  horasOrdinarias: number;
  horasExtras: number;
}

const MESES_CORTO = [
  'Ene','Feb','Mar','Abr','May','Jun',
  'Jul','Ago','Sep','Oct','Nov','Dic',
];
const MESES_LARGO = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

const ANIO = 2026;
const PERIODOS = Array.from({ length: 12 }, (_, i) =>
  `${ANIO}-${String(i + 1).padStart(2, '0')}`
);

// â”€â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function periodoActual(): string {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
}

function formatCLP(value: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
export default function ConfiguracionSueldos() {
  // PerÃ­odo seleccionado â€” por defecto el mes actual o el Ãºltimo disponible
  const [periodo, setPeriodo] = useState<string>(() => {
    const actual = periodoActual();
    return PERIODOS.includes(actual) ? actual : '2026-05';
  });

  const [datos, setDatos] = useState<DatosPreviRed>(() =>
    PreviRedService.getDatosParaPeriodo(periodo)
  );
  const [guardado, setGuardado] = useState(false);
  const [mostrarComparacion, setMostrarComparacion] = useState(false);

  // Calculadora horas extras
  const [calcHE, setCalcHE] = useState<CalcHorasExtras>({
    sueldoBase: SUELDO_MINIMO.MENSUAL,
    horasOrdinarias: JORNADA_LABORAL.HORAS_MES_VIGENTE,
    horasExtras: 10,
  });

  // Cargar datos cuando cambia el perÃ­odo
  useEffect(() => {
    setDatos(PreviRedService.getDatosParaPeriodo(periodo));
    setGuardado(false);
  }, [periodo]);

  const mesNum = parseInt(periodo.split('-')[1], 10);
  const ufInfo = PreviRedService.getUFInfo(periodo);
  const mejorAFP = PreviRedService.getMejorAFP(periodo);
  const comparacionAFP = useMemo(
    () => PreviRedService.compararAFP(1_500_000, periodo),
    [periodo]
  );

  // Resultado calculadora horas extras
  const resultadoHE = useMemo(() => {
    const valorHoraNormal =
      calcHE.sueldoBase > 0 && calcHE.horasOrdinarias > 0
        ? calcHE.sueldoBase / calcHE.horasOrdinarias
        : 0;
    const valorHoraExtra = valorHoraNormal * 1.5;
    const montoTotal = Math.round(valorHoraExtra * calcHE.horasExtras);
    const maxLegalMes = Math.round(10 * (52 / 12)); // ~43h/mes
    return {
      valorHoraNormal: Math.round(valorHoraNormal),
      valorHoraExtra:  Math.round(valorHoraExtra),
      montoTotal,
      sobreLimite: calcHE.horasExtras > maxLegalMes,
      maxLegalMes,
    };
  }, [calcHE]);

  // â”€â”€ Handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const guardarCambios = useCallback(() => {
    PreviRedService.guardarDatosParaPeriodo(datos, periodo);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 3000);
  }, [datos, periodo]);

  const resetearPeriodo = useCallback(() => {
    const d = PreviRedService.resetearPeriodo(periodo);
    setDatos(d);
  }, [periodo]);

  const navMes = useCallback((delta: number) => {
    const idx = PERIODOS.indexOf(periodo);
    const siguiente = PERIODOS[Math.max(0, Math.min(11, idx + delta))];
    if (siguiente) setPeriodo(siguiente);
  }, [periodo]);

  const setUFDatos = useCallback((uf: number) => {
    setDatos(prev => {
      const topeAfp    = prev.topeUFafp    ?? 90.0;
      const topeSeguro = prev.topeUFseguro ?? 135.2;
      return {
        ...prev,
        uf: { ...prev.uf, valor: uf },
        rentaTopes: {
          imss:   Math.round(topeAfp    * uf),
          afp:    Math.round(topeAfp    * uf),
          seguro: Math.round(topeSeguro * uf),
        },
      };
    });
  }, []);

  const setSISDatos = useCallback((sis: number) => {
    setDatos(prev => ({
      ...prev,
      sis,
      tasasAFP: prev.tasasAFP.map(t => ({
        ...t,
        sis,
        tasaNominal: parseFloat((t.tasaReal + sis).toFixed(2)),
        total:       parseFloat((t.tasaReal + sis).toFixed(2)),
      })),
    }));
  }, []);

  // Link al PDF PreviRed del perÃ­odo seleccionado
  const linkPreviRed = useMemo(() => {
    const [anio, mes] = periodo.split('-');
    const MESES_URL: Record<string, string> = {
      '01': 'enero', '02': 'febrero', '03': 'marzo', '04': 'abril',
      '05': 'mayo',  '06': 'junio',   '07': 'julio', '08': 'agosto',
      '09': 'septiembre', '10': 'octubre', '11': 'noviembre', '12': 'diciembre',
    };
    const mesNombre = MESES_URL[mes] ?? 'mayo';
    return `https://www.previred.com/indicadores-previsionales/`;
  }, [periodo]);

  // â”€â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="space-y-6">

      {/* â”€â”€ HEADER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ConfiguraciÃ³n de Sueldos</h1>
          <p className="text-sm text-gray-500 mt-1">
            Indicadores PreviRed {ANIO} Â· Ley 21.561 Â· {JORNADA_LABORAL.HORAS_SEMANA_VIGENTE}h semanales vigentes
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={linkPreviRed}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 rounded-lg flex items-center gap-1.5 transition-colors"
            title="Ver PDF oficial PreviRed del perÃ­odo"
          >
            <ExternalLink size={15} /> PDF PreviRed
          </a>
          <Button variant="secondary" icon={<RotateCcw size={16} />} onClick={resetearPeriodo}>
            Restablecer
          </Button>
          <Button onClick={guardarCambios} icon={<Save size={18} />}>
            {guardado ? 'âœ“ Guardado' : 'Guardar'}
          </Button>
        </div>
      </div>

      {/* â”€â”€ SELECTOR DE PERÃODO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navMes(-1)}
            disabled={periodo === PERIODOS[0]}
            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="flex-1 overflow-x-auto">
            <div className="flex gap-1 min-w-max">
              {PERIODOS.map((p) => {
                const m = parseInt(p.split('-')[1], 10) - 1;
                const editado = PreviRedService.estaEditado(p);
                const uf = PreviRedService.getUFInfo(p);
                const esActual = p === periodo;
                const esMesReal = new Date().getMonth() === m && new Date().getFullYear() === ANIO;

                return (
                  <button
                    key={p}
                    onClick={() => setPeriodo(p)}
                    className={`relative flex flex-col items-center px-3 py-2 rounded-lg text-xs font-medium transition-all min-w-[56px] ${
                      esActual
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <span>{MESES_CORTO[m]}</span>
                    {/* Indicador de estado */}
                    <span className={`mt-1 w-1.5 h-1.5 rounded-full ${
                      uf.verificado
                        ? 'bg-emerald-400'
                        : editado
                        ? 'bg-blue-300'
                        : m < new Date().getMonth()
                        ? 'bg-amber-400'
                        : 'bg-gray-300'
                    } ${esActual ? 'opacity-90' : ''}`} />
                    {esMesReal && !esActual && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full border border-white" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => navMes(1)}
            disabled={periodo === PERIODOS[11]}
            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Leyenda */}
        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Verificada con PDF oficial PreviRed</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Estimada (revisar con PDF PreviRed)</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block" /> Mes futuro (proyectado)</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-300 inline-block" /> Editado manualmente</span>
        </div>
      </Card>

      {/* â”€â”€ ALERTA UF NO VERIFICADA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {!ufInfo.verificado && (
        <div className={`flex items-start gap-3 p-4 rounded-xl border ${
          mesNum < new Date().getMonth() + 1
            ? 'bg-amber-50 border-amber-200'
            : 'bg-blue-50 border-blue-200'
        }`}>
          <AlertTriangle size={18} className={mesNum < new Date().getMonth() + 1 ? 'text-amber-500' : 'text-blue-400'} />
          <div className="text-sm">
            <p className={`font-medium ${mesNum < new Date().getMonth() + 1 ? 'text-amber-800' : 'text-blue-800'}`}>
              {mesNum < new Date().getMonth() + 1
                ? `UF de ${MESES_LARGO[mesNum - 1]} es una estimaciÃ³n â€” verifique con CMF/SII antes de procesar sueldos`
                : `UF de ${MESES_LARGO[mesNum - 1]} es un valor proyectado`}
            </p>
            <p className="text-gray-500 mt-0.5">
              Fuente oficial: <a href="https://www.cmfchile.cl/portal/estadisticas/617/w3-propertyvalue-27311.html" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600">CMF Chile â€” Valor UF</a>
              {' '}Â· Edite el campo UF abajo y guarde para este perÃ­odo.
            </p>
          </div>
        </div>
      )}

      {/* â”€â”€ TÃTULO MES SELECCIONADO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">
          {MESES_CORTO[mesNum - 1]}
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            {MESES_LARGO[mesNum - 1]} {ANIO}
          </h2>
          <p className="text-xs text-gray-500">
            {ufInfo.verificado
              ? <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={12} /> Datos verificados con fuente oficial</span>
              : <span className="text-amber-600">Datos estimados â€” edite la UF del perÃ­odo si tiene el valor oficial</span>}
          </p>
        </div>
      </div>

      {/* â”€â”€ UF / UTM / SIS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* UF */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <DollarSign size={20} className="text-blue-600" />
            </div>
            {ufInfo.verificado
              ? <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">Verificada</span>
              : <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full">Estimada</span>}
          </div>
          <p className="text-xs text-gray-500 mb-1">UF â€” {datos.uf.fecha}</p>
          <input
            type="number"
            step="0.01"
            value={datos.uf.valor}
            onChange={(e) => setUFDatos(parseFloat(e.target.value) || 0)}
            className="w-full text-2xl font-bold text-gray-900 border border-gray-300 rounded-lg px-3 py-2"
          />
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-500">
            <span>Tope AFP ({datos.topeUFafp ?? 90} UF): <strong>{formatCLP(datos.rentaTopes.afp)}</strong></span>
            <span>Tope AFC ({datos.topeUFseguro ?? 135.2} UF): <strong>{formatCLP(datos.rentaTopes.seguro)}</strong></span>
          </div>
        </Card>

        {/* UTM */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <TrendingUp size={20} className="text-purple-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-1">UTM â€” {MESES_LARGO[mesNum - 1]} {ANIO}</p>
          <input
            type="number"
            value={datos.utm}
            onChange={(e) => setDatos(prev => ({ ...prev, utm: parseFloat(e.target.value) || 0 }))}
            className="w-full text-2xl font-bold text-gray-900 border border-gray-300 rounded-lg px-3 py-2"
          />
          <p className="text-xs text-gray-400 mt-2">
            Tramo exento IUSC: hasta {formatCLP(13.5 * datos.utm)} (13,5 UTM)
          </p>
        </Card>

        {/* SIS */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Users size={20} className="text-emerald-600" />
            </div>
            {datos.sis === 1.62
              ? <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded-full">Abr 2026+</span>
              : <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">Eneâ€“Mar 2026</span>}
          </div>
          <p className="text-xs text-gray-500 mb-1">Tasa SIS â€” cargo del empleador (%)</p>
          <input
            type="number"
            step="0.01"
            value={datos.sis ?? 1.62}
            onChange={(e) => setSISDatos(parseFloat(e.target.value) || 0)}
            className="w-full text-2xl font-bold text-gray-900 border border-gray-300 rounded-lg px-3 py-2"
          />
          <div className="mt-2 text-xs text-gray-400 space-y-0.5">
            <p>Eneâ€“Mar 2026: <strong>1.54%</strong></p>
            <p>Abr 2026+: <strong>1.62%</strong> (Oficio 7429)</p>
          </div>
        </Card>
      </div>

      {/* â”€â”€ NOTA COTIZACIÃ“N ADICIONAL EMPLEADOR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex items-start gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-700">
        <Info size={15} className="text-indigo-500 mt-0.5 flex-shrink-0" />
        <div>
          <strong>CotizaciÃ³n adicional empleador (0.1%) â€” Reforma Previsional 2026:</strong>{' '}
          AdemÃ¡s del SIS, el empleador paga un 0.1% adicional al AFP del trabajador (columna "Cargo del Empleador" en la tabla PreviRed).
          Esto aparece en el costo empresa de cada liquidaciÃ³n.
        </div>
      </div>

      {/* â”€â”€ JORNADA LABORAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <Card>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Clock size={20} className="text-indigo-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="font-semibold text-gray-900">Jornada Laboral â€” Ley 21.561 "40 Horas"</h3>
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full font-medium">
                {JORNADA_LABORAL.HORAS_SEMANA_VIGENTE}h/sem vigentes
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              ReducciÃ³n gradual de la jornada mÃ¡xima ordinaria. Horas/mes = h/sem Ã— 52 Ã· 12.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {JORNADA_LABORAL.ETAPAS.map((etapa) => (
                <div
                  key={etapa.horas}
                  className={`rounded-lg p-3 border-2 ${
                    etapa.vigente
                      ? 'border-indigo-400 bg-indigo-50'
                      : etapa.desdeAnio > ANIO
                      ? 'border-dashed border-amber-300 bg-amber-50 opacity-80'
                      : 'border-gray-200 bg-gray-50 opacity-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xl font-bold ${etapa.vigente ? 'text-indigo-700' : 'text-gray-500'}`}>
                      {etapa.horas}h
                    </span>
                    {etapa.vigente && (
                      <span className="text-xs bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">Hoy</span>
                    )}
                    {etapa.desdeAnio > ANIO && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">PrÃ³ximo</span>
                    )}
                  </div>
                  <p className={`text-xs ${etapa.vigente ? 'text-indigo-600 font-medium' : 'text-gray-400'}`}>
                    Desde {etapa.desdeAnio}
                  </p>
                  <p className={`text-xs mt-1 ${etapa.vigente ? 'text-indigo-500' : 'text-gray-400'}`}>
                    {Math.round(etapa.horas * 52 / 12)}h/mes
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* â”€â”€ INDICADORES LEGALES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <Card title="Indicadores Legales">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-xs text-blue-600 font-medium mb-1">Sueldo MÃ­nimo</p>
            <p className="text-lg font-bold text-blue-900">{formatCLP(SUELDO_MINIMO.MENSUAL)}</p>
            <p className="text-xs text-blue-500 mt-1">{formatCLP(SUELDO_MINIMO.HORA)}/hora</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <p className="text-xs text-purple-600 font-medium mb-1">Tope AFP / Salud</p>
            <p className="text-lg font-bold text-purple-900">{formatCLP(datos.rentaTopes.afp)}</p>
            <p className="text-xs text-purple-500 mt-1">90 UF Â· UF={formatCLP(datos.uf.valor)}</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-4">
            <p className="text-xs text-amber-600 font-medium mb-1">Tope AFC</p>
            <p className="text-lg font-bold text-amber-900">{formatCLP(datos.rentaTopes.seguro)}</p>
            <p className="text-xs text-amber-500 mt-1">135,2 UF mensuales</p>
          </div>
          <div className="bg-emerald-50 rounded-lg p-4">
            <p className="text-xs text-emerald-600 font-medium mb-1">SIS + Adicional AFP</p>
            <p className="text-lg font-bold text-emerald-900">{(datos.sis ?? COTIZACIONES.SIS_EMPLEADOR).toFixed(2)}% + 0.1%</p>
            <p className="text-xs text-emerald-500 mt-1">Cargo del empleador</p>
          </div>
        </div>

        {/* AsignaciÃ³n Familiar */}
        <div className="mt-5">
          <div className="flex items-center gap-2 mb-3">
            <Users size={15} className="text-gray-500" />
            <p className="text-sm font-semibold text-gray-700">AsignaciÃ³n Familiar 2026 (por carga)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600">
                  <th className="text-left py-2 px-3 font-medium">Tramo</th>
                  <th className="text-right py-2 px-3 font-medium">RemuneraciÃ³n hasta</th>
                  <th className="text-right py-2 px-3 font-medium">Monto por carga</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr><td className="py-2 px-3 font-medium text-blue-700">A</td><td className="py-2 px-3 text-right">{formatCLP(ASIGNACION_FAMILIAR.TRAMO_A.limite)}</td><td className="py-2 px-3 text-right font-semibold text-emerald-700">{formatCLP(ASIGNACION_FAMILIAR.MONTO_UNICO_A)}</td></tr>
                <tr><td className="py-2 px-3 font-medium text-blue-700">B</td><td className="py-2 px-3 text-right">{formatCLP(ASIGNACION_FAMILIAR.TRAMO_B.limite)}</td><td className="py-2 px-3 text-right font-semibold text-emerald-700">{formatCLP(ASIGNACION_FAMILIAR.MONTO_UNICO_B)}</td></tr>
                <tr><td className="py-2 px-3 font-medium text-blue-700">C</td><td className="py-2 px-3 text-right">{formatCLP(ASIGNACION_FAMILIAR.TRAMO_C.limite)}</td><td className="py-2 px-3 text-right font-semibold text-emerald-700">{formatCLP(ASIGNACION_FAMILIAR.MONTO_UNICO_C)}</td></tr>
                <tr><td className="py-2 px-3 font-medium text-gray-400">D</td><td className="py-2 px-3 text-right text-gray-400">Superior</td><td className="py-2 px-3 text-right text-gray-400">$0</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* AFC */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-gray-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-600 mb-2">Seg. CesantÃ­a â€” Contrato Indefinido</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Trabajador</span><span className="font-medium">{COTIZACIONES.AFC_TRABAJADOR_INDEFINIDO}%</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Empleador</span><span className="font-medium">{COTIZACIONES.AFC_EMPLEADOR_INDEFINIDO}%</span></div>
            </div>
          </div>
          <div className="border border-gray-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-600 mb-2">Seg. CesantÃ­a â€” Contrato Plazo Fijo</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Trabajador</span><span className="font-medium">{COTIZACIONES.AFC_TRABAJADOR_PLAZO}%</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Empleador</span><span className="font-medium">{COTIZACIONES.AFC_EMPLEADOR_PLAZO}%</span></div>
            </div>
          </div>
        </div>
      </Card>

      {/* â”€â”€ TASAS AFP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <Card title={`Tasas de CotizaciÃ³n AFP â€” ${MESES_LARGO[mesNum - 1]} ${ANIO}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200 bg-gray-50">
                <th className="text-left py-3 px-3 font-medium text-gray-600">AFP</th>
                <th className="text-right py-3 px-3 font-medium text-gray-600">
                  Ahorro<br /><span className="text-xs font-normal text-gray-400">10%</span>
                </th>
                <th className="text-right py-3 px-3 font-medium text-gray-600">
                  ComisiÃ³n<br /><span className="text-xs font-normal text-gray-400">AFP</span>
                </th>
                <th className="text-right py-3 px-3 font-medium text-blue-700">
                  Total Trab.<br /><span className="text-xs font-normal">(descuento)</span>
                </th>
                <th className="text-right py-3 px-3 font-medium text-gray-600">
                  SIS<br /><span className="text-xs font-normal text-gray-400">empleador</span>
                </th>
                <th className="text-right py-3 px-3 font-medium text-gray-600">
                  +0.1%<br /><span className="text-xs font-normal text-gray-400">empleador</span>
                </th>
                <th className="text-right py-3 px-3 font-medium text-orange-700">
                  Costo emp.<br /><span className="text-xs font-normal">(SIS+0.1%)</span>
                </th>
                <th className="text-right py-3 px-3 font-medium text-gray-500">
                  Total ind.<br /><span className="text-xs font-normal text-gray-400">independiente</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {datos.tasasAFP.map((tasa, index) => {
                const comision = parseFloat((tasa.tasaReal - 10).toFixed(2));
                const adicional = tasa.empleadorAdicional ?? 0.1;
                const costoEmpleador = parseFloat((tasa.sis + adicional).toFixed(2));
                return (
                  <tr
                    key={index}
                    className={`border-b border-gray-100 hover:bg-gray-50 ${tasa.afp === mejorAFP.afp ? 'bg-emerald-50 hover:bg-emerald-50' : ''}`}
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{tasa.afp}</span>
                        {tasa.afp === mejorAFP.afp && (
                          <span className="px-1.5 py-0.5 bg-emerald-500 text-white text-xs rounded-full">Menor</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right text-gray-500">10.00%</td>
                    <td className="py-3 px-3 text-right text-gray-600">{comision.toFixed(2)}%</td>
                    <td className="py-3 px-3 text-right font-bold text-blue-700">{tasa.tasaReal.toFixed(2)}%</td>
                    <td className="py-3 px-3 text-right text-gray-500">{tasa.sis.toFixed(2)}%</td>
                    <td className="py-3 px-3 text-right text-gray-500">{adicional.toFixed(1)}%</td>
                    <td className="py-3 px-3 text-right font-semibold text-orange-700">{costoEmpleador.toFixed(2)}%</td>
                    <td className="py-3 px-3 text-right text-gray-400">{tasa.total.toFixed(2)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100 text-xs text-blue-700 space-y-1">
          <p><strong>Fuente:</strong> Indicadores PreviRed â€” tasas fijadas por la Superintendencia de Pensiones.</p>
          <p>
            <strong>Trabajador descuenta:</strong> 10% ahorro + comisiÃ³n AFP = columna "Total Trab."
            Â· <strong>Empleador paga:</strong> SIS + 0.1% adicional (reforma 2026)
            Â· SIS cambiÃ³ a 1.62% desde Abril 2026 (Oficio NÂ° 7429 del 14/04/2026)
          </p>
        </div>
      </Card>

      {/* â”€â”€ COMPARACIÃ“N AFP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">ComparaciÃ³n por sueldo de $1.500.000</h3>
          <Button variant="ghost" size="sm" onClick={() => setMostrarComparacion(!mostrarComparacion)}>
            {mostrarComparacion ? 'Ocultar' : 'Mostrar'}
          </Button>
        </div>
        {mostrarComparacion && (
          <div className="space-y-2">
            {comparacionAFP.map((comp, i) => (
              <div
                key={i}
                className={`flex items-center justify-between p-3 rounded-lg ${i === 0 ? 'bg-emerald-50' : 'bg-gray-50'}`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-sm">{comp.afp}</span>
                  {i === 0 && <span className="px-2 py-0.5 bg-emerald-500 text-white text-xs rounded-full">Recomendada</span>}
                </div>
                <div className="text-right">
                  <p className="font-medium text-sm">{formatCLP(comp.cotizacionTotal)}/mes</p>
                  {comp.ahorroAnual > 0 && (
                    <p className="text-xs text-emerald-600">Ahorro anual: {formatCLP(comp.ahorroAnual)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* â”€â”€ RENTAS TOPES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <Card title={`Rentas Topes Imponibles â€” ${MESES_LARGO[mesNum - 1]} ${ANIO}`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Tope AFP / Salud', key: 'afp' as const, uf: 90 },
            { label: 'Tope IMSS',        key: 'imss' as const, uf: 90 },
            { label: 'Tope AFC',         key: 'seguro' as const, uf: 135.2 },
          ].map(({ label, key, uf }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
              <input
                type="number"
                value={datos.rentaTopes[key]}
                onChange={(e) => setDatos({
                  ...datos,
                  rentaTopes: { ...datos.rentaTopes, [key]: parseFloat(e.target.value) },
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">{uf} UF Ã— {formatCLP(datos.uf.valor)}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* â”€â”€ CALCULADORA HORAS EXTRAORDINARIAS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <Card title="Calculadora de Horas Extraordinarias (Art. 32 CT)">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sueldo Base</label>
            <input
              type="number"
              value={calcHE.sueldoBase}
              onChange={(e) => setCalcHE({ ...calcHE, sueldoBase: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              min={0}
            />
            <p className="text-xs text-gray-400 mt-1">MÃ­nimo: {formatCLP(SUELDO_MINIMO.MENSUAL)}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Horas Ordinarias / Mes</label>
            <input
              type="number"
              value={calcHE.horasOrdinarias}
              onChange={(e) => setCalcHE({ ...calcHE, horasOrdinarias: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              min={1} max={240}
            />
            <p className="text-xs text-gray-400 mt-1">
              Ley vigente: 42h/sem = {JORNADA_LABORAL.HORAS_MES_VIGENTE}h/mes
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Horas Extras Trabajadas</label>
            <input
              type="number"
              value={calcHE.horasExtras}
              onChange={(e) => setCalcHE({ ...calcHE, horasExtras: Number(e.target.value) })}
              className={`w-full px-3 py-2 border rounded-lg text-sm ${
                resultadoHE.sobreLimite ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
              min={0}
            />
            <p className={`text-xs mt-1 ${resultadoHE.sobreLimite ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
              {resultadoHE.sobreLimite
                ? `âš  Supera el mÃ¡ximo legal (~${resultadoHE.maxLegalMes}h/mes)`
                : `MÃ¡x. legal: 2h/dÃ­a Â· 10h/sem (~${resultadoHE.maxLegalMes}h/mes)`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 rounded-xl p-4">
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">Valor Hora Ordinaria</p>
            <p className="text-xl font-bold text-gray-800">{formatCLP(resultadoHE.valorHoraNormal)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">Valor Hora Extra (Ã—1,5)</p>
            <p className="text-xl font-bold text-blue-700">{formatCLP(resultadoHE.valorHoraExtra)}</p>
          </div>
          <div className="text-center border-t md:border-t-0 md:border-l border-gray-200 pt-4 md:pt-0 md:pl-4">
            <p className="text-xs text-gray-500 mb-1">Total ({calcHE.horasExtras}h)</p>
            <p className="text-2xl font-bold text-emerald-600">{formatCLP(resultadoHE.montoTotal)}</p>
            <p className="text-xs text-gray-400 mt-1">Imponible para cotizaciones</p>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
          <Info size={15} className="text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700">
            <strong>CT Art. 30â€“32:</strong> Recargo mÃ­nimo 50% sobre la hora ordinaria. LÃ­mite: 2h/dÃ­a y 10h/semana.
            Las horas extras son <strong>imponibles</strong> (AFP, salud, AFC). El pacto debe ser escrito y tiene vigencia mÃ¡xima de 3 meses renovables.
          </p>
        </div>
      </Card>

      {/* â”€â”€ CÃ“MO ACTUALIZAR DESDE PDF PreviRed â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <Card>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Upload size={20} className="text-violet-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-1">CÃ³mo actualizar los indicadores desde el PDF PreviRed</h3>
            <p className="text-xs text-gray-500 mb-3">
              PreviRed publica un PDF mensual con todos los indicadores. Siga estos pasos para actualizar manualmente:
            </p>
            <ol className="text-xs text-gray-600 space-y-1.5 list-decimal list-inside">
              <li>
                Descargue el PDF desde{' '}
                <a href="https://www.previred.com/indicadores-previsionales/" target="_blank" rel="noopener noreferrer"
                  className="text-blue-600 underline hover:text-blue-800 inline-flex items-center gap-0.5">
                  previred.com/indicadores-previsionales <ExternalLink size={11} />
                </a>
              </li>
              <li>Seleccione el mes correspondiente en el selector de perÃ­odo de arriba</li>
              <li>Edite el campo <strong>UF</strong> con el valor "Al Ãºltimo dÃ­a del mes" que aparece en el PDF</li>
              <li>Edite el campo <strong>UTM</strong> con el valor publicado (columna UTM del cuadro superior)</li>
              <li>Edite el campo <strong>SIS</strong> si cambiÃ³ (Eneâ€“Mar 2026: 1.54% Â· Abr 2026+: 1.62%)</li>
              <li>Haga clic en <strong>Guardar</strong> â€” los cambios se aplican a todas las liquidaciones del perÃ­odo</li>
            </ol>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
              {[
                { mes: 'Ene 2026', uf: '39.706,07', utm: '69.751', sis: '1,54%', ok: true },
                { mes: 'Feb 2026', uf: '39.790,63', utm: '69.611', sis: '1,54%', ok: true },
                { mes: 'Mar 2026', uf: '39.841,72', utm: '69.889', sis: '1,54%', ok: true },
                { mes: 'Abr 2026', uf: '40.120,20', utm: '69.889', sis: '1,62%', ok: true },
                { mes: 'May 2026', uf: '40.610,69', utm: '70.588', sis: '1,62%', ok: true },
              ].map(d => (
                <div key={d.mes} className={`flex items-center justify-between p-2 rounded-lg border ${d.ok ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                  <span className="font-medium text-gray-700">{d.mes}</span>
                  <div className="text-right text-gray-500 space-y-0.5">
                    <div>UF ${d.uf}</div>
                    <div>UTM ${d.utm} Â· SIS {d.sis}</div>
                  </div>
                  {d.ok && <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0 ml-1" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* â”€â”€ HISTORIAL / ESTADO DE PERÃODOS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <Card title="Estado de ConfiguraciÃ³n por PerÃ­odo">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {PERIODOS.map((p) => {
            const m = parseInt(p.split('-')[1], 10) - 1;
            const editado = PreviRedService.estaEditado(p);
            const uf = PreviRedService.getUFInfo(p);
            const esPasado = p < periodoActual();
            const esFuturo = p > periodoActual();

            return (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={`text-left p-3 rounded-lg border transition-all ${
                  p === periodo
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <p className="text-sm font-semibold text-gray-800">{MESES_LARGO[m]}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  UF {uf.valor.toLocaleString('es-CL', { minimumFractionDigits: 2 })}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  {uf.verificado
                    ? <span className="text-xs text-emerald-600 flex items-center gap-0.5"><CheckCircle2 size={10} /> Verificada</span>
                    : esPasado
                    ? <span className="text-xs text-amber-600 flex items-center gap-0.5"><AlertTriangle size={10} /> Verificar</span>
                    : <span className="text-xs text-gray-400">Proyectado</span>}
                  {editado && !uf.verificado && (
                    <span className="text-xs text-blue-500 ml-1">Â· editado</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

    </div>
  );
}


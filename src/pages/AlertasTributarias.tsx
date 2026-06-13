import React, { useMemo } from 'react';
import { Bell, Calendar, CheckCircle2, AlertTriangle, Clock, XCircle } from 'lucide-react';
import { Card } from '../components/ui/Cards';
import { useApp } from '../context/AppContext';

interface AlertaTributaria {
  id: string;
  titulo: string;
  descripcion: string;
  fechaVencimiento: Date;
  categoria: 'sii' | 'prevision' | 'laboral' | 'municipal';
  prioridad: 'alta' | 'media' | 'baja';
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function generarAlertas(anio: number, mes: number): AlertaTributaria[] {
  // mes es 0-indexed
  const m = mes;
  const y = anio;
  // Día 12 ó 20 dependiendo de si es contribuyente electrónico
  const f29Dia = 20;
  const alertas: AlertaTributaria[] = [
    // F29 mes actual
    {
      id: `f29-${y}-${m}`,
      titulo: 'Formulario 29 (IVA y PPM)',
      descripcion: `Declaración y pago de IVA del mes ${MESES[m - 1]} ${y}. Contribuyentes electrónicos tienen plazo hasta el día ${f29Dia}.`,
      fechaVencimiento: new Date(y, m, f29Dia),
      categoria: 'sii',
      prioridad: 'alta',
    },
    // Cotizaciones previsionales (día 13)
    {
      id: `previred-${y}-${m}`,
      titulo: 'Pago Cotizaciones Previsionales (Previred)',
      descripcion: `Plazo para pagar AFP, Salud y AFC de los trabajadores del mes ${MESES[m - 1]}. Vence el día 13.`,
      fechaVencimiento: new Date(y, m, 13),
      categoria: 'prevision',
      prioridad: 'alta',
    },
    // Sueldos (último día hábil)
    {
      id: `sueldos-${y}-${m}`,
      titulo: 'Pago de Remuneraciones',
      descripcion: `Pago de sueldos líquidos del mes ${MESES[m - 1]}. Debe realizarse el último día hábil.`,
      fechaVencimiento: new Date(y, m, 0), // último día del mes anterior
      categoria: 'laboral',
      prioridad: 'alta',
    },
    // Anticipo PPM (sólo si aplica - igual al F29)
    {
      id: `ppm-${y}-${m}`,
      titulo: 'PPM (Pago Provisional Mensual)',
      descripcion: `Pago del PPM correspondiente a los ingresos del mes anterior. Se declara junto al F29.`,
      fechaVencimiento: new Date(y, m, f29Dia),
      categoria: 'sii',
      prioridad: 'media',
    },
    // Patente Municipal (semestral - enero y julio)
    ...(m === 0 || m === 6 ? [{
      id: `patente-${y}-${m}`,
      titulo: 'Patente Municipal Semestral',
      descripcion: `Vencimiento del pago de la Patente Comercial Municipal del semestre. Verificar con la municipalidad correspondiente.`,
      fechaVencimiento: new Date(y, m, 31),
      categoria: 'municipal' as const,
      prioridad: 'media' as const,
    }] : []),
    // F22 - Operación Renta (abril)
    ...(m === 3 ? [{
      id: `f22-${y}`,
      titulo: 'Operación Renta - Formulario 22',
      descripcion: `Plazo para presentar la Declaración Anual de Renta del año tributario ${y}. Vence el 30 de Abril.`,
      fechaVencimiento: new Date(y, 3, 30),
      categoria: 'sii' as const,
      prioridad: 'alta' as const,
    }] : []),
  ];
  return alertas;
}

const categoriaBadge: Record<string, { label: string; color: string }> = {
  sii:       { label: 'SII',        color: 'bg-blue-100 text-blue-800' },
  prevision: { label: 'Previsión',  color: 'bg-purple-100 text-purple-800' },
  laboral:   { label: 'Laboral',    color: 'bg-emerald-100 text-emerald-800' },
  municipal: { label: 'Municipal',  color: 'bg-amber-100 text-amber-800' },
};

export default function AlertasTributarias() {
  const hoy = new Date();
  const { state } = useApp();

  // Generar alertas para el mes actual y el siguiente
  const alertasMesActual = useMemo(() => generarAlertas(hoy.getFullYear(), hoy.getMonth() + 1), []);
  const alertasMesSiguiente = useMemo(() => {
    const nextMonth = hoy.getMonth() + 2 > 12 ? 1 : hoy.getMonth() + 2;
    const nextYear  = hoy.getMonth() + 2 > 12 ? hoy.getFullYear() + 1 : hoy.getFullYear();
    return generarAlertas(nextYear, nextMonth);
  }, []);

  const todasAlertas = [...alertasMesActual, ...alertasMesSiguiente].sort(
    (a, b) => a.fechaVencimiento.getTime() - b.fechaVencimiento.getTime()
  );

  const getEstado = (fecha: Date) => {
    const diff = Math.ceil((fecha.getTime() - hoy.getTime()) / (1000 * 3600 * 24));
    if (diff < 0)   return { label: 'VENCIDA',       color: 'text-red-700',    bg: 'bg-red-50 border-red-200',    icon: <XCircle   size={18} className="text-red-600"    /> };
    if (diff === 0) return { label: 'HOY',            color: 'text-red-700',    bg: 'bg-red-50 border-red-200',    icon: <AlertTriangle size={18} className="text-red-600" /> };
    if (diff <= 5)  return { label: `${diff}d`,       color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200', icon: <AlertTriangle size={18} className="text-amber-500" /> };
    if (diff <= 15) return { label: `${diff}d`,       color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',   icon: <Clock     size={18} className="text-blue-500"   /> };
    return              { label: `${diff}d`,           color: 'text-gray-600',   bg: 'bg-gray-50 border-gray-200',   icon: <CheckCircle2 size={18} className="text-gray-400" /> };
  };

  // Contratos a plazo fijo por vencer
  const contratosPorVencer = state.trabajadores.filter(t => {
    if (t.tipoContrato !== 'plazo') return false;
    return true; // en un sistema real verificaríamos fecha fin contrato
  });

  const vencenHoy     = todasAlertas.filter(a => { const d = Math.ceil((a.fechaVencimiento.getTime() - hoy.getTime())/(1000*3600*24)); return d >= 0 && d <= 0; });
  const vencenSemana  = todasAlertas.filter(a => { const d = Math.ceil((a.fechaVencimiento.getTime() - hoy.getTime())/(1000*3600*24)); return d >= 1 && d <= 7; });
  const proximas      = todasAlertas.filter(a => { const d = Math.ceil((a.fechaVencimiento.getTime() - hoy.getTime())/(1000*3600*24)); return d > 7; });
  const vencidas      = todasAlertas.filter(a => a.fechaVencimiento < hoy && Math.ceil((a.fechaVencimiento.getTime() - hoy.getTime())/(1000*3600*24)) < 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-rose-100 rounded-lg">
            <Bell className="text-rose-700" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Alertas y Calendario Tributario</h1>
            <p className="text-sm text-gray-500 mt-1">
              Vencimientos SII, Previred y obligaciones laborales — {MESES[hoy.getMonth()]} {hoy.getFullYear()}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Hoy</p>
          <p className="text-lg font-bold text-gray-900">
            {hoy.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={`rounded-xl border-2 p-4 text-center ${vencidas.length > 0 ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-200'}`}>
          <p className={`text-3xl font-black ${vencidas.length > 0 ? 'text-red-700' : 'text-gray-400'}`}>{vencidas.length}</p>
          <p className="text-xs font-semibold text-gray-600 mt-1 uppercase">Vencidas</p>
        </div>
        <div className={`rounded-xl border-2 p-4 text-center ${vencenHoy.length > 0 ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-200'}`}>
          <p className={`text-3xl font-black ${vencenHoy.length > 0 ? 'text-red-700' : 'text-gray-400'}`}>{vencenHoy.length}</p>
          <p className="text-xs font-semibold text-gray-600 mt-1 uppercase">Vencen Hoy</p>
        </div>
        <div className={`rounded-xl border-2 p-4 text-center ${vencenSemana.length > 0 ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-200'}`}>
          <p className={`text-3xl font-black ${vencenSemana.length > 0 ? 'text-amber-700' : 'text-gray-400'}`}>{vencenSemana.length}</p>
          <p className="text-xs font-semibold text-gray-600 mt-1 uppercase">Esta Semana</p>
        </div>
        <div className="rounded-xl border-2 p-4 text-center bg-blue-50 border-blue-200">
          <p className="text-3xl font-black text-blue-700">{proximas.length}</p>
          <p className="text-xs font-semibold text-gray-600 mt-1 uppercase">Próximas</p>
        </div>
      </div>

      {/* Lista de Alertas */}
      <Card>
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Calendar size={18} className="text-gray-500" />
          Calendario de Vencimientos
        </h3>
        <div className="space-y-3">
          {todasAlertas.map(alerta => {
            const estado = getEstado(alerta.fechaVencimiento);
            const cat    = categoriaBadge[alerta.categoria];
            return (
              <div key={alerta.id} className={`flex items-center gap-4 p-4 rounded-xl border ${estado.bg} transition-all`}>
                <div className="flex-shrink-0">{estado.icon}</div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold text-gray-900 text-sm">{alerta.titulo}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${cat.color}`}>{cat.label}</span>
                    {alerta.prioridad === 'alta' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-100 text-red-800">ALTA PRIORIDAD</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{alerta.descripcion}</p>
                </div>

                <div className="flex-shrink-0 text-right">
                  <p className="text-xs text-gray-500">Vence</p>
                  <p className="text-sm font-bold text-gray-900">
                    {alerta.fechaVencimiento.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
                  </p>
                  <span className={`text-xs font-black ${estado.color}`}>{estado.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Contratos a Plazo Fijo */}
      {contratosPorVencer.length > 0 && (
        <Card className="border-amber-200">
          <h3 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-600" />
            Trabajadores con Contrato a Plazo Fijo
          </h3>
          <div className="space-y-2">
            {contratosPorVencer.map(t => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{t.nombre} {t.apellidos}</p>
                  <p className="text-xs text-gray-500">{t.cargo} — Ingreso: {new Date(t.fechaIngreso).toLocaleDateString('es-CL')}</p>
                </div>
                <span className="bg-amber-200 text-amber-900 text-[10px] px-2 py-1 rounded font-bold">PLAZO FIJO</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

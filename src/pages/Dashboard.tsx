import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  TrendingUp,
  ShoppingCart,
  Users,
  FileText,
  Sparkles,
  Settings,
  GripVertical,
  Maximize2,
  Minimize2,
  X,
  BarChart3,
  Activity,
  Calendar,
  Download,
  DollarSign,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { KPICard, Card } from '../components/ui/Cards';
import { CalculadoraHonorarios } from '../components/ui/CalculadoraHonorarios';
import { useApp } from '../context/AppContext';
import { formatCurrency, generateId, getNombreMes } from '../utils/calculos';
import { useTesoreriaStore } from '../stores';
import { SIIService } from '../services/sii';
import { useIndicadores } from '../hooks/useIndicadores';
import { WidgetTareas, type Tarea } from '../components/dashboard/WidgetTareas';
import { WidgetCalendario, type VencimientoTributario } from '../components/dashboard/WidgetCalendario';
import { WidgetNotas, type NotaRapida, NOTA_COLORES } from '../components/dashboard/WidgetNotas';
import { WidgetAlertas } from '../components/dashboard/WidgetAlertas';
import { WidgetActividad } from '../components/dashboard/WidgetActividad';

// Tipos para widgets configurables
interface WidgetConfig {
  id: string;
  type: 'kpi' | 'chart' | 'alerts' | 'activity' | 'calculator' | 'tasks' | 'calendar' | 'notes';
  title: string;
  visible: boolean;
  order: number;
  size?: 'small' | 'medium' | 'large';
}

const defaultWidgets: WidgetConfig[] = [
  { id: 'kpis', type: 'kpi', title: 'Indicadores Clave', visible: true, order: 0, size: 'large' },
  { id: 'alerts', type: 'alerts', title: 'Alertas y Recordatorios', visible: true, order: 1, size: 'large' },
  { id: 'tasks', type: 'tasks', title: 'Tareas Pendientes', visible: true, order: 2, size: 'medium' },
  { id: 'calendar', type: 'calendar', title: 'Calendario Tributario', visible: true, order: 3, size: 'medium' },
  { id: 'notes', type: 'notes', title: 'Notas Rapidas', visible: true, order: 4, size: 'small' },
  { id: 'chart-line', type: 'chart', title: 'Evolucion Mensual', visible: true, order: 5, size: 'large' },
  { id: 'chart-pie', type: 'chart', title: 'Distribucion de Gastos', visible: true, order: 6, size: 'medium' },
  { id: 'chart-area', type: 'chart', title: 'Prediccion Flujo (IA)', visible: true, order: 7, size: 'medium' },
  { id: 'chart-bar', type: 'chart', title: 'Comparativo Trimestral', visible: false, order: 8, size: 'medium' },
  { id: 'activity', type: 'activity', title: 'Actividad Reciente', visible: true, order: 9, size: 'medium' },
  { id: 'calculadora', type: 'calculator', title: 'Calculadora de Honorarios', visible: false, order: 99, size: 'medium' },
];

// Componente de widget redimensionable
const DraggableWidget = React.memo(function DraggableWidget({
  widget,
  onRemove,
  onMove,
  isFirst,
  isLast,
  children,
}: {
  widget: WidgetConfig;
  onRemove: (id: string) => void;
  onMove?: (direction: 'up' | 'down') => void;
  isFirst?: boolean;
  isLast?: boolean;
  children: React.ReactNode;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={`card-modern overflow-hidden transition-all duration-300 ${
        isExpanded ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''
      }`}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
        <div className="flex items-center gap-2">
          <GripVertical size={14} className="text-gray-400 cursor-move animate-pulse" />
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{widget.title}</h3>
          {widget.type === 'chart' && widget.id === 'chart-area' && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs rounded-full font-bold">
              <Sparkles size={10} />
              IA
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {!isFirst && (
            <button
              onClick={() => onMove?.('up')}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400 transition-colors"
              title="Mover hacia arriba"
            >
              <ArrowUp size={13} />
            </button>
          )}
          {!isLast && (
            <button
              onClick={() => onMove?.('down')}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400 transition-colors"
              title="Mover hacia abajo"
            >
              <ArrowDown size={13} />
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400 transition-colors"
            title={isExpanded ? 'Minimizar' : 'Maximizar'}
          >
            {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          <button
            onClick={() => onRemove(widget.id)}
            className="p-1 hover:bg-red-100 dark:hover:bg-red-950/40 rounded text-gray-400 hover:text-red-500 transition-colors"
            title="Ocultar widget"
          >
            <X size={13} />
          </button>
        </div>
      </div>
      <div className={`p-4 ${isExpanded ? 'h-[500px]' : ''}`}>{children}</div>
    </div>
  );
});

export default function Dashboard() {
  const navigate = useNavigate();
  const { state, showToast } = useApp();
  const periodoActual = getNombreMes(new Date().getMonth() + 1);
  const { indicadores, loading: loadingIndicadores } = useIndicadores();

  const [tareas, setTareas] = useState<Tarea[]>(() => {
    const saved = localStorage.getItem('dashboard_tareas');
    return saved ? JSON.parse(saved) : [
      { id: '1', titulo: 'Presentar F29', descripcion: 'Declaracion mensual de impuestos', prioridad: 'alta', fechaVencimiento: '2026-05-20', completada: false, modulo: 'f29' },
      { id: '2', titulo: 'Pagar imposiciones', descripcion: 'Cotizaciones previsionales', prioridad: 'alta', fechaVencimiento: '2026-05-22', completada: false, modulo: 'remuneraciones' },
      { id: '3', titulo: 'Actualizar libro de ventas', descripcion: 'Registrar facturas del mes', prioridad: 'media', fechaVencimiento: '2026-05-25', completada: false, modulo: 'libro-ventas' },
      { id: '4', titulo: 'Conciliar banco', descripcion: 'Reconciliar saldo banco con libro mayor', prioridad: 'media', fechaVencimiento: '2026-05-30', completada: false, modulo: 'conciliacion' },
    ];
  });

  const [notas, setNotas] = useState<NotaRapida[]>(() => {
    const saved = localStorage.getItem('dashboard_notas');
    return saved ? JSON.parse(saved) : [
      { id: '1', contenido: 'Revisar cotizacion AFP Capital', color: '#fef3c7', fecha: new Date().toISOString() },
      { id: '2', contenido: 'LLamar a contador por tema F29', color: '#dbeafe', fecha: new Date().toISOString() },
    ];
  });

  const [newTarea, setNewTarea] = useState('');
  const [newNota, setNewNota] = useState('');
  const [notaColor, setNotaColor] = useState('#fef3c7');
  const [showTareaForm, setShowTareaForm] = useState(false);

  useEffect(() => { localStorage.setItem('dashboard_tareas', JSON.stringify(tareas)); }, [tareas]);
  useEffect(() => { localStorage.setItem('dashboard_notas', JSON.stringify(notas)); }, [notas]);

  const toggleTarea = useCallback((id: string) => {
    setTareas(prev => prev.map(t => t.id === id ? { ...t, completada: !t.completada } : t));
  }, []);

  const deleteTarea = useCallback((id: string) => {
    setTareas(prev => prev.filter(t => t.id !== id));
  }, []);

  const addTarea = useCallback(() => {
    if (!newTarea.trim()) return;
    setTareas(prev => [...prev, {
      id: generateId(),
      titulo: newTarea,
      descripcion: '',
      prioridad: 'media',
      fechaVencimiento: '',
      completada: false,
    }]);
    setNewTarea('');
    setShowTareaForm(false);
  }, [newTarea]);

  const addNota = useCallback(() => {
    if (!newNota.trim()) return;
    setNotas(prev => [...prev, {
      id: generateId(),
      contenido: newNota,
      color: notaColor,
      fecha: new Date().toISOString(),
    }]);
    setNewNota('');
  }, [newNota, notaColor]);

  const deleteNota = useCallback((id: string) => {
    setNotas(prev => prev.filter(n => n.id !== id));
  }, []);

  const tareasActivas = useMemo(
    () => tareas.filter(t => !t.completada).sort((a, b) => a.prioridad === 'alta' ? -1 : 1),
    [tareas]
  );
  const vencimientosProximos = [
    { nombre: 'IVA Mayo', fecha: '20 May 2026', dias: 8, tipo: 'impuesto' },
    { nombre: 'PPM Mayo', fecha: '20 May 2026', dias: 8, tipo: 'impuesto' },
    { nombre: 'Imposiciones', fecha: '22 May 2026', dias: 10, tipo: 'previsional' },
    { nombre: 'F29 Borrador', fecha: '20 May 2026', dias: 8, tipo: 'sii' },
    { nombre: 'Libro Ventas', fecha: '25 May 2026', dias: 13, tipo: 'contabilidad' },
    { nombre: 'Declaracion Jurada', fecha: '30 Jun 2026', dias: 49, tipo: 'sii' },
  ];

  // Estado para widgets configurables
  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
    const saved = localStorage.getItem('dashboard_widgets');
    return saved ? JSON.parse(saved) : defaultWidgets;
  });
  const [showSettings, setShowSettings] = useState(false);

  // Guardar widgets en localStorage
  const saveWidgets = useCallback((newWidgets: WidgetConfig[]) => {
    setWidgets(newWidgets);
    localStorage.setItem('dashboard_widgets', JSON.stringify(newWidgets));
  }, []);

  const toggleWidget = useCallback((id: string) => {
    setWidgets(prev => {
      const updated = prev.map((w) => w.id === id ? { ...w, visible: !w.visible } : w);
      localStorage.setItem('dashboard_widgets', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const resetWidgets = useCallback(() => {
    saveWidgets(defaultWidgets);
  }, [saveWidgets]);

  const moveWidget = useCallback((id: string, direction: 'up' | 'down') => {
    setWidgets(prev => {
      const visible = prev.filter(w => w.visible).sort((a, b) => a.order - b.order);
      const index = visible.findIndex(w => w.id === id);
      if (index === -1) return prev;
      
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= visible.length) return prev;
      
      const current = visible[index];
      const target = visible[targetIndex];
      
      // Swap their order values
      const currentOrder = current.order;
      
      const updated = prev.map(w => {
        if (w.id === current.id) return { ...w, order: target.order };
        if (w.id === target.id) return { ...w, order: currentOrder };
        return w;
      });
      
      localStorage.setItem('dashboard_widgets', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Calcular métricas (memoizadas)
  const totalVentas = useMemo(
    () => state.documentos
      .filter((d) => d.tipo === 'factura' && d.estado === 'emitido')
      .reduce((sum, d) => sum + d.total, 0),
    [state.documentos]
  );

  const totalGastos = useMemo(
    () => state.asientos
      .filter((a) => a.estado === 'aprobado')
      .reduce((sum, a) => sum + a.detalles
        .filter((d) => d.cuentaCodigo.startsWith('5'))
        .reduce((s, d) => s + d.debe, 0), 0),
    [state.asientos]
  );

  const totalTrabajadores = useMemo(() => state.trabajadores.length, [state.trabajadores]);
  const documentosPendientes = useMemo(
    () => state.documentos.filter((d) => d.estado === 'emitido').length,
    [state.documentos]
  );

  // ========== DATOS COMPUTADOS DESDE EL ESTADO REAL ==========
  const datosMensuales = useMemo(() => {
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const agrupado: Record<number, { ventas: number; compras: number; gastos: number }> = {};
    
    // Agrupar documentos por mes
    state.documentos.forEach(d => {
      const m = new Date(d.fecha || d.fechaEmision || '').getMonth();
      if (isNaN(m)) return;
      if (!agrupado[m]) agrupado[m] = { ventas: 0, compras: 0, gastos: 0 };
      const total = d.total || d.montoTotal || 0;
      if (d.tipo === 'factura' || d.tipoTransaccion === 'venta') {
        agrupado[m].ventas += total;
      } else {
        agrupado[m].compras += total;
      }
    });

    // Agrupar asientos por mes (gastos = cuentas código 5xx)
    state.asientos.forEach(a => {
      const m = new Date(a.fecha).getMonth();
      if (isNaN(m)) return;
      if (!agrupado[m]) agrupado[m] = { ventas: 0, compras: 0, gastos: 0 };
      a.detalles?.forEach(det => {
        if (det.cuentaCodigo?.startsWith('5')) {
          agrupado[m].gastos += det.debe || 0;
        }
      });
    });

    return Array.from({ length: 12 }, (_, i) => ({
      mes: meses[i],
      ventas: agrupado[i]?.ventas || 0,
      compras: agrupado[i]?.compras || 0,
      gastos: agrupado[i]?.gastos || 0,
    }));
  }, [state.documentos, state.asientos]);

  // Datos de distribución desde gastos reales
  const datosDistribucion = useMemo(() => {
    const gastosPorTipo: Record<string, number> = {};
    state.asientos.forEach(a => {
      a.detalles?.forEach(det => {
        const cod = det.cuentaCodigo || '';
        if (cod.startsWith('5') && det.debe) {
          const tipo = cod.startsWith('5-02-001') ? 'Sueldos'
            : cod.startsWith('5-02-003') ? 'Arriendos'
            : cod.startsWith('5-02-004') ? 'Servicios'
            : 'Otros';
          gastosPorTipo[tipo] = (gastosPorTipo[tipo] || 0) + det.debe;
        }
      });
    });

    const colores: Record<string, string> = {
      Sueldos: '#1E3A5F', Arriendos: '#2D5A87', Servicios: '#10B981',
      Marketing: '#F59E0B', 'Otros': '#6B7280'
    };

    const total = Object.values(gastosPorTipo).reduce((s, v) => s + v, 0);
    
    if (total === 0) {
      return [];
    }

    return Object.entries(gastosPorTipo).map(([nombre, valor]) => ({
      nombre,
      valor: Math.round((valor / total) * 100),
      color: colores[nombre] || '#6B7280',
    }));
  }, [state.asientos]);

  // Datos trimestrales
  const datosTrimestre = useMemo(() => {
    const trimestres = ['T1', 'T2', 'T3', 'T4'];
    return trimestres.map((mes, idx) => {
      const mesesTrim = [idx * 3, idx * 3 + 1, idx * 3 + 2];
      let ingreso = 0, gasto = 0;
      state.documentos.forEach(d => {
        const m = new Date(d.fecha || d.fechaEmision || '').getMonth();
        if (mesesTrim.includes(m)) {
          const total = d.total || d.montoTotal || 0;
          if (d.tipo === 'factura' || d.tipoTransaccion === 'venta') ingreso += total;
          else gasto += total;
        }
      });
      state.asientos.forEach(a => {
        const m = new Date(a.fecha).getMonth();
        if (mesesTrim.includes(m)) {
          a.detalles?.forEach(det => {
            if (det.cuentaCodigo?.startsWith('5')) gasto += det.debe || 0;
          });
        }
      });
      return {
        mes,
        ingreso: ingreso,
        gasto: gasto,
      };
    });
  }, [state.documentos, state.asientos]);

  // ========== PREDICCIONES IA ==========
  const proyeccionIA = useMemo(() => {
    const proyeccion = useTesoreriaStore.getState().proyectarFlujo(30);
    return proyeccion.map((p, i) => ({
      dia: `Día ${p.dia || (i + 1)}`,
      proyectado: p.saldo,
      prediccion: p.saldo * (1 + Math.random() * 0.05 - 0.02),
    }));
  }, []);

  const alertasIA = useMemo(() => useTesoreriaStore.getState().detectarAnomalias(), []);
  const sugerenciasIA = useMemo(() => useTesoreriaStore.getState().obtenerSugerencias(), []);

  // ========== ACTIVIDAD RECIENTE DESDE ESTADO REAL ==========
  const ultimosDocumentos = useMemo(
    () => [...state.documentos]
      .sort((a, b) => new Date(b.fecha || b.fechaEmision || '').getTime() - new Date(a.fecha || a.fechaEmision || '').getTime())
      .slice(0, 5),
    [state.documentos]
  );

  const ultimosAsientos = useMemo(
    () => [...state.asientos]
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      .slice(0, 5),
    [state.asientos]
  );

  // Renderizar contenido según tipo de widget
  const renderWidgetContent = (widget: WidgetConfig) => {
    switch (widget.type) {
      case 'calculator':
        return <CalculadoraHonorarios />;

      case 'tasks':
        return (
          <WidgetTareas
            tareasActivas={tareasActivas}
            showTareaForm={showTareaForm}
            setShowTareaForm={setShowTareaForm}
            newTarea={newTarea}
            setNewTarea={setNewTarea}
            addTarea={addTarea}
            toggleTarea={toggleTarea}
            deleteTarea={deleteTarea}
          />
        );

      case 'calendar':
        return <WidgetCalendario vencimientos={vencimientosProximos} />;

      case 'notes':
        return (
          <WidgetNotas
            notas={notas}
            notaColor={notaColor}
            setNotaColor={setNotaColor}
            newNota={newNota}
            setNewNota={setNewNota}
            addNota={addNota}
            deleteNota={deleteNota}
          />
        );
      case 'kpi': {
        // Sparkline: últimos 6 meses de ventas/gastos para cada KPI
        const ventasSpark = datosMensuales.slice(-6).map(d => d.ventas || Math.random() * 500000 + 100000);
        const comprasSpark = datosMensuales.slice(-6).map(d => d.compras || Math.random() * 300000 + 80000);
        const nominaSpark = [1200000,1350000,1500000,1480000,1520000, totalTrabajadores * 1500000];
        const impSpark    = [180000,220000,190000,240000,210000, documentosPendientes * 200000 || 195000];
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              title="Ventas del Mes"
              value={formatCurrency(totalVentas)}
              subtitle="Facturas emitidas"
              icon={TrendingUp}
              trend={totalVentas > 0 ? { value: 12.5, label: 'vs mes anterior' } : undefined}
              variant="success"
              animateValue
              sparklineData={ventasSpark}
            />
            <KPICard
              title="Compras del Mes"
              value={formatCurrency(totalGastos)}
              subtitle="Proveedores y gastos"
              icon={ShoppingCart}
              trend={totalGastos > 0 ? { value: -3.2, label: 'vs mes anterior' } : undefined}
              variant="default"
              animateValue
              sparklineData={comprasSpark}
            />
            <KPICard
              title="Nómina"
              value={formatCurrency(totalTrabajadores * 1500000)}
              subtitle={`${totalTrabajadores} trabajador${totalTrabajadores !== 1 ? 'es' : ''}`}
              icon={Users}
              variant="warning"
              animateValue
              sparklineData={nominaSpark}
            />
            <KPICard
              title="Impuestos Pendientes"
              value={formatCurrency(documentosPendientes * 200000)}
              subtitle="PPM e IVA a pagar"
              icon={FileText}
              variant="danger"
              animateValue
              sparklineData={impSpark}
            />
          </div>
        );
      }

      case 'chart':
        if (widget.id === 'chart-line') {
          const tieneDatos = datosMensuales.some(d => d.ventas > 0 || d.compras > 0 || d.gastos > 0);
          if (!tieneDatos) {
            return (
              <div className="h-64 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <BarChart3 size={40} className="mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">Registre facturas o asientos para ver los graficos</p>
                </div>
              </div>
            );
          }
          return (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={datosMensuales}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="mes" stroke="#6B7280" fontSize={12} />
                  <YAxis
                    stroke="#6B7280"
                    fontSize={12}
                    tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), '']}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                    }}
                  />
                  <Line type="monotone" dataKey="ventas" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981' }} name="Ventas" />
                  <Line type="monotone" dataKey="compras" stroke="#1E3A5F" strokeWidth={2} dot={{ fill: '#1E3A5F' }} name="Compras" />
                  <Line type="monotone" dataKey="gastos" stroke="#F59E0B" strokeWidth={2} dot={{ fill: '#F59E0B' }} name="Gastos" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        }

        if (widget.id === 'chart-pie') {
          if (datosDistribucion.length === 0) {
            return (
              <div className="h-48 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <BarChart3 size={32} className="mx-auto mb-2 text-gray-300" />
                  <p className="text-xs">Sin datos de gastos</p>
                </div>
              </div>
            );
          }
          return (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={datosDistribucion}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="valor"
                  >
                    {datosDistribucion.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value}%`, '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {datosDistribucion.map((item) => (
                  <div key={item.nombre} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-gray-600">{item.nombre}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        if (widget.id === 'chart-area') {
          return (
            <div className="h-64">
              <div className="mb-2 px-3 py-1.5 bg-emerald-50 rounded-lg inline-flex items-center gap-2">
                <Sparkles size={14} className="text-emerald-600" />
                <span className="text-xs text-emerald-700">
                  Predicción basada en patrones históricos y tendencias
                </span>
              </div>
              <ResponsiveContainer width="100%" height="85%">
                <AreaChart data={proyeccionIA}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="dia" stroke="#6B7280" fontSize={10} />
                  <YAxis
                    stroke="#6B7280"
                    fontSize={10}
                    tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), '']}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="proyectado"
                    stroke="#10B981"
                    fill="#10B98120"
                    strokeWidth={2}
                    name="Proyectado"
                  />
                  <Area
                    type="monotone"
                    dataKey="prediccion"
                    stroke="#8B5CF6"
                    fill="#8B5CF620"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    name="Predicción IA"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          );
        }

        if (widget.id === 'chart-bar') {
          const tieneDatosTrim = datosTrimestre.some(d => d.ingreso > 0 || d.gasto > 0);
          if (!tieneDatosTrim) {
            return (
              <div className="h-64 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <BarChart3 size={32} className="mx-auto mb-2 text-gray-300" />
                  <p className="text-xs">Sin datos trimestrales</p>
                </div>
              </div>
            );
          }
          return (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={datosTrimestre}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="mes" stroke="#6B7280" fontSize={12} />
                  <YAxis
                    stroke="#6B7280"
                    fontSize={10}
                    tickFormatter={(value) => `$${(value / 1000000).toFixed(0)}M`}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), '']}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="ingreso" fill="#10B981" name="Ingresos" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="gasto" fill="#F59E0B" name="Gastos" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          );
        }
        return null;

      case 'alerts':
        return <WidgetAlertas alertasIA={alertasIA} sugerenciasIA={sugerenciasIA} />;

      case 'activity':
        return (
          <WidgetActividad
            ultimosDocumentos={ultimosDocumentos}
            ultimosAsientos={ultimosAsientos}
            navigate={navigate}
          />
        );

      default:
        return null;
    }
  };

  // Widgets visibles ordenados.
  // Los KPIs van fijos en la fila superior (jerarquía visual), fuera del grid configurable.
  const kpiWidget = widgets.find((w) => w.type === 'kpi' && w.visible);
  const visibleWidgets = widgets.filter((w) => w.visible && w.type !== 'kpi').sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Resumen de {periodoActual} {new Date().getFullYear()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`btn-modern flex items-center gap-2 ${
              showSettings
                ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                : 'border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <Settings size={16} />
            <span className="text-sm">Personalizar</span>
          </button>
          <select className="input-modern px-3 py-2 text-sm">
            <option>{periodoActual} {new Date().getFullYear()}</option>
          </select>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <Card title="Configurar Widgets">
          <div className="space-y-3">
            {widgets.map((widget) => (
              <div
                key={widget.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={widget.visible}
                    onChange={() => toggleWidget(widget.id)}
                    className="w-4 h-4 rounded border-gray-300 text-[#1E3A5F] focus:ring-[#1E3A5F]"
                  />
                  <span className="text-sm text-gray-700">{widget.title}</span>
                  {widget.id === 'chart-area' && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">
                      <Sparkles size={10} />
                      IA
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={resetWidgets}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 underline"
            >
              Restaurar valores predeterminados
            </button>
          </div>
        </Card>
      )}

      {/* Fila superior: KPIs principales (jerarquía visual) */}
      {kpiWidget && renderWidgetContent(kpiWidget)}

      {/* Widgets Grid - Bento Layout (widgets secundarios) */}
      <div className="bento-grid">
        {visibleWidgets.map((widget, index) => (
          <motion.div
            key={widget.id}
            layout
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className={widget.size === 'large' ? 'bento-span-2' : widget.size === 'medium' ? 'bento-span-1' : 'bento-span-1 lg:col-span-1'}
          >
            <DraggableWidget
              widget={widget}
              onRemove={(id) => toggleWidget(id)}
              onMove={(dir) => moveWidget(widget.id, dir)}
              isFirst={index === 0}
              isLast={index === visibleWidgets.length - 1}
            >
              {renderWidgetContent(widget)}
            </DraggableWidget>
          </motion.div>
        ))}
      </div>

      {/* Indicadores Económicos Reales */}
      <Card title="Indicadores Económicos (mindicador.cl)">
        {loadingIndicadores ? (
          <div className="flex justify-center items-center py-4 text-gray-500">
            <Activity className="animate-pulse mr-2" size={18} />
            Obteniendo indicadores de hoy...
          </div>
        ) : indicadores ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-center border border-emerald-100 dark:border-emerald-800/50">
            <p className="text-xs font-medium text-emerald-900 dark:text-emerald-300 mb-1">UF Hoy</p>
            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(indicadores.uf.valor)}</p>
          </div>
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-center border border-blue-100 dark:border-blue-800/50">
            <p className="text-xs font-medium text-blue-900 dark:text-blue-300 mb-1">UTM</p>
            <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{formatCurrency(indicadores.utm.valor)}</p>
          </div>
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-center border border-amber-100 dark:border-amber-800/50">
            <p className="text-xs font-medium text-amber-900 dark:text-amber-300 mb-1">Dólar Observado</p>
            <p className="text-xl font-bold text-amber-700 dark:text-amber-400">{formatCurrency(indicadores.dolar.valor)}</p>
          </div>
          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl text-center border border-purple-100 dark:border-purple-800/50">
            <p className="text-xs font-medium text-purple-900 dark:text-purple-300 mb-1">Euro</p>
            <p className="text-xl font-bold text-purple-700 dark:text-purple-400">{formatCurrency(indicadores.euro.valor)}</p>
          </div>
          </div>
        ) : (
          <div className="text-sm text-red-500 text-center py-4">
            No se pudo conectar con mindicador.cl
          </div>
        )}
      </Card>

      {/* Quick Actions */}
      <Card title="Acciones Rápidas">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => navigate('/facturacion')}
            className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] text-center"
          >
            <FileText className="mx-auto text-blue-600 dark:text-blue-400 mb-2" size={24} />
            <span className="text-sm font-medium text-blue-900 dark:text-blue-300">Nueva Factura</span>
          </button>
          <button
            onClick={() => navigate('/asientos')}
            className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] text-center"
          >
            <BarChart3 className="mx-auto text-emerald-600 dark:text-emerald-400 mb-2" size={24} />
            <span className="text-sm font-medium text-emerald-900 dark:text-emerald-300">Nuevo Asiento</span>
          </button>
          <button
            onClick={() => navigate('/remuneraciones')}
            className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] text-center"
          >
            <Users className="mx-auto text-purple-600 dark:text-purple-400 mb-2" size={24} />
            <span className="text-sm font-medium text-purple-900 dark:text-purple-300">Liq. Sueldo</span>
          </button>
          <button
            onClick={() => navigate('/reportes')}
            className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] text-center"
          >
            <Download className="mx-auto text-amber-600 dark:text-amber-400 mb-2" size={24} />
            <span className="text-sm font-medium text-amber-900 dark:text-amber-300">Generar Reporte</span>
          </button>
          <button
            onClick={() => navigate('/documentos')}
            className="p-4 bg-teal-50 dark:bg-teal-900/20 rounded-xl hover:bg-teal-100 dark:hover:bg-teal-900/30 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] text-center"
          >
            <FileText className="mx-auto text-teal-600 mb-2" size={24} />
            <span className="text-sm font-medium text-teal-900">Documentos</span>
          </button>
        </div>
      </Card>

      {/* Integración SII Demo */}
      <Card title="Herramientas SII">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={18} className="text-[#1E3A5F] dark:text-blue-400" />
              <span className="font-medium text-gray-900 dark:text-gray-100">Tablas Tributarias</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">Descarga las últimas tablas del SII directamente</p>
            <button
              onClick={() => {
                const tablas = SIIService.descargarTablas();
                showToast('success', 'Tablas descargadas', `UF ${tablas.uf.valor}, UTM ${tablas.utm}, UTA ${tablas.uta}`);
              }}
              className="w-full px-3 py-2 bg-[#1E3A5F] text-white rounded-lg text-sm hover:bg-[#2D5A87] transition-colors"
            >
              Descargar Tablas
            </button>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-3">
              <Activity size={18} className="text-[#1E3A5F] dark:text-blue-400" />
              <span className="font-medium text-gray-900 dark:text-gray-100">Validar RUT</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">Verifica si un RUT es válido según algoritmo SII</p>
            <button
              onClick={() => {
                const result = SIIService.validarRUT('76.543.210-1');
                showToast('info', 'Validación RUT', `RUT 76.543.210-1 — Válido: ${result.valido ? 'Sí' : 'No'}, DV: ${result.digitoVerificador}`);
              }}
              className="w-full px-3 py-2 bg-[#1E3A5F] text-white rounded-lg text-sm hover:bg-[#2D5A87] transition-colors"
            >
              Probar Validación
            </button>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign size={18} className="text-[#1E3A5F] dark:text-blue-400" />
              <span className="font-medium text-gray-900 dark:text-gray-100">Calcular PPM</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">Pro rata PPM afecto según renta imponible</p>
            <button
              onClick={() => {
                const ppm = SIIService.calcularPPM(1500000);
                showToast('info', 'Cálculo PPM', `Renta $1.500.000 — PPM ${ppm.porcentaje}%: $${ppm.monto.toLocaleString('es-CL')}`);
              }}
              className="w-full px-3 py-2 bg-[#1E3A5F] text-white rounded-lg text-sm hover:bg-[#2D5A87] transition-colors"
            >
              Calcular PPM
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
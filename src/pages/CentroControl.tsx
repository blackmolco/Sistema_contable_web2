import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  FileWarning,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  WalletCards,
  XCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate } from '../utils/calculos';
import { Modal } from '../components/ui/Modal';
import { contabilizarDocumento } from '../services/apiSync';

type Hallazgo = {
  id: string;
  nivel: 'crítico' | 'atención' | 'informativo';
  titulo: string;
  detalle: string;
  ruta: string;
  accion: string;
};

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`card-modern p-5 ${className}`}>{children}</section>;
}

function Metric({ label, value, detail, tone, onClick }: { label: string; value: string | number; detail: string; tone: 'blue' | 'red' | 'amber' | 'green'; onClick?: () => void }) {
  const colors = {
    blue: 'border-primary/20 bg-primary/5 text-primary',
    red: 'border-red-200 bg-red-50 text-red-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };
  return (
    <button type="button" onClick={onClick} className={`w-full rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${colors[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-2 font-data text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{detail}</p>
    </button>
  );
}

export default function CentroControl() {
  const navigate = useNavigate();
  const { state, dispatch, showToast } = useApp();
  const [query, setQuery] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'críticos' | 'pendientes'>('todos');
  const [actualizando, setActualizando] = useState(false);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(() => new Date());
  const [mostrarPendientes, setMostrarPendientes] = useState(false);
  const [cuentasPendientes, setCuentasPendientes] = useState<Record<string, string>>({});
  const [procesandoDocumento, setProcesandoDocumento] = useState<string | null>(null);

  const documentos = (state.documentos ?? []) as any[];
  const asientos = (state.asientos ?? []) as any[];
  const cuentas = (state.cuentas ?? []) as any[];
  const entidades = (state.entidades ?? []) as any[];
  const cuentasCobrar = (state.cuentasCobrar ?? []) as any[];
  const cuentasPagar = (state.cuentasPagar ?? []) as any[];

  const desbalanceados = useMemo(() => {
    const idsCorregidos = new Set(asientos.filter(a => String(a.tipo || '').startsWith('correccion:')).map(a => String(a.tipo).slice('correccion:'.length)));
    return asientos.filter(a => {
    if (a.estado === 'anulado' || String(a.tipo || '').startsWith('reverso:') || idsCorregidos.has(a.id)) return false;
    const debe = (a.detalles ?? []).reduce((sum: number, d: any) => sum + Number(d.debe || 0), 0);
    const haber = (a.detalles ?? []).reduce((sum: number, d: any) => sum + Number(d.haber || 0), 0);
    return Math.abs(debe - haber) >= 1;
    });
  }, [asientos]);
  const pendientes = useMemo(() => documentos.filter(d => d.estado !== 'anulado' && (d.estado === 'pendiente' || !d.asientoId)), [documentos]);
  const esCompraDocumento = (d: any) => d.libro === 'compras' || d.tipo === 'factura_compra' || d.tipoTransaccion === 'compra';
  const cuentaSugerida = (d: any) => {
    const rut = d.receptor?.rut || d.rutCliente || '';
    const entidad = entidades.find(e => e.rut?.replace(/[^0-9kK]/g, '').toUpperCase() === rut.replace(/[^0-9kK]/g, '').toUpperCase());
    if (entidad?.cuentaDefaultId && cuentas.some(c => c.id === entidad.cuentaDefaultId && c.permiteMovimiento)) return entidad.cuentaDefaultId;
    const codigo = esCompraDocumento(d) ? '5-03-004-0001' : '4-01-001-0001';
    return cuentas.find(c => c.codigo === codigo && c.permiteMovimiento)?.id || '';
  };
  const opcionesCuenta = (d: any) => cuentas
    .filter(c => c.permiteMovimiento && (esCompraDocumento(d) ? ['gasto', 'activo', 'pasivo'].includes(c.tipo) : c.tipo === 'ingreso'))
    .map(c => ({ value: c.id, label: `${c.codigo} — ${c.nombre}` }));
  const contabilizarPendiente = async (d: any) => {
    const cuentaId = cuentasPendientes[d.id] || cuentaSugerida(d);
    if (!cuentaId) {
      showToast('error', 'Falta cuenta contable', 'Seleccione una cuenta antes de contabilizar.');
      return false;
    }
    setProcesandoDocumento(d.id);
    try {
      const resultado = await contabilizarDocumento(d.id, esCompraDocumento(d) ? { cuentaGastoId: cuentaId } : { cuentaIngresoId: cuentaId });
      const asiento = resultado.asiento as any;
      dispatch({ type: 'ADD_ASIENTO', payload: {
        id: asiento.id,
        numero: asiento.numero,
        fecha: String(asiento.fecha).slice(0, 10),
        glosa: asiento.glosa,
        detalles: (asiento.detalles || []).map((linea: any) => ({ ...linea, debe: Number(linea.debe || 0), haber: Number(linea.haber || 0) })),
        totalDebe: (asiento.detalles || []).reduce((s: number, linea: any) => s + Number(linea.debe || 0), 0),
        totalHaber: (asiento.detalles || []).reduce((s: number, linea: any) => s + Number(linea.haber || 0), 0),
        estado: 'contabilizado',
        tipo: asiento.tipo,
      } });
      dispatch({ type: 'UPDATE_DOCUMENTO', payload: { ...d, asientoId: resultado.documento.asientoId, estado: resultado.documento.estado } });
      showToast('success', 'Documento contabilizado', `Se generó el asiento N° ${resultado.asiento.numero}.`);
      return true;
    } catch (error) {
      showToast('error', 'No se pudo contabilizar', error instanceof Error ? error.message : 'Revise la cuenta sugerida y vuelva a intentar.');
      return false;
    } finally {
      setProcesandoDocumento(null);
    }
  };
  const contabilizarTodosSugeridos = async () => {
    for (const documento of pendientes) await contabilizarPendiente(documento);
  };
  const duplicados = useMemo(() => {
    const seen = new Map<string, number>();
    documentos.forEach(d => {
      const rut = d.receptor?.rut || d.rutCliente || '';
      const key = `${d.tipo}|${d.numero}|${rut}|${String(d.fecha).slice(0, 10)}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    });
    return [...seen.values()].filter(n => n > 1).length;
  }, [documentos]);
  const documentosActivos = documentos.filter(d => d.estado !== 'anulado');
  const esCompra = (d: any) => d.libro === 'compras' || d.tipo === 'factura_compra' || d.tipoTransaccion === 'compra';
  const documentoPorId = useMemo(() => new Map(documentosActivos.map(d => [d.id, d])), [documentosActivos]);
  const saldosAuxiliares = useMemo(() => {
    const saldos = new Map<string, { tipo: 'cliente' | 'proveedor' | 'honorario'; monto: number }>();
    asientos.filter(a => a.estado !== 'anulado').forEach(a => (a.detalles ?? []).forEach((d: any) => {
      const doc = d.documentoId ? documentoPorId.get(d.documentoId) : undefined;
      const rut = d.rutAuxiliar || doc?.receptor?.rut || doc?.rutCliente;
      if (!rut) return;
      const cuenta = cuentas.find(c => c.id === d.cuentaId);
      const tipo = (cuenta?.tipoAuxiliar || (doc && esCompra(doc) ? 'proveedor' : 'cliente')) as 'cliente' | 'proveedor' | 'honorario';
      const naturaleza = cuenta?.naturaleza || 'deudora';
      const movimiento = (Number(d.debe || 0) - Number(d.haber || 0)) * (naturaleza === 'deudora' ? 1 : -1);
      const key = `${tipo}|${rut}|${d.documentoId || a.id}`;
      const actual = saldos.get(key);
      saldos.set(key, { tipo, monto: (actual?.monto || 0) + movimiento });
    }));
    return [...saldos.values()].reduce((totales, item) => {
      if (Math.abs(item.monto) >= 1) totales[item.tipo] += Math.abs(item.monto);
      return totales;
    }, { cliente: 0, proveedor: 0, honorario: 0 });
  }, [asientos, cuentas, documentoPorId]);
  const saldoCobrar = saldosAuxiliares.cliente || (cuentasCobrar.length
    ? cuentasCobrar.reduce((sum, c) => sum + Math.max(0, Number(c.monto ?? 0) - Number(c.montoPagado ?? 0)), 0)
    : documentosActivos.filter(d => !esCompra(d) && (d.estado === 'pendiente' || !d.asientoId)).reduce((sum, d) => sum + Number(d.total ?? 0), 0));
  const saldoPagar = saldosAuxiliares.proveedor || (cuentasPagar.length
    ? cuentasPagar.reduce((sum, c) => sum + Math.max(0, Number(c.monto ?? 0) - Number(c.montoPagado ?? 0)), 0)
    : documentosActivos.filter(d => esCompra(d) && (d.estado === 'pendiente' || !d.asientoId)).reduce((sum, d) => sum + Number(d.total ?? 0), 0));

  const [importState, setImportState] = useState(() => {
    try { return JSON.parse(localStorage.getItem('scc_importacion_sii_estado') || 'null'); } catch { return null; }
  });

  React.useEffect(() => {
    const actualizar = () => {
      try { setImportState(JSON.parse(localStorage.getItem('scc_importacion_sii_estado') || 'null')); } catch { setImportState(null); }
      setUltimaActualizacion(new Date());
    };
    window.addEventListener('scc:login', actualizar);
    window.addEventListener('scc:importacion-sii', actualizar);
    return () => {
      window.removeEventListener('scc:login', actualizar);
      window.removeEventListener('scc:importacion-sii', actualizar);
    };
  }, []);

  const recargarDatos = () => {
    setActualizando(true);
    // Los proveedores escuchan esta señal y vuelven a consultar la empresa
    // activa en el backend, sin perder la navegación actual.
    window.dispatchEvent(new Event('scc:login'));
    window.setTimeout(() => {
      setActualizando(false);
      setUltimaActualizacion(new Date());
    }, 1200);
  };

  const hallazgos = useMemo<Hallazgo[]>(() => {
    const items: Hallazgo[] = [];
    if (desbalanceados.length) items.push({ id: 'desbalance', nivel: 'crítico', titulo: 'Asientos descuadrados', detalle: `${desbalanceados.length} asiento(s) requieren revisión antes del cierre.`, ruta: '/control-integridad', accion: 'Abrir control' });
    if (duplicados) items.push({ id: 'duplicados', nivel: 'atención', titulo: 'Posibles documentos duplicados', detalle: `${duplicados} combinación(es) de RUT, fecha, tipo y folio repetidas.`, ruta: '/sincronizacion-sii', accion: 'Revisar cargas' });
    if (pendientes.length) items.push({ id: 'pendientes', nivel: 'atención', titulo: 'Documentos pendientes de contabilizar', detalle: `${pendientes.length} documento(s) no tienen asiento asociado.`, ruta: '/control-integridad', accion: 'Ver documentos' });
    if (importState?.estado === 'procesando') items.push({ id: 'importacion', nivel: 'informativo', titulo: 'Importación SII en curso', detalle: `${importState.hecho ?? 0}/${importState.total ?? 0} registros procesados.`, ruta: '/sincronizacion-sii', accion: 'Ver proceso' });
    return items;
  }, [desbalanceados.length, duplicados, pendientes.length, importState]);

  const resultados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const rows = [
      ...cuentas.map(c => ({ id: `cuenta-${c.id}`, tipo: 'Cuenta', titulo: `${c.codigo} — ${c.nombre}`, detalle: 'Plan de Cuentas', ruta: '/plan-cuentas' })),
      ...entidades.map(e => ({ id: `entidad-${e.id}`, tipo: 'Entidad', titulo: `${e.rut} — ${e.razonSocial}`, detalle: e.tipo, ruta: '/cuenta-corriente' })),
      ...documentos.map(d => ({ id: `doc-${d.id}`, tipo: 'Documento', titulo: `${d.tipo} N° ${d.numero}`, detalle: `${d.receptor?.rut || d.rutCliente || ''} · ${d.receptor?.razonSocial || d.razonSocialCliente || ''}`, ruta: '/ingreso-documento' })),
      ...asientos.map(a => ({ id: `asiento-${a.id}`, tipo: 'Asiento', titulo: `Asiento #${a.numero}`, detalle: `${formatDate(a.fecha)} · ${a.glosa}`, ruta: '/asientos' })),
    ];
    return rows.filter(r => `${r.titulo} ${r.detalle}`.toLowerCase().includes(q)).slice(0, 12);
  }, [asientos, cuentas, documentos, entidades, query]);

  const hallazgosFiltrados = hallazgos.filter(h => filtro === 'todos' || (filtro === 'críticos' ? h.nivel === 'crítico' : h.nivel !== 'crítico'));

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"><Activity size={14} /> Centro de control</div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Estado contable de la empresa</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Una vista única para detectar pendientes, revisar riesgos y continuar el trabajo.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden text-[11px] text-gray-400 sm:inline">Actualizado {ultimaActualizacion.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>
          <button type="button" onClick={recargarDatos} disabled={actualizando} className="btn-modern inline-flex items-center gap-2"><RefreshCw size={16} className={actualizando ? 'animate-spin' : ''} /> {actualizando ? 'Actualizando...' : 'Actualizar'}</button>
          <button type="button" onClick={() => navigate('/sincronizacion-sii')} className="btn-modern inline-flex items-center gap-2"><ClipboardCheck size={16} /> Importar SII</button>
          <button type="button" onClick={() => navigate('/asientos')} className="btn-modern inline-flex items-center gap-2"><BookOpenCheck size={16} /> Nuevo asiento</button>
        </div>
      </div>

      <Card className="relative overflow-visible">
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
          <Search size={18} className="text-gray-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por RUT, folio, cuenta, glosa o nombre..." className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400" />
          <kbd className="hidden rounded border border-gray-200 bg-white px-2 py-1 text-[10px] text-gray-400 sm:block dark:border-gray-700 dark:bg-gray-900">Ctrl K</kbd>
        </div>
        {query && <div className="mt-3 divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-700 dark:bg-gray-900">
          {resultados.length ? resultados.map(r => <button key={r.id} type="button" onClick={() => navigate(r.ruta)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800"><span className="rounded-lg bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase text-primary">{r.tipo}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-gray-800 dark:text-gray-100">{r.titulo}</strong><small className="block truncate text-xs text-gray-500">{r.detalle}</small></span><ArrowRight size={15} className="text-gray-400" /></button>) : <p className="px-4 py-6 text-center text-sm text-gray-500">No se encontraron resultados.</p>}
        </div>}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Asientos descuadrados" value={desbalanceados.length} detail="Revisar antes de cerrar" tone={desbalanceados.length ? 'red' : 'green'} onClick={() => navigate('/control-integridad')} />
        <Metric label="Documentos pendientes" value={pendientes.length} detail="Sin asiento o en estado pendiente" tone={pendientes.length ? 'amber' : 'green'} onClick={() => setMostrarPendientes(true)} />
        <Metric label="Por cobrar" value={formatCurrency(saldoCobrar)} detail={cuentasCobrar.length ? `${cuentasCobrar.length} obligación(es) registradas` : 'Estimado desde documentos pendientes'} tone="blue" onClick={() => navigate('/cuenta-corriente')} />
        <Metric label="Por pagar" value={formatCurrency(saldoPagar)} detail={cuentasPagar.length ? `${cuentasPagar.length} obligación(es) registradas` : 'Estimado desde documentos pendientes'} tone="blue" onClick={() => navigate('/cuenta-corriente')} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-lg font-bold text-gray-900 dark:text-white">Revisión prioritaria</h2><p className="text-xs text-gray-500">Alertas calculadas con la información actual de la empresa.</p></div><div className="flex rounded-lg bg-gray-100 p-1 text-xs dark:bg-gray-800">{(['todos', 'críticos', 'pendientes'] as const).map(f => <button key={f} type="button" onClick={() => setFiltro(f)} className={`rounded-md px-3 py-1.5 capitalize ${filtro === f ? 'bg-white font-semibold text-primary shadow-sm dark:bg-gray-700' : 'text-gray-500'}`}>{f}</button>)}</div></div>
          <div className="space-y-3">{hallazgosFiltrados.length ? hallazgosFiltrados.map(h => <div key={h.id} className="flex items-start gap-3 rounded-xl border border-gray-100 p-3 dark:border-gray-800"><span className={`mt-0.5 rounded-full p-2 ${h.nivel === 'crítico' ? 'bg-red-100 text-red-600' : h.nivel === 'atención' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>{h.nivel === 'crítico' ? <XCircle size={16} /> : h.nivel === 'atención' ? <AlertTriangle size={16} /> : <Activity size={16} />}</span><div className="min-w-0 flex-1"><p className="font-semibold text-gray-800 dark:text-gray-100">{h.titulo}</p><p className="mt-0.5 text-sm text-gray-500">{h.detalle}</p></div><button type="button" onClick={() => h.id === 'pendientes' ? setMostrarPendientes(true) : navigate(h.ruta)} className="shrink-0 text-xs font-semibold text-primary hover:underline">{h.accion}</button></div>) : <div className="flex flex-col items-center justify-center rounded-xl bg-emerald-50 px-6 py-10 text-center dark:bg-emerald-950/20"><CheckCircle2 size={34} className="text-emerald-600" /><p className="mt-3 font-semibold text-emerald-800 dark:text-emerald-300">No hay pendientes en este filtro</p><p className="mt-1 text-sm text-emerald-700/70">La información actual está lista para continuar.</p></div>}</div>
        </Card>

        <Card>
          <h2 className="font-display text-lg font-bold text-gray-900 dark:text-white">Accesos frecuentes</h2>
          <p className="mt-1 text-xs text-gray-500">Atajos para las tareas diarias.</p>
          <div className="mt-4 space-y-2">{[
            ['/cuenta-corriente', 'Cuenta Corriente', WalletCards],
            ['/control-integridad', 'Control de Integridad', ShieldCheck],
            ['/periodos', 'Cierre de período', ClipboardCheck],
            ['/plan-cuentas', 'Plan de Cuentas', Users],
            ['/balance-8-columnas', 'Balance 8 Columnas', FileSearch],
          ].map(([path, label, Icon]) => <button key={String(path)} type="button" onClick={() => navigate(String(path))} className="flex w-full items-center gap-3 rounded-xl border border-gray-100 px-3 py-3 text-left transition hover:border-primary/30 hover:bg-primary/5 dark:border-gray-800"><span className="rounded-lg bg-primary/10 p-2 text-primary"><Icon size={16} /></span><span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span><ArrowRight size={15} className="text-gray-400" /></button>)}</div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between"><div><h2 className="font-display text-lg font-bold text-gray-900 dark:text-white">Resumen de control</h2><p className="text-xs text-gray-500">Información disponible para la empresa activa.</p></div><button type="button" onClick={() => navigate('/control-integridad')} className="text-xs font-semibold text-primary hover:underline">Ejecutar revisión completa</button></div>
        <div className="mt-4 grid gap-4 md:grid-cols-3"><div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50"><p className="text-xs text-gray-500">Cuentas activas</p><p className="mt-1 font-data text-xl font-bold text-gray-900 dark:text-white">{cuentas.filter(c => c.activo !== false).length}</p></div><div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50"><p className="text-xs text-gray-500">Entidades registradas</p><p className="mt-1 font-data text-xl font-bold text-gray-900 dark:text-white">{entidades.filter(e => e.activo !== false).length}</p></div><div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50"><p className="text-xs text-gray-500">Documentos cargados</p><p className="mt-1 font-data text-xl font-bold text-gray-900 dark:text-white">{documentos.length}</p></div></div>
      </Card>

      <Modal isOpen={mostrarPendientes} onClose={() => setMostrarPendientes(false)} title={`Resolver documentos pendientes (${pendientes.length})`} size="full" footer={<div className="flex w-full items-center justify-between gap-3"><span className="text-xs text-gray-500">La cuenta sugerida puede cambiarse antes de contabilizar.</span><div className="flex gap-2"><button type="button" onClick={contabilizarTodosSugeridos} disabled={!!procesandoDocumento} className="btn-primary">Contabilizar todos los sugeridos</button><button type="button" onClick={() => setMostrarPendientes(false)} className="btn-modern">Cerrar</button></div></div>}>
        <div className="mb-4 grid gap-3 md:grid-cols-2"><div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><strong>Qué hacer:</strong> revise la cuenta sugerida por tipo de documento y memoria del proveedor. Si es correcta, pulse <strong>Contabilizar</strong>; si no, elija otra cuenta.</div><div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800"><strong>Regla aplicada:</strong> compras → gasto/activo sugerido; ventas → Ventas. El asiento se genera balanceado y alimenta Cuenta Corriente.</div></div>
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700"><table className="w-full min-w-[1120px] text-sm"><thead className="bg-gray-50 dark:bg-gray-800"><tr><th className="px-3 py-3 text-left">Tipo</th><th className="px-3 py-3 text-left">Folio</th><th className="px-3 py-3 text-left">RUT / nombre</th><th className="px-3 py-3 text-left">Fecha</th><th className="px-3 py-3 text-right">Total</th><th className="px-3 py-3 text-left">Cuenta sugerida / selección</th><th className="px-3 py-3 text-left">Acción</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-800">{pendientes.slice(0, 200).map(d => { const cuentaId = cuentasPendientes[d.id] || cuentaSugerida(d); return <tr key={d.id}><td className="px-3 py-3">{String(d.tipo).replaceAll('_', ' ')}</td><td className="px-3 py-3 font-data">{d.numero}</td><td className="px-3 py-3"><strong>{d.receptor?.rut || d.rutCliente || 'Sin RUT'}</strong><br /><span className="text-xs text-gray-500">{d.receptor?.razonSocial || d.razonSocialCliente || 'Sin nombre'}</span></td><td className="px-3 py-3">{formatDate(d.fecha)}</td><td className="px-3 py-3 text-right font-data">{formatCurrency(Number(d.total || 0))}</td><td className="px-3 py-3"><select value={cuentaId} onChange={e => setCuentasPendientes(actual => ({ ...actual, [d.id]: e.target.value }))} className="min-w-[330px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900">{!cuentaId && <option value="">Seleccione una cuenta...</option>}{opcionesCuenta(d).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>{cuentaId && !cuentasPendientes[d.id] && <p className="mt-1 text-[11px] text-emerald-600">Sugerida automáticamente</p>}</td><td className="px-3 py-3"><button type="button" onClick={() => contabilizarPendiente(d)} disabled={!!procesandoDocumento} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{procesandoDocumento === d.id ? 'Procesando...' : 'Contabilizar'}</button></td></tr>; })}</tbody></table></div>
        {pendientes.length > 200 && <p className="mt-3 text-xs text-gray-500">Se muestran los primeros 200 documentos. Total: {pendientes.length}.</p>}
      </Modal>
    </div>
  );
}

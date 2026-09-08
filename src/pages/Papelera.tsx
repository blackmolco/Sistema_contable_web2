import React, { useMemo, useState } from 'react';
import { ArchiveRestore, FileText, RotateCcw, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate } from '../utils/calculos';
import { Card, Badge } from '../components/ui/Cards';

type Item = { id: string; tipo: 'Documento' | 'Asiento'; titulo: string; fecha: string; detalle: string; monto: number; raw: any };

export default function Papelera() {
  const { state, dispatch, showToast } = useApp();
  const [query, setQuery] = useState('');
  const [tipo, setTipo] = useState<'todos' | 'Documento' | 'Asiento'>('todos');

  const items = useMemo<Item[]>(() => [
    ...(state.documentos ?? []).filter(d => d.estado === 'anulado').map(d => ({
      id: `doc-${d.id}`, tipo: 'Documento' as const, titulo: `${String(d.tipo).replaceAll('_', ' ')} N° ${d.numero}`,
      fecha: d.fecha, detalle: `${d.receptor?.rut || d.rutCliente || 'Sin RUT'} · ${d.receptor?.razonSocial || d.razonSocialCliente || 'Sin nombre'}`,
      monto: Number(d.total || 0), raw: d,
    })),
    ...(state.asientos ?? []).filter(a => a.estado === 'anulado').map(a => ({
      id: `asiento-${a.id}`, tipo: 'Asiento' as const, titulo: `Asiento #${a.numero}`,
      fecha: a.fecha, detalle: a.glosa || 'Sin glosa', monto: Number(a.totalDebe || 0), raw: a,
    })),
  ], [state.asientos, state.documentos]);

  const visibles = items.filter(item => {
    if (tipo !== 'todos' && item.tipo !== tipo) return false;
    const texto = `${item.titulo} ${item.detalle}`.toLowerCase();
    return !query.trim() || texto.includes(query.trim().toLowerCase());
  });

  const restaurar = (item: Item) => {
    if (item.tipo === 'Documento') {
      dispatch({ type: 'UPDATE_DOCUMENTO', payload: { ...item.raw, estado: 'emitido' } });
    } else {
      dispatch({ type: 'UPDATE_ASIENTO', payload: { ...item.raw, estado: 'pendiente' } });
    }
    showToast('success', 'Registro restaurado', `${item.titulo} volvió a estar disponible.`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="mb-2 inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300"><ShieldCheck size={14} /> Trazabilidad protegida</div><h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white">Papelera y anulados</h1><p className="mt-1 text-sm text-gray-500">Revisa registros anulados y restáuralos cuando corresponda.</p></div>
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:bg-amber-950/20 dark:text-amber-300"><strong>{items.length}</strong> registro(s) en papelera</div>
      </div>
      <Card>
        <div className="flex flex-col gap-3 md:flex-row"><div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-200 px-3 dark:border-gray-700"><Search size={16} className="text-gray-400" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por folio, RUT, glosa o nombre..." className="w-full bg-transparent py-2.5 text-sm outline-none" /></div><div className="flex rounded-lg bg-gray-100 p-1 dark:bg-gray-800">{(['todos', 'Documento', 'Asiento'] as const).map(value => <button key={value} type="button" onClick={() => setTipo(value)} className={`rounded-md px-3 py-2 text-xs ${tipo === value ? 'bg-white font-semibold text-primary shadow-sm dark:bg-gray-700' : 'text-gray-500'}`}>{value}</button>)}</div></div>
        <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead><tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-700"><th className="px-3 py-3">Tipo</th><th className="px-3 py-3">Registro</th><th className="px-3 py-3">Fecha</th><th className="px-3 py-3">Detalle</th><th className="px-3 py-3 text-right">Monto</th><th className="px-3 py-3 text-right">Acción</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-800">{visibles.map(item => <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50"><td className="px-3 py-3"><Badge variant="danger">{item.tipo}</Badge></td><td className="px-3 py-3 font-semibold text-gray-800 dark:text-gray-100">{item.titulo}</td><td className="px-3 py-3 text-gray-500">{formatDate(item.fecha)}</td><td className="max-w-[320px] truncate px-3 py-3 text-gray-600 dark:text-gray-300">{item.detalle}</td><td className="px-3 py-3 text-right font-data">{formatCurrency(item.monto)}</td><td className="px-3 py-3 text-right"><button type="button" onClick={() => restaurar(item)} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5"><RotateCcw size={14} /> Restaurar</button></td></tr>)}{!visibles.length && <tr><td colSpan={6} className="px-3 py-14 text-center text-gray-500"><Trash2 size={28} className="mx-auto mb-2 text-gray-300" />No hay registros anulados para este filtro.</td></tr>}</tbody></table></div>
      </Card>
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-300"><ArchiveRestore size={18} className="mt-0.5 shrink-0" /><p>Restaurar un asiento contabilizado lo devuelve a estado pendiente para que puedas revisarlo antes de contabilizarlo nuevamente. La acción queda registrada en la sincronización del sistema.</p></div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { CalendarCheck2, LockKeyhole, RotateCcw } from 'lucide-react';
import { Card, Badge } from '../components/ui/Cards';
import { Button, Select } from '../components/ui/FormElements';
import { apiFetch } from '../services/httpClient';
import { getEmpresaActivaId } from '../services/apiSync';
import { useApp } from '../context/AppContext';

interface Periodo { id: string; anio: number; mes: number; estado: 'abierto' | 'revision' | 'cerrado'; }
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function PeriodosContables() {
  const { showToast } = useApp();
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [cargando, setCargando] = useState(false);

  const cargar = async () => {
    const empresaId = getEmpresaActivaId(); if (!empresaId) return;
    setCargando(true);
    try { setPeriodos(await apiFetch<Periodo[]>(`/api/periodos?empresaId=${encodeURIComponent(empresaId)}`)); }
    catch (e) { showToast('error', 'No se pudieron cargar los períodos', e instanceof Error ? e.message : 'Error inesperado'); }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, [anio]);

  const cambiar = async (mes: number, estado: Periodo['estado']) => {
    const empresaId = getEmpresaActivaId(); if (!empresaId) return;
    let motivo: string | undefined;
    const actual = periodos.find(p => p.anio === anio && p.mes === mes)?.estado ?? 'abierto';
    if (actual === 'cerrado' && estado === 'abierto') {
      motivo = window.prompt('Indique el motivo de reapertura del período:')?.trim();
      if (!motivo || motivo.length < 5) return;
    }
    try {
      await apiFetch('/api/periodos', { method: 'PUT', body: JSON.stringify({ empresaId, anio, mes, estado, motivo }) });
      showToast('success', 'Período actualizado', `${MESES[mes - 1]} ${anio}: ${estado}`); await cargar();
    } catch (e) { showToast('error', 'No se pudo actualizar', e instanceof Error ? e.message : 'Error inesperado'); }
  };

  return <div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="p-3 rounded-xl bg-primary/10"><CalendarCheck2 className="text-primary" /></div><div><h1 className="text-2xl font-bold dark:text-gray-100">Períodos Contables</h1><p className="text-sm text-gray-500">Controle cuándo se permiten movimientos en cada mes.</p></div></div><div className="w-32"><Select value={String(anio)} onChange={e => setAnio(Number(e.target.value))} options={[anio-2,anio-1,anio,anio+1].map(v => ({ value: String(v), label: String(v) }))} /></div></div>
    <Card padding="none"><div className="divide-y dark:divide-gray-800">{MESES.map((nombre, i) => { const mes=i+1; const estado=periodos.find(p => p.anio===anio&&p.mes===mes)?.estado ?? 'abierto'; return <div key={mes} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="w-8 font-data text-gray-400">{String(mes).padStart(2,'0')}</span><p className="font-semibold dark:text-gray-100">{nombre}</p><Badge variant={estado==='cerrado'?'danger':estado==='revision'?'warning':'success'}>{estado==='revision'?'En revisión':estado[0].toUpperCase()+estado.slice(1)}</Badge></div><div className="flex gap-2">{estado==='abierto'&&<Button size="sm" variant="secondary" onClick={()=>cambiar(mes,'revision')}>Enviar a revisión</Button>}{estado!=='cerrado'&&<Button size="sm" onClick={()=>cambiar(mes,'cerrado')} icon={<LockKeyhole size={14}/>}>Cerrar</Button>}{estado==='cerrado'&&<Button size="sm" variant="secondary" onClick={()=>cambiar(mes,'abierto')} icon={<RotateCcw size={14}/>}>Reabrir</Button>}{estado==='revision'&&<Button size="sm" variant="ghost" onClick={()=>cambiar(mes,'abierto')}>Volver a abierto</Button>}</div></div>; })}</div>{cargando&&<p className="p-4 text-sm text-gray-500">Actualizando períodos…</p>}</Card>
  </div>;
}

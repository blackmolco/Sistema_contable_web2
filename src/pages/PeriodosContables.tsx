import React, { useEffect, useState } from 'react';
import { CalendarCheck2, LockKeyhole, RotateCcw, CheckCircle2, XCircle, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Card, Badge } from '../components/ui/Cards';
import { Button, Select, Textarea } from '../components/ui/FormElements';
import { Modal } from '../components/ui/Modal';
import { apiFetch } from '../services/httpClient';
import { getEmpresaActivaId } from '../services/apiSync';
import { useApp } from '../context/AppContext';

interface Periodo {
  id: string; anio: number; mes: number; estado: 'abierto' | 'revision' | 'cerrado';
  comentarioCierre?: string | null; cierreForzado?: boolean;
}
interface Control { id: string; titulo: string; severidad: 'bloqueante' | 'advertencia'; ok: boolean; cantidad: number; detalle: string | null }
interface Checklist { periodo: string; checks: Control[]; bloqueantes: number; puedeCerrar: boolean }

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function PeriodosContables() {
  const { showToast } = useApp();
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [cargando, setCargando] = useState(false);

  const [mesCierre, setMesCierre] = useState<number | null>(null);
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [evaluando, setEvaluando] = useState(false);
  const [comentario, setComentario] = useState('');
  const [forzar, setForzar] = useState(false);
  const [motivoForzado, setMotivoForzado] = useState('');
  const [cerrando, setCerrando] = useState(false);

  const cargar = async () => {
    const empresaId = getEmpresaActivaId(); if (!empresaId) return;
    setCargando(true);
    try { setPeriodos(await apiFetch<Periodo[]>(`/api/periodos?empresaId=${encodeURIComponent(empresaId)}`)); }
    catch (e) { showToast('error', 'No se pudieron cargar los períodos', e instanceof Error ? e.message : 'Error inesperado'); }
    finally { setCargando(false); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const abrirCierre = async (mes: number) => {
    const empresaId = getEmpresaActivaId(); if (!empresaId) return;
    setMesCierre(mes); setChecklist(null); setComentario(''); setForzar(false); setMotivoForzado('');
    setEvaluando(true);
    try {
      setChecklist(await apiFetch<Checklist>(`/api/periodos/checklist?empresaId=${encodeURIComponent(empresaId)}&anio=${anio}&mes=${mes}`));
    } catch (e) {
      showToast('error', 'No se pudo revisar el período', e instanceof Error ? e.message : 'Error inesperado');
      setMesCierre(null);
    } finally { setEvaluando(false); }
  };

  const confirmarCierre = async () => {
    const empresaId = getEmpresaActivaId(); if (!empresaId || mesCierre === null || !checklist) return;
    setCerrando(true);
    try {
      await apiFetch('/api/periodos', {
        method: 'PUT',
        body: JSON.stringify({
          empresaId, anio, mes: mesCierre, estado: 'cerrado',
          comentario: comentario.trim() || undefined,
          forzar: forzar || undefined,
          motivo: forzar ? motivoForzado.trim() : undefined,
        }),
      });
      showToast('success', 'Período cerrado', `${MESES[mesCierre - 1]} ${anio}${forzar ? ' (cierre forzado)' : ''}`);
      setMesCierre(null); await cargar();
    } catch (e) { showToast('error', 'No se pudo cerrar', e instanceof Error ? e.message : 'Error inesperado'); }
    finally { setCerrando(false); }
  };

  const puedeConfirmar = checklist && !cerrando && (checklist.puedeCerrar || (forzar && motivoForzado.trim().length >= 10));

  const icono = (c: Control) => c.ok
    ? <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" />
    : c.severidad === 'bloqueante'
      ? <XCircle size={18} className="text-red-500 flex-shrink-0" />
      : <AlertTriangle size={18} className="text-amber-500 flex-shrink-0" />;

  return <div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-primary/10"><CalendarCheck2 className="text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold dark:text-gray-100">Períodos Contables</h1>
          <p className="text-sm text-gray-500">Controle cuándo se permiten movimientos en cada mes. Para cerrar un mes se revisa un checklist de control.</p>
        </div>
      </div>
      <div className="w-32"><Select value={String(anio)} onChange={e => setAnio(Number(e.target.value))} options={[anio-2,anio-1,anio,anio+1].map(v => ({ value: String(v), label: String(v) }))} /></div>
    </div>

    <Card padding="none">
      <div className="divide-y dark:divide-gray-800">
        {MESES.map((nombre, i) => {
          const mes = i + 1;
          const periodo = periodos.find(p => p.anio === anio && p.mes === mes);
          const estado = periodo?.estado ?? 'abierto';
          return <div key={mes} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="w-8 font-data text-gray-400">{String(mes).padStart(2, '0')}</span>
              <p className="font-semibold dark:text-gray-100">{nombre}</p>
              <Badge variant={estado === 'cerrado' ? 'danger' : estado === 'revision' ? 'warning' : 'success'}>{estado === 'revision' ? 'En revisión' : estado[0].toUpperCase() + estado.slice(1)}</Badge>
              {estado === 'cerrado' && periodo?.cierreForzado && <Badge variant="warning">Cierre forzado</Badge>}
              {estado === 'cerrado' && periodo?.comentarioCierre && <span className="text-xs text-gray-500 italic">“{periodo.comentarioCierre}”</span>}
            </div>
            <div className="flex gap-2">
              {estado === 'abierto' && <Button size="sm" variant="secondary" onClick={() => cambiar(mes, 'revision')}>Enviar a revisión</Button>}
              {estado !== 'cerrado' && <Button size="sm" onClick={() => abrirCierre(mes)} icon={<LockKeyhole size={14} />}>Cerrar</Button>}
              {estado === 'cerrado' && <Button size="sm" variant="secondary" onClick={() => cambiar(mes, 'abierto')} icon={<RotateCcw size={14} />}>Reabrir</Button>}
              {estado === 'revision' && <Button size="sm" variant="ghost" onClick={() => cambiar(mes, 'abierto')}>Volver a abierto</Button>}
            </div>
          </div>;
        })}
      </div>
      {cargando && <p className="p-4 text-sm text-gray-500">Actualizando períodos…</p>}
    </Card>

    <Modal
      isOpen={mesCierre !== null}
      onClose={() => setMesCierre(null)}
      title={mesCierre !== null ? `Cerrar ${MESES[mesCierre - 1]} ${anio}` : 'Cerrar período'}
      size="lg"
      footer={<>
        <Button variant="secondary" onClick={() => setMesCierre(null)}>Cancelar</Button>
        <Button onClick={confirmarCierre} disabled={!puedeConfirmar} icon={<LockKeyhole size={14} />}>
          {cerrando ? 'Cerrando...' : forzar ? 'Cerrar de todos modos' : 'Cerrar período'}
        </Button>
      </>}
    >
      {evaluando || !checklist ? (
        <p className="text-sm text-gray-500 py-6 text-center">Revisando el período…</p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {checklist.puedeCerrar
              ? 'Todos los controles obligatorios están en orden.'
              : `Hay ${checklist.bloqueantes} control(es) obligatorio(s) pendiente(s). Corrígelos antes de cerrar.`}
          </p>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            {checklist.checks.map(c => (
              <li key={c.id} className="flex items-start gap-3 px-3 py-2.5">
                {icono(c)}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    {c.titulo} {c.severidad === 'advertencia' && <span className="ml-1 text-[10px] uppercase text-gray-400">aviso</span>}
                  </p>
                  {!c.ok && c.detalle && <p className="text-xs text-gray-500">{c.detalle}</p>}
                </div>
              </li>
            ))}
          </ul>

          {!checklist.puedeCerrar && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2 dark:bg-amber-900/10 dark:border-amber-800">
              <label className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
                <input type="checkbox" checked={forzar} onChange={e => setForzar(e.target.checked)} className="rounded" />
                <ShieldAlert size={16} /> Forzar el cierre igual (queda registrado)
              </label>
              {forzar && (
                <Textarea rows={2} value={motivoForzado} onChange={e => setMotivoForzado(e.target.value)}
                  placeholder="Motivo del cierre forzado (mínimo 10 caracteres)" />
              )}
            </div>
          )}

          {checklist.puedeCerrar && (
            <Textarea rows={2} label="Comentario de cierre (opcional)" value={comentario} onChange={e => setComentario(e.target.value)}
              placeholder="Ej.: Revisado con el cliente, F29 declarado el día 12." />
          )}
        </div>
      )}
    </Modal>
  </div>;
}

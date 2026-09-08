import React from 'react';
import { Activity, CheckCircle2, ExternalLink, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const KEY = 'scc_importacion_sii_estado';

type ImportStatus = {
  estado?: string;
  hecho?: number;
  total?: number;
  tipo?: string;
  nombreArchivo?: string;
};

function readStatus(): ImportStatus | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function BackgroundActivityBanner() {
  const navigate = useNavigate();
  const [status, setStatus] = React.useState<ImportStatus | null>(readStatus);
  const [closed, setClosed] = React.useState(false);

  React.useEffect(() => {
    const refresh = () => { setStatus(readStatus()); setClosed(false); };
    const timer = window.setInterval(refresh, 1500);
    window.addEventListener('storage', refresh);
    window.addEventListener('scc:importacion-sii', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('scc:importacion-sii', refresh);
    };
  }, []);

  if (!status || closed || status.estado !== 'procesando') return null;
  const total = Math.max(1, Number(status.total ?? 0));
  const hecho = Math.min(total, Number(status.hecho ?? 0));
  const porcentaje = Math.round((hecho / total) * 100);

  return (
    <div className="fixed right-4 top-[4.5rem] z-50 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-primary/20 bg-white shadow-xl dark:border-primary/40 dark:bg-gray-900">
      <div className="flex items-start gap-3 p-4">
        <span className="rounded-xl bg-primary/10 p-2 text-primary"><Activity size={18} className="animate-pulse" /></span>
        <div className="min-w-0 flex-1"><p className="text-sm font-bold text-gray-900 dark:text-white">Importación SII en curso</p><p className="mt-0.5 truncate text-xs text-gray-500">{status.nombreArchivo || `Libro de ${status.tipo || 'documentos'}`}</p></div>
        <button type="button" onClick={() => setClosed(true)} aria-label="Ocultar estado" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"><X size={15} /></button>
      </div>
      <div className="px-4 pb-3"><div className="mb-2 flex justify-between text-xs font-semibold"><span className="text-gray-500">Puedes seguir trabajando</span><span className="text-primary">{hecho}/{total}</span></div><div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${porcentaje}%` }} /></div></div>
      <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-4 py-2.5 dark:border-gray-800 dark:bg-gray-800/50"><span className="flex items-center gap-1.5 text-[11px] text-gray-500"><CheckCircle2 size={13} className="text-emerald-500" /> Estado guardado automáticamente</span><button type="button" onClick={() => navigate('/sincronizacion-sii')} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Ver proceso <ExternalLink size={12} /></button></div>
    </div>
  );
}

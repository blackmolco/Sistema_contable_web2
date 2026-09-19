import React, { useEffect, useState } from 'react';
import { DatabaseBackup, Download, ShieldCheck, AlertTriangle, Info } from 'lucide-react';
import { Card } from '../components/ui/Cards';
import { Button } from '../components/ui/FormElements';
import { apiFetchRaw } from '../services/httpClient';
import { getEmpresaActivaId } from '../services/apiSync';
import { useApp } from '../context/AppContext';
import { useAppStore } from '../stores/appStore';

interface ResultadoRespaldo {
  generadoEn: string;
  archivo: string;
  conteos: Record<string, number>;
  bytes: number;
}

const ETIQUETAS: Record<string, string> = {
  Cuenta: 'Cuentas del plan', AsientoContable: 'Asientos contables', DetalleAsiento: 'Líneas de asiento',
  DocumentoTributario: 'Documentos (facturas, boletas)', Honorario: 'Boletas de honorarios', Entidad: 'Clientes y proveedores',
  Trabajador: 'Trabajadores', LiquidacionSueldo: 'Liquidaciones de sueldo', ActivoFijo: 'Activos fijos',
  PeriodoContable: 'Períodos contables', TesoreriaMovimiento: 'Movimientos de tesorería', ImportacionSII: 'Importaciones del SII',
};

const claveUltimo = (empresaId: string) => `ultimo_respaldo_${empresaId}`;

const diasDesde = (iso: string) => Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);

export default function BackupSettings() {
  const { showToast } = useApp();
  const empresa = useAppStore((s) => s.empresaActiva);
  const [descargando, setDescargando] = useState(false);
  const [ultimo, setUltimo] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoRespaldo | null>(null);

  useEffect(() => {
    const id = getEmpresaActivaId();
    try { setUltimo(id ? localStorage.getItem(claveUltimo(id)) : null); } catch { setUltimo(null); }
    setResultado(null);
  }, [empresa?.id]);

  const descargar = async () => {
    const empresaId = getEmpresaActivaId();
    if (!empresaId) return;
    setDescargando(true);
    try {
      const res = await apiFetchRaw(`/api/respaldo/empresa?empresaId=${encodeURIComponent(empresaId)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Error ${res.status}`);
      }
      const texto = await res.text();
      const datos = JSON.parse(texto) as { generadoEn: string; conteos: Record<string, number> };
      const nombre = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || `respaldo_${datos.generadoEn.slice(0, 10)}.json`;

      const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = nombre; a.click();
      URL.revokeObjectURL(url);

      try { localStorage.setItem(claveUltimo(empresaId), datos.generadoEn); } catch { /* solo es un recordatorio */ }
      setUltimo(datos.generadoEn);
      setResultado({ generadoEn: datos.generadoEn, archivo: nombre, conteos: datos.conteos, bytes: texto.length });
      showToast('success', 'Respaldo descargado', `Se guardó ${nombre}.`);
    } catch (e) {
      showToast('error', 'No se pudo generar el respaldo', e instanceof Error ? e.message : 'Error inesperado');
    } finally {
      setDescargando(false);
    }
  };

  const dias = ultimo ? diasDesde(ultimo) : null;
  const atrasado = dias === null || dias >= 7;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-primary/10"><DatabaseBackup className="text-primary" size={24} /></div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Respaldo</h1>
          <p className="text-sm text-gray-500 mt-1">Copia completa de los datos de {empresa?.razonSocial ?? 'la empresa activa'}, tomada directamente desde el servidor.</p>
        </div>
      </div>

      <Card>
        <div className="space-y-4">
          <div className={`flex items-start gap-3 rounded-lg p-3 text-sm ${atrasado ? 'bg-amber-50 text-amber-800 dark:bg-amber-900/10 dark:text-amber-300' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/10 dark:text-emerald-300'}`}>
            {atrasado ? <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" /> : <ShieldCheck size={18} className="mt-0.5 flex-shrink-0" />}
            <p>
              {dias === null
                ? 'Todavía no has descargado ningún respaldo desde este navegador.'
                : dias === 0 ? 'Último respaldo descargado hoy.' : `Último respaldo descargado hace ${dias} día(s).`}
              {atrasado && ' Se recomienda descargar uno al menos una vez por semana y después de cada cierre de mes.'}
            </p>
          </div>

          <Button onClick={descargar} disabled={descargando || !empresa} icon={<Download size={16} />}>
            {descargando ? 'Generando respaldo...' : 'Descargar respaldo completo'}
          </Button>

          {resultado && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-sm space-y-2">
              <p className="font-medium text-gray-800 dark:text-gray-100">{resultado.archivo} <span className="text-gray-400 font-normal">· {(resultado.bytes / 1024).toFixed(0)} KB</span></p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-gray-600 dark:text-gray-300">
                {Object.entries(ETIQUETAS).filter(([k]) => (resultado.conteos[k] ?? 0) > 0).map(([k, nombre]) => (
                  <li key={k} className="flex justify-between"><span>{nombre}</span><span className="font-data">{resultado.conteos[k]}</span></li>
                ))}
              </ul>
              <p className="text-xs text-gray-500">El archivo incluye una firma (checksum) para comprobar más adelante que no fue alterado.</p>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-300">
          <Info size={18} className="mt-0.5 flex-shrink-0 text-gray-400" />
          <div className="space-y-2">
            <p><strong>Qué incluye:</strong> plan de cuentas, asientos, documentos, honorarios, clientes y proveedores, trabajadores y liquidaciones, activos fijos, períodos y demás datos contables de la empresa.</p>
            <p><strong>Qué no incluye:</strong> usuarios y contraseñas, ni los archivos PDF o imágenes subidos.</p>
            <p><strong>Restaurar:</strong> la restauración la realiza el administrador del sistema a partir de este archivo. Guárdalo en un lugar seguro y no lo compartas: contiene información financiera de la empresa.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

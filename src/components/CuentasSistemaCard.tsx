import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from './ui/Cards';
import { SearchSelect } from './ui/FormElements';
import { useApp } from '../context/AppContext';
import { useAppStore } from '../stores/appStore';
import { useAuthStore } from '../stores/authStore';
import { apiFetch, apiFetchRaw } from '../services/httpClient';
import { getErrorMessage } from '../services/errorHandler';
import type { CuentaSistemaFila } from '../hooks/useCuentasSistema';

// Qué cuenta de ESTE plan de cuentas usa el sistema para cada función
// automática (clientes, IVA, ventas...). Solo admin y supervisor pueden cambiarlas.
export default function CuentasSistemaCard() {
  const { state, showToast } = useApp();
  const empresaId = useAppStore(s => s.empresaActiva?.id ?? null);
  const rol = useAuthStore(s => s.user?.rol);
  const puedeEditar = rol === 'admin' || rol === 'administrador' || rol === 'supervisor';
  const [abierto, setAbierto] = useState(false);
  const [filas, setFilas] = useState<CuentaSistemaFila[]>([]);
  const [guardando, setGuardando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!empresaId) return;
    try {
      setFilas(await apiFetch<CuentaSistemaFila[]>(`/api/empresas/${empresaId}/cuentas-sistema`));
    } catch (err) {
      showToast('error', 'Error', `No se pudieron cargar las cuentas del sistema: ${getErrorMessage(err)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  useEffect(() => { if (abierto) cargar(); }, [abierto, cargar]);

  const guardar = async (concepto: string, cuentaId: string) => {
    if (!empresaId) return;
    setGuardando(concepto);
    try {
      const res = await apiFetchRaw(`/api/empresas/${empresaId}/cuentas-sistema`, {
        method: 'PATCH',
        body: JSON.stringify({ [concepto]: cuentaId || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      await cargar();
    } catch (err) {
      showToast('error', 'Error al guardar', getErrorMessage(err));
    } finally {
      setGuardando(null);
    }
  };

  const opciones = state.cuentas.filter(c => c.permiteMovimiento)
    .map(c => ({ value: c.id, label: `${c.codigo} — ${c.nombre}` }));

  return (
    <Card>
      <button onClick={() => setAbierto(!abierto)} className="w-full flex items-center justify-between text-left">
        <div>
          <p className="font-semibold text-gray-900">Cuentas del sistema</p>
          <p className="text-xs text-gray-500">Qué cuentas de este plan usa el sistema al generar asientos automáticos (clientes, IVA, ventas, honorarios).</p>
        </div>
        {abierto ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {abierto && (
        <div className="mt-3">
          {filas.map(f => (
            <div key={f.concepto} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
              <div className="w-1/3 min-w-0">
                <p className="text-sm text-gray-800 truncate">{f.label}</p>
                <p className="text-[10px] text-gray-400">Plan estándar: {f.codigoDefault}</p>
              </div>
              {puedeEditar ? (
                <div className="flex-1">
                  <SearchSelect value={f.cuentaId ?? ''} onChange={(id) => guardar(f.concepto, id)} options={opciones} placeholder="Buscar cuenta..." />
                </div>
              ) : (
                <p className="flex-1 text-sm text-gray-600">
                  {f.cuentaCodigo ? `${f.cuentaCodigo} — ${f.cuentaNombre}` : <span className="text-amber-600">Sin cuenta asignada</span>}
                </p>
              )}
              {!f.cuentaId && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">Falta</span>}
              {guardando === f.concepto && <span className="text-[10px] text-gray-400 flex-shrink-0">Guardando...</span>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

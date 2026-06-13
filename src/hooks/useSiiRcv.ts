// src/hooks/useSiiRcv.ts
// Sincronización RCV del SII vía job asíncrono + SSE (EventSource).
// Flujo: POST /api/sii/rcv/async → { jobId } → EventSource /api/sii/rcv/stream/:jobId?token=...
import { useCallback, useEffect, useRef, useState } from 'react';
import { getToken } from '../services/apiAuth';
import { API_BASE, apiFetch } from '../services/httpClient';

export interface SiiRcvResult {
  success: boolean;
  documentos: Array<Record<string, unknown>>;
  total: number;
  totalMonto?: number;
  periodo: string;
  tipo: string;
}

export interface SiiRcvState {
  status: 'idle' | 'pending' | 'running' | 'done' | 'failed';
  result: SiiRcvResult | null;
  error: string | null;
}

export function useSiiRcv() {
  const [state, setState] = useState<SiiRcvState>({ status: 'idle', result: null, error: null });
  const esRef = useRef<EventSource | null>(null);

  const cerrar = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
  }, []);

  useEffect(() => cerrar, [cerrar]);

  const iniciarSync = useCallback(
    async (rut: string, clave: string, periodo: string, tipo: 'ventas' | 'compras') => {
      cerrar();
      setState({ status: 'pending', result: null, error: null });
      try {
        const { jobId } = await apiFetch<{ jobId: string }>('/api/sii/rcv/async', {
          method: 'POST',
          body: JSON.stringify({ rut, clave, periodo, tipo }),
        });

        // EventSource no envía headers → el token va por query (soportado solo en este endpoint)
        const token = getToken() || '';
        const es = new EventSource(
          `${API_BASE}/api/sii/rcv/stream/${jobId}?token=${encodeURIComponent(token)}`
        );
        esRef.current = es;

        es.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data) as { status: string; result: SiiRcvResult | null; error: string | null };
            if (data.status === 'done') {
              setState({ status: 'done', result: data.result, error: null });
              cerrar();
            } else if (data.status === 'failed' || data.status === 'not_found') {
              setState({ status: 'failed', result: null, error: data.error || 'Job no encontrado' });
              cerrar();
            } else {
              setState({ status: data.status as SiiRcvState['status'], result: null, error: null });
            }
          } catch {
            // mensaje malformado: ignorar
          }
        };
        es.onerror = () => {
          setState((prev) =>
            prev.status === 'done' ? prev : { status: 'failed', result: null, error: 'Conexión SSE interrumpida' }
          );
          cerrar();
        };
      } catch (err) {
        setState({
          status: 'failed',
          result: null,
          error: err instanceof Error ? err.message : 'Error al iniciar sincronización',
        });
      }
    },
    [cerrar]
  );

  return { ...state, iniciarSync, cancelar: cerrar };
}

export default useSiiRcv;

import React, { useMemo, useState } from 'react';
import { CreditCard, History } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card, Badge } from '../components/ui/Cards';
import { Select, SearchSelect } from '../components/ui/FormElements';
import { formatCurrency, formatDate } from '../utils/calculos';
import { Entidad } from '../types';

type FiltroTipo = 'todos' | 'cliente' | 'proveedor' | 'honorario';

const LABEL_TIPO: Record<Exclude<FiltroTipo, 'todos'>, string> = {
  cliente: 'Clientes',
  proveedor: 'Proveedores',
  honorario: 'Honorarios',
};

export default function CuentaCorriente() {
  const { state } = useApp();
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');
  const [rutSeleccionado, setRutSeleccionado] = useState('');
  const [soloPendientes, setSoloPendientes] = useState(true);

  // Etiqueta legible por documentoId + monto original del documento
  // (factura/boleta/honorario), tal como se guardó al emitirse.
  const documentoPorId = useMemo(() => {
    const mapa = new Map<string, { label: string; total: number; fecha: string }>();
    (state.documentos ?? []).forEach((d) => {
      if (d.id) mapa.set(d.id, { label: `${d.tipo} N° ${d.numero}`, total: d.total, fecha: d.fecha });
    });
    (state.honorarios ?? []).forEach((h) => {
      mapa.set(h.id, { label: `Honorarios ${h.periodo}`, total: h.montoLiquido, fecha: h.fechaPago || '' });
    });
    return mapa;
  }, [state.documentos, state.honorarios]);

  const entidadPorRut = useMemo(() => {
    const mapa = new Map<string, Entidad>();
    (state.entidades ?? []).forEach((e) => mapa.set(e.rut, e));
    return mapa;
  }, [state.entidades]);

  // Todas las líneas de asiento que tocaron una cuenta de control, con
  // contexto del asiento que las generó — es la fuente única de verdad:
  // no hay tabla de saldos aparte que se pueda desalinear de la contabilidad.
  const lineasAuxiliares = useMemo(() => {
    const lineas: Array<{
      asientoId: string; numero: number; fecha: string; glosa: string;
      rutAuxiliar: string; nombreAuxiliar: string; documentoId?: string;
      debe: number; haber: number; naturaleza: 'deudora' | 'acreedora'; tipoAuxiliar?: string;
    }> = [];
    (state.asientos ?? []).forEach((asiento) => {
      asiento.detalles.forEach((d) => {
        if (!d.rutAuxiliar) return;
        const cuenta = state.cuentas.find((c) => c.id === d.cuentaId);
        lineas.push({
          asientoId: asiento.id, numero: asiento.numero, fecha: asiento.fecha, glosa: asiento.glosa,
          rutAuxiliar: d.rutAuxiliar, nombreAuxiliar: d.nombreAuxiliar || d.rutAuxiliar,
          documentoId: d.documentoId, debe: d.debe, haber: d.haber,
          naturaleza: cuenta?.naturaleza ?? 'deudora', tipoAuxiliar: cuenta?.tipoAuxiliar,
        });
      });
    });
    return lineas;
  }, [state.asientos, state.cuentas]);

  // Agrupado por documento pendiente: una fila por (rut, documentoId).
  const documentosPendientes = useMemo(() => {
    const mapa = new Map<string, {
      rut: string; nombre: string; tipoAuxiliar?: string; documentoId?: string;
      saldo: number; naturaleza: 'deudora' | 'acreedora';
    }>();
    lineasAuxiliares.forEach((l) => {
      const key = `${l.rutAuxiliar}|${l.documentoId ?? l.asientoId}`;
      const signo = l.naturaleza === 'deudora' ? 1 : -1;
      const existente = mapa.get(key);
      if (existente) {
        existente.saldo += (l.debe - l.haber) * signo;
      } else {
        mapa.set(key, {
          rut: l.rutAuxiliar, nombre: l.nombreAuxiliar, tipoAuxiliar: l.tipoAuxiliar,
          documentoId: l.documentoId, saldo: (l.debe - l.haber) * signo, naturaleza: l.naturaleza,
        });
      }
    });
    return Array.from(mapa.values());
  }, [lineasAuxiliares]);

  const filasFiltradas = useMemo(() => {
    return documentosPendientes.filter((f) => {
      if (filtroTipo !== 'todos' && f.tipoAuxiliar !== filtroTipo) return false;
      if (rutSeleccionado && f.rut !== rutSeleccionado) return false;
      if (soloPendientes && Math.abs(f.saldo) < 1) return false;
      return true;
    });
  }, [documentosPendientes, filtroTipo, rutSeleccionado, soloPendientes]);

  const totalesPorTipo = useMemo(() => {
    const totales: Record<string, number> = { cliente: 0, proveedor: 0, honorario: 0 };
    documentosPendientes.forEach((f) => {
      if (Math.abs(f.saldo) < 1 || !f.tipoAuxiliar) return;
      totales[f.tipoAuxiliar] = (totales[f.tipoAuxiliar] ?? 0) + Math.abs(f.saldo);
    });
    return totales;
  }, [documentosPendientes]);

  // Historial cronológico completo de un RUT (todas las líneas, no solo el
  // saldo agrupado) — para ver de dónde salió el saldo pendiente.
  const historialRut = useMemo(() => {
    if (!rutSeleccionado) return [];
    let acumulado = 0;
    return lineasAuxiliares
      .filter((l) => l.rutAuxiliar === rutSeleccionado)
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.numero - b.numero)
      .map((l) => {
        const signo = l.naturaleza === 'deudora' ? 1 : -1;
        acumulado += (l.debe - l.haber) * signo;
        return { ...l, saldoAcumulado: acumulado };
      });
  }, [lineasAuxiliares, rutSeleccionado]);

  const entidadesOptions = useMemo(() => [
    { value: '', label: 'Todas las entidades' },
    ...(state.entidades ?? [])
      .filter((e) => filtroTipo === 'todos' || e.tipo === filtroTipo || e.tipo === 'ambos')
      .map((e) => ({ value: e.rut, label: `${e.rut} — ${e.razonSocial}` })),
  ], [state.entidades, filtroTipo]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-primary/10 rounded-lg">
          <CreditCard className="text-primary" size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Cuenta Corriente</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Pendientes de cobro/pago por cliente, proveedor u honorario — calculado directamente desde los asientos.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Por cobrar (Clientes)</p>
          <p className="text-xl font-data font-black text-emerald-700 dark:text-emerald-400">{formatCurrency(totalesPorTipo.cliente)}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Por pagar (Proveedores)</p>
          <p className="text-xl font-data font-black text-red-600 dark:text-red-400">{formatCurrency(totalesPorTipo.proveedor)}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Por pagar (Honorarios)</p>
          <p className="text-xl font-data font-black text-amber-600 dark:text-amber-400">{formatCurrency(totalesPorTipo.honorario)}</p>
        </Card>
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <Select
            label="Tipo"
            value={filtroTipo}
            onChange={(e) => { setFiltroTipo(e.target.value as FiltroTipo); setRutSeleccionado(''); }}
            options={[
              { value: 'todos', label: 'Todos' },
              { value: 'cliente', label: 'Clientes' },
              { value: 'proveedor', label: 'Proveedores' },
              { value: 'honorario', label: 'Honorarios' },
            ]}
          />
          <div className="md:col-span-2">
            <SearchSelect
              label="Entidad"
              value={rutSeleccionado}
              onChange={setRutSeleccionado}
              options={entidadesOptions}
              placeholder="Todas las entidades"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 pb-2">
            <input type="checkbox" checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)} className="rounded" />
            Solo pendientes
          </label>
        </div>
      </Card>

      <Card title="Documentos" padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">RUT</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Documento</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Saldo pendiente</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">
                    No hay documentos {soloPendientes ? 'pendientes' : ''} para este filtro.
                  </td>
                </tr>
              ) : (
                filasFiltradas.map((f, i) => {
                  const info = f.documentoId ? documentoPorId.get(f.documentoId) : undefined;
                  const pendiente = Math.abs(f.saldo) >= 1;
                  return (
                    <tr key={i} className="odd:bg-gray-50/50 dark:odd:bg-gray-800/30 hover:bg-blue-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3 font-data text-gray-600 dark:text-gray-300">{f.rut}</td>
                      <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{f.nombre}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{info?.label ?? 'Sin documento'}</td>
                      <td className="px-4 py-3 text-right font-data font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(Math.abs(f.saldo))}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={pendiente ? 'warning' : 'success'}>{pendiente ? 'Pendiente' : 'Pagado'}</Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {rutSeleccionado && (
        <Card title="Historial completo del RUT">
          <div className="flex items-center gap-2 mb-3 text-sm text-gray-500 dark:text-gray-400">
            <History size={16} />
            {entidadPorRut.get(rutSeleccionado)?.razonSocial ?? rutSeleccionado}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Fecha</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Asiento</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Glosa</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Debe</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Haber</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {historialRut.map((l, i) => (
                  <tr key={i} className="odd:bg-gray-50/50 dark:odd:bg-gray-800/30">
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{formatDate(l.fecha)}</td>
                    <td className="px-3 py-2 font-data text-primary dark:text-blue-400">#{l.numero}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{l.glosa}</td>
                    <td className="px-3 py-2 text-right font-data text-gray-900 dark:text-gray-100">{l.debe > 0 ? formatCurrency(l.debe) : ''}</td>
                    <td className="px-3 py-2 text-right font-data text-gray-900 dark:text-gray-100">{l.haber > 0 ? formatCurrency(l.haber) : ''}</td>
                    <td className="px-3 py-2 text-right font-data font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(l.saldoAcumulado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

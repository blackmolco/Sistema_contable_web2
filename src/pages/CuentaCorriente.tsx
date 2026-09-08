import React, { useMemo, useState } from 'react';
import { CreditCard, History, ListChecks, WalletCards } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card, Badge } from '../components/ui/Cards';
import { Button, Input, MontoInput, Select, SearchSelect } from '../components/ui/FormElements';
import { Modal } from '../components/ui/Modal';
import { formatCurrency, formatDate } from '../utils/calculos';
import { Entidad } from '../types';
import { aplicarPagoCobro } from '../services/apiSync';

type FiltroTipo = 'todos' | 'cliente' | 'proveedor' | 'honorario';
type Aplicable = { rut: string; nombre: string; documentoId: string; cuentaControlId: string; saldo: number; naturaleza: 'deudora' | 'acreedora' };

const LABEL_TIPO: Record<Exclude<FiltroTipo, 'todos'>, string> = {
  cliente: 'Clientes',
  proveedor: 'Proveedores',
  honorario: 'Honorarios',
};

const vencimientoDocumento = (fecha: string, vencimiento?: string) => {
  if (vencimiento) return vencimiento;
  const d = new Date(`${fecha.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 30);
  return d.toISOString().slice(0, 10);
};

export default function CuentaCorriente() {
  const { state, showToast } = useApp();
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');
  const [rutSeleccionado, setRutSeleccionado] = useState('');
  const [soloPendientes, setSoloPendientes] = useState(true);
  const [aplicando, setAplicando] = useState<Aplicable[]>([]);
  const [seleccionados, setSeleccionados] = useState<Record<string, Aplicable>>({});
  const [montosAplicar, setMontosAplicar] = useState<Record<string, number>>({});
  const [cuentaMedioId, setCuentaMedioId] = useState('');
  const [fechaAplicar, setFechaAplicar] = useState(new Date().toISOString().slice(0, 10));
  const [guardando, setGuardando] = useState(false);

  // Etiqueta legible por documentoId + monto original del documento
  // (factura/boleta/honorario), tal como se guardó al emitirse.
  const documentoPorId = useMemo(() => {
    const mapa = new Map<string, { label: string; total: number; fecha: string; vencimiento?: string }>();
    (state.documentos ?? []).forEach((d) => {
      if (d.id) mapa.set(d.id, { label: `${d.tipo} N° ${d.numero}`, total: d.total, fecha: d.fecha, vencimiento: d.fechaVencimiento });
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
      debe: number; haber: number; naturaleza: 'deudora' | 'acreedora'; tipoAuxiliar?: string; cuentaControlId: string;
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
          cuentaControlId: d.cuentaId,
        });
      });
    });
    return lineas;
  }, [state.asientos, state.cuentas]);

  // Agrupado por documento pendiente: una fila por (rut, documentoId).
  const documentosPendientes = useMemo(() => {
    const mapa = new Map<string, {
      rut: string; nombre: string; tipoAuxiliar?: string; documentoId?: string;
      saldo: number; naturaleza: 'deudora' | 'acreedora'; cuentaControlId: string;
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
          documentoId: l.documentoId, saldo: (l.debe - l.haber) * signo, naturaleza: l.naturaleza, cuentaControlId: l.cuentaControlId,
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

  const antiguedad = useMemo(() => {
    const tramos = { vigente: 0, dias30: 0, dias60: 0, dias90: 0, mas90: 0 };
    const hoyUtc = new Date();
    const inicioHoy = Date.UTC(hoyUtc.getFullYear(), hoyUtc.getMonth(), hoyUtc.getDate());
    documentosPendientes.forEach((f) => {
      if (Math.abs(f.saldo) < 1 || !f.documentoId) return;
      const info = documentoPorId.get(f.documentoId);
      const fechaBase = info ? vencimientoDocumento(info.fecha, info.vencimiento) : undefined;
      if (!fechaBase) return;
      const dias = Math.floor((inicioHoy - Date.parse(`${fechaBase.slice(0, 10)}T00:00:00Z`)) / 86400000);
      const monto = Math.abs(f.saldo);
      if (dias <= 0) tramos.vigente += monto;
      else if (dias <= 30) tramos.dias30 += monto;
      else if (dias <= 60) tramos.dias60 += monto;
      else if (dias <= 90) tramos.dias90 += monto;
      else tramos.mas90 += monto;
    });
    return tramos;
  }, [documentosPendientes, documentoPorId]);

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

  const cuentasMedioOptions = useMemo(() => [
    { value: '', label: 'Seleccionar banco o caja...' },
    ...state.cuentas.filter(c => c.permiteMovimiento && !c.requiereAuxiliar && (c.nombre.toLowerCase().includes('banco') || c.nombre.toLowerCase().includes('caja')))
      .map(c => ({ value: c.id, label: `${c.codigo} — ${c.nombre}` })),
  ], [state.cuentas]);

  const claveAplicacion = (f: Aplicable) => `${f.rut}|${f.documentoId}`;

  const abrirAplicaciones = (items: Aplicable[]) => {
    setAplicando(items);
    setMontosAplicar(Object.fromEntries(items.map((f) => [claveAplicacion(f), Math.abs(f.saldo)])));
  };

  const alternarSeleccion = (f: Aplicable) => {
    const clave = claveAplicacion(f);
    setSeleccionados((actual) => {
      const siguiente = { ...actual };
      if (siguiente[clave]) delete siguiente[clave];
      else siguiente[clave] = f;
      return siguiente;
    });
  };

  const registrarAplicacion = async () => {
    if (!aplicando.length || !cuentaMedioId) return;
    const aplicaciones = aplicando.map((f) => ({ ...f, monto: montosAplicar[claveAplicacion(f)] || 0 }));
    if (aplicaciones.some((a) => a.monto <= 0 || a.monto > Math.abs(a.saldo))) return;
    setGuardando(true);
    try {
      await aplicarPagoCobro({ fecha: fechaAplicar, cuentaMedioId, glosa: `Aplicación de ${aplicaciones.length} obligación(es)`, aplicaciones });
      showToast('success', 'Movimiento registrado', 'Se creó el asiento y se actualizó la cuenta corriente.');
      setAplicando([]); setSeleccionados({}); setMontosAplicar({}); setCuentaMedioId('');
      window.dispatchEvent(new Event('scc:login'));
    } catch (e) {
      showToast('error', 'No se pudo registrar', e instanceof Error ? e.message : 'Error inesperado');
    } finally { setGuardando(false); }
  };

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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ['Vigente', antiguedad.vigente, 'text-emerald-700 dark:text-emerald-400'],
          ['Vencido 1–30 días', antiguedad.dias30, 'text-amber-600 dark:text-amber-400'],
          ['31–60 días', antiguedad.dias60, 'text-orange-600 dark:text-orange-400'],
          ['61–90 días', antiguedad.dias90, 'text-red-600 dark:text-red-400'],
          ['Más de 90 días', antiguedad.mas90, 'text-red-800 dark:text-red-300'],
        ].map(([label, valor, color]) => <Card key={String(label)} className="text-center"><p className="text-xs text-gray-500 dark:text-gray-400">{label}</p><p className={`mt-1 font-data text-base font-bold ${color}`}>{formatCurrency(Number(valor))}</p></Card>)}
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
        {Object.keys(seleccionados).length > 0 && (
          <div className="flex flex-col gap-3 border-b border-primary/15 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-200">
              <ListChecks size={17} className="text-primary" />
              {Object.keys(seleccionados).length} obligación(es) seleccionada(s)
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setSeleccionados({})}>Limpiar</Button>
              <Button size="sm" onClick={() => abrirAplicaciones(Object.values(seleccionados))}>Aplicar seleccionadas</Button>
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="w-10 px-3 py-3"></th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">RUT</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Documento</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Vencimiento</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Saldo pendiente</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Estado</th><th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">
                    No hay documentos {soloPendientes ? 'pendientes' : ''} para este filtro.
                  </td>
                </tr>
              ) : (
                filasFiltradas.map((f, i) => {
                  const info = f.documentoId ? documentoPorId.get(f.documentoId) : undefined;
                  const pendiente = Math.abs(f.saldo) >= 1;
                  const aplicable: Aplicable | null = pendiente && f.documentoId ? { rut: f.rut, nombre: f.nombre, documentoId: f.documentoId, cuentaControlId: f.cuentaControlId, saldo: f.saldo, naturaleza: f.naturaleza } : null;
                  const clave = aplicable ? claveAplicacion(aplicable) : '';
                  const seleccionActual = Object.values(seleccionados);
                  const mezclaNaturaleza = aplicable && seleccionActual.length > 0 && seleccionActual[0].naturaleza !== aplicable.naturaleza;
                  const fechaVencimiento = info ? vencimientoDocumento(info.fecha, info.vencimiento) : undefined;
                  const vencimientoEstimado = Boolean(info && !info.vencimiento);
                  const vencido = pendiente && Boolean(fechaVencimiento) && Date.parse(`${fechaVencimiento!.slice(0, 10)}T23:59:59Z`) < Date.now();
                  return (
                    <tr key={i} className="odd:bg-gray-50/50 dark:odd:bg-gray-800/30 hover:bg-blue-50 dark:hover:bg-gray-700/50">
                      <td className="px-3 py-3 text-center">{aplicable && <input type="checkbox" aria-label={`Seleccionar ${info?.label ?? 'documento'}`} checked={Boolean(seleccionados[clave])} disabled={Boolean(mezclaNaturaleza)} title={mezclaNaturaleza ? 'Registre cobros y pagos en operaciones separadas' : undefined} onChange={() => alternarSeleccion(aplicable)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />}</td>
                      <td className="px-4 py-3 font-data text-gray-600 dark:text-gray-300">{f.rut}</td>
                      <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{f.nombre}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{info?.label ?? 'Sin documento'}</td>
                      <td className={`px-4 py-3 ${vencido ? 'font-semibold text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-300'}`}>{fechaVencimiento ? `${vencimientoEstimado ? 'Est. ' : ''}${formatDate(fechaVencimiento)}` : 'Sin fecha'}</td>
                      <td className="px-4 py-3 text-right font-data font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(Math.abs(f.saldo))}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={vencido ? 'danger' : pendiente ? 'warning' : 'success'}>{vencido ? 'Vencido' : pendiente ? 'Pendiente' : 'Pagado'}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">{aplicable && <Button size="sm" variant="secondary" onClick={() => abrirAplicaciones([aplicable])}>Aplicar pago/cobro</Button>}</td>
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
      <Modal isOpen={aplicando.length > 0} onClose={() => setAplicando([])} title={aplicando.length > 1 ? 'Aplicar varias obligaciones' : 'Aplicar pago o cobro'} size="lg" footer={<><Button variant="secondary" onClick={() => setAplicando([])}>Cancelar</Button><Button onClick={registrarAplicacion} disabled={guardando || !cuentaMedioId || aplicando.some(f => (montosAplicar[claveAplicacion(f)] || 0) <= 0 || (montosAplicar[claveAplicacion(f)] || 0) > Math.abs(f.saldo))}>{guardando ? 'Guardando...' : `Registrar ${aplicando.length} movimiento(s)`}</Button></>}>
        <div className="space-y-4">
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">{aplicando.map((f) => { const clave = claveAplicacion(f); const info = documentoPorId.get(f.documentoId); return <div key={clave} className="grid gap-3 rounded-lg border border-primary/15 bg-primary/5 p-3 sm:grid-cols-[1fr_180px] sm:items-end"><div><p className="font-semibold">{f.nombre}</p><p className="text-sm text-gray-500">{f.rut} · {info?.label ?? 'Documento'} · Pendiente {formatCurrency(Math.abs(f.saldo))}</p></div><MontoInput label="Monto a aplicar" value={montosAplicar[clave] || 0} onChange={(monto) => setMontosAplicar(actual => ({ ...actual, [clave]: monto }))} error={(montosAplicar[clave] || 0) > Math.abs(f.saldo) ? 'Supera el saldo pendiente' : undefined} /></div>; })}</div>
          <SearchSelect label="Cuenta de banco o caja" value={cuentaMedioId} onChange={setCuentaMedioId} options={cuentasMedioOptions} />
          <Input type="date" label="Fecha" value={fechaAplicar} onChange={e => setFechaAplicar(e.target.value)} />
          <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-800"><span className="text-gray-500">Total a registrar</span><strong className="font-data text-lg">{formatCurrency(Object.values(montosAplicar).reduce((s, n) => s + n, 0))}</strong></div>
          <p className="text-xs text-gray-500 flex gap-2"><WalletCards size={15} />El sistema generará un solo asiento contable con el detalle de cada obligación.</p>
        </div>
      </Modal>
    </div>
  );
}

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, FileWarning, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card, Badge } from '../components/ui/Cards';
import { Button } from '../components/ui/FormElements';
import { formatCurrency, formatDate } from '../utils/calculos';

type Nivel = 'critico' | 'advertencia';
interface Hallazgo { id: string; nivel: Nivel; categoria: string; detalle: string; referencia: string; destino: string; accion: string; }

export default function ControlIntegridad() {
  const { state } = useApp();
  const navigate = useNavigate();

  const hallazgos = useMemo(() => {
    const lista: Hallazgo[] = [];
    const cuentaPorId = new Map(state.cuentas.map(c => [c.id, c]));
    const documentosPorId = new Map(state.documentos.map(d => [d.id, d]));

    const numeros = new Map<number, number>();
    state.asientos.forEach(a => numeros.set(a.numero, (numeros.get(a.numero) ?? 0) + 1));
    numeros.forEach((cantidad, numero) => {
      if (cantidad > 1) lista.push({ id: `numero-${numero}`, nivel: 'critico', categoria: 'Correlativo duplicado', detalle: `${cantidad} comprobantes utilizan el número ${numero}.`, referencia: `Asiento #${numero}`, destino: '/asientos', accion: 'Revisar asientos' });
    });

    state.asientos.forEach(asiento => {
      const debe = asiento.detalles.reduce((s, d) => s + Number(d.debe || 0), 0);
      const haber = asiento.detalles.reduce((s, d) => s + Number(d.haber || 0), 0);
      if (Math.abs(debe - haber) >= 1) lista.push({ id: `descuadre-${asiento.id}`, nivel: 'critico', categoria: 'Asiento descuadrado', detalle: `Debe ${formatCurrency(debe)} · Haber ${formatCurrency(haber)} · Diferencia ${formatCurrency(Math.abs(debe - haber))}.`, referencia: `#${asiento.numero} · ${formatDate(asiento.fecha)}`, destino: `/asientos?asientoId=${encodeURIComponent(asiento.id)}&modo=editar`, accion: 'Abrir para corregir' });
      asiento.detalles.forEach((d, i) => {
        const cuenta = cuentaPorId.get(d.cuentaId);
        if (cuenta?.requiereAuxiliar && !d.rutAuxiliar) lista.push({ id: `aux-${asiento.id}-${i}`, nivel: 'critico', categoria: 'Auxiliar sin RUT', detalle: `${d.cuentaCodigo} ${d.cuentaNombre} exige cliente, proveedor o prestador.`, referencia: `Asiento #${asiento.numero}`, destino: `/asientos?asientoId=${encodeURIComponent(asiento.id)}&modo=editar`, accion: 'Completar auxiliar' });
        if (d.documentoId && !documentosPorId.has(d.documentoId)) lista.push({ id: `doc-huerfano-${asiento.id}-${i}`, nivel: 'advertencia', categoria: 'Referencia sin documento', detalle: `La línea apunta a un documento que ya no existe.`, referencia: `Asiento #${asiento.numero}`, destino: `/asientos?asientoId=${encodeURIComponent(asiento.id)}&modo=editar`, accion: 'Revisar referencia' });
      });
    });

    state.documentos.forEach(doc => {
      if (!doc.asientoId) lista.push({ id: `sin-asiento-${doc.id}`, nivel: 'critico', categoria: 'Documento sin asiento', detalle: `${doc.tipo} N° ${doc.numero} no tiene comprobante contable asociado.`, referencia: `${doc.rutCliente || 'Sin RUT'} · ${formatDate(doc.fecha)}`, destino: '/sincronizacion-sii', accion: 'Revisar carga SII' });
    });

    const docs = new Map<string, number>();
    state.documentos.forEach(d => {
      const key = `${d.libro ?? ''}|${d.tipo}|${d.numero}`;
      docs.set(key, (docs.get(key) ?? 0) + 1);
    });
    docs.forEach((cantidad, key) => {
      if (cantidad > 1) lista.push({ id: `doc-duplicado-${key}`, nivel: 'advertencia', categoria: 'Documento posiblemente duplicado', detalle: `${cantidad} registros comparten libro, tipo y folio.`, referencia: key.split('|').join(' · '), destino: '/sincronizacion-sii', accion: 'Revisar importación' });
    });

    const codigos = new Map<string, number>();
    state.cuentas.forEach(c => codigos.set(c.codigo, (codigos.get(c.codigo) ?? 0) + 1));
    codigos.forEach((cantidad, codigo) => {
      if (cantidad > 1) lista.push({ id: `cuenta-${codigo}`, nivel: 'critico', categoria: 'Cuenta duplicada', detalle: `${cantidad} cuentas utilizan el mismo código.`, referencia: codigo, destino: '/plan-cuentas', accion: 'Abrir plan' });
    });

    return lista.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === 'critico' ? -1 : 1));
  }, [state.asientos, state.cuentas, state.documentos]);

  const criticos = hallazgos.filter(h => h.nivel === 'critico').length;
  const advertencias = hallazgos.length - criticos;

  return <div className="space-y-6">
    <div className="flex items-center gap-3">
      <div className="p-3 rounded-xl bg-primary/10"><ShieldCheck className="text-primary" size={26} /></div>
      <div><h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Control de Integridad</h1><p className="text-sm text-gray-500 dark:text-gray-400">Revisión automática de la empresa activa.</p></div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card><p className="text-xs text-gray-500">Estado</p><div className="mt-2 flex items-center gap-2">{criticos ? <AlertTriangle className="text-red-500" /> : <CheckCircle2 className="text-emerald-500" />}<span className="text-xl font-bold">{criticos ? 'Requiere revisión' : 'Sin errores críticos'}</span></div></Card>
      <Card><p className="text-xs text-gray-500">Errores críticos</p><p className="text-3xl font-data font-black text-red-600 mt-2">{criticos}</p></Card>
      <Card><p className="text-xs text-gray-500">Advertencias</p><p className="text-3xl font-data font-black text-amber-600 mt-2">{advertencias}</p></Card>
    </div>
    <Card title="Resultados" padding="none">
      {hallazgos.length === 0 ? <div className="py-16 text-center"><CheckCircle2 className="mx-auto text-emerald-500 mb-3" size={38} /><p className="font-semibold text-gray-900 dark:text-gray-100">La revisión no encontró inconsistencias</p></div> :
      <div className="overflow-x-auto"><table className="w-full table-modern"><thead><tr><th>Nivel</th><th>Control</th><th>Detalle</th><th>Referencia</th><th className="text-right">Corrección</th></tr></thead><tbody>{hallazgos.map(h => <tr key={h.id}><td><Badge variant={h.nivel === 'critico' ? 'danger' : 'warning'}>{h.nivel === 'critico' ? 'Crítico' : 'Revisar'}</Badge></td><td className="font-medium"><span className="inline-flex gap-2 items-center"><FileWarning size={15} />{h.categoria}</span></td><td>{h.detalle}</td><td className="font-data text-xs">{h.referencia}</td><td className="text-right"><Button variant="ghost" size="sm" onClick={() => navigate(h.destino)}>{h.accion}<ArrowRight size={14} /></Button></td></tr>)}</tbody></table></div>}
    </Card>
  </div>;
}

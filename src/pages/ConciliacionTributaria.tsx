import React, { useMemo, useState } from 'react';
import { CheckCircle2, Scale, TriangleAlert } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card, Badge } from '../components/ui/Cards';
import { Select } from '../components/ui/FormElements';
import { formatCurrency } from '../utils/calculos';

export default function ConciliacionTributaria() {
  const { state } = useApp();
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth()+1);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const r = useMemo(() => {
    const periodo = (f:string) => { const p=f.slice(0,10).split('-'); return Number(p[0])===anio&&Number(p[1])===mes; };
    const docs=state.documentos.filter(d=>periodo(d.fecha));
    const ventas=docs.filter(d=>d.libro==='ventas'); const compras=docs.filter(d=>d.libro==='compras');
    const signo=(d:typeof docs[number])=>d.tipo==='nota_credito'?-1:1;
    const ivaVentas=ventas.reduce((s,d)=>s+(d.iva||0)*signo(d),0);
    const ivaCompras=compras.reduce((s,d)=>s+(d.iva||0)*signo(d),0);
    const asientos=state.asientos.filter(a=>a.estado!=='anulado'&&periodo(a.fecha)&&!a.tipo?.startsWith('reverso:')&&a.tipo!=='traspaso');
    let mayorDebito=0, mayorCredito=0;
    asientos.forEach(a=>a.detalles.forEach(d=>{ const n=d.cuentaNombre.toLowerCase(); if(n.includes('iva débito')||n.includes('iva debito')) mayorDebito+=d.haber-d.debe; if(n.includes('iva crédito')||n.includes('iva credito')) mayorCredito+=d.debe-d.haber; }));
    const sinAsiento=docs.filter(d=>!d.asientoId);
    const ids=new Set(state.asientos.map(a=>a.id));
    const enlaceRoto=docs.filter(d=>d.asientoId&&!ids.has(d.asientoId));
    const descuadrados=asientos.filter(a=>Math.abs(a.detalles.reduce((s,d)=>s+d.debe-d.haber,0))>=1);
    const sinAuxiliar=asientos.flatMap(a=>a.detalles.filter(d=>state.cuentas.find(c=>c.id===d.cuentaId)?.requiereAuxiliar&&!d.rutAuxiliar));
    return { docs,ventas,compras,ivaVentas,ivaCompras,mayorDebito,mayorCredito,sinAsiento,enlaceRoto,descuadrados,sinAuxiliar,difDebito:ivaVentas-mayorDebito,difCredito:ivaCompras-mayorCredito };
  },[state.documentos,state.asientos,state.cuentas,mes,anio]);
  const ok=Math.abs(r.difDebito)<1&&Math.abs(r.difCredito)<1&&!r.sinAsiento.length&&!r.enlaceRoto.length&&!r.descuadrados.length&&!r.sinAuxiliar.length;
  const controles=[
    ['IVA Débito: Libro vs Mayor',r.ivaVentas,r.mayorDebito,r.difDebito],['IVA Crédito: Libro vs Mayor',r.ivaCompras,r.mayorCredito,r.difCredito]
  ] as const;
  return <div className="space-y-6"><div className="flex flex-col md:flex-row md:items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="p-3 bg-primary/10 rounded-xl"><Scale className="text-primary"/></div><div><h1 className="text-2xl font-bold dark:text-gray-100">Conciliación Tributaria</h1><p className="text-sm text-gray-500">Libros, documentos, auxiliares y mayor contable.</p></div></div><div className="flex gap-2"><Select value={String(mes)} onChange={e=>setMes(Number(e.target.value))} options={Array.from({length:12},(_,i)=>({value:String(i+1),label:new Date(2026,i,1).toLocaleString('es-CL',{month:'long'})}))}/><Select value={String(anio)} onChange={e=>setAnio(Number(e.target.value))} options={[anio-1,anio,anio+1].map(x=>({value:String(x),label:String(x)}))}/></div></div>
  <Card><div className="flex items-center gap-3">{ok?<CheckCircle2 size={32} className="text-emerald-500"/>:<TriangleAlert size={32} className="text-amber-500"/>}<div><p className="text-lg font-bold dark:text-gray-100">{ok?'Período conciliado':'Existen diferencias por revisar'}</p><p className="text-sm text-gray-500">{r.docs.length} documentos · {r.ventas.length} ventas · {r.compras.length} compras</p></div></div></Card>
  <Card title="IVA Libro vs Mayor" padding="none"><div className="overflow-x-auto"><table className="w-full table-modern"><thead><tr><th>Control</th><th className="text-right">Libro</th><th className="text-right">Mayor</th><th className="text-right">Diferencia</th><th>Estado</th></tr></thead><tbody>{controles.map(c=><tr key={c[0]}><td>{c[0]}</td><td className="text-right font-data">{formatCurrency(c[1])}</td><td className="text-right font-data">{formatCurrency(c[2])}</td><td className="text-right font-data">{formatCurrency(c[3])}</td><td><Badge variant={Math.abs(c[3])<1?'success':'danger'}>{Math.abs(c[3])<1?'Coincide':'Diferencia'}</Badge></td></tr>)}</tbody></table></div></Card>
  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">{[['Documentos sin asiento',r.sinAsiento.length],['Enlaces de asiento rotos',r.enlaceRoto.length],['Asientos descuadrados',r.descuadrados.length],['Auxiliares sin RUT',r.sinAuxiliar.length]].map(([l,v])=><Card key={String(l)}><p className="text-xs text-gray-500">{l}</p><p className={`text-3xl font-data font-black mt-2 ${Number(v)?'text-red-600':'text-emerald-600'}`}>{v}</p></Card>)}</div></div>;
}

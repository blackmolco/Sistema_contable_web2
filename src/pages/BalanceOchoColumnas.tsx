import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, Download, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Card } from '../components/ui/Cards';
import { Button, Input } from '../components/ui/FormElements';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate } from '../utils/calculos';
import { getBrandRgb } from '../utils/brandColor';

interface FilaBalance8 {
  codigo: string; nombre: string; tipo: string;
  sumasDebe: number; sumasHaber: number; saldoDeudor: number; saldoAcreedor: number;
  inventarioActivo: number; inventarioPasivo: number; resultadoPerdida: number; resultadoGanancia: number;
}

const redondear = (valor: number) => Math.round(valor);
const celda = (valor: number) => valor ? formatCurrency(valor) : '';

export default function BalanceOchoColumnas() {
  const { state } = useApp();
  const hoy = new Date();
  const [fechaInicio, setFechaInicio] = useState(`${hoy.getFullYear()}-01-01`);
  const [fechaFin, setFechaFin] = useState(hoy.toISOString().slice(0, 10));

  const filas = useMemo<FilaBalance8[]>(() => {
    const movimientos = new Map<string, { nombre: string; tipo: string; debe: number; haber: number }>();
    const tipoPorCodigo = new Map(state.cuentas.map(c => [c.codigo, c.tipo]));
    state.asientos
      .filter(a => a.estado !== 'anulado' && a.fecha.slice(0, 10) >= fechaInicio && a.fecha.slice(0, 10) <= fechaFin)
      .forEach(asiento => asiento.detalles.forEach(detalle => {
        const actual = movimientos.get(detalle.cuentaCodigo) ?? { nombre: detalle.cuentaNombre, tipo: tipoPorCodigo.get(detalle.cuentaCodigo) ?? 'activo', debe: 0, haber: 0 };
        actual.debe += detalle.debe || 0; actual.haber += detalle.haber || 0;
        movimientos.set(detalle.cuentaCodigo, actual);
      }));
    return [...movimientos.entries()].map(([codigo, m]) => {
      const saldoDeudor = Math.max(redondear(m.debe - m.haber), 0);
      const saldoAcreedor = Math.max(redondear(m.haber - m.debe), 0);
      const esResultado = m.tipo === 'ingreso' || m.tipo === 'gasto';
      return {
        codigo, nombre: m.nombre, tipo: m.tipo, sumasDebe: redondear(m.debe), sumasHaber: redondear(m.haber), saldoDeudor, saldoAcreedor,
        inventarioActivo: !esResultado && m.tipo === 'activo' ? saldoDeudor - saldoAcreedor : 0,
        inventarioPasivo: !esResultado && m.tipo !== 'activo' ? saldoAcreedor - saldoDeudor : 0,
        resultadoPerdida: m.tipo === 'gasto' ? saldoDeudor - saldoAcreedor : 0,
        resultadoGanancia: m.tipo === 'ingreso' ? saldoAcreedor - saldoDeudor : 0,
      };
    }).filter(f => f.sumasDebe || f.sumasHaber).sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [state.asientos, state.cuentas, fechaInicio, fechaFin]);

  const totales = useMemo(() => filas.reduce((t, f) => ({
    sumasDebe: t.sumasDebe + f.sumasDebe, sumasHaber: t.sumasHaber + f.sumasHaber,
    saldoDeudor: t.saldoDeudor + f.saldoDeudor, saldoAcreedor: t.saldoAcreedor + f.saldoAcreedor,
    inventarioActivo: t.inventarioActivo + f.inventarioActivo, inventarioPasivo: t.inventarioPasivo + f.inventarioPasivo,
    resultadoPerdida: t.resultadoPerdida + f.resultadoPerdida, resultadoGanancia: t.resultadoGanancia + f.resultadoGanancia,
  }), { sumasDebe: 0, sumasHaber: 0, saldoDeudor: 0, saldoAcreedor: 0, inventarioActivo: 0, inventarioPasivo: 0, resultadoPerdida: 0, resultadoGanancia: 0 }), [filas]);

  const diferenciaSumas = redondear(totales.sumasDebe - totales.sumasHaber);
  const diferenciaSaldos = redondear(totales.saldoDeudor - totales.saldoAcreedor);
  const resultado = redondear(totales.resultadoGanancia - totales.resultadoPerdida);
  const diferenciaFinal = redondear((totales.inventarioActivo + totales.resultadoPerdida) - (totales.inventarioPasivo + totales.resultadoGanancia));
  const cuadrado = Math.abs(diferenciaSumas) <= 1 && Math.abs(diferenciaSaldos) <= 1 && Math.abs(diferenciaFinal) <= 1;
  const valores = (f: FilaBalance8) => [f.sumasDebe, f.sumasHaber, f.saldoDeudor, f.saldoAcreedor, f.inventarioActivo, f.inventarioPasivo, f.resultadoPerdida, f.resultadoGanancia];
  const valoresTotales = [totales.sumasDebe, totales.sumasHaber, totales.saldoDeudor, totales.saldoAcreedor, totales.inventarioActivo, totales.inventarioPasivo, totales.resultadoPerdida, totales.resultadoGanancia];

  const exportarPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const brand = getBrandRgb();
    doc.setFontSize(14); doc.setTextColor(...brand);
    doc.text('BALANCE DE COMPROBACION Y DE SALDOS - 8 COLUMNAS', 148.5, 13, { align: 'center' });
    doc.setFontSize(9); doc.setTextColor(70);
    doc.text(`Periodo: ${formatDate(fechaInicio)} al ${formatDate(fechaFin)}`, 148.5, 19, { align: 'center' });
    autoTable(doc, {
      startY: 24,
      head: [[{ content: 'Cuenta', colSpan: 2 }, { content: 'Sumas', colSpan: 2 }, { content: 'Saldos', colSpan: 2 }, { content: 'Inventario', colSpan: 2 }, { content: 'Resultados', colSpan: 2 }], ['Codigo', 'Nombre', 'Debe', 'Haber', 'Deudor', 'Acreedor', 'Activo', 'Pasivo', 'Perdida', 'Ganancia']],
      body: filas.map(f => [f.codigo, f.nombre, ...valores(f).map(celda)]),
      foot: [['', 'TOTALES', ...valoresTotales.map(celda)]], theme: 'grid',
      styles: { fontSize: 6.5, cellPadding: 1.2, halign: 'right' }, headStyles: { fillColor: brand, textColor: 255, fontStyle: 'bold' }, footStyles: { fillColor: brand, textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { halign: 'left', cellWidth: 23 }, 1: { halign: 'left', cellWidth: 53 } },
      didDrawPage: data => { doc.setFontSize(7); doc.setTextColor(110); doc.text(`Pagina ${data.pageNumber}`, 282, 202, { align: 'right' }); },
    });
    doc.save(`Balance_8_Columnas_${fechaFin}.pdf`);
  };

  const exportarExcel = () => {
    const datos: Record<string, string | number>[] = filas.map(f => ({ Codigo: f.codigo, Cuenta: f.nombre, 'Sumas Debe': f.sumasDebe, 'Sumas Haber': f.sumasHaber, 'Saldo Deudor': f.saldoDeudor, 'Saldo Acreedor': f.saldoAcreedor, 'Inventario Activo': f.inventarioActivo, 'Inventario Pasivo': f.inventarioPasivo, 'Resultado Perdida': f.resultadoPerdida, 'Resultado Ganancia': f.resultadoGanancia }));
    datos.push({ Codigo: '', Cuenta: 'TOTALES', 'Sumas Debe': totales.sumasDebe, 'Sumas Haber': totales.sumasHaber, 'Saldo Deudor': totales.saldoDeudor, 'Saldo Acreedor': totales.saldoAcreedor, 'Inventario Activo': totales.inventarioActivo, 'Inventario Pasivo': totales.inventarioPasivo, 'Resultado Perdida': totales.resultadoPerdida, 'Resultado Ganancia': totales.resultadoGanancia });
    const hoja = XLSX.utils.json_to_sheet(datos); hoja['!cols'] = [{ wch: 18 }, { wch: 42 }, ...Array(8).fill({ wch: 16 })];
    const libro = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(libro, hoja, 'Balance 8 Columnas');
    XLSX.writeFile(libro, `Balance_8_Columnas_${fechaFin}.xlsx`);
  };

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Balance de 8 Columnas</h1><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Balance de comprobacion y saldos del periodo</p></div><div className="flex gap-2"><Button variant="secondary" icon={<FileSpreadsheet size={16}/>} onClick={exportarExcel} disabled={!filas.length}>Traspasar a Excel</Button><Button icon={<Download size={16}/>} onClick={exportarPDF} disabled={!filas.length}>Descargar PDF</Button></div></div>
    <Card><div className="grid gap-4 sm:grid-cols-2"><Input type="date" label="Desde" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)}/><Input type="date" label="Hasta" value={fechaFin} onChange={e => setFechaFin(e.target.value)}/></div></Card>
    {!filas.length ? <Card><div className="flex flex-col items-center gap-3 py-12 text-gray-400"><AlertCircle size={36}/><p>No hay movimientos en el periodo seleccionado.</p></div></Card> : <Card padding="none">
      <div className="max-h-[68vh] overflow-auto"><table className="w-full min-w-[1280px] border-collapse text-xs"><thead className="sticky top-0 z-10 text-white"><tr className="bg-primary"><th rowSpan={2} className="border border-white/20 px-2 py-3 text-left">Codigo</th><th rowSpan={2} className="min-w-64 border border-white/20 px-2 py-3 text-left">Cuenta</th>{['Sumas','Saldos','Inventario','Resultados'].map(x=><th key={x} colSpan={2} className="border border-white/20 px-2 py-2">{x}</th>)}</tr><tr className="bg-[var(--brand-dark)]">{['Debe','Haber','Deudor','Acreedor','Activo','Pasivo','Perdida','Ganancia'].map(x=><th key={x} className="border border-white/20 px-2 py-2 text-right">{x}</th>)}</tr></thead>
      <tbody>{filas.map((f,i)=><tr key={f.codigo} className={i%2?'bg-gray-50 dark:bg-gray-800/40':'bg-white dark:bg-gray-900'}><td className="border px-2 py-2 font-data dark:border-gray-700">{f.codigo}</td><td className="border px-2 py-2 dark:border-gray-700">{f.nombre}</td>{valores(f).map((v,j)=><td key={j} className="border px-2 py-2 text-right font-data tabular-nums dark:border-gray-700">{celda(v)}</td>)}</tr>)}</tbody>
      <tfoot><tr className="bg-primary font-bold text-white"><td colSpan={2} className="border border-white/20 px-2 py-3">TOTALES</td>{valoresTotales.map((v,j)=><td key={j} className="border border-white/20 px-2 py-3 text-right font-data">{celda(v)}</td>)}</tr></tfoot></table></div>
      <div className="grid gap-3 border-t p-4 md:grid-cols-3 dark:border-gray-700"><div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800"><p className="text-xs text-gray-500">Resultado del ejercicio</p><p className="font-data text-lg font-bold">{formatCurrency(Math.abs(resultado))} {resultado>=0?'ganancia':'perdida'}</p></div><div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800"><p className="text-xs text-gray-500">Diferencia Debe / Haber</p><p className={`font-data text-lg font-bold ${diferenciaSumas?'text-red-600':'text-emerald-600'}`}>{formatCurrency(diferenciaSumas)}</p></div><div className={`flex items-center gap-2 rounded-lg border p-3 ${cuadrado?'border-emerald-200 bg-emerald-50 text-emerald-700':'border-red-200 bg-red-50 text-red-700'}`}>{cuadrado?<CheckCircle size={18}/>:<AlertCircle size={18}/>}<span className="font-semibold">{cuadrado?'Balance cuadrado':`Descuadre: ${formatCurrency(diferenciaFinal)}`}</span></div></div>
    </Card>}
  </div>;
}

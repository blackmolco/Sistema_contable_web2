import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, Download, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Card } from '../components/ui/Cards';
import { Button, Select } from '../components/ui/FormElements';
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
const CODIGO_UTILIDADES_ACUMULADAS = '3-01-003-0001';

export default function BalanceOchoColumnas() {
  const { state } = useApp();
  const hoy = new Date();
  const [anioCorte, setAnioCorte] = useState(String(hoy.getFullYear()));
  const [mesCorte, setMesCorte] = useState(String(hoy.getMonth() + 1));
  const [tipoCorte, setTipoCorte] = useState<'mensual' | 'anual'>('mensual');
  const aniosDisponibles = Array.from(new Set((state.asientos ?? []).map(a => new Date(a.fecha).getFullYear())))
    .sort((a, b) => b - a);
  if (!aniosDisponibles.includes(hoy.getFullYear())) aniosDisponibles.unshift(hoy.getFullYear());
  const fechaInicio = `${anioCorte}-01-01`;
  const ultimoMes = tipoCorte === 'anual' ? 12 : Number(mesCorte);
  const fechaFin = `${anioCorte}-${String(ultimoMes).padStart(2, '0')}-${new Date(Number(anioCorte), ultimoMes, 0).getDate()}`;
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  const filas = useMemo<FilaBalance8[]>(() => {
    const movimientos = new Map<string, { nombre: string; tipo: string; anteriorDebe: number; anteriorHaber: number; periodoDebe: number; periodoHaber: number }>();
    const tipoPorCodigo = new Map(state.cuentas.map(c => [c.codigo, c.tipo]));
    let resultadoAnteriorDebe = 0;
    let resultadoAnteriorHaber = 0;
    state.asientos
      .filter(a => a.estado !== 'anulado' && a.fecha.slice(0, 10) <= fechaFin)
      .forEach(asiento => asiento.detalles.forEach(detalle => {
        const tipo = tipoPorCodigo.get(detalle.cuentaCodigo) ?? 'activo';
        const actual = movimientos.get(detalle.cuentaCodigo) ?? { nombre: detalle.cuentaNombre, tipo, anteriorDebe: 0, anteriorHaber: 0, periodoDebe: 0, periodoHaber: 0 };
        if (asiento.fecha.slice(0, 10) < fechaInicio) {
          // Solo las cuentas permanentes arrastran saldo. Ingresos y gastos
          // comienzan en cero en cada ejercicio, pero su resultado neto debe
          // incorporarse al patrimonio inicial para mantener el cuadre.
          if (tipo === 'ingreso' || tipo === 'gasto') {
            resultadoAnteriorDebe += detalle.debe || 0;
            resultadoAnteriorHaber += detalle.haber || 0;
            return;
          }
          actual.anteriorDebe += detalle.debe || 0;
          actual.anteriorHaber += detalle.haber || 0;
        } else {
          actual.periodoDebe += detalle.debe || 0;
          actual.periodoHaber += detalle.haber || 0;
        }
        movimientos.set(detalle.cuentaCodigo, actual);
      }));
    const filasCalculadas = [...movimientos.entries()].map(([codigo, m]) => {
      // Redondear solo al final. Redondear la apertura y el movimiento por
      // separado podía crear diferencias de $1 al totalizar muchas cuentas.
      const aperturaNeta = m.anteriorDebe - m.anteriorHaber;
      const sumasDebe = Math.max(aperturaNeta, 0) + m.periodoDebe;
      const sumasHaber = Math.max(-aperturaNeta, 0) + m.periodoHaber;
      const saldoNeto = sumasDebe - sumasHaber;
      const saldoDeudor = Math.max(saldoNeto, 0);
      const saldoAcreedor = Math.max(-saldoNeto, 0);
      const esResultado = m.tipo === 'ingreso' || m.tipo === 'gasto';
      return {
        codigo, nombre: m.nombre, tipo: m.tipo, sumasDebe, sumasHaber, saldoDeudor, saldoAcreedor,
        inventarioActivo: !esResultado && m.tipo === 'activo' ? saldoDeudor - saldoAcreedor : 0,
        inventarioPasivo: !esResultado && m.tipo !== 'activo' ? saldoAcreedor - saldoDeudor : 0,
        resultadoPerdida: m.tipo === 'gasto' ? saldoDeudor - saldoAcreedor : 0,
        resultadoGanancia: m.tipo === 'ingreso' ? saldoAcreedor - saldoDeudor : 0,
      };
    }).filter(f => f.sumasDebe || f.sumasHaber);

    const resultadoAnterior = resultadoAnteriorHaber - resultadoAnteriorDebe;
    if (resultadoAnterior !== 0) {
      // El resultado de ejercicios anteriores pertenece a Utilidades
      // Acumuladas; no debe aparecer como una cuenta técnica 9-...
      const indiceUtilidades = filasCalculadas.findIndex(f => f.codigo === CODIGO_UTILIDADES_ACUMULADAS);
      const cuentaUtilidades = state.cuentas.find(c => c.codigo === CODIGO_UTILIDADES_ACUMULADAS);
      const agregarDebe = Math.max(-resultadoAnterior, 0);
      const agregarHaber = Math.max(resultadoAnterior, 0);
      const base = indiceUtilidades >= 0 ? filasCalculadas[indiceUtilidades] : {
        codigo: CODIGO_UTILIDADES_ACUMULADAS,
        nombre: cuentaUtilidades?.nombre || 'Utilidades Acumuladas',
        tipo: 'patrimonio', sumasDebe: 0, sumasHaber: 0, saldoDeudor: 0, saldoAcreedor: 0,
        inventarioActivo: 0, inventarioPasivo: 0, resultadoPerdida: 0, resultadoGanancia: 0,
      };
      const sumasDebe = base.sumasDebe + agregarDebe;
      const sumasHaber = base.sumasHaber + agregarHaber;
      const saldoNeto = sumasDebe - sumasHaber;
      const actualizada: FilaBalance8 = {
        ...base,
        sumasDebe,
        sumasHaber,
        saldoDeudor: Math.max(saldoNeto, 0),
        saldoAcreedor: Math.max(-saldoNeto, 0),
        inventarioActivo: 0,
        inventarioPasivo: -saldoNeto,
      };
      if (indiceUtilidades >= 0) filasCalculadas[indiceUtilidades] = actualizada;
      else filasCalculadas.push(actualizada);
    }
    return filasCalculadas.sort((a, b) => a.codigo.localeCompare(b.codigo));
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
  // Los importes se expresan en pesos enteros: una diferencia de $1 sigue
  // siendo un descuadre y no debe mostrarse como "Balance cuadrado".
  const cuadrado = diferenciaSumas === 0 && diferenciaSaldos === 0 && diferenciaFinal === 0;
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
    <div className="page-header"><div><h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Balance de 8 Columnas</h1><p className="page-header-subtitle">Balance de comprobación y saldos del periodo</p></div><div className="flex flex-wrap gap-2"><Button variant="secondary" icon={<FileSpreadsheet size={16}/>} onClick={exportarExcel} disabled={!filas.length}>Traspasar a Excel</Button><Button icon={<Download size={16}/>} onClick={exportarPDF} disabled={!filas.length}>Descargar PDF</Button></div></div>
    <Card className="filter-bar"><div className="grid w-full gap-4 sm:grid-cols-3"><Select label="Tipo de corte" value={tipoCorte} onChange={e => setTipoCorte(e.target.value as 'mensual' | 'anual')} options={[{ value: 'mensual', label: 'Mensual acumulado' }, { value: 'anual', label: 'Año completo' }]} /><Select label="Año" value={anioCorte} onChange={e => setAnioCorte(e.target.value)} options={aniosDisponibles.map(a => ({ value: String(a), label: String(a) }))} /><Select label="Mes de corte" value={mesCorte} disabled={tipoCorte === 'anual'} onChange={e => setMesCorte(e.target.value)} options={meses.map((label, i) => ({ value: String(i + 1), label }))} /></div><p className="w-full text-xs text-gray-500 dark:text-gray-400">{tipoCorte === 'anual' ? `Acumulado del año ${anioCorte}` : `Acumulado desde enero hasta ${meses[Number(mesCorte) - 1]} de ${anioCorte}`}. Las cuentas permanentes incluyen sus saldos de apertura.</p></Card>
    {!filas.length ? <Card><div className="flex flex-col items-center gap-3 py-12 text-gray-400"><AlertCircle size={36}/><p>No hay movimientos en el periodo seleccionado.</p></div></Card> : <Card padding="none">
      <div className="table-scroll"><table className="ledger-table w-full min-w-[1280px] border-collapse text-xs"><thead className="sticky top-0 z-10 text-white"><tr className="bg-primary"><th rowSpan={2} className="border border-white/20 px-2 py-3 text-left">Código</th><th rowSpan={2} className="min-w-64 border border-white/20 px-2 py-3 text-left">Cuenta</th>{['Sumas','Saldos','Inventario','Resultados'].map(x=><th key={x} colSpan={2} className="border border-white/20 px-2 py-2">{x}</th>)}</tr><tr className="bg-[var(--brand-dark)]">{['Debe','Haber','Deudor','Acreedor','Activo','Pasivo','Pérdida','Ganancia'].map(x=><th key={x} className="border border-white/20 px-2 py-2 text-right">{x}</th>)}</tr></thead>
      <tbody>{filas.map((f,i)=><tr key={f.codigo} className={i%2?'bg-gray-50 dark:bg-gray-800/40':'bg-white dark:bg-gray-900'}><td className="border px-2 py-2 font-data dark:border-gray-700">{f.codigo}</td><td className="border px-2 py-2 dark:border-gray-700">{f.nombre}</td>{valores(f).map((v,j)=><td key={j} className="border px-2 py-2 text-right font-data tabular-nums dark:border-gray-700">{celda(v)}</td>)}</tr>)}</tbody>
      <tfoot><tr className="bg-primary font-bold text-white"><td colSpan={2} className="border border-white/20 px-2 py-3">TOTALES</td>{valoresTotales.map((v,j)=><td key={j} className="border border-white/20 px-2 py-3 text-right font-data">{celda(v)}</td>)}</tr></tfoot></table></div>
      <div className="grid gap-3 border-t p-4 md:grid-cols-3 dark:border-gray-700"><div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800"><p className="text-xs text-gray-500">Resultado del ejercicio</p><p className="font-data text-lg font-bold">{formatCurrency(Math.abs(resultado))} {resultado>=0?'ganancia':'perdida'}</p></div><div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800"><p className="text-xs text-gray-500">Diferencia Debe / Haber</p><p className={`font-data text-lg font-bold ${diferenciaSumas?'text-red-600':'text-emerald-600'}`}>{formatCurrency(diferenciaSumas)}</p></div><div className={`flex items-center gap-2 rounded-lg border p-3 ${cuadrado?'border-emerald-200 bg-emerald-50 text-emerald-700':'border-red-200 bg-red-50 text-red-700'}`}>{cuadrado?<CheckCircle size={18}/>:<AlertCircle size={18}/>}<span className="font-semibold">{cuadrado?'Balance cuadrado':`Descuadre: ${formatCurrency(diferenciaFinal)}`}</span></div></div>
    </Card>}
  </div>;
}

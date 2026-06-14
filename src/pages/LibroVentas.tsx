import React, { useState, useMemo } from 'react';
import {
  Download,
  FileText,
  TrendingUp,
  TrendingDown,
  Filter,
  Calendar,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card, Badge } from '../components/ui/Cards';
import { Button, Select } from '../components/ui/FormElements';
import { formatCurrency, formatDate, formatRUT, getNombreMes, getPeriodoActual } from '../utils/calculos';
import { MESES, TIPOS_DOCUMENTO_SII } from '../data/normativa';

interface LibroVentasProps {
  tipo: 'ventas' | 'compras';
}

export default function LibroVentas({ tipo }: LibroVentasProps) {
  const { state } = useApp();

  // ── Estados de período: mes y año SEPARADOS para que funcionen independientemente ──
  const now = new Date();
  const [selectedMes, setSelectedMes]   = useState<number>(now.getMonth() + 1);
  const [selectedAnio, setSelectedAnio] = useState<number>(now.getFullYear());

  // ── Clasificación robusta compra/venta ────────────────────────────────────────
  // Usa el campo `libro` (origen explícito) y, como respaldo para documentos
  // importados del SII sin ese campo, el estado (compras=pendiente, ventas=emitido).
  const esCompra = (d: typeof state.documentos[number]) =>
    d.libro === 'compras' ||
    d.tipo === 'factura_compra' ||
    (d.libro !== 'ventas' && d.estado === 'pendiente');

  const esVenta = (d: typeof state.documentos[number]) =>
    d.libro === 'ventas' ||
    (d.libro !== 'compras' && d.tipo !== 'factura_compra' && d.estado === 'emitido');

  // ── Todos los documentos según tipo de libro ──────────────────────────────────
  // Se incluyen TODOS los tipos (facturas afectas/exentas, notas de crédito y
  // débito). Las notas de crédito restan; ver `signo` más abajo.
  const documentos = useMemo(
    () => state.documentos.filter((d) => (tipo === 'ventas' ? esVenta(d) : esCompra(d))),
    [state.documentos, tipo]
  );

  // ── Filtrar por mes Y año (ambos estados usados directamente) ─────────────────
  const registrosFiltrados = useMemo(() => {
    return documentos.filter((doc) => {
      const docDate = new Date(doc.fecha);
      return docDate.getFullYear() === selectedAnio && docDate.getMonth() + 1 === selectedMes;
    });
  }, [documentos, selectedMes, selectedAnio]);

  // ── Mapear a estructura de registros para la tabla ────────────────────────────
  // Las notas de crédito (código 61) restan del libro: se registran con signo negativo.
  const registros = useMemo(() => {
    return registrosFiltrados.map((doc) => {
      const signo = doc.tipo === 'nota_credito' ? -1 : 1;
      return {
        id: doc.id,
        fecha: doc.fecha,
        tipoDocumento: doc.tipo,
        numeroDocumento: doc.numero ?? 0,
        rut: doc.receptor?.rut ?? doc.rutCliente ?? '',
        razonSocial: doc.receptor?.razonSocial ?? doc.razonSocialCliente ?? '',
        exento: (doc.totalExento ?? 0) * signo,
        neto: (doc.neto ?? doc.subtotal ?? 0) * signo,
        iva: (doc.iva ?? 0) * signo,
        total: (doc.total ?? 0) * signo,
      };
    });
  }, [registrosFiltrados]);

  // ── Totales ───────────────────────────────────────────────────────────────────
  const totales = useMemo(() => registros.reduce(
    (acc, r) => ({
      exento: acc.exento + r.exento,
      neto:   acc.neto   + r.neto,
      iva:    acc.iva    + r.iva,
      total:  acc.total  + r.total,
    }),
    { exento: 0, neto: 0, iva: 0, total: 0 }
  ), [registros]);

  // ── Resumen por tipo de documento ─────────────────────────────────────────────
  const porTipo = useMemo(() => {
    const tipos: Record<string, { cantidad: number; total: number }> = {};
    registros.forEach((r) => {
      if (!tipos[r.tipoDocumento]) tipos[r.tipoDocumento] = { cantidad: 0, total: 0 };
      tipos[r.tipoDocumento].cantidad++;
      tipos[r.tipoDocumento].total += r.total;
    });
    return tipos;
  }, [registros]);

  // ── Exportar a CSV ────────────────────────────────────────────────────────────
  const exportarCSV = () => {
    const cabecera = ['Fecha', 'Tipo Doc', 'N° Doc', 'RUT', 'Razón Social', 'Exento', 'Neto', 'IVA', 'Total'];
    const filas = registros.map(r => [
      formatDate(r.fecha),
      r.tipoDocumento,
      r.numeroDocumento,
      r.rut,
      r.razonSocial,
      r.exento,
      r.neto,
      r.iva,
      r.total,
    ]);
    const csv = [cabecera, ...filas].map(fila => fila.join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    a.href = url;
    a.download = `Libro${tipo === 'ventas' ? 'Ventas' : 'Compras'}_${meses[selectedMes-1]}${selectedAnio}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const nombreMes = getNombreMes(selectedMes);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Libro de {tipo === 'ventas' ? 'Ventas' : 'Compras'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {documentos.length} documento{documentos.length !== 1 ? 's' : ''} en total ·
            <span className="font-semibold text-[#1E3A5F] ml-1">{registros.length} en {nombreMes} {selectedAnio}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportarCSV}
            disabled={registros.length === 0}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Download size={15} /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Filtros */}
      <Card padding="sm">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-600">Período:</span>
          </div>
          {/* Selector de MES */}
          <select
            value={selectedMes}
            onChange={(e) => setSelectedMes(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20"
          >
            {MESES.map((mes) => (
              <option key={mes.numero} value={mes.numero}>
                {mes.nombre}
              </option>
            ))}
          </select>
          {/* Selector de AÑO — ahora funcional e independiente */}
          <select
            value={selectedAnio}
            onChange={(e) => setSelectedAnio(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20"
          >
            {[2023, 2024, 2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {documentos.length > 0 && registros.length === 0 && (
            <span className="text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded-lg border border-amber-200">
              ⚠️ Sin documentos en {nombreMes} {selectedAnio} — prueba otro período
            </span>
          )}
        </div>
      </Card>

      {/* Totales */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card padding="sm">
          <p className="text-sm text-gray-500 mb-1">Exento</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(totales.exento)}</p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-gray-500 mb-1">Neto</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(totales.neto)}</p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-gray-500 mb-1">IVA</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(totales.iva)}</p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-gray-500 mb-1">Total</p>
          <p className="text-xl font-bold text-[#1E3A5F]">{formatCurrency(totales.total)}</p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-gray-500 mb-1">Documentos</p>
          <p className="text-xl font-bold text-gray-900">{registros.length}</p>
        </Card>
      </div>

      {/* Por Tipo de Documento */}
      <Card title="Resumen por Tipo de Documento">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(porTipo).map(([tipoDoc, data]) => {
            const tipoInfo = TIPOS_DOCUMENTO_SII.find((t) => t.codigo === tipoDoc);
            return (
              <div key={tipoDoc} className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">{tipoInfo?.nombre || tipoDoc}</p>
                <p className="text-lg font-bold text-gray-900">{data.cantidad}</p>
                <p className="text-sm text-gray-600">{formatCurrency(data.total)}</p>
              </div>
            );
          })}
          {Object.keys(porTipo).length === 0 && (
            <p className="col-span-4 text-center text-gray-500 py-4">
              No hay documentos en este período
            </p>
          )}
        </div>
      </Card>

      {/* Tabla */}
      <Card padding="none">
        <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
        <table className="w-full">
          <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800">
            <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fecha</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tipo</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">N°</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">RUT</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cliente/Proveedor</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Exento</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Neto</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">IVA</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {registros.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center">
                  <FileText className="mx-auto text-gray-300 mb-3" size={48} />
                  <p className="text-gray-500">No hay documentos en este período</p>
                </td>
              </tr>
            ) : (
              registros.map((registro) => (
                <tr key={registro.id} className="odd:bg-gray-50/50 dark:odd:bg-gray-800/30 hover:bg-blue-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 text-sm text-gray-600">{formatDate(registro.fecha)}</td>
                  <td className="px-4 py-3 text-sm">
                    <Badge variant="info">{registro.tipoDocumento.toUpperCase()}</Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-center font-mono">{registro.numeroDocumento}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatRUT(registro.rut)}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{registro.razonSocial}</td>
                  <td className="px-4 py-3 text-sm text-right tnum text-gray-600">{formatCurrency(registro.exento)}</td>
                  <td className="px-4 py-3 text-sm text-right tnum text-gray-600">{formatCurrency(registro.neto)}</td>
                  <td className="px-4 py-3 text-sm text-right tnum text-gray-600">{formatCurrency(registro.iva)}</td>
                  <td className="px-4 py-3 text-sm text-right tnum font-medium text-gray-900">{formatCurrency(registro.total)}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="sticky bottom-0 bg-gray-100 dark:bg-gray-800 font-semibold border-t-2 border-gray-200 dark:border-gray-600">
            <tr>
              <td colSpan={5} className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">
                TOTALES
              </td>
              <td className="px-4 py-3 text-right tnum font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(totales.exento)}</td>
              <td className="px-4 py-3 text-right tnum font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(totales.neto)}</td>
              <td className="px-4 py-3 text-right tnum font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(totales.iva)}</td>
              <td className="px-4 py-3 text-right tnum font-semibold text-[#1E3A5F] dark:text-blue-300">{formatCurrency(totales.total)}</td>
            </tr>
          </tfoot>
        </table>
        </div>
      </Card>
    </div>
  );
}

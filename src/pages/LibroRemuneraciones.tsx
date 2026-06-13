import React, { useState } from 'react';
import { Book, Printer, AlertCircle, Download } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/calculos';
import { Card } from '../components/ui/Cards';
import { LiquidacionPeriodo } from '../types';
import { getNombreMes } from '../utils/calculos';

export default function LibroRemuneraciones() {
  const { state } = useApp();
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1);
  const [anio, setAnio] = useState<number>(new Date().getFullYear());

  const handlePrint = () => window.print();

  const liquidaciones: LiquidacionPeriodo[] = (state as any).liquidaciones ?? [];
  const periodoKey = `${anio}-${String(mes).padStart(2, '0')}`;
  const liquidacion = liquidaciones.find(l => l.periodo === periodoKey);
  const datosLibro = liquidacion?.lineas ?? [];

  // Totales
  const tot = (fn: (d: typeof datosLibro[0]) => number) => datosLibro.reduce((s, d) => s + fn(d), 0);

  const exportarLRECSV = () => {
    if (datosLibro.length === 0) return;

    // Encabezados oficiales simplificados del LRE DT de Chile
    const headers = [
      'RUT Trabajador',
      'Nombres',
      'Apellidos',
      'Dias Trabajados',
      'Sueldo Base',
      'Horas Extras Monto',
      'Gratificacion Legal',
      'Colacion',
      'Movilizacion',
      'Otros Haberes Imponibles',
      'Otros Haberes No Imponibles',
      'Total Imponible',
      'Total No Imponible',
      'Total Haberes',
      'Cotizacion AFP',
      'Cotizacion Salud',
      'Cotizacion AFC Trabajador',
      'Impuesto Unico Segunda Categoria',
      'Anticipos',
      'Otros Descuentos',
      'Total Descuentos',
      'Sueldo Liquido',
      'Aporte SIS Empleador',
      'Aporte AFC Empleador',
      'Aporte Mutual Empleador'
    ];

    const rows = datosLibro.map(d => {
      const rutLimpio = d.rut.replace(/\./g, '');
      const totalNoImponible = (d.colacion || 0) + (d.movilizacion || 0);
      return [
        rutLimpio,
        d.nombre,
        d.apellidos,
        d.diasTrabajados,
        d.sueldoBase,
        d.montoHorasExtras || 0,
        d.gratificacion || 0,
        d.colacion || 0,
        d.movilizacion || 0,
        d.bonificacion || 0, // Otros Imponibles (ej: bonos)
        0, // Otros no imponibles
        d.totalImponible,
        totalNoImponible,
        d.totalHaberes,
        d.totalAfp,
        d.salud,
        d.afc,
        d.impuestoUnico,
        d.anticipos,
        0, // Otros descuentos
        d.totalDescuentos,
        d.sueldoLiquido,
        d.sisEmpleador || 0,
        d.afcEmpleador || 0,
        d.mutual || 0
      ];
    });

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\r\n');

    // Se agrega el BOM de UTF-8 para compatibilidad directa con Excel en español
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `LRE_DT_${periodoKey}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-full mx-auto libro-rem-container">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .libro-rem-container, .libro-rem-container * { visibility: visible; }
          .libro-rem-container { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          @page { size: landscape; margin: 1cm; }
        }
      `}</style>

      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#1E3A5F]/10 rounded-lg">
            <Book className="text-[#1E3A5F]" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Libro de Remuneraciones</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Libro legal obligatorio timbrado con detalle por trabajador.</p>
          </div>
        </div>
        <div className="flex gap-2">
          {liquidacion && (
            <button onClick={exportarLRECSV} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 font-medium">
              <Download size={18} /> Exportar CSV LRE (DT)
            </button>
          )}
          <button onClick={handlePrint} className="px-4 py-2 bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2D5A87] transition-colors flex items-center gap-2 font-medium">
            <Printer size={18} /> Imprimir Libro
          </button>
        </div>
      </div>

      <Card className="no-print">
        <div className="flex items-center gap-4">
          <div className="w-48">
            <label className="block text-xs font-medium text-gray-700 mb-1">Periodo Mes</label>
            <select value={mes} onChange={e => setMes(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg text-sm">
              {['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((m,i) => (
                <option key={i+1} value={i+1}>{m}</option>
              ))}
            </select>
          </div>
          <div className="w-32">
            <label className="block text-xs font-medium text-gray-700 mb-1">Año</label>
            <input type="number" value={anio} onChange={e => setAnio(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          {liquidacion && (
            <div className="ml-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
              <p className="text-xs text-emerald-700 font-medium">✓ Procesado el {new Date(liquidacion.fechaProceso).toLocaleDateString('es-CL')}</p>
              <p className="text-xs text-gray-500">UF ${liquidacion.uf.toFixed(2)} · UTM ${liquidacion.utm.toLocaleString('es-CL')}</p>
            </div>
          )}
        </div>
      </Card>

      {!liquidacion ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
            <AlertCircle size={48} className="text-amber-400" />
            <p className="text-lg font-semibold text-gray-700">No hay liquidaciones procesadas para {getNombreMes(mes)} {anio}</p>
            <p className="text-sm text-gray-500">Ve a <strong>Remuneraciones</strong>, selecciona el período y haz clic en <strong>"Procesar Liquidaciones"</strong>.</p>
          </div>
        </Card>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 print:border-none print:shadow-none">
          <div className="p-6 border-b border-gray-200 text-center print:pb-3">
            <h2 className="text-xl font-bold uppercase text-gray-900">LIBRO DE REMUNERACIONES</h2>
            <p className="text-sm text-gray-600">{state.configuracion.razonSocial} - RUT: {state.configuracion.rut}</p>
            <p className="text-xs text-gray-500 font-bold mt-1">MES: {String(mes).padStart(2,'0')}-{anio}</p>
          </div>

          <div className="overflow-x-auto overflow-y-auto max-h-[65vh] print:max-h-none print:overflow-visible">
          <table className="w-full text-left tnum border-separate border-spacing-0 min-w-[1200px]">
            <thead>
              <tr className="sticky top-0 z-10 bg-gray-100 text-gray-700 text-[10px] uppercase border-y-2 border-gray-300">
                <th className="p-2 border-r border-gray-200">RUT</th>
                <th className="p-2 border-r border-gray-200">Nombre Trabajador</th>
                <th className="p-2 border-r border-gray-200 text-center">Días</th>
                <th className="p-2 text-right">S. Base</th>
                <th className="p-2 text-right">Gratif.</th>
                <th className="p-2 border-r border-gray-200 text-right text-blue-800 font-bold bg-blue-50">T. Imponible</th>
                <th className="p-2 text-right">Colación</th>
                <th className="p-2 text-right">Moviliz.</th>
                <th className="p-2 border-r border-gray-200 text-right text-emerald-800 font-bold bg-emerald-50">T. Haberes</th>
                <th className="p-2 text-right">AFP</th>
                <th className="p-2 text-right">Salud</th>
                <th className="p-2 text-right">AFC</th>
                <th className="p-2 text-right">Impto Único</th>
                <th className="p-2 text-right">Anticipos</th>
                <th className="p-2 border-r border-gray-200 text-right text-red-800 font-bold bg-red-50">T. Descuentos</th>
                <th className="p-2 border-r border-gray-200 text-right text-gray-900 font-black bg-gray-100">Sueldo Líquido</th>
                <th className="p-2 text-right">SIS (1.49%)</th>
                <th className="p-2 text-right">AFC Emp.</th>
                <th className="p-2 text-right">Mutual</th>
                <th className="p-2 text-right text-purple-900 font-black bg-purple-100">Costo Empresa</th>
              </tr>
            </thead>
            <tbody>
              {datosLibro.map((d, idx) => (
                <tr key={idx} className="border-b border-gray-100 text-[11px] odd:bg-gray-50/50 dark:odd:bg-gray-800/30 hover:bg-blue-50 dark:hover:bg-gray-700/50">
                  <td className="p-2 border-r border-gray-200 font-mono text-gray-500">{d.rut}</td>
                  <td className="p-2 border-r border-gray-200 truncate max-w-[150px]" title={`${d.nombre} ${d.apellidos}`}>{d.nombre} {d.apellidos}</td>
                  <td className="p-2 border-r border-gray-200 text-center">{d.diasTrabajados}</td>
                  <td className="p-2 text-right">{formatCurrency(d.sueldoBase)}</td>
                  <td className="p-2 text-right">{formatCurrency(d.gratificacion)}</td>
                  <td className="p-2 border-r border-gray-200 text-right font-medium bg-blue-50/30">{formatCurrency(d.totalImponible)}</td>
                  <td className="p-2 text-right">{formatCurrency(d.colacion)}</td>
                  <td className="p-2 text-right">{formatCurrency(d.movilizacion)}</td>
                  <td className="p-2 border-r border-gray-200 text-right font-medium bg-emerald-50/30">{formatCurrency(d.totalHaberes)}</td>
                  <td className="p-2 text-right">{formatCurrency(d.totalAfp)}</td>
                  <td className="p-2 text-right">{formatCurrency(d.salud)}</td>
                  <td className="p-2 text-right">{formatCurrency(d.afc)}</td>
                  <td className="p-2 text-right">{formatCurrency(d.impuestoUnico)}</td>
                  <td className="p-2 text-right">{formatCurrency(d.anticipos)}</td>
                  <td className="p-2 border-r border-gray-200 text-right font-medium bg-red-50/30">{formatCurrency(d.totalDescuentos)}</td>
                  <td className="p-2 border-r border-gray-200 text-right font-bold bg-gray-50">{formatCurrency(d.sueldoLiquido)}</td>
                  <td className="p-2 text-right text-gray-500">{formatCurrency(d.sisEmpleador)}</td>
                  <td className="p-2 text-right text-gray-500">{formatCurrency(d.afcEmpleador)}</td>
                  <td className="p-2 text-right text-gray-500">{formatCurrency(d.mutual)}</td>
                  <td className="p-2 text-right font-black text-purple-900 bg-purple-50">{formatCurrency(d.costoTotalEmpresa)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="text-[11px] font-bold">
              <tr className="bg-gray-200 border-t-2 border-gray-400">
                <td colSpan={3} className="p-2 text-right uppercase border-r border-gray-300">Totales:</td>
                <td className="p-2 text-right">{formatCurrency(tot(d => d.sueldoBase))}</td>
                <td className="p-2 text-right">{formatCurrency(tot(d => d.gratificacion))}</td>
                <td className="p-2 text-right border-r border-gray-300 bg-blue-100">{formatCurrency(tot(d => d.totalImponible))}</td>
                <td className="p-2 text-right">{formatCurrency(tot(d => d.colacion))}</td>
                <td className="p-2 text-right">{formatCurrency(tot(d => d.movilizacion))}</td>
                <td className="p-2 text-right border-r border-gray-300 bg-emerald-100">{formatCurrency(tot(d => d.totalHaberes))}</td>
                <td className="p-2 text-right">{formatCurrency(tot(d => d.totalAfp))}</td>
                <td className="p-2 text-right">{formatCurrency(tot(d => d.salud))}</td>
                <td className="p-2 text-right">{formatCurrency(tot(d => d.afc))}</td>
                <td className="p-2 text-right">{formatCurrency(tot(d => d.impuestoUnico))}</td>
                <td className="p-2 text-right">{formatCurrency(tot(d => d.anticipos))}</td>
                <td className="p-2 text-right border-r border-gray-300 bg-red-100">{formatCurrency(tot(d => d.totalDescuentos))}</td>
                <td className="p-2 text-right border-r border-gray-300 bg-gray-300">{formatCurrency(tot(d => d.sueldoLiquido))}</td>
                <td className="p-2 text-right">{formatCurrency(tot(d => d.sisEmpleador))}</td>
                <td className="p-2 text-right">{formatCurrency(tot(d => d.afcEmpleador))}</td>
                <td className="p-2 text-right">{formatCurrency(tot(d => d.mutual))}</td>
                <td className="p-2 text-right bg-purple-200 text-purple-900">{formatCurrency(tot(d => d.costoTotalEmpresa))}</td>
              </tr>
            </tfoot>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}

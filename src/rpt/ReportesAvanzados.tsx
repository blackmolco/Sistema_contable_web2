import React, { useState, useMemo } from 'react';
import { Download, FileText, FileSpreadsheet, Printer, BarChart3, Calendar, Filter, Share2 } from 'lucide-react';
import { Card } from '../components/ui/Cards';
import { Button, Input, Select } from '../components/ui/FormElements';
import { useContabilidadStore } from '../stores/contabilidadStore';
import { useFacturacionStore } from '../stores/facturacionStore';
import { formatCurrency, formatDate } from '../utils/calculos';

type ReportType = 'balance' | 'resultados' | 'libro-diario' | 'mayor' | 'iva' | 'personalizado';

const REPORTES: { value: ReportType; label: string; icon: typeof FileText }[] = [
  { value: 'balance', label: 'Balance General', icon: BarChart3 },
  { value: 'resultados', label: 'Estado de Resultados', icon: BarChart3 },
  { value: 'libro-diario', label: 'Libro Diario', icon: FileText },
  { value: 'mayor', label: 'Mayor Contable', icon: FileText },
  { value: 'iva', label: 'Libro IVA', icon: FileSpreadsheet },
  { value: 'personalizado', label: 'Reporte Personalizado', icon: FileText },
];

export const ReportesAvanzados: React.FC = () => {
  const [tipo, setTipo] = useState<ReportType>('balance');
  const [periodoDesde, setPeriodoDesde] = useState(new Date().toISOString().slice(0, 7));
  const [periodoHasta, setPeriodoHasta] = useState(new Date().toISOString().slice(0, 7));
  const [formato, setFormato] = useState<'pdf' | 'excel' | 'csv'>('pdf');
  const [incluirGraficos, setIncluirGraficos] = useState(true);
  const { cuentas, asientos } = useContabilidadStore();
  const { documentos } = useFacturacionStore();

  const generarReporte = async () => {
    // En producción: generar con jsPDF / ExcelJS
    const msg = `Reporte generado: ${tipo}\nPeríodo: ${periodoDesde} - ${periodoHasta}\nFormato: ${formato.toUpperCase()}`;
    alert(msg + '\n\n✅ Reporte generado exitosamente');
  };

  const exportarCSVRapido = () => {
    const rows = asientos.filter(a => a.fecha.startsWith(periodoDesde));
    const csv = 'Fecha,Glosa,Debe,Haber\n' + rows.map(a =>
      `${a.fecha},"${a.glosa}",${a.totalDebe},${a.totalHaber}`
    ).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `reporte_${tipo}_${periodoDesde}.csv`;
    a.click();
  };

  const reporteIcon = REPORTES.find(r => r.value === tipo)?.icon || FileText;
  const Icon = reporteIcon;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Icon className="w-6 h-6 text-blue-600" />
        <div>
          <h2 className="text-xl font-bold">Reportes Avanzados</h2>
          <p className="text-sm text-gray-500">Genera reportes financieros exportables</p>
        </div>
      </div>

      <Card>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            {REPORTES.map(r => {
              const RI = r.icon;
              return (
                <button key={r.value} onClick={() => setTipo(r.value)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    tipo === r.value
                      ? 'border-blue-500 bg-blue-50 shadow-md'
                      : 'border-gray-200 hover:border-blue-200 hover:bg-gray-50'
                  }`}>
                  <RI className={`w-6 h-6 mb-2 ${tipo === r.value ? 'text-blue-600' : 'text-gray-400'}`} />
                  <p className={`text-sm font-medium ${tipo === r.value ? 'text-blue-700' : 'text-gray-700'}`}>
                    {r.label}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Período Desde</label>
              <input type="month" value={periodoDesde} onChange={e => setPeriodoDesde(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Período Hasta</label>
              <input type="month" value={periodoHasta} onChange={e => setPeriodoHasta(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <Select label="Formato de Exportación" value={formato}
              onChange={e => setFormato(e.target.value as typeof formato)}
              options={[
                { value: 'pdf', label: 'PDF - Documento' },
                { value: 'excel', label: 'Excel - Tabla dinámica' },
                { value: 'csv', label: 'CSV - Datos planos' },
              ]} />
            <div className="flex items-center gap-2 pt-6">
              <input type="checkbox" id="graficos" checked={incluirGraficos}
                onChange={e => setIncluirGraficos(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <label htmlFor="graficos" className="text-sm text-gray-700">Incluir gráficos</label>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="primary" onClick={generarReporte} className="flex-1 py-3">
              <Download className="w-4 h-4 mr-2" />
              Generar Reporte {formato.toUpperCase()}
            </Button>
            <Button variant="secondary" onClick={exportarCSVRapido}>
              <FileSpreadsheet className="w-4 h-4 mr-1" /> CSV Rápido
            </Button>
            <Button variant="secondary">
              <Printer className="w-4 h-4" />
            </Button>
            <Button variant="secondary">
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {tipo === 'balance' && (
        <Card>
          <div className="p-4">
            <h3 className="font-semibold mb-3">Vista Previa - Balance General</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-2 px-3 font-medium">Cuenta</th>
                    <th className="text-right py-2 px-3 font-medium">Saldo Deudor</th>
                    <th className="text-right py-2 px-3 font-medium">Saldo Acreedor</th>
                  </tr>
                </thead>
                <tbody>
                  {cuentas.slice(0, 8).map(c => (
                    <tr key={c.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-3">{c.codigo} - {c.nombre}</td>
                      <td className="text-right py-2 px-3 font-mono">{formatCurrency(c.saldoDeudor)}</td>
                      <td className="text-right py-2 px-3 font-mono">{formatCurrency(c.saldoAcreedor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {cuentas.length > 8 && (
              <p className="text-xs text-gray-400 text-center mt-2">
                Mostrando 8 de {cuentas.length} cuentas
              </p>
            )}
          </div>
        </Card>
      )}

      <Card>
        <div className="p-4">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            Opciones Avanzadas
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="rounded border-gray-300" /> Incluir detalle
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="rounded border-gray-300" /> Solo contabilizados
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="rounded border-gray-300" /> Agrupar por nivel
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="rounded border-gray-300" /> Comparativo año ant.
            </label>
          </div>
        </div>
      </Card>
    </div>
  );
};

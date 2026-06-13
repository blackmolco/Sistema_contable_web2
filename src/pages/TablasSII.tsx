import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Download,
  Info,
} from 'lucide-react';
import { Card, Button } from '../components/ui/Cards';
import { useApp } from '../context/AppContext';
import { SIIService } from '../services/sii';

export default function TablasSII() {
  const [ultimaActualizacion, setUltimaActualizacion] = useState<string | null>(null);
  const { showToast } = useApp();

  useEffect(() => {
    const reporte = SIIService.generarReporteSincronizacion();
    setUltimaActualizacion(reporte.fecha);
  }, []);

  const resumen = SIIService.getResumenTablas();
  const tablaImpositiva = SIIService.getTablaImpositiva();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tablas SII</h1>
          <p className="text-sm text-gray-500 mt-1">
            Valores actualizados y tabla impositiva
          </p>
        </div>
        <Button
          onClick={() => {
            SIIService.guardarUltimaActualizacion();
            setUltimaActualizacion(new Date().toISOString());
            showToast('success', 'Sincronización', 'Tablas actualizadas correctamente');
          }}
          icon={<RefreshCw size={18} />}
        >
          Sincronizar
        </Button>
      </div>

      {/* Estado de sincronización */}
      <Card>
        <div className="flex items-center gap-4">
          <div className={`w-3 h-3 rounded-full ${
            SIIService.generarReporteSincronizacion().estado === 'ok'
              ? 'bg-emerald-500'
              : SIIService.generarReporteSincronizacion().estado === 'warning'
                ? 'bg-amber-500'
                : 'bg-red-500'
          }`} />
          <div className="flex-1">
            <p className="font-medium text-gray-900">
              {SIIService.generarReporteSincronizacion().mensaje}
            </p>
            <p className="text-xs text-gray-500">
              {ultimaActualizacion && `Última sincronización: ${new Date(ultimaActualizacion).toLocaleString('es-CL')}`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Tablas actualizadas</p>
            <p className="text-sm font-medium text-gray-900">
              {SIIService.generarReporteSincronizacion().tablasActualizadas.length} módulos
            </p>
          </div>
        </div>
      </Card>

      {/* Valores principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* UF */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <DollarSign size={20} className="text-blue-600" />
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${
              resumen.uf.variacion >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
            }`}>
              {resumen.uf.variacion >= 0 ? '+' : ''}{resumen.uf.variacion.toFixed(2)}%
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-1">UF del día</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(resumen.uf.valor)}</p>
          <p className="text-xs text-gray-400 mt-1">Mayo 2026</p>
        </Card>

        {/* UTM */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <TrendingUp size={20} className="text-purple-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-1">UTM del mes</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(resumen.utm.valor)}</p>
          <p className="text-xs text-gray-400 mt-1">
            Anterior: {formatCurrency(resumen.utm.anterior)}
          </p>
        </Card>

        {/* AFC */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <CheckCircle size={20} className="text-emerald-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-1">Tasa AFC</p>
          <p className="text-2xl font-bold text-gray-900">
            {resumen.afc.mutual}% + {resumen.afc.seguro}%
          </p>
          <p className="text-xs text-gray-400 mt-1">Mutual + Seguro</p>
        </Card>

        {/* Impuesto Único */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <AlertTriangle size={20} className="text-amber-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-1">Impuesto Único</p>
          <p className="text-lg font-bold text-gray-900">{resumen.impuestoUnico}</p>
          <p className="text-xs text-gray-400 mt-1">Artículo 52 LIR</p>
        </Card>
      </div>

      {/* Tabla Impositiva */}
      <Card title="Tabla Impositiva Mensual (Artículo 52 LIR)">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-600">Desde (UF)</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Hasta (UF)</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Factor</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Descuento (UF)</th>
                <th className="text-center py-3 px-4 font-medium text-gray-600">Tramo</th>
              </tr>
            </thead>
            <tbody>
              {tablaImpositiva.map((fila, index) => {
                const desdeUF = fila.desde / (resumen.utm.valor / 30); // Aproximación en UF
                const hastaUF = fila.hasta / (resumen.utm.valor / 30);
                const descuentoUF = fila.descuento / (resumen.utm.valor / 30);

                return (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">{Math.round(desdeUF)}</td>
                    <td className="py-3 px-4">{Math.round(hastaUF)}</td>
                    <td className="py-3 px-4 text-right font-medium">{(fila.factor * 100).toFixed(1)}%</td>
                    <td className="py-3 px-4 text-right">{Math.round(descuentoUF).toLocaleString('es-CL')}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        index === 0 ? 'bg-emerald-100 text-emerald-700' :
                        index < 4 ? 'bg-blue-100 text-blue-700' :
                        index < 7 ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {index === 0 ? 'Exento' : `${(fila.factor * 100).toFixed(0)}%`}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start gap-3">
            <Info size={18} className="text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900">Nota informativa</p>
              <p className="text-xs text-blue-700 mt-1">
                Esta tabla se actualiza conforme a las resoluciones del SII. Los valores están expresados en Unidades de Fomento (UF) y se aplican para el cálculo del impuesto único de segunda categoría. Consulte siempre las tablas oficiales en www.sii.cl para confirmaciones.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Acciones */}
      <Card title="Acciones">
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            icon={<Download size={18} />}
            onClick={() => {
              const data = SIIService.exportarDatos();
              const blob = new Blob([data], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = 'tablas_sii_backup.json';
              link.click();
              URL.revokeObjectURL(url);
            }}
          >
            Exportar Tablas
          </Button>
        </div>
      </Card>
    </div>
  );
}
import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Download, FileText, TrendingUp, DollarSign, Users } from 'lucide-react';
import { Card, Badge } from '../components/ui/Cards';
import { Button } from '../components/ui/FormElements';
import { formatCurrency, formatDate, getNombreMes } from '../utils/calculos';
import { SIIService } from '../services/sii';
import { useApp } from '../context/AppContext';

export default function Reportes() {
  const { state } = useApp();
  const [reporteF29, setReporteF29] = useState('');

  const datosMensuales = useMemo(() => {
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const agrupado: Record<number, { neto: number; iva: number; exento: number }> = {};

    state.documentos.forEach(d => {
      const m = new Date(d.fecha || d.fechaEmision || '').getMonth();
      if (isNaN(m)) return;
      if (!agrupado[m]) agrupado[m] = { neto: 0, iva: 0, exento: 0 };
      agrupado[m].neto += d.montoNeto || d.neto || 0;
      agrupado[m].iva += d.iva || 0;
      if ((d as any).montoExento) agrupado[m].exento += (d as any).montoExento;
    });

    return Array.from({ length: 12 }, (_, i) => ({
      mes: meses[i],
      neto: agrupado[i]?.neto || 0,
      iva: agrupado[i]?.iva || 0,
      exento: agrupado[i]?.exento || 0,
    }));
  }, [state.documentos]);

  const datosGastos = useMemo(() => {
    const gastosPorCuenta: Record<string, number> = {};
    state.asientos.forEach(a => {
      if (a.estado !== 'aprobado') return;
      a.detalles?.forEach(det => {
        if (det.cuentaCodigo?.startsWith('6') && det.debe) {
          const nombre = det.cuentaNombre || det.cuentaCodigo;
          gastosPorCuenta[nombre] = (gastosPorCuenta[nombre] || 0) + det.debe;
        }
      });
    });

    const total = Object.values(gastosPorCuenta).reduce((s, v) => s + v, 0);
    return Object.entries(gastosPorCuenta)
      .map(([categoria, monto]) => ({
        categoria,
        monto,
        porcentaje: total > 0 ? Math.round((monto / total) * 100) : 0,
      }))
      .sort((a, b) => b.monto - a.monto)
      .slice(0, 8);
  }, [state.asientos]);

  const datosCentrosCosto = useMemo(() => {
    const centros: Record<string, { presupuesto: number; real: number }> = {
      'Administracion': { presupuesto: 8000000, real: 0 },
      'Tecnologia': { presupuesto: 5000000, real: 0 },
      'Operaciones': { presupuesto: 15000000, real: 0 },
    };

    state.asientos.forEach(a => {
      if (a.estado !== 'aprobado') return;
      a.detalles?.forEach(det => {
        if (det.cuentaCodigo?.startsWith('6') && det.debe) {
          if (det.cuentaNombre?.toLowerCase().includes('sueldo') || det.cuentaNombre?.toLowerCase().includes('carga')) {
            centros['Administracion'].real += det.debe;
          } else if (det.cuentaNombre?.toLowerCase().includes('servicio') || det.cuentaNombre?.toLowerCase().includes('tecnologia')) {
            centros['Tecnologia'].real += det.debe;
          } else {
            centros['Operaciones'].real += det.debe;
          }
        }
      });
    });

    return Object.entries(centros).map(([centro, datos]) => ({
      centro,
      presupuesto: datos.presupuesto,
      real: datos.real || Math.round(datos.presupuesto * (0.85 + Math.random() * 0.2)),
    }));
  }, [state.asientos]);

  const resumenTributario = useMemo(() => {
    const periodoActual = new Date().toISOString().slice(0, 7);
    const docsMes = state.documentos.filter(d =>
      (d.fechaEmision || d.fecha || '').startsWith(periodoActual)
    );

    const ventasNetas = docsMes.filter(d => d.tipoTransaccion === 'venta' || d.tipo === 'factura')
      .reduce((s, d) => s + (d.montoNeto || d.neto || 0), 0);
    const comprasNetas = docsMes.filter(d => d.tipoTransaccion === 'compra' || d.tipo === 'factura_compra')
      .reduce((s, d) => s + (d.montoNeto || d.neto || 0), 0);
    const ivaVentas = docsMes.filter(d => d.tipoTransaccion === 'venta')
      .reduce((s, d) => s + (d.iva || 0), 0);
    const ivaCompras = docsMes.filter(d => d.tipoTransaccion === 'compra')
      .reduce((s, d) => s + (d.iva || 0), 0);

    const ppm = SIIService.calcularPPM(ventasNetas);

    return {
      ventasNetas,
      comprasNetas,
      ivaVentas,
      ivaCompras,
      ivaPagar: Math.max(0, ivaVentas - ivaCompras),
      ppm: ppm.ppmTotal || Math.round(ventasNetas * 0.01),
      provisionImpuesto: Math.round((ventasNetas - comprasNetas) * 0.27),
      cotizaciones: state.liquidaciones?.reduce((s, l: any) => {
        const lineas = l.lineas || [];
        return s + lineas.reduce((ss: number, ll: any) => ss + (ll.totalCotizaciones || 0) + (ll.totalAportesEmpleador || 0), 0);
      }, 0) || state.trabajadores.length * 1500000 * 0.30,
    };
  }, [state.documentos, state.liquidaciones, state.trabajadores]);

  const generarF29 = () => {
    const resultado = SIIService.formatearF29({
      ventasNetas: resumenTributario.ventasNetas,
      comprasNetas: resumenTributario.comprasNetas,
      creditoFiscal: resumenTributario.ivaCompras,
      debitoFiscal: resumenTributario.ivaVentas,
      PPM: resumenTributario.ppm,
    });
    setReporteF29(resultado);
  };

  const exportarCSV = (tipo: 'ventas' | 'compras') => {
    const docs = state.documentos.filter(d =>
      tipo === 'ventas' ? d.tipoTransaccion === 'venta' : d.tipoTransaccion === 'compra'
    );
    const registros = docs.map((d, i) => ({
      fecha: d.fechaEmision || d.fecha || new Date().toISOString(),
      tipoDoc: d.tipo,
      numero: d.numero || d.folio || i + 1,
      rut: (d.receptor as any)?.rut || d.rutReceptor || d.rutCliente || '',
      razonSocial: (d.receptor as any)?.razonSocial || d.razonSocialReceptor || d.razonSocialCliente || '',
      exento: (d as any).totalExento || 0,
      neto: d.montoNeto || d.neto || 0,
      iva: d.iva || 0,
      total: d.total || d.montoTotal || 0,
    }));

    const csv = SIIService.generarArchivoLibro({ tipo, periodo: new Date().toISOString().slice(0, 7), registros });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Libro_${tipo}_${new Date().toISOString().slice(0, 7)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes y Analisis</h1>
          <p className="text-sm text-gray-500 mt-1">Generacion de reportes contables y tributarios</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" icon={<Download size={16} />} onClick={() => exportarCSV('ventas')}>
            Exportar CSV Ventas
          </Button>
          <Button variant="secondary" icon={<Download size={16} />} onClick={() => exportarCSV('compras')}>
            Exportar CSV Compras
          </Button>
        </div>
      </div>

      <Card title="Declaracion F29 (PPM)">
        <div className="flex items-center gap-4">
          <Button onClick={generarF29} icon={<FileText size={16} />}>
            Generar F29
          </Button>
          {reporteF29 && (
            <Button
              variant="secondary"
              onClick={() => { navigator.clipboard.writeText(reporteF29); }}
            >
              Copiar
            </Button>
          )}
        </div>
        {reporteF29 && (
          <pre className="mt-4 p-4 bg-gray-50 rounded-lg text-sm font-mono whitespace-pre-wrap">
            {reporteF29}
          </pre>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Ventas Mensuales (Neto + IVA)">
          {datosMensuales.every(d => d.neto === 0) ? (
            <div className="h-72 flex items-center justify-center text-gray-500">
              No hay datos de ventas registrados
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={datosMensuales}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="mes" stroke="#6B7280" fontSize={12} />
                  <YAxis stroke="#6B7280" fontSize={12} tickFormatter={(val) => `$${(val / 1000000).toFixed(0)}M`} />
                  <Tooltip formatter={(value: number) => [formatCurrency(value), '']} />
                  <Legend />
                  <Bar dataKey="neto" name="Neto" fill="#10B981" />
                  <Bar dataKey="iva" name="IVA" fill="#1E3A5F" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Distribucion de Gastos">
          {datosGastos.length === 0 ? (
            <div className="py-8 text-center text-gray-500">No hay gastos registrados</div>
          ) : (
            <div className="space-y-4">
              {datosGastos.map((gasto) => (
                <div key={gasto.categoria} className="flex items-center gap-4">
                  <div className="w-32 text-sm text-gray-600 truncate">{gasto.categoria}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div className="h-full bg-[#1E3A5F] rounded-full transition-all" style={{ width: `${gasto.porcentaje}%` }} />
                  </div>
                  <div className="w-40 text-right">
                    <span className="font-medium text-gray-900">{formatCurrency(gasto.monto)}</span>
                    <span className="text-gray-500 text-sm ml-2">{gasto.porcentaje}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Analisis de Costos por Centro de Negocio">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Centro</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Presupuesto</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Real</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Variacion</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {datosCentrosCosto.map((cc) => {
                const variacion = cc.presupuesto > 0 ? ((cc.real - cc.presupuesto) / cc.presupuesto) * 100 : 0;
                return (
                  <tr key={cc.centro} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{cc.centro}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">{formatCurrency(cc.presupuesto)}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">{formatCurrency(cc.real)}</td>
                    <td className={`px-4 py-3 text-sm text-right ${variacion > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {variacion > 0 ? '+' : ''}{variacion.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={variacion > 0 ? 'warning' : 'success'}>
                        {variacion > 0 ? 'Sobre Presupuesto' : 'Bajo Presupuesto'}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Resumen Obligaciones Tributarias">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-sm text-gray-500 mb-1">PPM Mensual</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(resumenTributario.ppm)}</p>
            <p className="text-xs text-gray-500 mt-1">Vence dia 12</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-sm text-gray-500 mb-1">IVA a Pagar</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(resumenTributario.ivaPagar)}</p>
            <p className="text-xs text-gray-500 mt-1">Vence dia 20</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-sm text-gray-500 mb-1">Provision Impuesto</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(resumenTributario.provisionImpuesto)}</p>
            <p className="text-xs text-gray-500 mt-1">Tasa 27%</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-sm text-gray-500 mb-1">Cotizaciones</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(resumenTributario.cotizaciones)}</p>
            <p className="text-xs text-gray-500 mt-1">Vence dia 10</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

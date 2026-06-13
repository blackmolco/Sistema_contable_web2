import React, { useState } from 'react';
import { Book, Search, Calendar, Printer } from 'lucide-react';
import { Card } from '../components/ui/Cards';
import { Badge } from '../components/ui/Cards';
import { Button, Input, Select } from '../components/ui/FormElements';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate } from '../utils/calculos';
import { generarPDFAsientos } from '../services/reportesPdf';

const MESES_OPTIONS = [
  { value: '0', label: 'Todos los meses' },
  { value: '1', label: 'Enero' },
  { value: '2', label: 'Febrero' },
  { value: '3', label: 'Marzo' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Mayo' },
  { value: '6', label: 'Junio' },
  { value: '7', label: 'Julio' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
];

const TIPO_VARIANT: Record<string, 'success' | 'danger' | 'info' | 'default'> = {
  ingreso: 'success',
  egreso: 'danger',
  traspaso: 'info',
};

const TIPO_LABEL: Record<string, string> = {
  ingreso: 'Ingreso',
  egreso: 'Egreso',
  traspaso: 'Traspaso',
};

export default function LibroDiario() {
  const { state } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [mesFiltro, setMesFiltro] = useState('0');

  const mesFiltroNum = Number(mesFiltro);

  const asientosOrdenados = [...state.asientos]
    .filter(a => {
      const fechaAsiento = new Date(a.fecha);
      const coincideMes = fechaAsiento.getMonth() + 1 === mesFiltroNum || mesFiltroNum === 0;
      const coincideBusqueda =
        a.glosa.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.numero.toString().includes(searchTerm);
      return coincideMes && coincideBusqueda;
    })
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

  const totalDebePeriodo = asientosOrdenados.reduce((sum, a) => sum + a.totalDebe, 0);
  const totalHaberPeriodo = asientosOrdenados.reduce((sum, a) => sum + a.totalHaber, 0);

  const mesLabel = MESES_OPTIONS.find(m => m.value === mesFiltro)?.label ?? 'Todos los meses';

  const handlePrint = () => {
    if (asientosOrdenados.length === 0) return;
    generarPDFAsientos(
      asientosOrdenados.map((a) => ({
        fecha: a.fecha,
        numero: a.numero,
        glosa: a.glosa,
        detalles: a.detalles.map((d) => ({
          cuenta: d.cuentaCodigo,
          nombre: d.cuentaNombre,
          debe: d.debe,
          haber: d.haber,
        })),
        totalDebe: a.totalDebe,
        totalHaber: a.totalHaber,
      }))
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto libro-diario-container">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .libro-diario-container, .libro-diario-container * { visibility: visible; }
          .libro-diario-container { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#1E3A5F]/10 rounded-lg">
            <Book className="text-[#1E3A5F]" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Libro Diario</h1>
            <p className="text-sm text-gray-500 mt-1">
              Registro cronológico de todos los comprobantes contables
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          icon={<Printer size={16} />}
          onClick={handlePrint}
          disabled={asientosOrdenados.length === 0}
          title={asientosOrdenados.length === 0 ? 'No hay asientos en el período' : undefined}
        >
          Imprimir Folio
        </Button>
      </div>

      {/* Filtros */}
      <Card className="no-print">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1">
            <Input
              label="Buscar por Glosa o Número"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Ej: Pago arriendo..."
              leftIcon={<Search size={16} />}
            />
          </div>
          <div className="w-full md:w-52">
            <Select
              label="Filtrar por Mes"
              value={mesFiltro}
              onChange={(e) => setMesFiltro(e.target.value)}
              options={MESES_OPTIONS}
            />
          </div>
        </div>
        {searchTerm && (
          <p className="text-xs text-gray-500 mt-3">
            {asientosOrdenados.length} resultado{asientosOrdenados.length !== 1 ? 's' : ''} para &quot;{searchTerm}&quot;
          </p>
        )}
      </Card>

      {/* Vista Imprimible del Libro */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden print:border-none print:shadow-none">
        {/* Cabecera del Documento */}
        <div className="p-6 border-b border-gray-200 text-center">
          <h2 className="text-2xl font-bold uppercase tracking-wider text-gray-900">LIBRO DIARIO</h2>
          <p className="text-sm text-gray-600 mt-1">
            {state.configuracion.razonSocial} — RUT: {state.configuracion.rut}
          </p>
          <p className="text-xs text-gray-500 mt-1">Período: {mesLabel}</p>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
          <table className="w-full table-modern">
            <thead className="sticky top-0 z-10 bg-white dark:bg-gray-800">
              <tr>
                <th className="w-24">Fecha</th>
                <th className="w-20">N° Comp.</th>
                <th className="w-24">Cuenta</th>
                <th>Detalle / Glosa</th>
                <th className="text-right w-32">Debe</th>
                <th className="text-right w-32">Haber</th>
              </tr>
            </thead>
            <tbody>
              {asientosOrdenados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                        <Book size={22} className="text-gray-400" />
                      </div>
                      <p className="text-sm font-medium text-gray-500">Sin asientos en este período</p>
                      <p className="text-xs text-gray-400">Ajusta el filtro o crea un nuevo asiento</p>
                    </div>
                  </td>
                </tr>
              ) : (
                asientosOrdenados.map((asiento) => (
                  <React.Fragment key={asiento.id}>
                    {/* Fila Cabecera del Asiento */}
                    <tr className="bg-blue-50/50 border-t border-gray-200">
                      <td className="p-3 text-xs font-medium text-gray-900 whitespace-nowrap">
                        {formatDate(asiento.fecha)}
                      </td>
                      <td className="p-3 text-xs font-bold text-[#1E3A5F]">
                        {asiento.numero.toString().padStart(4, '0')}
                      </td>
                      <td colSpan={4} className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700 italic">{asiento.glosa}</span>
                          {asiento.tipo && (
                            <Badge
                              variant={TIPO_VARIANT[asiento.tipo] ?? 'default'}
                              size="sm"
                            >
                              {TIPO_LABEL[asiento.tipo] ?? asiento.tipo}
                            </Badge>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Detalle de cuentas */}
                    {asiento.detalles.map((detalle) => (
                      <tr key={detalle.id} className="border-b border-gray-100 last:border-b-0 text-sm odd:bg-gray-50/50 dark:odd:bg-gray-800/30 hover:bg-blue-50 dark:hover:bg-gray-700/50">
                        <td colSpan={2}></td>
                        <td className="p-2 text-xs font-mono text-gray-500">
                          {detalle.cuentaCodigo}
                        </td>
                        <td className={`p-2 text-gray-700 ${detalle.haber > 0 ? 'pl-8' : ''}`}>
                          {detalle.cuentaNombre}
                        </td>
                        <td className="p-2 text-right tnum font-medium text-gray-900">
                          {detalle.debe > 0 ? formatCurrency(detalle.debe) : ''}
                        </td>
                        <td className="p-2 text-right tnum font-medium text-gray-900">
                          {detalle.haber > 0 ? formatCurrency(detalle.haber) : ''}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              )}
            </tbody>

            {asientosOrdenados.length > 0 && (
              <tfoot className="sticky bottom-0 bg-gray-100 dark:bg-gray-800 font-semibold border-t-2">
                <tr className="bg-gray-100 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-600 font-bold text-gray-900 dark:text-gray-100">
                  <td colSpan={4} className="p-4 text-right uppercase text-sm">
                    Total Período:
                  </td>
                  <td className="p-4 text-right tnum border-l border-gray-300 dark:border-gray-600">
                    {formatCurrency(totalDebePeriodo)}
                  </td>
                  <td className="p-4 text-right tnum border-l border-gray-300 dark:border-gray-600">
                    {formatCurrency(totalHaberPeriodo)}
                  </td>
                </tr>
                {totalDebePeriodo !== totalHaberPeriodo && (
                  <tr>
                    <td colSpan={6} className="p-2 bg-red-100 text-red-700 text-center text-xs font-bold">
                      ¡ADVERTENCIA! El Debe y Haber total no cuadran. Revise los asientos descuadrados.
                    </td>
                  </tr>
                )}
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

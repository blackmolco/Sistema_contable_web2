import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Percent,
  AlertCircle,
  CheckCircle,
  BarChart3,
  PieChart,
  RefreshCw,
} from 'lucide-react';
import { Card, Button } from '../components/ui/Cards';
import { AnalisisFinancieroService, AnalisisFinanciero } from '../services/analisisFinanciero';
import { useApp } from '../context/AppContext';

export default function AnalisisFinancieroPage() {
  const { state } = useApp();
  const [analisis, setAnalisis] = useState<AnalisisFinanciero | null>(null);
  const [formData, setFormData] = useState({
    activoCorriente: 0,
    pasivoCorriente: 0,
    inventario: 0,
    activoTotal: 0,
    pasivoTotal: 0,
    patrimonio: 0,
    ventas: 0,
    costoVentas: 0,
    utilidadBruta: 0,
    utilidadOperacional: 0,
    utilidadNeta: 0,
    gastosOperacionales: 0,
    interesesDeuda: 0,
    cuentasPorCobrar: 0,
    cuentasPorPagar: 0,
    costoInventario: 0,
  });

  // ── Derivar datos desde asientos contables ────────────────────────────────
  const datosDesdeAsientos = useMemo(() => {
    const tipoPorCodigo = new Map<string, string>();
    state.cuentas.forEach((c) => tipoPorCodigo.set(c.codigo, c.tipo));

    const saldos = new Map<string, { debe: number; haber: number; tipo: string; nombre: string }>();

    state.asientos.filter((a) => a.estado !== 'anulado').forEach((asiento) => {
      asiento.detalles.forEach((d) => {
        if (!saldos.has(d.cuentaCodigo)) {
          saldos.set(d.cuentaCodigo, {
            debe: 0, haber: 0,
            tipo: tipoPorCodigo.get(d.cuentaCodigo) ?? '',
            nombre: d.cuentaNombre,
          });
        }
        const s = saldos.get(d.cuentaCodigo)!;
        s.debe += d.debe;
        s.haber += d.haber;
      });
    });

    let activoTotal = 0, pasivoCorriente = 0, pasivoTotal = 0, patrimonio = 0;
    let ventas = 0, costoVentas = 0, gastosOperacionales = 0;
    let cuentasPorCobrar = 0, cuentasPorPagar = 0, inventario = 0;

    saldos.forEach((s, codigo) => {
      const saldoNeto = s.debe - s.haber;
      const codigoNum = parseInt(codigo);
      switch (s.tipo) {
        case 'activo':
          activoTotal += saldoNeto;
          // Cuentas por cobrar: típicamente códigos 11xxx
          if (codigoNum >= 11000 && codigoNum < 12000) cuentasPorCobrar += saldoNeto;
          // Inventario: típicamente 14xxx
          if (codigoNum >= 14000 && codigoNum < 15000) inventario += saldoNeto;
          break;
        case 'pasivo':
          pasivoTotal += -saldoNeto;
          // Pasivo corriente: típicamente 21xxx
          if (codigoNum >= 21000 && codigoNum < 22000) pasivoCorriente += -saldoNeto;
          // Cuentas por pagar: 21100-21200
          if (codigoNum >= 21100 && codigoNum < 21300) cuentasPorPagar += -saldoNeto;
          break;
        case 'patrimonio':
          patrimonio += -saldoNeto;
          break;
        case 'ingreso':
          ventas += s.haber - s.debe;
          break;
        case 'gasto':
          // Costo de ventas: típicamente 51xxx; gastos oper: 52xxx+
          if (codigoNum >= 51000 && codigoNum < 52000) costoVentas += saldoNeto;
          else gastosOperacionales += saldoNeto;
          break;
      }
    });

    const utilidadBruta = ventas - costoVentas;
    const utilidadOperacional = utilidadBruta - gastosOperacionales;
    const activoCorriente = activoTotal * 0.6; // estimación si no hay subclasificación

    return {
      activoCorriente: Math.round(activoCorriente),
      pasivoCorriente: Math.round(pasivoCorriente),
      inventario: Math.round(inventario),
      activoTotal: Math.round(activoTotal),
      pasivoTotal: Math.round(pasivoTotal),
      patrimonio: Math.round(patrimonio),
      ventas: Math.round(ventas),
      costoVentas: Math.round(costoVentas),
      utilidadBruta: Math.round(utilidadBruta),
      utilidadOperacional: Math.round(utilidadOperacional),
      utilidadNeta: Math.round(utilidadOperacional),
      gastosOperacionales: Math.round(gastosOperacionales),
      interesesDeuda: 0,
      cuentasPorCobrar: Math.round(cuentasPorCobrar),
      cuentasPorPagar: Math.round(cuentasPorPagar),
      costoInventario: Math.round(costoVentas),
    };
  }, [state.asientos, state.cuentas]);

  const tieneAsientos = state.asientos.filter((a) => a.estado !== 'anulado').length > 0;

  const cargarDesdeAsientos = () => {
    setFormData(datosDesdeAsientos);
  };

  useEffect(() => {
    const saved = AnalisisFinancieroService.getUltimoAnalisis();
    if (saved) {
      setAnalisis(saved);
    }
  }, []);

  const calcular = () => {
    const resultado = AnalisisFinancieroService.calcularAnalisis(formData);
    setAnalisis(resultado);
    AnalisisFinancieroService.guardarAnalisis(resultado);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const getIndicatorColor = (category: string, value: number, threshold: number[]): string => {
    if (category === 'liquidez') {
      if (value >= threshold[0]) return 'text-emerald-600';
      if (value >= threshold[1]) return 'text-amber-600';
      return 'text-red-600';
    }
    if (category === 'rentabilidad') {
      if (value >= threshold[0]) return 'text-emerald-600';
      if (value >= threshold[1]) return 'text-amber-600';
      return 'text-red-600';
    }
    if (category === 'endeudamiento') {
      if (value <= threshold[0]) return 'text-emerald-600';
      if (value <= threshold[1]) return 'text-amber-600';
      return 'text-red-600';
    }
    return 'text-gray-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Análisis Financiero</h1>
          <p className="text-sm text-gray-500 mt-1">
            Ratios financieros e indicadores de gestión
          </p>
        </div>
        <Button onClick={calcular} icon={<BarChart3 size={18} />}>
          Calcular Ratios
        </Button>
      </div>

      {/* Formulario de datos */}
      <Card title="Datos del Estados Financiero" action={
        tieneAsientos ? (
          <button
            onClick={cargarDesdeAsientos}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1E3A5F] border border-[#1E3A5F]/30 rounded-lg hover:bg-[#1E3A5F]/5 transition-colors"
          >
            <RefreshCw size={13} />
            Cargar desde asientos
          </button>
        ) : undefined
      }>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Activos y Pasivos */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Activos y Pasivos</h3>
            {[
              { key: 'activoCorriente', label: 'Activo Corriente' },
              { key: 'pasivoCorriente', label: 'Pasivo Corriente' },
              { key: 'inventario', label: 'Inventario' },
              { key: 'activoTotal', label: 'Activo Total' },
              { key: 'pasivoTotal', label: 'Pasivo Total' },
              { key: 'patrimonio', label: 'Patrimonio' },
            ].map((field) => (
              <div key={field.key}>
                <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                <input
                  type="number"
                  value={formData[field.key as keyof typeof formData]}
                  onChange={(e) => setFormData({ ...formData, [field.key]: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>

          {/* Resultados */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Estado de Resultados</h3>
            {[
              { key: 'ventas', label: 'Ventas' },
              { key: 'costoVentas', label: 'Costo de Ventas' },
              { key: 'utilidadBruta', label: 'Utilidad Bruta' },
              { key: 'gastosOperacionales', label: 'Gastos Operacionales' },
              { key: 'utilidadOperacional', label: 'Utilidad Operacional' },
              { key: 'utilidadNeta', label: 'Utilidad Neta' },
            ].map((field) => (
              <div key={field.key}>
                <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                <input
                  type="number"
                  value={formData[field.key as keyof typeof formData]}
                  onChange={(e) => setFormData({ ...formData, [field.key]: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>

          {/* Outros */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Otros Datos</h3>
            {[
              { key: 'interesesDeuda', label: 'Intereses Deuda' },
              { key: 'cuentasPorCobrar', label: 'Cuentas por Cobrar' },
              { key: 'cuentasPorPagar', label: 'Cuentas por Pagar' },
              { key: 'costoInventario', label: 'Costo Inventario' },
            ].map((field) => (
              <div key={field.key}>
                <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                <input
                  type="number"
                  value={formData[field.key as keyof typeof formData]}
                  onChange={(e) => setFormData({ ...formData, [field.key]: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Resultados del análisis */}
      {analisis && (
        <>
          {/* Liquidez */}
          <Card title="Análisis de Liquidez">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-2">Razón Corriente</p>
                <p className={`text-2xl font-bold ${getIndicatorColor('liquidez', analisis.liquidez.razonCorriente, [2, 1.5])}`}>
                  {analisis.liquidez.razonCorriente.toFixed(2)}
                </p>
                <p className="text-xs text-gray-400 mt-1">Recomendado: ≥ 1.5</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-2">Prueba Ácida</p>
                <p className={`text-2xl font-bold ${getIndicatorColor('liquidez', analisis.liquidez.pruebaAcida, [1, 0.8])}`}>
                  {analisis.liquidez.pruebaAcida.toFixed(2)}
                </p>
                <p className="text-xs text-gray-400 mt-1">Recomendado: ≥ 1</p>
              </div>
              <div className="text-center p-4 bg-emerald-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-2">Capital de Trabajo</p>
                <p className={`text-2xl font-bold ${analisis.liquidez.capitalTrabajo >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(analisis.liquidez.capitalTrabajo)}
                </p>
                <p className="text-xs text-gray-400 mt-1">AC - PC</p>
              </div>
              <div className="text-center p-4 bg-gray-100 rounded-lg">
                <div className={`flex items-center justify-center gap-2 ${analisis.liquidez.capitalTrabajo >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {analisis.liquidez.capitalTrabajo >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                  <span className="text-sm font-medium">
                    {analisis.liquidez.capitalTrabajo >= 0 ? 'Positivo' : 'Negativo'}
                  </span>
                </div>
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700">{analisis.liquidez.interpretacion}</p>
            </div>
          </Card>

          {/* Rentabilidad */}
          <Card title="Análisis de Rentabilidad">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-2">Margen Bruto</p>
                <p className={`text-xl font-bold ${getIndicatorColor('rentabilidad', analisis.rentabilidad.margenBruto, [40, 25])}`}>
                  {formatPercent(analisis.rentabilidad.margenBruto)}
                </p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-2">Margen Operacional</p>
                <p className={`text-xl font-bold ${getIndicatorColor('rentabilidad', analisis.rentabilidad.margenOperacional, [20, 10])}`}>
                  {formatPercent(analisis.rentabilidad.margenOperacional)}
                </p>
              </div>
              <div className="text-center p-4 bg-emerald-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-2">Margen Neto</p>
                <p className={`text-xl font-bold ${getIndicatorColor('rentabilidad', analisis.rentabilidad.margenNeto, [15, 5])}`}>
                  {formatPercent(analisis.rentabilidad.margenNeto)}
                </p>
              </div>
              <div className="text-center p-4 bg-amber-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-2">ROE</p>
                <p className={`text-xl font-bold ${getIndicatorColor('rentabilidad', analisis.rentabilidad.ROE, [20, 10])}`}>
                  {formatPercent(analisis.rentabilidad.ROE)}
                </p>
                <p className="text-xs text-gray-400 mt-1">Retorno Patrimonio</p>
              </div>
              <div className="text-center p-4 bg-rose-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-2">ROI</p>
                <p className={`text-xl font-bold ${getIndicatorColor('rentabilidad', analisis.rentabilidad.ROI, [15, 8])}`}>
                  {formatPercent(analisis.rentabilidad.ROI)}
                </p>
                <p className="text-xs text-gray-400 mt-1">Retorno Inversión</p>
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700">{analisis.rentabilidad.interpretacion}</p>
            </div>
          </Card>

          {/* Endeudamiento */}
          <Card title="Análisis de Endeudamiento">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-2">Razón Endeudamiento</p>
                <p className={`text-2xl font-bold ${getIndicatorColor('endeudamiento', analisis.endeuda.razonEndeuda, [40, 60])}`}>
                  {formatPercent(analisis.endeuda.razonEndeuda)}
                </p>
                <p className="text-xs text-gray-400 mt-1">Recomendado: ≤ 60%</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-2">Deuda/Patrimonio</p>
                <p className={`text-2xl font-bold ${getIndicatorColor('endeudamiento', analisis.endeuda.razonDeudaPatrimonio, [1, 1.5])}`}>
                  {analisis.endeuda.razonDeudaPatrimonio.toFixed(2)}
                </p>
                <p className="text-xs text-gray-400 mt-1">Recomendado: ≤ 1.5</p>
              </div>
              <div className="text-center p-4 bg-emerald-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-2">Cobertura Intereses</p>
                <p className={`text-2xl font-bold ${getIndicatorColor('liquidez', analisis.endeuda.coberturaIntereses, [5, 2])}`}>
                  {analisis.endeuda.coberturaIntereses.toFixed(2)}
                </p>
                <p className="text-xs text-gray-400 mt-1">Recomendado: ≥ 2</p>
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700">{analisis.endeuda.interpretacion}</p>
            </div>
          </Card>

          {/* Actividad */}
          <Card title="Análisis de Actividad">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-2">Rot. Inventario</p>
                <p className="text-xl font-bold text-gray-900">
                  {analisis.actividad.rotacionInventarios.toFixed(1)}
                </p>
                <p className="text-xs text-gray-400 mt-1">veces/año</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-2">Días Inventario</p>
                <p className="text-xl font-bold text-gray-900">
                  {analisis.actividad.diasInventario.toFixed(0)}
                </p>
                <p className="text-xs text-gray-400 mt-1">días</p>
              </div>
              <div className="text-center p-4 bg-emerald-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-2">Rot. CxC</p>
                <p className="text-xl font-bold text-gray-900">
                  {analisis.actividad.rotacionCuentasPorCobrar.toFixed(1)}
                </p>
                <p className="text-xs text-gray-400 mt-1">veces/año</p>
              </div>
              <div className="text-center p-4 bg-amber-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-2">Días CxC</p>
                <p className="text-xl font-bold text-gray-900">
                  {analisis.actividad.diasCuentasPorCobrar.toFixed(0)}
                </p>
                <p className="text-xs text-gray-400 mt-1">días</p>
              </div>
              <div className="text-center p-4 bg-rose-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-2">Rot. CxP</p>
                <p className="text-xl font-bold text-gray-900">
                  {analisis.actividad.rotacionCuentasPorPagar.toFixed(1)}
                </p>
                <p className="text-xs text-gray-400 mt-1">veces/año</p>
              </div>
              <div className="text-center p-4 bg-gray-100 rounded-lg">
                <p className="text-xs text-gray-500 mb-2">Días CxP</p>
                <p className="text-xl font-bold text-gray-900">
                  {analisis.actividad.diasCuentasPorPagar.toFixed(0)}
                </p>
                <p className="text-xs text-gray-400 mt-1">días</p>
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700">{analisis.actividad.interpretacion}</p>
            </div>
          </Card>

          {/* Resumen Ejecutivo */}
          <Card title="Resumen Ejecutivo">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <CheckCircle size={24} className="text-emerald-600" />
                <div>
                  <p className="font-medium text-emerald-900">Liquidez</p>
                  <p className="text-sm text-emerald-700">
                    {analisis.liquidez.razonCorriente >= 1.5 ? 'Sólida' : 'Revisar'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <Percent size={24} className="text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900">Rentabilidad</p>
                  <p className="text-sm text-blue-700">
                    {analisis.rentabilidad.margenNeto >= 10 ? 'Buena' : 'Mejorar'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                <AlertCircle size={24} className="text-amber-600" />
                <div>
                  <p className="font-medium text-amber-900">Endeudamiento</p>
                  <p className="text-sm text-amber-700">
                    {analisis.endeuda.razonEndeuda <= 50 ? 'Saludable' : 'Alto'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
                <PieChart size={24} className="text-purple-600" />
                <div>
                  <p className="font-medium text-purple-900">Eficiencia</p>
                  <p className="text-sm text-purple-700">
                    {analisis.actividad.diasInventario <= 60 ? 'Eficiente' : 'Lento'}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
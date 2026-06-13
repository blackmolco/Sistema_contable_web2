import React, { useState, useMemo } from 'react';
import { Landmark, FileSpreadsheet, Calculator, Building2, Download, Plus, Trash2, Users, Percent, AlertTriangle, CheckCircle2, Shield } from 'lucide-react';
import { Card } from '../components/ui/Cards';
import { useContabilidad } from '../context/ContabilidadContext';
import { formatCurrency } from '../utils/calculos';
import { Button, Input } from '../components/ui/FormElements';

interface Partner {
  id: string;
  nombre: string;
  rut: string;
  participacion: number;
}

export default function CierreTributario() {
  const { state } = useContabilidad();
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [regimen, setRegimen] = useState<'14D3' | '14D8'>('14D3');
  const [tasaD3, setTasaD3] = useState<10 | 12.5 | 27>(10);
  const [agregados, setAgregados] = useState<number>(0);
  const [deducciones, setDeducciones] = useState<number>(0);
  const [activosExcluidos, setActivosExcluidos] = useState<number>(0);

  // Socios para régimen 14 D8
  const [socios, setSocios] = useState<Partner[]>([
    { id: '1', nombre: 'Inversiones del Norte SpA', rut: '76.999.888-K', participacion: 60 },
    { id: '2', nombre: 'Roberto Valenzuela', rut: '15.654.321-0', participacion: 40 },
  ]);

  const [nuevoSocio, setNuevoSocio] = useState<Omit<Partner, 'id'>>({
    nombre: '',
    rut: '',
    participacion: 0
  });

  const saldosPorCuenta = useMemo(() => {
    const saldos: Record<string, { debe: number; haber: number }> = {};
    state.asientos.filter(a => a.estado === 'aprobado').forEach(a => {
      a.detalles?.forEach(d => {
        if (!saldos[d.cuentaId]) saldos[d.cuentaId] = { debe: 0, haber: 0 };
        saldos[d.cuentaId].debe += d.debe;
        saldos[d.cuentaId].haber += d.haber;
      });
    });
    return saldos;
  }, [state.asientos]);

  const totalPerdidas = useMemo(() => {
    return state.cuentas
      .filter(c => c.tipo === 'gasto')
      .reduce((acc, c) => acc + (saldosPorCuenta[c.id]?.debe || 0), 0);
  }, [state.cuentas, saldosPorCuenta]);

  const totalGanancias = useMemo(() => {
    return state.cuentas
      .filter(c => c.tipo === 'ingreso')
      .reduce((acc, c) => acc + (saldosPorCuenta[c.id]?.haber || 0), 0);
  }, [state.cuentas, saldosPorCuenta]);

  const utilidadFinanciera = useMemo(() => {
    const resultado = totalGanancias - totalPerdidas;
    return resultado !== 0 ? resultado : 0;
  }, [totalGanancias, totalPerdidas]);

  const agregadosTributarios = agregados || 0;
  const deduccionesTributarias = deducciones || 0;
  const rli = utilidadFinanciera + agregadosTributarios - deduccionesTributarias;

  // Cálculo de Impuesto de Primera Categoría (IDPC)
  const impuestoPrimeraCategoria = useMemo(() => {
    if (regimen === '14D8') {
      return 0; // Régimen Transparente no paga IDPC
    }
    return Math.round(rli > 0 ? rli * (tasaD3 / 100) : 0);
  }, [rli, regimen, tasaD3]);

  const totalActivos = useMemo(() => {
    return state.cuentas
      .filter(c => c.tipo === 'activo')
      .reduce((acc, c) => acc + (saldosPorCuenta[c.id]?.debe || 0), 0);
  }, [state.cuentas, saldosPorCuenta]);

  const totalPasivos = useMemo(() => {
    return state.cuentas
      .filter(c => c.tipo === 'pasivo')
      .reduce((acc, c) => acc + (saldosPorCuenta[c.id]?.haber || 0), 0);
  }, [state.cuentas, saldosPorCuenta]);

  const valorIntangibles = activosExcluidos || 0;
  const cpt = totalActivos - valorIntangibles - totalPasivos;
  const tieneDatos = totalActivos > 0 || totalPasivos > 0 || totalGanancias > 0 || totalPerdidas > 0;

  // Validación de participación de socios
  const totalParticipacion = useMemo(() => {
    return socios.reduce((sum, s) => sum + s.participacion, 0);
  }, [socios]);

  const handleAgregarSocio = () => {
    if (!nuevoSocio.nombre || !nuevoSocio.rut || nuevoSocio.participacion <= 0) return;
    setSocios([
      ...socios,
      {
        id: `${Date.now()}`,
        ...nuevoSocio
      }
    ]);
    setNuevoSocio({ nombre: '', rut: '', participacion: 0 });
  };

  const handleEliminarSocio = (id: string) => {
    setSocios(socios.filter(s => s.id !== id));
  };

  const exportPapelesTrabajo = () => {
    const rows = [
      ['Papel de Trabajo - Cierre Tributario', `Año Comercial ${anio}`],
      ['Régimen Tributario', regimen === '14D3' ? 'Pro Pyme General (Art. 14 D N°3)' : 'Pro Pyme Transparente (Art. 14 D N°8)'],
      [],
      ['1. Determinación de la Renta Líquida Imponible (RLI)'],
      ['Utilidad Financiera del Balance', utilidadFinanciera],
      ['(+) Agregados Tributarios', agregadosTributarios],
      ['(-) Deducciones Tributarias', deduccionesTributarias],
      ['Renta Líquida Imponible (RLI)', rli],
      [],
      regimen === '14D3' 
        ? ['Impuesto de Primera Categoría (IDPC)', impuestoPrimeraCategoria, `Tasa ${tasaD3}%`]
        : ['Impuesto de Primera Categoría (IDPC)', 'Liberado (0%)', 'Tasa Global Comp. socios'],
      [],
      ['2. Capital Propio Tributario (CPT)'],
      ['Total Activos Tributarios', totalActivos],
      ['(-) Valores Intangibles / Excluidos', valorIntangibles],
      ['(-) Pasivo Exigible', totalPasivos],
      ['Capital Propio Tributario (CPT)', cpt],
    ];

    if (regimen === '14D8') {
      rows.push([], ['3. Asignación de RLI a Socios (Régimen 14 D N°8)']);
      rows.push(['RUT', 'Nombre Socio', '% Participación', 'RLI Asignada']);
      socios.forEach(s => {
        rows.push([s.rut, s.nombre, `${s.participacion}%`, Math.round(rli * s.participacion / 100)]);
      });
      rows.push(['Total', '', `${totalParticipacion}%`, rli]);
    }

    const csvContent = "\uFEFF" + rows.map(e => e.join(";")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `Cierre_Tributario_${anio}_${regimen}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-600/10 dark:bg-indigo-400/10 rounded-xl">
            <Landmark className="text-indigo-600 dark:text-indigo-400 animate-pulse" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Operación Renta: Cierre Tributario</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Asistente avanzado de RLI, Capital Propio y asignación de utilidades.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={anio} 
            onChange={(e) => setAnio(Number(e.target.value))} 
            className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value={new Date().getFullYear()}>Año Comercial {new Date().getFullYear()}</option>
            <option value={new Date().getFullYear() - 1}>Año Comercial {new Date().getFullYear() - 1}</option>
          </select>
        </div>
      </div>

      {/* Selector de Régimen Tributario */}
      <Card padding="sm" className="bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-900/50 dark:to-gray-900/20 border-gray-200/60 dark:border-gray-800/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Régimen Tributario Pyme</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Seleccione el régimen aplicable para determinar el impuesto y su distribución.</p>
          </div>
          <div className="flex p-1 bg-gray-200/60 dark:bg-gray-800/80 rounded-xl max-w-md w-full md:w-auto">
            <button
              onClick={() => setRegimen('14D3')}
              className={`flex-1 md:flex-none px-5 py-2 text-xs font-bold rounded-lg transition-all duration-150 ${
                regimen === '14D3'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Pro Pyme General (14 D3)
            </button>
            <button
              onClick={() => setRegimen('14D8')}
              className={`flex-1 md:flex-none px-5 py-2 text-xs font-bold rounded-lg transition-all duration-150 ${
                regimen === '14D8'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Pro Pyme Transparente (14 D8)
            </button>
          </div>
        </div>
      </Card>

      {!tieneDatos && (
        <Card>
          <div className="text-center py-10 text-gray-500">
            <Landmark size={40} className="mx-auto mb-3 text-gray-300 dark:text-gray-700" />
            <p className="font-medium">No hay datos contables registrados</p>
            <p className="text-sm mt-1">Registre asientos contables para alimentar el asistente tributario automáticamente.</p>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Renta Líquida Imponible */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-indigo-100 dark:border-indigo-900/40">
            <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-gray-800 pb-3">
              <Calculator className="text-indigo-600 dark:text-indigo-400" size={20} />
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">1. Determinación de la R.L.I.</h3>
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800/30 rounded-xl border border-gray-100 dark:border-gray-800/40">
                <div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 block">Utilidad (Pérdida) del Balance</span>
                  <span className="text-[10px] text-gray-400">Ingresos (Gtas) - Gastos (Pdas)</span>
                </div>
                <span className="font-mono font-bold text-gray-900 dark:text-gray-100 text-base">{formatCurrency(utilidadFinanciera)}</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-red-50/50 dark:bg-red-950/10 rounded-xl border border-red-100/50 dark:border-red-900/20">
                <div>
                  <span className="text-sm font-medium text-red-900 dark:text-red-300 block">Más: Agregados a la Renta</span>
                  <span className="text-[10px] text-red-700 dark:text-red-400">Art. 33 N°1 LIR (Ej: Multas, Gastos Rechazados)</span>
                </div>
                <input
                  type="number"
                  value={agregados}
                  onChange={(e) => setAgregados(Number(e.target.value))}
                  className="w-36 px-3 py-1.5 text-right border border-red-200 dark:border-red-900/40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg font-mono text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  placeholder="0"
                />
              </div>

              <div className="flex justify-between items-center p-3 bg-emerald-50/50 dark:bg-emerald-950/10 rounded-xl border border-emerald-100/50 dark:border-emerald-900/20">
                <div>
                  <span className="text-sm font-medium text-emerald-900 dark:text-emerald-300 block">Menos: Deducciones a la Renta</span>
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400">Art. 33 N°2 LIR (Ej: Dividendos perc., INR)</span>
                </div>
                <input
                  type="number"
                  value={deducciones}
                  onChange={(e) => setDeducciones(Number(e.target.value))}
                  className="w-36 px-3 py-1.5 text-right border border-emerald-200 dark:border-emerald-900/40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg font-mono text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="p-4 bg-indigo-55 bg-indigo-600/5 dark:bg-indigo-400/5 border border-indigo-200 dark:border-indigo-900/30 rounded-xl mb-4">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider block mb-1">Base Imponible Tributaria</span>
                  <span className="text-sm text-indigo-950 dark:text-indigo-200 font-semibold">Renta Líquida Imponible (RLI)</span>
                </div>
                <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{formatCurrency(rli)}</span>
              </div>
            </div>

            {/* Panel dinámico según el régimen seleccionado */}
            {regimen === '14D3' ? (
              <div className="border-t border-gray-150 dark:border-gray-800 pt-5 mt-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Tasa de Impuesto Primera Categoría (IDPC)</h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Seleccione la tasa legal vigente para el período.</p>
                  </div>
                  <div className="flex gap-1.5 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                    {[10, 12.5, 27].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => setTasaD3(rate as 10 | 12.5 | 27)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                          tasaD3 === rate
                            ? 'bg-white dark:bg-gray-700 text-[#1E3A5F] dark:text-white shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                      >
                        {rate}%
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center px-4 py-3 bg-[#1E3A5F] dark:bg-[#112237] text-white rounded-xl shadow-inner">
                  <div className="flex items-center gap-2">
                    <Shield size={16} className="text-indigo-300" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-indigo-200">IDPC Calculado ({tasaD3}%)</span>
                  </div>
                  <span className="font-mono font-black text-xl text-emerald-400">{formatCurrency(impuestoPrimeraCategoria)}</span>
                </div>

                <div className="p-3 bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100/50 dark:border-blue-900/20 rounded-lg text-xs text-blue-700 dark:text-blue-400 flex items-start gap-2">
                  <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
                  <p>
                    <strong>Nota:</strong> Los socios tendrán derecho a utilizar el 100% de este impuesto como crédito contra sus impuestos personales (Global Complementario o Adicional), según el art. 14 D N°3.
                  </p>
                </div>
              </div>
            ) : (
              <div className="border-t border-gray-150 dark:border-gray-800 pt-5 mt-5 space-y-4">
                <div className="flex justify-between items-center px-4 py-3 bg-emerald-600/10 dark:bg-emerald-400/5 text-emerald-800 dark:text-emerald-300 rounded-xl border border-emerald-200 dark:border-emerald-900/30">
                  <div className="flex items-center gap-2">
                    <Shield size={16} className="text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Impuesto Primera Categoría (IDPC)</span>
                  </div>
                  <span className="font-mono font-black text-sm uppercase">Exento / Liberado</span>
                </div>
                <div className="p-3 bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100/50 dark:border-amber-900/20 rounded-lg text-xs text-amber-800 dark:text-amber-400 flex items-start gap-2">
                  <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                  <p>
                    <strong>Régimen Transparente:</strong> La empresa no paga IDPC. La RLI se asigna directamente a los socios en proporción a sus participaciones y tributa a nivel personal.
                  </p>
                </div>
              </div>
            )}
          </Card>

          {/* Distribución a socios (sólo 14 D8) */}
          {regimen === '14D8' && (
            <Card className="border-emerald-100 dark:border-emerald-900/40">
              <div className="flex items-center justify-between mb-6 border-b border-gray-100 dark:border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <Users className="text-emerald-600 dark:text-emerald-400" size={20} />
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Distribución de RLI a Socios</h3>
                </div>
                <Badge variant={totalParticipacion === 100 ? 'success' : 'warning'}>
                  Total Asignado: {totalParticipacion}%
                </Badge>
              </div>

              {/* Lista de Socios */}
              <div className="overflow-x-auto mb-6">
                <table className="w-full text-sm text-left text-gray-700 dark:text-gray-300">
                  <thead className="text-xs uppercase text-gray-500 bg-gray-50 dark:bg-gray-800/40">
                    <tr>
                      <th className="px-4 py-2">RUT</th>
                      <th className="px-4 py-2">Nombre / Razón Social</th>
                      <th className="px-4 py-2 text-right">% Participación</th>
                      <th className="px-4 py-2 text-right">Utilidad Asignada</th>
                      <th className="px-4 py-2 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                    {socios.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50/55 dark:hover:bg-gray-800/20">
                        <td className="px-4 py-2.5 font-mono">{s.rut}</td>
                        <td className="px-4 py-2.5 font-medium">{s.nombre}</td>
                        <td className="px-4 py-2.5 text-right font-semibold">{s.participacion}%</td>
                        <td className="px-4 py-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                          {formatCurrency(Math.round(rli * s.participacion / 100))}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <button
                            onClick={() => handleEliminarSocio(s.id)}
                            className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-950/20 rounded transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Agregar Socio */}
              <div className="bg-gray-50 dark:bg-gray-800/30 p-4 rounded-xl border border-gray-100 dark:border-gray-800/40">
                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Agregar Nuevo Socio</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                  <Input
                    placeholder="RUT (Ej: 12.345.678-9)"
                    value={nuevoSocio.rut}
                    onChange={e => setNuevoSocio({ ...nuevoSocio, rut: e.target.value })}
                  />
                  <Input
                    placeholder="Nombre o Razón Social"
                    value={nuevoSocio.nombre}
                    onChange={e => setNuevoSocio({ ...nuevoSocio, nombre: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="% Participación"
                    value={nuevoSocio.participacion || ''}
                    onChange={e => setNuevoSocio({ ...nuevoSocio, participacion: Number(e.target.value) })}
                    leftIcon={<Percent size={12} />}
                  />
                </div>
                <div className="flex justify-between items-center">
                  <div className="text-[11px] text-gray-500">
                    {totalParticipacion !== 100 && (
                      <span className="text-amber-600 flex items-center gap-1">
                        <AlertTriangle size={12} /> La participación total actual es de {totalParticipacion}%. Debe sumar exactamente 100%.
                      </span>
                    )}
                  </div>
                  <Button
                    onClick={handleAgregarSocio}
                    variant="primary"
                    size="sm"
                    icon={<Plus size={14} />}
                  >
                    Añadir Socio
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Capital Propio Tributario (CPT) */}
        <div className="space-y-6">
          <Card className="border-blue-100 dark:border-blue-900/40">
            <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-gray-800 pb-3">
              <Building2 className="text-blue-600 dark:text-blue-400" size={20} />
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">2. Capital Propio (CPT)</h3>
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800/30 rounded-xl border border-gray-100 dark:border-gray-800/40">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Activos (Según Balance)</span>
                <span className="font-mono font-bold text-gray-900 dark:text-gray-100">{formatCurrency(totalActivos)}</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-amber-50/50 dark:bg-amber-950/10 rounded-xl border border-amber-100/50 dark:border-amber-900/20">
                <div>
                  <span className="text-sm font-medium text-amber-950 dark:text-amber-300 block">Menos: Valores Excluidos</span>
                  <span className="text-[10px] text-amber-700 dark:text-amber-400">Intangibles o valores sin inversión efectiva</span>
                </div>
                <input
                  type="number"
                  value={activosExcluidos}
                  onChange={(e) => setActivosExcluidos(Number(e.target.value))}
                  className="w-32 px-2.5 py-1 text-right border border-amber-200 dark:border-amber-900/40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg font-mono text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  placeholder="0"
                />
              </div>

              <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800/30 rounded-xl border border-gray-100 dark:border-gray-800/40">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Activo Depurado</span>
                <span className="font-mono font-semibold text-gray-750 dark:text-gray-200">{formatCurrency(totalActivos - valorIntangibles)}</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-red-50/50 dark:bg-red-950/10 rounded-xl border border-red-100/50 dark:border-red-900/20">
                <div>
                  <span className="text-sm font-medium text-red-900 dark:text-red-300 block">Menos: Pasivo Exigible</span>
                  <span className="text-[10px] text-red-700 dark:text-red-400">Deudas con terceros</span>
                </div>
                <span className="font-mono font-bold text-red-800 dark:text-red-400">{formatCurrency(totalPasivos)}</span>
              </div>
            </div>

            <div className="p-4 bg-blue-600/5 dark:bg-blue-400/5 border border-blue-200 dark:border-blue-900/30 rounded-xl">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider block mb-1">Patrimonio Tributario</span>
                  <span className="text-sm text-blue-950 dark:text-blue-200 font-semibold">Capital Propio Tributario</span>
                </div>
                <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{formatCurrency(cpt)}</span>
              </div>
            </div>
          </Card>

          {/* Exportación */}
          <Card className="bg-gradient-to-br from-[#1E3A5F] to-[#2D5A87] text-white border-none shadow-lg">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-white/10 rounded-lg mt-0.5">
                  <FileSpreadsheet size={18} className="text-indigo-200" />
                </div>
                <div>
                  <h4 className="font-bold text-base">Papeles de Trabajo F22</h4>
                  <p className="text-xs text-white/70 mt-0.5">Exporte la determinación de la RLI y CPT a planilla para su revisión o carga directa en el SII.</p>
                </div>
              </div>
              <button
                onClick={exportPapelesTrabajo}
                disabled={!tieneDatos}
                className="w-full py-2.5 bg-white text-[#1E3A5F] font-bold text-xs rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:hover:bg-white active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow"
              >
                <Download size={14} /> Exportar Papeles de Trabajo (CSV)
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

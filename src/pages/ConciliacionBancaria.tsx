import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet,
  Upload,
  Download,
  Check,
  X,
  AlertCircle,
  RefreshCw,
  FileSpreadsheet,
  Search,
  Calendar,
  Landmark,
  Lock,
  Key,
  ChevronRight,
  Shield,
  ShieldCheck,
  Activity,
  CheckCircle2,
  ArrowRight,
  Fingerprint,
  CreditCard,
} from 'lucide-react';
import { Card, Button } from '../components/ui/Cards';
import { formatCurrency, formatDate } from '../utils/calculos';
import {
  ConciliacionService,
  TransaccionBancaria,
  TransaccionContable,
  ResultadoConciliacion,
} from '../services/conciliacion';
import { useApp } from '../context/AppContext';
import { useTesoreriaStore, FlujoCaja } from '../stores';

export default function ConciliacionBancaria() {
  const { state: appState, showToast } = useApp();
  const tesoreria = useTesoreriaStore();
  const location = useLocation();

  // Fintoc simulator states
  const [fintocModalOpen, setFintocModalOpen] = useState(false);
  const [syncStep, setSyncStep] = useState<'bank' | 'credentials' | '2fa' | 'account' | 'syncing' | 'success'>('bank');
  const [selectedBank, setSelectedBank] = useState('');
  const [rut, setRut] = useState('');
  const [password, setPassword] = useState('');
  const [tokenCode, setTokenCode] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatusText, setSyncStatusText] = useState('');

  const [transaccionesBancarias, setTransaccionesBancarias] = useState<TransaccionBancaria[]>([]);

  useEffect(() => {
    if (location.state?.triggerAction === 'sincronizar_banco') {
      setSyncStep('bank');
      setFintocModalOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const completarSincronizacionFintoc = () => {
    const unconciliatedContables = transaccionesContables.filter(tc => !tc.conciliada);
    const transaccionesParaInyectar: Omit<FlujoCaja, 'id'>[] = [];
    let count = 0;
    
    unconciliatedContables.slice(0, 5).forEach(tc => {
      const tipoFlujo: 'entrada' | 'salida' = tc.tipo === 'credito' ? 'entrada' : 'salida';
      transaccionesParaInyectar.push({
        fecha: tc.fecha,
        tipo: tipoFlujo,
        categoria: 'Sincronizado Fintoc',
        descripcion: `Fintoc: ${tc.glosa}`,
        monto: tc.monto,
        origen: tc.tipo === 'credito' ? 'factura' : 'proveedor',
        estado: 'realizado',
      });
      count++;
    });
    
    const fallbackDesc = [
      { descripcion: 'Servicios de Hosting AWS', monto: 45000, tipo: 'salida', origen: 'proveedor' },
      { descripcion: 'Abono Factura Cliente #9872', monto: 1200000, tipo: 'entrada', origen: 'factura' },
      { descripcion: 'Comisión Mantención Cuenta Corriente', monto: 18500, tipo: 'salida', origen: 'otro' },
      { descripcion: 'Pago Patente Comercial Municipalidad', monto: 125000, tipo: 'salida', origen: 'impuesto' },
      { descripcion: 'Reembolso Gastos Caja Chica', monto: 35000, tipo: 'salida', origen: 'otro' },
    ];
    
    let fallbackIdx = 0;
    while (count < 5 && fallbackIdx < fallbackDesc.length) {
      const fb = fallbackDesc[fallbackIdx];
      const hoy = new Date();
      hoy.setDate(hoy.getDate() - fallbackIdx);
      const fechaStr = hoy.toISOString().split('T')[0];
      
      transaccionesParaInyectar.push({
        fecha: fechaStr,
        tipo: fb.tipo as 'entrada' | 'salida',
        categoria: 'Sincronizado Fintoc',
        descripcion: `Fintoc: ${fb.descripcion}`,
        monto: fb.monto,
        origen: fb.origen as any,
        estado: 'realizado',
      });
      count++;
      fallbackIdx++;
    }
    
    transaccionesParaInyectar.forEach(t => {
      tesoreria.agregarMovimiento(t);
    });
    
    showToast('success', 'Sincronización Exitosa', `Se han importado 5 transacciones bancarias vía Fintoc.`);
  };

  const iniciarSincronizacion = () => {
    setSyncStep('syncing');
    setSyncProgress(0);
    setSyncStatusText('Conectando de forma segura con el banco...');
    
    const steps = [
      { progress: 25, text: 'Autenticando credenciales de acceso...' },
      { progress: 50, text: 'Buscando cuentas y cartolas de movimientos...' },
      { progress: 75, text: 'Descargando transacciones recientes...' },
      { progress: 100, text: 'Procesando firmas y verificación de integridad...' }
    ];
    
    steps.forEach((step, idx) => {
      setTimeout(() => {
        setSyncProgress(step.progress);
        setSyncStatusText(step.text);
      }, (idx + 1) * 800);
    });
    
    setTimeout(() => {
      completarSincronizacionFintoc();
      setSyncStep('success');
    }, (steps.length + 1) * 800);
  };
  const [transaccionesContables, setTransaccionesContables] = useState<TransaccionContable[]>([]);
  const [resultado, setResultado] = useState<ResultadoConciliacion | null>(null);

  // Manual Match State
  const [bancariaSeleccionada, setBancariaSeleccionada] = useState<string | null>(null);
  const [contableSeleccionada, setContableSeleccionada] = useState<string | null>(null);
  const [hoveredMatchId, setHoveredMatchId] = useState<string | null>(null);

  // Search/Filters
  const [filtroBancaria, setFiltroBancaria] = useState('');
  const [filtroContable, setFiltroContable] = useState('');

  useEffect(() => {
    const bancarias: TransaccionBancaria[] = tesoreria.flujoCaja
      .filter(f => f.estado === 'realizado')
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map((f, i) => ({
        id: `b_${i}`,
        fecha: f.fecha,
        descripcion: f.descripcion,
        tipo: f.tipo === 'entrada' ? 'credito' : 'debito',
        monto: f.monto,
        referencia: f.categoria,
        conciliada: false,
      }));

    const contables: TransaccionContable[] = [];
    appState.asientos
      .filter(a => a.estado === 'aprobado')
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .forEach((a, i) => {
        a.detalles?.forEach(det => {
          if (det.cuentaCodigo === '1120' || det.cuentaCodigo === '1110') {
            contables.push({
              id: `c_${i}_${det.cuentaCodigo}`,
              fecha: a.fecha,
              glosa: a.glosa,
              monto: det.debe || det.haber,
              cuentaBanco: det.cuentaCodigo,
              tipo: det.debe > 0 ? 'credito' : 'debito',
              conciliada: false,
            });
          }
        });
      });

    setTransaccionesBancarias(bancarias);
    setTransaccionesContables(contables);
  }, [appState.asientos, tesoreria.flujoCaja]);

  const ejecutarConciliacion = () => {
    const res = ConciliacionService.conciliarPorReferencia(
      transaccionesBancarias,
      transaccionesContables
    );
    setResultado(res);
    setTransaccionesBancarias([...transaccionesBancarias]);
    setTransaccionesContables([...transaccionesContables]);
    setBancariaSeleccionada(null);
    setContableSeleccionada(null);
    showToast('success', 'Conciliación Automática', `Conciliación ejecutada. ${res.partidasConciliadas.length} transacciones conciliadas en total.`);
  };

  const saldoBanco = transaccionesBancarias.reduce((sum, t) => t.tipo === 'credito' ? sum + t.monto : sum - t.monto, 0);
  const saldoContable = transaccionesContables.reduce((sum, t) => t.tipo === 'credito' ? sum + t.monto : sum - t.monto, 0);

  const handleImportarCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const contenido = event.target?.result as string;
      const transacciones = ConciliacionService.importarCSV(contenido);
      setTransaccionesBancarias(transacciones);
      showToast('success', 'Archivo Importado', `Se cargaron ${transacciones.length} transacciones desde la cartola bancaria.`);
    };
    reader.readAsText(file);
  };

  const handleExportarReporte = () => {
    if (!resultado) { showToast('warning', 'Sin Reporte', 'Ejecute la conciliación primero'); return; }
    const html = ConciliacionService.generarReporteConciliacion(resultado, 'Banco Chile CTA CTE 12345', saldoBanco, saldoContable, new Date().toLocaleDateString('es-CL'));
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'conciliacion_bancaria.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  const conciliarManual = () => {
    if (!bancariaSeleccionada || !contableSeleccionada) return;

    const tbIndex = transaccionesBancarias.findIndex(x => x.id === bancariaSeleccionada);
    const tcIndex = transaccionesContables.findIndex(x => x.id === contableSeleccionada);

    if (tbIndex !== -1 && tcIndex !== -1) {
      const tb = { ...transaccionesBancarias[tbIndex], conciliada: true, transaccionId: transaccionesContables[tcIndex].id };
      const tc = { ...transaccionesContables[tcIndex], conciliada: true, transaccionBancariaId: transaccionesBancarias[tbIndex].id };

      const nuevasB = [...transaccionesBancarias];
      nuevasB[tbIndex] = tb;
      
      const nuevasC = [...transaccionesContables];
      nuevasC[tcIndex] = tc;

      setTransaccionesBancarias(nuevasB);
      setTransaccionesContables(nuevasC);

      const conciliadas = resultado ? [...resultado.partidasConciliadas] : [];
      const filteredConciliadas = conciliadas.filter(
        p => p.transaccionBancaria.id !== tb.id && p.transaccionContable.id !== tc.id
      );
      
      filteredConciliadas.push({
        transaccionBancaria: tb,
        transaccionContable: tc,
        fechaConciliacion: new Date().toISOString()
      });

      const pendB = nuevasB.filter(x => !x.conciliada);
      const pendC = nuevasC.filter(x => !x.conciliada);
      const totalC = filteredConciliadas.reduce((sum, p) => sum + p.transaccionBancaria.monto, 0);

      setResultado({
        partidasConciliadas: filteredConciliadas,
        transaccionesBancariasPendientes: pendB,
        transaccionesContablesPendientes: pendC,
        totalConciliado: totalC,
        totalDiferencias: 0,
        mensaje: `Conciliación manual exitosa entre "${tb.descripcion}" y "${tc.glosa}".`
      });

      setBancariaSeleccionada(null);
      setContableSeleccionada(null);
      showToast('success', 'Manual Match', 'Transacciones conciliadas manualmente.');
    }
  };

  const desconciliarTransacciones = (tbId: string, tcId: string) => {
    const tbIndex = transaccionesBancarias.findIndex(x => x.id === tbId);
    const tcIndex = transaccionesContables.findIndex(x => x.id === tcId);

    if (tbIndex !== -1 && tcIndex !== -1) {
      const tb = { ...transaccionesBancarias[tbIndex], conciliada: false, transaccionId: undefined };
      const tc = { ...transaccionesContables[tcIndex], conciliada: false, transaccionBancariaId: undefined };

      const nuevasB = [...transaccionesBancarias];
      nuevasB[tbIndex] = tb;

      const nuevasC = [...transaccionesContables];
      nuevasC[tcIndex] = tc;

      setTransaccionesBancarias(nuevasB);
      setTransaccionesContables(nuevasC);

      if (resultado) {
        const conciliadas = resultado.partidasConciliadas.filter(
          p => p.transaccionBancaria.id !== tbId || p.transaccionContable.id !== tcId
        );
        const pendB = nuevasB.filter(x => !x.conciliada);
        const pendC = nuevasC.filter(x => !x.conciliada);
        const totalC = conciliadas.reduce((sum, p) => sum + p.transaccionBancaria.monto, 0);

        setResultado({
          partidasConciliadas: conciliadas,
          transaccionesBancariasPendientes: pendB,
          transaccionesContablesPendientes: pendC,
          totalConciliado: totalC,
          totalDiferencias: 0,
          mensaje: 'Transacciones desconciliadas.'
        });
      }
      showToast('info', 'Desconciliar', 'Se deshizo la conciliación.');
    }
  };

  const bancariasFiltradas = transaccionesBancarias.filter(
    tb => 
      tb.descripcion.toLowerCase().includes(filtroBancaria.toLowerCase()) ||
      tb.fecha.includes(filtroBancaria) ||
      tb.monto.toString().includes(filtroBancaria)
  );

  const contablesFiltradas = transaccionesContables.filter(
    tc => 
      tc.glosa.toLowerCase().includes(filtroContable.toLowerCase()) ||
      tc.fecha.includes(filtroContable) ||
      tc.monto.toString().includes(filtroContable)
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Conciliación Bancaria</h1>
          <p className="text-sm text-gray-500 mt-1">Conciliación manual y automática de transacciones</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="secondary" 
            onClick={() => { setSyncStep('bank'); setFintocModalOpen(true); }} 
            icon={<Landmark size={18} />}
            className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-900/40 dark:text-indigo-400 dark:hover:bg-indigo-950/20"
          >
            Conectar Cuenta Bancaria (Fintoc)
          </Button>
          <Button variant="secondary" onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.accept = '.csv'; input.onchange = (event) => handleImportarCSV(event as unknown as React.ChangeEvent<HTMLInputElement>); input.click(); }} icon={<Upload size={18} />}>
            Importar CSV Cartola
          </Button>
          <Button onClick={ejecutarConciliacion} icon={<RefreshCw size={18} />}>
            Ejecutar Conciliación
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <div className="text-xs text-blue-700 font-medium">Saldo Banco (Cartola)</div>
          <div className="text-2xl font-bold text-blue-900">{formatCurrency(saldoBanco)}</div>
        </Card>
        <Card className="bg-purple-50 border-purple-200">
          <div className="text-xs text-purple-700 font-medium">Saldo Contable (Ledger)</div>
          <div className="text-2xl font-bold text-purple-900">{formatCurrency(saldoContable)}</div>
        </Card>
        <Card className="bg-emerald-50 border-emerald-200">
          <div className="text-xs text-emerald-700 font-medium">Diferencia</div>
          <div className="text-2xl font-bold text-emerald-900">{formatCurrency(Math.abs(saldoBanco - saldoContable))}</div>
        </Card>
        <Card className="bg-amber-50 border-amber-200">
          <div className="text-xs text-amber-700 font-medium">{resultado ? 'Partidas Conciliadas' : 'Sin Conciliar'}</div>
          <div className="text-2xl font-bold text-amber-900">{resultado ? resultado.partidasConciliadas.length : '-'}</div>
        </Card>
      </div>

      {bancariaSeleccionada && contableSeleccionada && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
          <div className="text-xs text-gray-700">
            <span className="font-bold text-amber-800 block text-xs uppercase mb-1">Propuesta de Conciliación Manual:</span>
            <div className="space-y-0.5">
              <p><strong>Cartola:</strong> {transaccionesBancarias.find(x => x.id === bancariaSeleccionada)?.descripcion} ({formatCurrency(transaccionesBancarias.find(x => x.id === bancariaSeleccionada)?.monto || 0)})</p>
              <p><strong>Libro Diario:</strong> {transaccionesContables.find(x => x.id === contableSeleccionada)?.glosa} ({formatCurrency(transaccionesContables.find(x => x.id === contableSeleccionada)?.monto || 0)})</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setBancariaSeleccionada(null); setContableSeleccionada(null); }} className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-300 transition-colors">
              Cancelar
            </button>
            <button onClick={conciliarManual} className="px-3 py-1.5 bg-[#1E3A5F] text-white text-xs font-semibold rounded-lg hover:bg-[#2D5A87] transition-colors">
              Conciliar Manual
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PANEL IZQUIERDO: Cartola Bancaria */}
        <Card 
          title={
            <div className="flex items-center justify-between">
              <span>Cartola Bancaria (Banco)</span>
              <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                {bancariasFiltradas.length} ítems
              </span>
            </div>
          }
        >
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Buscar en Cartola (fecha, monto, descripción)..." 
                value={filtroBancaria}
                onChange={(e) => setFiltroBancaria(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-[#1E3A5F]/20"
              />
            </div>
          </div>
          
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
            {bancariasFiltradas.length === 0 ? (
              <p className="text-center text-xs text-gray-500 py-10">No hay movimientos bancarios.</p>
            ) : (
              bancariasFiltradas.map((tb) => {
                const isSelected = bancariaSeleccionada === tb.id;
                const isHovered = hoveredMatchId === tb.id || (tb.conciliada && hoveredMatchId === tb.transaccionId);
                return (
                  <div
                    key={tb.id}
                    onMouseEnter={() => tb.conciliada && setHoveredMatchId(tb.transaccionId || null)}
                    onMouseLeave={() => setHoveredMatchId(null)}
                    onClick={() => !tb.conciliada && setBancariaSeleccionada(isSelected ? null : tb.id)}
                    className={`p-3 rounded-lg border text-xs transition-all duration-150 cursor-pointer select-none
                      ${tb.conciliada 
                        ? isHovered 
                          ? 'bg-emerald-100 border-emerald-400 shadow-sm animate-pulse' 
                          : 'bg-emerald-50 border-emerald-200' 
                        : isSelected
                          ? 'border-[#1E3A5F] ring-2 ring-[#1E3A5F]/25 bg-blue-50/30'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-gray-800">{tb.descripcion}</span>
                      <span className={`font-bold ${tb.tipo === 'credito' ? 'text-emerald-700' : 'text-red-700'}`}>
                        {tb.tipo === 'credito' ? '+' : '-'}{formatCurrency(tb.monto)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center mt-2 text-[10px] text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar size={10} /> {formatDate(tb.fecha)}
                      </span>
                      
                      {tb.conciliada ? (
                        <div className="flex items-center gap-1.5">
                          <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                            <Check size={8} /> Conciliado
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (tb.transaccionId) desconciliarTransacciones(tb.id, tb.transaccionId);
                            }}
                            className="text-red-500 hover:text-red-700 font-semibold underline p-0.5 rounded"
                            title="Deshacer conciliación"
                          >
                            Deshacer
                          </button>
                        </div>
                      ) : (
                        <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                          Pendiente
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* PANEL DERECHO: Contabilidad */}
        <Card 
          title={
            <div className="flex items-center justify-between">
              <span>Libro Diario (Contabilidad Banco)</span>
              <span className="text-xs font-semibold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                {contablesFiltradas.length} ítems
              </span>
            </div>
          }
        >
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Buscar en Libro (fecha, monto, glosa)..." 
                value={filtroContable}
                onChange={(e) => setFiltroContable(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-[#1E3A5F]/20"
              />
            </div>
          </div>
          
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
            {contablesFiltradas.length === 0 ? (
              <p className="text-center text-xs text-gray-500 py-10">No hay movimientos contables.</p>
            ) : (
              contablesFiltradas.map((tc) => {
                const isSelected = contableSeleccionada === tc.id;
                const isHovered = hoveredMatchId === tc.id || (tc.conciliada && hoveredMatchId === tc.transaccionBancariaId);
                return (
                  <div
                    key={tc.id}
                    onMouseEnter={() => tc.conciliada && setHoveredMatchId(tc.transaccionBancariaId || null)}
                    onMouseLeave={() => setHoveredMatchId(null)}
                    onClick={() => !tc.conciliada && setContableSeleccionada(isSelected ? null : tc.id)}
                    className={`p-3 rounded-lg border text-xs transition-all duration-150 cursor-pointer select-none
                      ${tc.conciliada 
                        ? isHovered 
                          ? 'bg-emerald-100 border-emerald-400 shadow-sm animate-pulse' 
                          : 'bg-emerald-50 border-emerald-200' 
                        : isSelected
                          ? 'border-[#1E3A5F] ring-2 ring-[#1E3A5F]/25 bg-blue-50/30'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-gray-800">{tc.glosa}</span>
                      <span className={`font-bold ${tc.tipo === 'credito' ? 'text-emerald-700' : 'text-red-700'}`}>
                        {tc.tipo === 'credito' ? '+' : '-'}{formatCurrency(tc.monto)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center mt-2 text-[10px] text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar size={10} /> {formatDate(tc.fecha)} (Cta: {tc.cuentaBanco})
                      </span>
                      
                      {tc.conciliada ? (
                        <div className="flex items-center gap-1.5">
                          <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                            <Check size={8} /> Conciliado
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (tc.transaccionBancariaId) desconciliarTransacciones(tc.transaccionBancariaId, tc.id);
                            }}
                            className="text-red-500 hover:text-red-700 font-semibold underline p-0.5 rounded"
                            title="Deshacer conciliación"
                          >
                            Deshacer
                          </button>
                        </div>
                      ) : (
                        <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                          Pendiente
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {resultado && (
        <Card title="Resultado de Conciliación">
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg"><p className="text-sm text-blue-900">{resultado.mensaje}</p></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <div className="flex items-center gap-2"><Check size={18} className="text-emerald-600" /><span className="font-medium text-emerald-900">Conciliadas</span></div>
                <p className="text-2xl font-bold text-emerald-900 mt-2">{resultado.partidasConciliadas.length}</p>
                <p className="text-sm text-emerald-700">{formatCurrency(resultado.totalConciliado)}</p>
              </div>
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-center gap-2"><AlertCircle size={18} className="text-amber-600" /><span className="font-medium text-amber-900">Pendientes Banco</span></div>
                <p className="text-2xl font-bold text-amber-900 mt-2">{resultado.transaccionesBancariasPendientes.length}</p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center gap-2"><X size={18} className="text-red-600" /><span className="font-medium text-red-900">Pendientes Contable</span></div>
                <p className="text-2xl font-bold text-red-900 mt-2">{resultado.transaccionesContablesPendientes.length}</p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleExportarReporte} icon={<Download size={18} />} variant="secondary">Exportar Reporte</Button>
            </div>
          </div>
        </Card>
      )}

      <Card title="Cómo usar la Conciliación Bancaria">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2"><FileSpreadsheet size={18} />Paso 1: Importar cartola bancaria</h4>
            <p className="text-sm text-gray-600">Haga clic en "Importar CSV Cartola" y seleccione el archivo CSV exportado desde su banca electrónica.</p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2"><RefreshCw size={18} />Paso 2: Conciliación automática</h4>
            <p className="text-sm text-gray-600">Presione "Ejecutar Conciliación" para asociar automáticamente registros con el mismo monto y fecha (+/- 3 días de tolerancia).</p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2"><Search size={18} />Paso 3: Conciliación manual</h4>
            <p className="text-sm text-gray-600">Seleccione un registro pendiente en la cartola (izquierda) y otro en el libro diario (derecha) y presione "Conciliar Manual".</p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2"><Download size={18} />Paso 4: Exportar reporte</h4>
            <p className="text-sm text-gray-600">Descargue el acta oficial de conciliación en formato HTML haciendo clic en "Exportar Reporte".</p>
          </div>
        </div>
      </Card>
      {/* Modal Fintoc */}
      <AnimatePresence>
        {fintocModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-lg">
                    <Landmark size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 font-sans">Fintoc Link</h3>
                    <p className="text-[10px] text-gray-500 flex items-center gap-1 font-medium font-sans">
                      <Lock size={10} className="text-emerald-500" /> Conexión encriptada SSL
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setFintocModalOpen(false)}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Progress Indicator */}
              {syncStep !== 'syncing' && syncStep !== 'success' && (
                <div className="flex justify-between items-center px-6 pt-4 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider font-sans">
                  <span className={syncStep === 'bank' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''}>1. Banco</span>
                  <ChevronRight size={10} />
                  <span className={syncStep === 'credentials' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''}>2. Credenciales</span>
                  <ChevronRight size={10} />
                  <span className={syncStep === '2fa' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''}>3. Seguridad</span>
                  <ChevronRight size={10} />
                  <span className={syncStep === 'account' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''}>4. Cuenta</span>
                </div>
              )}

              {/* Content body */}
              <div className="p-6">
                {/* Paso 1: Selección de Banco */}
                {syncStep === 'bank' && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 font-sans">Selecciona tu institución bancaria</h4>
                      <p className="text-xs text-gray-500 mt-0.5 font-sans">Fintoc se conecta de forma segura a tu banco para descargar las cartolas.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      {[
                        { id: 'chile', name: 'Banco de Chile', bg: 'hover:bg-blue-50/50 hover:border-blue-300 dark:hover:bg-blue-950/20', color: 'text-blue-600' },
                        { id: 'santander', name: 'Santander', bg: 'hover:bg-red-50/50 hover:border-red-300 dark:hover:bg-red-950/20', color: 'text-red-600' },
                        { id: 'bci', name: 'BCI', bg: 'hover:bg-green-50/50 hover:border-green-300 dark:hover:bg-green-950/20', color: 'text-green-600' },
                        { id: 'estado', name: 'Banco Estado', bg: 'hover:bg-amber-50/50 hover:border-amber-300 dark:hover:bg-amber-950/20', color: 'text-amber-600' },
                        { id: 'itau', name: 'Itaú', bg: 'hover:bg-orange-50/50 hover:border-orange-300 dark:hover:bg-orange-950/20', color: 'text-orange-600' },
                        { id: 'scotiabank', name: 'Scotiabank', bg: 'hover:bg-rose-50/50 hover:border-rose-300 dark:hover:bg-rose-950/20', color: 'text-rose-600' }
                      ].map((bank) => (
                        <button
                          key={bank.id}
                          onClick={() => {
                            setSelectedBank(bank.name);
                            setSyncStep('credentials');
                          }}
                          className={`flex flex-col items-center justify-center p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-800/10 text-center transition-all duration-200 active:scale-[0.98] ${bank.bg}`}
                        >
                          <div className={`p-2 bg-white dark:bg-gray-800 rounded-full shadow-sm mb-2 ${bank.color}`}>
                            <Landmark size={20} />
                          </div>
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 font-sans">{bank.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Paso 2: Credenciales */}
                {syncStep === 'credentials' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSyncStep('bank')}
                        className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline font-sans"
                      >
                        &larr; Volver
                      </button>
                      <span className="text-xs text-gray-400 font-sans">| Conectando a {selectedBank}</span>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 font-sans">Ingresa tus credenciales web</h4>
                      <p className="text-xs text-gray-500 mt-0.5 font-sans">Usa tus claves de acceso de tu banca personas o empresas.</p>
                    </div>

                    <div className="space-y-3 pt-2">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 font-sans">RUT Empresa o Personal</label>
                        <input
                          type="text"
                          placeholder="12.345.678-9"
                          value={rut}
                          onChange={(e) => setRut(e.target.value)}
                          className="input-modern font-sans"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 font-sans">Clave de Internet</label>
                        <div className="relative">
                          <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="input-modern pl-9 font-sans"
                          />
                          <Key size={14} className="absolute left-3 top-3 text-gray-400" />
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={() => setSyncStep('2fa')}
                      disabled={!rut || !password}
                      className="w-full mt-2 font-sans"
                    >
                      Continuar
                    </Button>
                  </div>
                )}

                {/* Paso 3: Código de Seguridad (2FA) */}
                {syncStep === '2fa' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSyncStep('credentials')}
                        className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline font-sans"
                      >
                        &larr; Volver
                      </button>
                      <span className="text-xs text-gray-400 font-sans">| Verificación de Seguridad</span>
                    </div>

                    <div className="text-center py-2">
                      <div className="inline-flex p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-full mb-3">
                        <Fingerprint size={28} />
                      </div>
                      <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 font-sans">Autenticación Multifactor (2FA)</h4>
                      <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto font-sans">
                        Por seguridad, ingresa el código temporal generado en tu aplicación bancaria (e.g. Mi Pass, Digipass o SuperClave).
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 text-center font-sans">Código de Seguridad (6 dígitos)</label>
                        <input
                          type="text"
                          maxLength={6}
                          placeholder="123456"
                          value={tokenCode}
                          onChange={(e) => setTokenCode(e.target.value.replace(/\D/g, ''))}
                          className="input-modern text-center text-lg font-mono tracking-[0.5em] focus:ring-amber-500/20 focus:border-amber-500"
                        />
                      </div>
                    </div>

                    <Button
                      onClick={() => setSyncStep('account')}
                      disabled={tokenCode.length < 6}
                      className="w-full bg-amber-600 hover:bg-amber-700 focus:ring-amber-500/30 mt-2 font-sans"
                    >
                      Verificar y Continuar
                    </Button>
                  </div>
                )}

                {/* Paso 4: Selección de Cuenta */}
                {syncStep === 'account' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSyncStep('2fa')}
                        className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline font-sans"
                      >
                        &larr; Volver
                      </button>
                      <span className="text-xs text-gray-400 font-sans">| Cuentas Encontradas</span>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 font-sans">Selecciona la cuenta a vincular</h4>
                      <p className="text-xs text-gray-500 mt-0.5 font-sans">Hemos encontrado las siguientes cuentas habilitadas para descarga.</p>
                    </div>

                    <div className="space-y-2.5 pt-2">
                      {[
                        { id: '12345', name: 'Cuenta Corriente Moneda Nacional', desc: 'CTA CTE N° ••••12345', balance: 5240000 },
                        { id: '88221', name: 'Cuenta Vista Comercial', desc: 'CTA VISTA N° ••••88221', balance: 145000 }
                      ].map((acc) => (
                        <button
                          key={acc.id}
                          onClick={() => setSelectedAccount(acc.name)}
                          className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all duration-150 active:scale-[0.99]
                            ${selectedAccount === acc.name
                              ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/10 dark:bg-indigo-950/10'
                              : 'border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-800/10 hover:border-gray-200 dark:hover:border-gray-700'
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg">
                              <CreditCard size={18} />
                            </div>
                            <div>
                              <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block font-sans">{acc.name}</span>
                              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-sans">{acc.desc}</span>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-gray-700 dark:text-gray-300 font-sans">{formatCurrency(acc.balance)}</span>
                        </button>
                      ))}
                    </div>

                    <Button
                      onClick={iniciarSincronizacion}
                      disabled={!selectedAccount}
                      className="w-full mt-4 font-sans"
                    >
                      Sincronizar Ahora
                    </Button>
                  </div>
                )}

                {/* Paso 5: Sincronizando */}
                {syncStep === 'syncing' && (
                  <div className="py-8 flex flex-col items-center justify-center text-center">
                    <div className="relative mb-6">
                      <div className="w-16 h-16 rounded-full border-4 border-indigo-100 dark:border-indigo-950 flex items-center justify-center">
                        <Activity className="text-indigo-600 dark:text-indigo-400 animate-pulse" size={28} />
                      </div>
                      <div className="absolute inset-0 rounded-full border-4 border-t-indigo-600 border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
                    </div>
                    
                    <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 font-sans">Sincronizando transacciones...</h4>
                    <p className="text-xs text-gray-500 mt-1 max-w-xs font-sans">{syncStatusText}</p>
                    
                    <div className="w-full max-w-xs bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 mt-6 overflow-hidden">
                      <motion.div
                        className="bg-indigo-600 h-full"
                        animate={{ width: `${syncProgress}%` }}
                        transition={{ duration: 0.4 }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mt-2 font-sans">{syncProgress}%</span>
                  </div>
                )}

                {/* Paso 6: Éxito */}
                {syncStep === 'success' && (
                  <div className="py-6 flex flex-col items-center justify-center text-center">
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                      className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-full mb-4"
                    >
                      <CheckCircle2 size={42} />
                    </motion.div>

                    <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 font-sans">¡Conexión y Sincronización Exitosa!</h4>
                    <p className="text-xs text-gray-500 mt-1.5 max-w-xs font-sans">
                      Se importaron <span className="font-bold text-emerald-600 dark:text-emerald-400">5 transacciones bancarias</span> desde tu cuenta corriente a tu cartola local.
                    </p>

                    <div className="w-full border-t border-gray-100 dark:border-gray-800 my-5 pt-4 text-left">
                      <div className="flex justify-between text-xs py-1 border-b border-gray-50 dark:border-gray-800/30">
                        <span className="text-gray-500 font-sans">Banco:</span>
                        <span className="font-semibold text-gray-800 dark:text-gray-200 font-sans">{selectedBank}</span>
                      </div>
                      <div className="flex justify-between text-xs py-1 border-b border-gray-50 dark:border-gray-800/30">
                        <span className="text-gray-500 font-sans">Cuenta vinculada:</span>
                        <span className="font-semibold text-gray-800 dark:text-gray-200 font-sans">{selectedAccount}</span>
                      </div>
                      <div className="flex justify-between text-xs py-1">
                        <span className="text-gray-500 font-sans">Método de descarga:</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-sans">
                          <Shield size={10} /> Fintoc API (Automático)
                        </span>
                      </div>
                    </div>

                    <Button
                      onClick={() => {
                        setFintocModalOpen(false);
                        setRut('');
                        setPassword('');
                        setTokenCode('');
                        setSelectedAccount('');
                      }}
                      className="w-full font-sans"
                    >
                      Volver a Conciliación
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

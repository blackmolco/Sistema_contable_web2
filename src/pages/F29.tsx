import React, { useMemo, useState } from 'react';
import { Upload, FileText, Printer, CheckCircle2, AlertCircle, Save, RefreshCw, Info } from 'lucide-react';
import { Card } from '../components/ui/Cards';
import { formatCurrency, generateId } from '../utils/calculos';
import { useApp } from '../context/AppContext';
import { RETENCION_HONORARIOS } from '../data/normativa';
import { DetalleAsiento } from '../types';

interface RCVLine {
  id: string;
  rut: string;
  razonSocial: string;
  tipoDocto: string;
  folio: string;
  neto: number;
  iva: number;
  total: number;
  cuentaId?: string;
}

export default function F29() {
  const { state, dispatch, showToast } = useApp();
  
  const [comprasNeto, setComprasNeto] = useState(0);
  const [comprasIva, setComprasIva] = useState(0);
  const [ventasNeto, setVentasNeto] = useState(0);
  const [ventasIva, setVentasIva] = useState(0);
  
  const [detallesCompras, setDetallesCompras] = useState<RCVLine[]>([]);
  
  // Guardamos un diccionario { RUT: cuentaId }
  const [proveedorMapping, setProveedorMapping] = useState<Record<string, string>>(() => {
    return JSON.parse(localStorage.getItem('proveedor_cuenta_mapping') || '{}');
  });

  // ── Período para carga automática ────────────────────────────────
  const hoy = new Date();
  const [mesAuto, setMesAuto] = useState(hoy.getMonth() + 1);
  const [anioAuto, setAnioAuto] = useState(hoy.getFullYear());

  // Totales desde libros del sistema para el período seleccionado
  const datosDelSistema = useMemo(() => {
    const matchPeriodo = (fecha: string) => {
      const d = new Date(fecha);
      return d.getMonth() + 1 === mesAuto && d.getFullYear() === anioAuto;
    };
    const ventas  = (state.libroVentas ?? []).filter(r => matchPeriodo(r.fecha));
    const compras = (state.libroCompras ?? []).filter(r => matchPeriodo(r.fecha));
    return {
      ventasNeto:  ventas.reduce((s, r) => s + r.neto,  0),
      ventasIva:   ventas.reduce((s, r) => s + r.iva,   0),
      comprasNeto: compras.reduce((s, r) => s + r.neto, 0),
      comprasIva:  compras.reduce((s, r) => s + r.iva,  0),
      countVentas:  ventas.length,
      countCompras: compras.length,
    };
  }, [state.libroVentas, state.libroCompras, mesAuto, anioAuto]);

  const cargarDesistema = () => {
    setVentasNeto(datosDelSistema.ventasNeto);
    setVentasIva(datosDelSistema.ventasIva);
    setComprasNeto(datosDelSistema.comprasNeto);
    setComprasIva(datosDelSistema.comprasIva);
    showToast('success', 'Datos cargados',
      `Ventas: ${datosDelSistema.countVentas} docs | Compras: ${datosDelSistema.countCompras} docs`);
  };
  // ─────────────────────────────────────────────────────────────────

  const honorariosRetencion = useMemo(
    () => state.honorarios.reduce((sum, h) => sum + (h.retencion || 0), 0),
    [state.honorarios]
  );

  // PPM (1% por defecto)
  const [tasaPpm, setTasaPpm] = useState(1);
  const ppm = (ventasNeto * tasaPpm) / 100;

  const totalAPagar = (ventasIva - comprasIva) + honorariosRetencion + ppm;

  // --- Lógica de Cierre de IVA ---
  const buscarCuenta = (codigo: string, defaultNombre: string, defaultId: string) => {
    const c = state.cuentas?.find(x => x.codigo === codigo || x.nombre.toLowerCase().includes(defaultNombre.toLowerCase()));
    return {
      cuentaId: c?.id || defaultId,
      cuentaCodigo: c?.codigo || codigo,
      cuentaNombre: c?.nombre || defaultNombre
    };
  };

  const glosaCierreIva = `Cierre de IVA Periodo ${mesAuto}/${anioAuto}`;
  const asientoCierreExistente = (state.asientos || []).find(
    a => a.glosa === glosaCierreIva && a.estado !== 'anulado'
  );

  const cIvaDebito = buscarCuenta('2-01-002-0002', 'IVA Débito Fiscal', 'iva-debito-fiscal');
  const cIvaCredito = buscarCuenta('1-02-002-0001', 'IVA Crédito Fiscal', 'iva-credito-fiscal');
  const cIvaPagar = buscarCuenta('2-01-002-0003', 'IVA por Pagar', 'iva-por-pagar');
  const cRemanente = buscarCuenta('1-02-002-0002', 'Remanente de Crédito Fiscal', 'remanente-credito-fiscal');

  const debeDebito = ventasIva;
  const haberCredito = comprasIva;
  const difIva = ventasIva - comprasIva;

  const detallesCierre: DetalleAsiento[] = [];
  if (debeDebito > 0) {
    detallesCierre.push({ ...cIvaDebito, debe: debeDebito, haber: 0 });
  }
  if (haberCredito > 0) {
    detallesCierre.push({ ...cIvaCredito, debe: 0, haber: haberCredito });
  }

  if (difIva > 0) {
    detallesCierre.push({ ...cIvaPagar, debe: 0, haber: difIva });
  } else if (difIva < 0) {
    detallesCierre.push({ ...cRemanente, debe: Math.abs(difIva), haber: 0 });
  }

  const totalDebeCierre = detallesCierre.reduce((acc, d) => acc + d.debe, 0);
  const totalHaberCierre = detallesCierre.reduce((acc, d) => acc + d.haber, 0);

  const generarAsientoCierreIva = () => {
    if (ventasIva === 0 && comprasIva === 0) {
      showToast('error', 'Sin montos', 'No hay saldos de IVA para cerrar en este período.');
      return;
    }

    if (asientoCierreExistente) {
      showToast('warning', 'Ya contabilizado', 'El asiento de cierre de IVA ya fue ingresado.');
      return;
    }

    const nuevoAsiento = {
      id: generateId(),
      fecha: new Date(anioAuto, mesAuto, 0).toISOString().split('T')[0], // Último día del período
      numero: state.numeroAsiento || 1,
      glosa: glosaCierreIva,
      detalles: detallesCierre,
      totalDebe: totalDebeCierre,
      totalHaber: totalHaberCierre,
      estado: 'aprobado' as const,
      tipo: 'traspaso'
    };

    dispatch({ type: 'ADD_ASIENTO', payload: nuevoAsiento });
    showToast('success', 'Asiento de Cierre Registrado', `Se ha generado el asiento de cierre de IVA para el periodo ${mesAuto}/${anioAuto}.`);
  };


  // Lógica simple para parsear el CSV del SII
  const parseCSV = (file: File, type: 'compras' | 'ventas') => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n');
      let neto = 0;
      let iva = 0;
      const lineasParsadas: RCVLine[] = [];
      
      lines.forEach((line, index) => {
        if (index === 0 || !line.trim()) return; // Saltar cabecera o vacías
        const cols = line.split(';');
        if (cols.length >= 8) {
          const tipoDocto = cols[0];
          const folio = cols[1] || '';
          const rut = cols[3] || cols[2] || '';
          const razonSocial = cols[4] || cols[3] || '';
          
          const mNeto = parseInt(cols[cols.length - 3].replace(/\D/g, '')) || 0;
          const mIva = parseInt(cols[cols.length - 2].replace(/\D/g, '')) || 0;
          const mTotal = parseInt(cols[cols.length - 1].replace(/\D/g, '')) || 0;
          
          if (type === 'compras') {
             const defaultCuentaId = proveedorMapping[rut] || '';
             lineasParsadas.push({
               id: generateId(), rut, razonSocial, tipoDocto, folio, neto: mNeto, iva: mIva, total: mTotal, cuentaId: defaultCuentaId
             });
          }
          
          neto += mNeto;
          iva += mIva;
        }
      });

      if (type === 'compras') {
        setComprasNeto(neto);
        setComprasIva(iva);
        setDetallesCompras(lineasParsadas);
      } else {
        setVentasNeto(neto);
        setVentasIva(iva);
      }
    };
    reader.readAsText(file);
  };

  const handlePrint = () => {
    window.print();
  };

  const guardarCentralizacionCompras = () => {
    if (detallesCompras.length === 0) {
      showToast('warning', 'Sin compras', 'Carga un RCV de compras antes de centralizar.');
      return;
    }

    const sinCuenta = detallesCompras.filter((linea) => !linea.cuentaId);
    if (sinCuenta.length > 0) {
      showToast('error', 'Cuentas incompletas', `Hay ${sinCuenta.length} linea(s) sin cuenta contable asignada.`);
      return;
    }

    const detalles = detallesCompras.map((linea) => {
      const cuenta = state.cuentas.find((c) => c.id === linea.cuentaId);
      return {
        cuentaId: linea.cuentaId!,
        cuentaCodigo: cuenta?.codigo || linea.cuentaId!,
        cuentaNombre: cuenta?.nombre || 'Cuenta clasificada',
        debe: linea.neto,
        haber: 0,
      };
    });

    if (comprasIva > 0) {
      detalles.push({
        cuentaId: 'iva-credito-fiscal',
        cuentaCodigo: '1-02-002-0001',
        cuentaNombre: 'IVA Credito Fiscal',
        debe: comprasIva,
        haber: 0,
      });
    }

    detalles.push({
      cuentaId: 'proveedores',
      cuentaCodigo: '2-01-001-0001',
      cuentaNombre: 'Proveedores (Acreedores por Compras)',
      debe: 0,
      haber: comprasNeto + comprasIva,
    });

    dispatch({
      type: 'ADD_ASIENTO',
      payload: {
        id: generateId(),
        fecha: new Date().toISOString(),
        numero: state.numeroAsiento,
        glosa: 'Centralizacion RCV Compras desde F29',
        detalles,
        totalDebe: comprasNeto + comprasIva,
        totalHaber: comprasNeto + comprasIva,
        estado: 'aprobado',
      },
    });

    showToast('success', 'Centralizacion guardada', 'Se genero el asiento contable del RCV de compras.');
  };

  const updateMapping = (rut: string, cuentaId: string, idLinea: string) => {
    // 1. Actualizar el diccionario (localStorage y state)
    const newMapping = { ...proveedorMapping, [rut]: cuentaId };
    setProveedorMapping(newMapping);
    localStorage.setItem('proveedor_cuenta_mapping', JSON.stringify(newMapping));
    
    // 2. Actualizar las líneas actuales que tengan ese mismo RUT
    setDetallesCompras(prev => prev.map(linea => 
      linea.rut === rut ? { ...linea, cuentaId } : linea
    ));
  };

  const cuentasGasto = state.cuentas.filter(c => c.codigo.startsWith('5') || c.codigo.startsWith('4'));

  return (
    <div className="space-y-6 max-w-5xl mx-auto f29-container">
      {/* Estilos específicos para impresión PDF */}
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            .f29-container, .f29-container * {
              visibility: visible;
            }
            .f29-container {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }
            .no-print {
              display: none !important;
            }
            .print-border {
              border: 2px solid #000 !important;
            }
          }
        `}
      </style>

      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Borrador F29 y Centralización</h1>
          <p className="text-sm text-gray-500 mt-1">
            Sube tu RCV. El sistema recordará a qué cuenta contable asignas cada RUT.
          </p>
        </div>
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2D5A87] transition-colors flex items-center gap-2"
        >
          <Printer size={18} />
          Generar PDF Oficial
        </button>
      </div>

      {/* ── Carga automática desde libros del sistema ── */}
      <div className="no-print flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <Info size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-blue-800 mb-2">Cargar desde Libros del Sistema</p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-blue-700 font-medium">Mes</label>
              <select
                value={mesAuto}
                onChange={e => setMesAuto(Number(e.target.value))}
                className="ml-2 text-sm border border-blue-300 rounded-lg px-2 py-1 bg-white"
              >
                {['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'].map((m, i) => (
                  <option key={i} value={i+1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-blue-700 font-medium">Año</label>
              <input
                type="number"
                value={anioAuto}
                onChange={e => setAnioAuto(Number(e.target.value))}
                className="ml-2 w-20 text-sm border border-blue-300 rounded-lg px-2 py-1 bg-white"
              />
            </div>
            <button
              onClick={cargarDesistema}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 active:scale-[0.97] transition-[background-color,transform]"
            >
              <RefreshCw size={14} />
              Cargar ({datosDelSistema.countVentas} ventas / {datosDelSistema.countCompras} compras)
            </button>
          </div>
        </div>
      </div>

      {/* Zona de Carga de Archivos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 no-print">
        <Card title="Libro de Ventas (CSV SII)">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors">
            <Upload className="mx-auto text-gray-400 mb-2" size={32} />
            <p className="text-sm text-gray-600 mb-4">Selecciona el CSV de Ventas</p>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => e.target.files && parseCSV(e.target.files[0], 'ventas')}
              className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
            />
          </div>
          {ventasIva > 0 && (
            <div className="mt-4 p-3 bg-emerald-50 text-emerald-700 rounded-lg flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 size={16} /> ¡Ventas cargadas correctamente!
            </div>
          )}
        </Card>

        <Card title="Libro de Compras (CSV SII)">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors">
            <Upload className="mx-auto text-gray-400 mb-2" size={32} />
            <p className="text-sm text-gray-600 mb-4">Selecciona el CSV de Compras</p>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => e.target.files && parseCSV(e.target.files[0], 'compras')}
              className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          {comprasIva > 0 && (
            <div className="mt-4 p-3 bg-blue-50 text-blue-700 rounded-lg flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 size={16} /> ¡Compras cargadas correctamente!
            </div>
          )}
        </Card>
      </div>

      {/* Mapeo Automático de Cuentas para Compras */}
      {detallesCompras.length > 0 && (
        <Card title="Contabilización Inteligente de Compras" className="no-print">
          <p className="text-xs text-gray-500 mb-4">
            Selecciona a qué cuenta contable (Gasto/Activo) corresponde cada factura. ¡El sistema lo aprenderá para el próximo mes!
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-600 text-xs">
                  <th className="p-2 border-b">RUT Proveedor</th>
                  <th className="p-2 border-b">Razón Social</th>
                  <th className="p-2 border-b">N° Doc</th>
                  <th className="p-2 border-b text-right">Neto</th>
                  <th className="p-2 border-b text-right">IVA</th>
                  <th className="p-2 border-b w-[250px]">Cuenta Contable (Clasificación)</th>
                </tr>
              </thead>
              <tbody>
                {detallesCompras.slice(0, 10).map((linea) => (
                  <tr key={linea.id} className="text-sm border-b hover:bg-gray-50">
                    <td className="p-2 font-mono text-xs">{linea.rut}</td>
                    <td className="p-2 truncate max-w-[200px]" title={linea.razonSocial}>{linea.razonSocial}</td>
                    <td className="p-2 text-xs">{linea.folio}</td>
                    <td className="p-2 text-right">{formatCurrency(linea.neto)}</td>
                    <td className="p-2 text-right">{formatCurrency(linea.iva)}</td>
                    <td className="p-2">
                      <select 
                        className={`w-full text-xs p-1.5 border rounded ${linea.cuentaId ? 'bg-emerald-50 border-emerald-300' : 'bg-red-50 border-red-300'}`}
                        value={linea.cuentaId || ''}
                        onChange={(e) => updateMapping(linea.rut, e.target.value, linea.id)}
                      >
                        <option value="">-- Seleccionar Cuenta --</option>
                        {cuentasGasto.map(c => (
                          <option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {detallesCompras.length > 10 && (
              <p className="text-center text-xs text-gray-500 mt-2 p-2 bg-gray-50 rounded">
                Mostrando 10 de {detallesCompras.length} facturas. (El mapeo se aplica por RUT).
              </p>
            )}
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={guardarCentralizacionCompras}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 flex items-center gap-2"
            >
              <Save size={16} /> Guardar Centralización
            </button>
          </div>
        </Card>
      )}

      {/* Cierre Contable de IVA */}
      {(ventasIva > 0 || comprasIva > 0) && (
        <Card title="Cierre Contable Mensual de IVA" className="no-print border-indigo-200 dark:bg-gray-800 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Este proceso genera el asiento de liquidación de IVA del mes. Cancela el IVA Crédito y Débito, registrando el impuesto por pagar o remanente.
          </p>

          <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 mb-4 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-gray-500 dark:text-gray-400 border-b pb-2">
                  <th className="p-2">Código</th>
                  <th className="p-2">Cuenta</th>
                  <th className="p-2 text-right">Debe</th>
                  <th className="p-2 text-right">Haber</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-gray-850 dark:text-gray-200">
                {detallesCierre.map((d, i) => (
                  <tr key={i} className="hover:bg-gray-100/55 dark:hover:bg-gray-800/50">
                    <td className="p-2 font-mono text-gray-500">{d.cuentaCodigo}</td>
                    <td className="p-2 font-medium">{d.cuentaNombre}</td>
                    <td className="p-2 text-right font-semibold text-blue-600 dark:text-blue-400">{d.debe > 0 ? formatCurrency(d.debe) : ''}</td>
                    <td className="p-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">{d.haber > 0 ? formatCurrency(d.haber) : ''}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-gray-200 dark:border-gray-700 font-bold">
                <tr>
                  <td colSpan={2} className="p-2 text-right">Total:</td>
                  <td className="p-2 text-right text-blue-700 dark:text-blue-400">{formatCurrency(totalDebeCierre)}</td>
                  <td className="p-2 text-right text-emerald-700 dark:text-emerald-400">{formatCurrency(totalHaberCierre)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex justify-end">
            {asientoCierreExistente ? (
              <div className="px-4 py-2 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-lg text-sm font-semibold flex items-center gap-1.5">
                <CheckCircle2 size={16} /> Cierre IVA Contabilizado (Asiento N° {asientoCierreExistente.numero})
              </div>
            ) : (
              <button
                onClick={generarAsientoCierreIva}
                className="px-4 py-2 bg-[#1E3A5F] text-white hover:bg-[#2D5A87] transition-all rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm"
              >
                <RefreshCw size={16} /> Generar Asiento de Cierre de IVA
              </button>
            )}
          </div>
        </Card>
      )}

      {/* Vista F29 (Imprimible) */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 print-border">
        <div className="text-center mb-8 border-b pb-4">
          <h2 className="text-3xl font-bold text-gray-900 tracking-wider">FORMULARIO 29</h2>
          <p className="text-sm text-gray-500 mt-2">Declaración Mensual y Pago Simultáneo de Impuestos</p>
        </div>

        <div className="space-y-8">
          {/* IVA Débito (Ventas) */}
          <section>
            <h3 className="font-bold text-lg mb-3 bg-gray-100 p-2 rounded">DÉBITO Y VENTAS (IVA)</h3>
            <div className="grid grid-cols-12 gap-4 border-b py-2">
              <div className="col-span-8 text-sm text-gray-700">Facturas Emitidas (Neto)</div>
              <div className="col-span-2 text-right text-xs font-mono text-gray-400 border border-gray-300 px-1 rounded">Cód. 503</div>
              <div className="col-span-2 text-right font-medium">{formatCurrency(ventasNeto)}</div>
            </div>
            <div className="grid grid-cols-12 gap-4 border-b py-2 bg-blue-50">
              <div className="col-span-8 text-sm font-bold text-gray-900">Total IVA Débito Fiscal</div>
              <div className="col-span-2 text-right text-xs font-mono text-blue-500 border border-blue-300 px-1 rounded bg-white">Cód. 538</div>
              <div className="col-span-2 text-right font-bold text-blue-700">{formatCurrency(ventasIva)}</div>
            </div>
          </section>

          {/* IVA Crédito (Compras) */}
          <section>
            <h3 className="font-bold text-lg mb-3 bg-gray-100 p-2 rounded">CRÉDITO Y COMPRAS (IVA)</h3>
            <div className="grid grid-cols-12 gap-4 border-b py-2">
              <div className="col-span-8 text-sm text-gray-700">Facturas Recibidas (Neto)</div>
              <div className="col-span-2 text-right text-xs font-mono text-gray-400 border border-gray-300 px-1 rounded">Cód. 514</div>
              <div className="col-span-2 text-right font-medium">{formatCurrency(comprasNeto)}</div>
            </div>
            <div className="grid grid-cols-12 gap-4 border-b py-2 bg-emerald-50">
              <div className="col-span-8 text-sm font-bold text-gray-900">Total IVA Crédito Fiscal</div>
              <div className="col-span-2 text-right text-xs font-mono text-emerald-500 border border-emerald-300 px-1 rounded bg-white">Cód. 537</div>
              <div className="col-span-2 text-right font-bold text-emerald-700">{formatCurrency(comprasIva)}</div>
            </div>
          </section>

          {/* Honorarios y PPM */}
          <section>
            <h3 className="font-bold text-lg mb-3 bg-gray-100 p-2 rounded">IMPUESTO A LA RENTA (RETENCIONES Y PPM)</h3>
            <div className="grid grid-cols-12 gap-4 border-b py-2">
              <div className="col-span-8 text-sm text-gray-700">
                Retención Boletas de Honorarios ({RETENCION_HONORARIOS.TASA_NORMA}%)
              </div>
              <div className="col-span-2 text-right text-xs font-mono text-gray-400 border border-gray-300 px-1 rounded">Cód. 151</div>
              <div className="col-span-2 text-right font-medium">{formatCurrency(honorariosRetencion)}</div>
            </div>
            <div className="grid grid-cols-12 gap-4 border-b py-2">
              <div className="col-span-4 text-sm text-gray-700 flex items-center gap-2">
                PPM Neto Ventas (Tasa
                <input 
                  type="number" 
                  value={tasaPpm} 
                  onChange={(e) => setTasaPpm(Number(e.target.value))}
                  className="w-16 px-1 border rounded no-print"
                  step="0.1"
                />%)
              </div>
              <div className="col-span-4 text-sm text-gray-500 text-right">Base: {formatCurrency(ventasNeto)}</div>
              <div className="col-span-2 text-right text-xs font-mono text-gray-400 border border-gray-300 px-1 rounded">Cód. 62</div>
              <div className="col-span-2 text-right font-medium">{formatCurrency(ppm)}</div>
            </div>
          </section>

          {/* Total a Pagar */}
          <section className="mt-8 border-t-4 border-gray-900 pt-4">
            <div className="grid grid-cols-12 gap-4 items-center">
              <div className="col-span-8 text-xl font-black text-gray-900 uppercase">
                TOTAL A PAGAR AL SII
              </div>
              <div className="col-span-2 text-right text-sm font-mono text-red-500 border border-red-300 px-1 rounded font-bold">Cód. 91</div>
              <div className="col-span-2 text-right text-2xl font-black text-red-600">
                {formatCurrency(totalAPagar > 0 ? totalAPagar : 0)}
              </div>
            </div>
            {totalAPagar < 0 && (
              <div className="mt-2 text-right text-sm text-emerald-600 font-medium flex items-center justify-end gap-1">
                <AlertCircle size={16} /> Tienes un Remanente de Crédito Fiscal a tu favor.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

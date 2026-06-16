import React, { useState, useMemo } from 'react';
import {
  RefreshCw, CheckCircle2, AlertTriangle, Search,
  BookOpen, ShoppingCart, Zap, Save,
} from 'lucide-react';
import { Card } from '../components/ui/Cards';
import { useApp } from '../context/AppContext';
import { formatCurrency, generateId } from '../utils/calculos';

// ─── Tipos locales ─────────────────────────────────────────────────────────────
interface AsignacionCuenta {
  rut: string;
  razonSocial: string;
  totalNeto: number;
  totalIva: number;
  totalFinal: number;
  cantidad: number;
  cuentaCodigo: string;
  cuentaNombre: string;
}

const MESES_NOMBRE = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

export default function CentralizacionLibros() {
  const { state, dispatch, showToast } = useApp();
  const [tipo, setTipo]   = useState<'ventas' | 'compras' | 'boletas'>('ventas');
  const [mes, setMes]     = useState(new Date().getMonth() + 1);
  const [anio, setAnio]   = useState(new Date().getFullYear());
  const [paso, setPaso]   = useState<1 | 2>(1); // 1=resumen, 2=asignación cuentas
  const [asignaciones, setAsignaciones] = useState<AsignacionCuenta[]>([]);
  const [busquedaCuenta, setBusquedaCuenta] = useState('');
  const [rutEditando, setRutEditando] = useState<string | null>(null);

  // ─── Documentos del período ─────────────────────────────────────────────────
  const docsPeriodo = useMemo(() => {
    return state.documentos.filter(d => {
      const fecha = new Date(d.fecha);
      const coincidePeriodo = fecha.getFullYear() === anio && fecha.getMonth() + 1 === mes;
      if (!coincidePeriodo) return false;

      // Ventas: facturas y facturas exentas emitidas (estado emitido)
      if (tipo === 'ventas')  return (d.tipo === 'factura' || d.tipo === 'factura_exenta') && d.estado !== 'pendiente';
      // Boletas: boletas de cualquier tipo
      if (tipo === 'boletas') return d.tipo === 'boleta' || d.tipo === 'boleta_electronica' || d.tipo === 'boleta_exenta';
      // Compras: facturas de compra importadas del SII (estado pendiente) O facturas recibidas
      if (tipo === 'compras') return d.tipo === 'factura_compra' || d.estado === 'pendiente';
      return false;
    });
  }, [state.documentos, mes, anio, tipo]);

  const totalNeto  = docsPeriodo.reduce((s, d) => s + (d.neto ?? d.subtotal ?? 0), 0);
  const totalIva   = docsPeriodo.reduce((s, d) => s + (d.iva ?? 0), 0);
  const totalFinal = docsPeriodo.reduce((s, d) => s + (d.total ?? 0), 0);

  // ─── Paso 1 → Paso 2: agrupar por RUT y precargar cuentas guardadas ─────────
  const prepararAsignaciones = () => {
    if (docsPeriodo.length === 0) {
      showToast('error', 'Sin documentos', `No hay documentos de ${tipo} en el período seleccionado.`);
      return;
    }

    // Para ventas/boletas no necesitamos asignación de cuenta por RUT (siempre van a la misma cuenta)
    if (tipo === 'ventas' || tipo === 'boletas') {
      generarAsientoDirecto();
      return;
    }

    // Para compras: agrupar por RUT y precargar la cuenta guardada si existe
    const mapaRut = new Map<string, AsignacionCuenta>();
    docsPeriodo.forEach(d => {
      const rut  = d.rutCliente ?? d.receptor?.rut ?? 'SIN-RUT';
      const razon = d.razonSocialCliente ?? d.receptor?.razonSocial ?? rut;
      const neto  = d.neto ?? d.subtotal ?? 0;
      const iva   = d.iva ?? 0;
      const total = d.total ?? 0;

      const cuentaGuardada = state.rutCuentas[rut];
      if (!mapaRut.has(rut)) {
        mapaRut.set(rut, {
          rut, razonSocial: razon,
          totalNeto: 0, totalIva: 0, totalFinal: 0, cantidad: 0,
          cuentaCodigo: cuentaGuardada?.cuentaCodigo ?? '',
          cuentaNombre: cuentaGuardada?.cuentaNombre ?? '',
        });
      }
      const entry = mapaRut.get(rut)!;
      entry.totalNeto  += neto;
      entry.totalIva   += iva;
      entry.totalFinal += total;
      entry.cantidad++;
    });

    setAsignaciones(Array.from(mapaRut.values()));
    setPaso(2);
  };

  // ─── Cuentas filtradas para el selector ────────────────────────────────────
  // CORRECCIÓN: el estado global usa state.cuentas (no state.planCuentas)
  const todasLasCuentas = state.cuentas ?? [];
  const cuentasFiltradas = useMemo(() =>
    todasLasCuentas
      .filter(c =>
        (c.tipo === 'gasto' || c.tipo === 'activo' || !c.tipo) &&
        (c.codigo?.includes(busquedaCuenta) ||
         c.nombre?.toLowerCase().includes(busquedaCuenta.toLowerCase()))
      )
      .slice(0, 30)
  , [todasLasCuentas, busquedaCuenta]);

  const asignarCuenta = (rut: string, codigo: string, nombre: string) => {
    setAsignaciones(prev => prev.map(a =>
      a.rut === rut ? { ...a, cuentaCodigo: codigo, cuentaNombre: nombre } : a
    ));
    // Guardar en el mapping global
    dispatch({ type: 'SET_RUT_CUENTA', payload: { rut, cuentaCodigo: codigo, cuentaNombre: nombre } });
    setRutEditando(null);
    setBusquedaCuenta('');
  };

  // ─── Eliminar asientos anteriores del mismo tipo y período ─────────────────
  const eliminarAsientosExistentes = (prefijo: string, periodo: string) => {
    state.asientos
      .filter(a => a.glosa.includes(prefijo) && a.glosa.includes(periodo))
      .forEach(a => dispatch({ type: 'DELETE_ASIENTO', payload: a.id }));
  };

  // ─── Generar asiento de ventas/boletas directamente ─────────────────────────
  const generarAsientoDirecto = () => {
    const esBoleta = tipo === 'boletas';
    const nombreTipo = esBoleta ? 'Boletas Emitidas' : 'Ventas (Facturas)';
    const periodo = `${MESES_NOMBRE[mes - 1]} ${anio}`;
    eliminarAsientosExistentes(`Centralización ${nombreTipo}`, periodo);

    // Boletas: Banco a Venta + IVA (ya pagadas)
    // Facturas: CxC a Venta + IVA (por cobrar)
    const detalles = [
      {
        cuentaId: esBoleta ? 'banco' : 'cxc',
        cuentaCodigo: esBoleta ? '1-01-002-0001' : '1-02-001-0001',
        cuentaNombre: esBoleta ? 'Banco Cuenta Corriente' : 'Clientes (Deudores por Ventas)',
        debe: totalFinal, haber: 0,
      },
      {
        cuentaId: 'venta',
        cuentaCodigo: '4-01-001-0001',
        cuentaNombre: 'Ventas',
        debe: 0, haber: totalNeto,
      },
    ];

    if (totalIva > 0) {
      detalles.push({
        cuentaId: 'iva-debito',
        cuentaCodigo: '2-01-002-0001',
        cuentaNombre: 'IVA Débito Fiscal',
        debe: 0, haber: totalIva,
      });
    }

    const asiento = {
      id: generateId(),
      fecha: `${anio}-${String(mes).padStart(2, '0')}-28`,
      numero: state.numeroAsiento,
      glosa: `Centralización ${nombreTipo} — ${periodo}`,
      detalles,
      totalDebe: totalFinal,
      totalHaber: totalNeto + totalIva,
      estado: 'aprobado' as const,
    };

    dispatch({ type: 'ADD_ASIENTO', payload: asiento });
    showToast('success', '¡Centralización OK!',
      `Asiento de ${nombreTipo} por ${formatCurrency(totalFinal)} generado en el Libro Diario.`);
    setPaso(1);
  };

  // ─── Generar asiento de compras con cuentas por RUT ─────────────────────────
  const generarAsientoCompras = () => {
    const sinCuenta = asignaciones.filter(a => !a.cuentaCodigo);
    if (sinCuenta.length > 0) {
      showToast('error', 'Cuentas incompletas',
        `Faltan ${sinCuenta.length} proveedor(es) sin cuenta contable asignada.`);
      return;
    }

    const periodo = `${MESES_NOMBRE[mes - 1]} ${anio}`;
    eliminarAsientosExistentes('Centralización Libro de Compras', periodo);
    const detalles: any[] = [];

    // Un cargo por proveedor a su cuenta de gasto
    asignaciones.forEach(a => {
      detalles.push({
        cuentaId: `gasto-${a.rut}`,
        cuentaCodigo: a.cuentaCodigo,
        cuentaNombre: a.cuentaNombre,
        debe: a.totalNeto, haber: 0,
      });
    });

    // IVA Crédito Fiscal (si lo hay)
    if (totalIva > 0) {
      detalles.push({
        cuentaId: 'iva-credito',
        cuentaCodigo: '1-02-002-0001',
        cuentaNombre: 'IVA Crédito Fiscal',
        debe: totalIva, haber: 0,
      });
    }

    // Proveedores (CxP)
    detalles.push({
      cuentaId: 'cxp',
      cuentaCodigo: '2-01-001-0001',
      cuentaNombre: 'Proveedores (Acreedores por Compras)',
      debe: 0, haber: totalFinal,
    });

    const asiento = {
      id: generateId(),
      fecha: `${anio}-${String(mes).padStart(2, '0')}-28`,
      numero: state.numeroAsiento,
      glosa: `Centralización Libro de Compras — ${periodo}`,
      detalles,
      totalDebe: totalNeto + totalIva,
      totalHaber: totalFinal,
      estado: 'aprobado' as const,
    };

    dispatch({ type: 'ADD_ASIENTO', payload: asiento });
    showToast('success', '¡Centralización OK!',
      `Asiento de Compras por ${formatCurrency(totalFinal)} generado. Las cuentas por proveedor fueron guardadas.`);
    setPaso(1);
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-[#1E3A5F]/10 rounded-lg">
          <RefreshCw className="text-[#1E3A5F]" size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Centralización de Libros</h1>
          <p className="text-sm text-gray-500 mt-1">
            Contabiliza automáticamente el Libro de Ventas, Boletas o Compras de un período al Libro Diario.
          </p>
        </div>
      </div>

      {paso === 1 && (
        <>
          {/* Selector tipo + período */}
          <Card>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {([
                { key: 'ventas',  label: 'Libro de Ventas',   icon: <BookOpen  size={18}/>, color: 'blue'   },
                { key: 'boletas', label: 'Boletas Emitidas',  icon: <Zap       size={18}/>, color: 'emerald'},
                { key: 'compras', label: 'Libro de Compras',  icon: <ShoppingCart size={18}/>, color: 'amber'},
              ] as const).map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setTipo(opt.key)}
                  className={`py-4 rounded-xl border-2 font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                    tipo === opt.key
                      ? `border-${opt.color}-500 bg-${opt.color}-50 text-${opt.color}-700`
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>

            {tipo === 'boletas' && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2">
                <CheckCircle2 className="text-emerald-600 flex-shrink-0 mt-0.5" size={16} />
                <p className="text-xs text-emerald-800">
                  Las boletas se contabilizan como <strong>Banco (Debe) → Ventas + IVA (Haber)</strong> porque se asume que están pagadas al momento de la emisión.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Mes</label>
                <select value={mes} onChange={e => setMes(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg text-sm">
                  {MESES_NOMBRE.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Año</label>
                <input type="number" value={anio} onChange={e => setAnio(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-500 mb-1">Documentos encontrados</p>
                <p className="text-2xl font-black text-[#1E3A5F]">
                  {docsPeriodo.length}
                  <span className="text-sm font-normal text-gray-500 ml-2">{MESES_NOMBRE[mes - 1]} {anio}</span>
                </p>
              </div>
            </div>
          </Card>

          {/* Resumen financiero */}
          {docsPeriodo.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              <Card className="text-center">
                <p className="text-xs text-gray-500 mb-1">Neto</p>
                <p className="text-xl font-black text-gray-900">{formatCurrency(totalNeto)}</p>
              </Card>
              <Card className="text-center">
                <p className="text-xs text-gray-500 mb-1">IVA</p>
                <p className="text-xl font-black text-gray-900">{formatCurrency(totalIva)}</p>
              </Card>
              <Card className="bg-[#1E3A5F] text-center">
                <p className="text-xs text-white/70 mb-1">TOTAL</p>
                <p className="text-xl font-black text-white">{formatCurrency(totalFinal)}</p>
              </Card>
            </div>
          )}

          <button
            onClick={prepararAsignaciones}
            disabled={docsPeriodo.length === 0}
            className="w-full py-4 bg-[#1E3A5F] text-white rounded-xl font-bold text-lg hover:bg-[#2D5A87] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            <RefreshCw size={22} />
            {tipo === 'compras' ? 'Siguiente: Asignar Cuentas por Proveedor →' : `Centralizar ${MESES_NOMBRE[mes - 1]} ${anio}`}
          </button>
        </>
      )}

      {/* ── PASO 2: Asignación de cuentas (solo Compras) ───────────────────── */}
      {paso === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Asignar Cuenta Contable por Proveedor</h2>
            <button onClick={() => setPaso(1)} className="text-sm text-gray-500 hover:underline">← Volver</button>
          </div>

          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 flex items-start gap-2 text-xs text-blue-800">
            <AlertTriangle className="text-blue-600 flex-shrink-0 mt-0.5" size={16} />
            Las cuentas que asignes se <strong>guardarán automáticamente</strong> por RUT para futuras centralizaciones.
            Los campos pre-rellenados corresponden a asignaciones previas.
          </div>

          <div className="space-y-4">
            {asignaciones.map(a => (
              <Card key={a.rut} className={`border-2 ${a.cuentaCodigo ? 'border-emerald-300 bg-emerald-50/30' : 'border-amber-300 bg-amber-50/30'}`}>
                {/* Datos del proveedor */}
                <div className="flex items-start gap-3 mb-3">
                  <div className={`p-2 rounded-lg flex-shrink-0 ${a.cuentaCodigo ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                    {a.cuentaCodigo
                      ? <CheckCircle2 className="text-emerald-600" size={18} />
                      : <AlertTriangle className="text-amber-600" size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 truncate">{a.razonSocial || 'Sin nombre'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      RUT: <span className="font-mono">{a.rut}</span> · {a.cantidad} factura{a.cantidad !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-500">Neto</p>
                    <p className="font-bold text-gray-900 text-sm">{formatCurrency(a.totalNeto)}</p>
                  </div>
                </div>

                {/* Selector de cuenta contable */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">
                    {a.cuentaCodigo ? '✅ Cuenta asignada:' : '⚠️ Selecciona la cuenta contable de gasto:'}
                  </label>

                  {/* Buscador de texto */}
                  <div className="relative mb-2">
                    <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar por código o nombre de cuenta..."
                      value={rutEditando === a.rut ? busquedaCuenta : ''}
                      onFocus={() => { setRutEditando(a.rut); setBusquedaCuenta(''); }}
                      onChange={e => { setRutEditando(a.rut); setBusquedaCuenta(e.target.value); }}
                      className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  {/* Lista de cuentas (siempre visible al enfocar o cuando hay búsqueda) */}
                  {rutEditando === a.rut && (
                    <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto bg-white shadow-sm">
                      {(busquedaCuenta
                        ? cuentasFiltradas
                        : todasLasCuentas.filter(c => c.tipo === 'gasto' || c.tipo === 'activo' || !c.tipo).slice(0, 50)
                      ).map(c => (
                        <button
                          key={c.id}
                          onClick={() => asignarCuenta(a.rut, c.codigo, c.nombre)}
                          className={`w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 border-b border-gray-100 last:border-0 flex items-center gap-3 ${
                            a.cuentaCodigo === c.codigo ? 'bg-blue-50 font-semibold' : ''
                          }`}
                        >
                          <span className="font-mono text-blue-700 text-xs w-20 flex-shrink-0">{c.codigo}</span>
                          <span className="text-gray-800 truncate">{c.nombre}</span>
                        </button>
                      ))}
                      {busquedaCuenta && cuentasFiltradas.length === 0 && (
                        <p className="px-3 py-3 text-sm text-gray-400 text-center">Sin resultados para "{busquedaCuenta}"</p>
                      )}
                    </div>
                  )}

                  {/* Cuenta seleccionada actualmente */}
                  {a.cuentaCodigo && rutEditando !== a.rut && (
                    <div className="mt-2 flex items-center gap-2 p-2 bg-emerald-100 rounded-lg">
                      <span className="font-mono text-emerald-700 font-bold text-sm">{a.cuentaCodigo}</span>
                      <span className="text-emerald-800 text-sm">{a.cuentaNombre}</span>
                      <button
                        onClick={() => { setRutEditando(a.rut); setBusquedaCuenta(''); }}
                        className="ml-auto text-xs text-emerald-600 hover:underline flex-shrink-0"
                      >
                        Cambiar
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>

          <button
            onClick={generarAsientoCompras}
            className="w-full py-4 bg-[#1E3A5F] text-white rounded-xl font-bold text-lg hover:bg-[#2D5A87] transition-colors flex items-center justify-center gap-3"
          >
            <Save size={22} /> Generar Asiento Contable de Compras
          </button>
        </div>
      )}
    </div>
  );
}

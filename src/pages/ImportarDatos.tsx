import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle,
  AlertCircle,
  Table,
  Users,
  ShoppingCart,
  Package,
  CreditCard,
  AlertTriangle,
  Info,
  Eye,
  ChevronDown,
  ChevronUp,
  Code2,
} from 'lucide-react';
import { Card, Button } from '../components/ui/Cards';
import { TableSkeleton } from '../components/ui/Skeleton';
import { ImportService, Plantilla, DatosImportados } from '../services/importService';
import { useRemuneraciones } from '../context/AppContext';
import type { Trabajador } from '../types';

// ─── tipos locales ─────────────────────────────────────────────────────────────
type Paso = 'seleccion' | 'preview' | 'resultado';

// ─── XML DTE parser ────────────────────────────────────────────────────────────
interface DTERegistro {
  tipo: string;
  folio: string;
  rut: string;
  razonSocial: string;
  fecha: string;
  neto: number;
  iva: number;
  total: number;
  exento: number;
}

function parsearXMLDTE(xmlText: string): DTERegistro[] {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');
    const registros: DTERegistro[] = [];

    // Documentos individuales (EnvioDTE / SetDTE)
    const docs = doc.querySelectorAll('DTE, Documento');
    docs.forEach(dte => {
      const encabezado = dte.querySelector('Encabezado, Encabezamiento');
      if (!encabezado) return;
      const idDoc = encabezado.querySelector('IdDoc');
      const emisor = encabezado.querySelector('Emisor');
      const receptor = encabezado.querySelector('Receptor');
      const totales = encabezado.querySelector('Totales');
      if (!idDoc || !totales) return;

      registros.push({
        tipo:        idDoc.querySelector('TipoDTE')?.textContent ?? '',
        folio:       idDoc.querySelector('Folio')?.textContent ?? '',
        rut:         (receptor ?? emisor)?.querySelector('RUTRecep, RUTEmisor, RUT')?.textContent ?? '',
        razonSocial: (receptor ?? emisor)?.querySelector('RznSocRecep, RznSocEmisor, RznSoc')?.textContent ?? '',
        fecha:       idDoc.querySelector('FchEmis')?.textContent ?? '',
        neto:        Number(totales.querySelector('MntNeto')?.textContent ?? 0),
        iva:         Number(totales.querySelector('IVA')?.textContent ?? 0),
        total:       Number(totales.querySelector('MntTotal')?.textContent ?? 0),
        exento:      Number(totales.querySelector('MntExe')?.textContent ?? 0),
      });
    });

    return registros;
  } catch {
    return [];
  }
}

// ─── helpers ───────────────────────────────────────────────────────────────────
const TIPO_LABELS: Record<string, string> = {
  trabajadores:  'Trabajadores',
  asientos:      'Asientos Contables',
  facturas:      'Facturas',
  inventario:    'Inventario',
  plan_cuentas:  'Plan de Cuentas',
};

const AFP_NOMBRES: Record<string, string> = {
  afp_capital:   'AFP Capital',
  afp_cuprum:    'AFP Cuprum',
  afp_habitat:   'AFP Hábitat',
  afp_modelo:    'AFP Modelo',
  afp_planvital: 'AFP PlanVital',
  afp_provida:   'AFP ProVida',
  afp_uno:       'AFP Uno',
  afp_ninguna:   'Sin Afiliación AFP',
};

const TIPO_CONTRATO_LABELS: Record<string, string> = {
  indefinido: 'Indefinido',
  plazo_fijo: 'Plazo Fijo',
  por_obra:   'Por Obra',
  honorarios: 'Honorarios',
  practica:   'Práctica',
};

// ═══════════════════════════════════════════════════════════════════════════════
export default function ImportarDatos() {
  const plantillas              = ImportService.getPlantillas();
  const { state: remState, dispatch: remDispatch } = useRemuneraciones();
  const trabajadoresExistentes  = remState.trabajadores;

  const [tipoSeleccionado, setTipoSeleccionado] = useState('');
  const [archivo,          setArchivo]           = useState<File | null>(null);

  // XML DTE state
  const [xmlArchivo,    setXmlArchivo]    = useState<File | null>(null);
  const [xmlRegistros,  setXmlRegistros]  = useState<DTERegistro[] | null>(null);
  const [xmlCargando,   setXmlCargando]   = useState(false);
  const [xmlError,      setXmlError]      = useState('');
  const xmlInputRef = useRef<HTMLInputElement>(null);
  const [cargando,         setCargando]           = useState(false);
  const [paso,             setPaso]               = useState<Paso>('seleccion');
  const [resultado,        setResultado]           = useState<DatosImportados | null>(null);
  const [guardado,         setGuardado]            = useState(false);
  const [mostrarPreview,   setMostrarPreview]      = useState(true);
  const [mostrarErrores,   setMostrarErrores]      = useState(true);

  const historial   = ImportService.getHistorial();
  const inputRef    = useRef<HTMLInputElement>(null);

  // ── selección de archivo ────────────────────────────────────────────────────
  const handleArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setArchivo(f);
      setResultado(null);
      setPaso('seleccion');
      setGuardado(false);
    }
  };

  // ── procesar CSV ────────────────────────────────────────────────────────────
  const handleImportar = async () => {
    if (!archivo || !tipoSeleccionado) return;
    setCargando(true);
    try {
      const res = await ImportService.importarArchivo(tipoSeleccionado, archivo);
      setResultado(res);
      setPaso('preview');
      ImportService.guardarImportacion(res);
    } catch {
      setResultado({
        tipo: tipoSeleccionado as DatosImportados['tipo'],
        filas: 0,
        errores: ['Error inesperado al procesar el archivo.'],
        datos:  [],
      });
      setPaso('preview');
    }
    setCargando(false);
  };

  // ── confirmar y guardar al store ────────────────────────────────────────────
  const handleConfirmar = () => {
    if (!resultado) return;

    if (resultado.tipo === 'trabajadores' && resultado.trabajadores?.length) {
      // Detectar RUTs duplicados con los ya existentes
      const rutsExistentes = new Set(trabajadoresExistentes.map(t => t.rut.replace(/\./g, '')));
      let importados = 0;
      let omitidos   = 0;

      resultado.trabajadores.forEach((t: Trabajador) => {
        const rutLimpio = t.rut.replace(/\./g, '');
        if (rutsExistentes.has(rutLimpio)) {
          omitidos++;
        } else {
          remDispatch({ type: 'ADD_TRABAJADOR', payload: t });
          importados++;
        }
      });

      setResultado(prev => prev ? {
        ...prev,
        filas:   importados,
        errores: omitidos > 0
          ? [...(prev.errores ?? []), `${omitidos} trabajador(es) omitido(s) por RUT duplicado`]
          : (prev.errores ?? []),
      } : prev);
    }

    setGuardado(true);
    setPaso('resultado');
  };

  // ── reset ───────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setArchivo(null);
    setTipoSeleccionado('');
    setResultado(null);
    setPaso('seleccion');
    setGuardado(false);
  };

  // ── iconos ──────────────────────────────────────────────────────────────────
  const getIcono = (tipo: string) => {
    switch (tipo) {
      case 'trabajadores':  return <Users         size={20} className="text-blue-600"    />;
      case 'asientos':      return <CreditCard    size={20} className="text-purple-600"  />;
      case 'facturas':      return <ShoppingCart  size={20} className="text-emerald-600" />;
      case 'inventario':    return <Package       size={20} className="text-amber-600"   />;
      case 'plan_cuentas':  return <Table         size={20} className="text-gray-600"    />;
      default:              return <FileSpreadsheet size={20} className="text-gray-600"  />;
    }
  };

  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Importar Datos</h1>
        <p className="text-sm text-gray-500 mt-1">
          Carga masiva desde archivos CSV — descargue la plantilla, complete los datos e importe.
        </p>
      </div>

      {/* AVISO FORMATO */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <Info size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">Solo formato CSV</p>
          <p className="text-xs text-blue-700">
            Se acepta separador <strong>coma (,)</strong>, <strong>punto y coma (;)</strong> o <strong>tabulación</strong> — se detecta automáticamente.
            Los archivos Excel (.xlsx) deben convertirse primero: en Excel use
            <strong> Archivo → Guardar como → CSV UTF-8</strong>.
            Los nombres de columna pueden estar en singular o plural y con o sin tilde.
          </p>
        </div>
      </div>

      {/* PLANTILLAS */}
      <Card title="Plantillas Disponibles">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plantillas.map((p) => (
            <div
              key={p.id}
              onClick={() => setTipoSeleccionado(p.tipo)}
              className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                tipoSeleccionado === p.tipo
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  {getIcono(p.tipo)}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">{p.nombre}</h3>
                  <p className="text-xs text-gray-500">{p.descripcion}</p>
                </div>
              </div>

              {/* Columnas de la plantilla */}
              <div className="flex flex-wrap gap-1 mb-3">
                {p.columnas.map(c => (
                  <span key={c} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded font-mono">
                    {c}
                  </span>
                ))}
              </div>

              <Button
                variant="ghost"
                size="sm"
                icon={<Download size={14} />}
                onClick={(e) => { e.stopPropagation(); ImportService.descargarPlantilla(p.id); }}
              >
                Descargar plantilla
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* ── PASO 1: SELECCIÓN Y CARGA ─────────────────────────────────────── */}
      {paso === 'seleccion' && (
        <Card title="Cargar Archivo">
          <div className="space-y-4">
            {/* Selector tipo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de datos a importar
              </label>
              <select
                value={tipoSeleccionado}
                onChange={e => setTipoSeleccionado(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">Seleccionar tipo...</option>
                {plantillas.map(p => (
                  <option key={p.tipo} value={p.tipo}>{p.nombre}</option>
                ))}
              </select>
            </div>

            {/* Drop zone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Archivo CSV
              </label>
              {/* Input oculto — activado programáticamente con el ref */}
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                onChange={handleArchivo}
                className="hidden"
              />
              <div
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                  archivo ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'
                }`}
              >
                <Upload size={36} className={`mx-auto mb-3 ${archivo ? 'text-blue-500' : 'text-gray-400'}`} />
                {archivo ? (
                  <>
                    <p className="font-medium text-blue-700">{archivo.name}</p>
                    <p className="text-xs text-blue-500 mt-1">
                      {(archivo.size / 1024).toFixed(1)} KB · haz clic para cambiar
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-gray-600 font-medium">Haz clic aquí para seleccionar el archivo CSV</p>
                    <p className="text-xs text-gray-400 mt-1">Soporta separador coma, punto y coma o tabulación</p>
                  </>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={handleReset}>Limpiar</Button>
              <Button
                onClick={handleImportar}
                disabled={!archivo || !tipoSeleccionado || cargando}
                icon={<Upload size={16} />}
              >
                {cargando ? 'Procesando...' : 'Procesar archivo'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Skeleton mientras se procesa el archivo */}
      {cargando && <TableSkeleton rows={6} cols={5} />}

      {/* ── PASO 2: PREVIEW Y CONFIRMACIÓN ──────────────────────────────── */}
      {paso === 'preview' && resultado && (
        <div className="space-y-4">
          {/* Resumen */}
          <div className={`p-4 rounded-xl border flex items-start gap-3 ${
            resultado.errores.length === 0
              ? 'bg-emerald-50 border-emerald-200'
              : resultado.filas > 0
              ? 'bg-amber-50 border-amber-200'
              : 'bg-red-50 border-red-200'
          }`}>
            {resultado.errores.length === 0 ? (
              <CheckCircle size={22} className="text-emerald-600 mt-0.5 flex-shrink-0" />
            ) : resultado.filas > 0 ? (
              <AlertTriangle size={22} className="text-amber-600 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle size={22} className="text-red-600 mt-0.5 flex-shrink-0" />
            )}
            <div>
              <p className="font-semibold text-gray-900">
                {resultado.filas} registro(s) listos para importar
                {resultado.errores.length > 0 && ` · ${resultado.errores.length} error(es)`}
              </p>
              <p className="text-sm text-gray-600 mt-0.5">
                Tipo: <strong>{TIPO_LABELS[resultado.tipo] ?? resultado.tipo}</strong>
                {resultado.tipo === 'trabajadores' && resultado.trabajadores && (
                  <> · {resultado.trabajadores.length} trabajador(es) válidos</>
                )}
              </p>
            </div>
          </div>

          {/* Errores */}
          {resultado.errores.length > 0 && (
            <Card>
              <button
                className="flex items-center justify-between w-full"
                onClick={() => setMostrarErrores(!mostrarErrores)}
              >
                <h3 className="font-semibold text-red-700 flex items-center gap-2">
                  <AlertCircle size={16} />
                  {resultado.errores.length} error(es) encontrados
                </h3>
                {mostrarErrores ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {mostrarErrores && (
                <ul className="mt-3 space-y-1">
                  {resultado.errores.map((e, i) => (
                    <li key={i} className="text-sm text-red-700 bg-red-50 rounded px-3 py-1.5 font-mono text-xs">
                      {e}
                    </li>
                  ))}
                </ul>
              )}
              {resultado.filas === 0 && (
                <p className="mt-3 text-sm text-gray-500">
                  No hay registros válidos para importar. Corrija el archivo y vuelva a intentarlo.
                </p>
              )}
            </Card>
          )}

          {/* Preview tabla trabajadores */}
          {resultado.tipo === 'trabajadores' && resultado.trabajadores && resultado.trabajadores.length > 0 && (
            <Card>
              <button
                className="flex items-center justify-between w-full mb-3"
                onClick={() => setMostrarPreview(!mostrarPreview)}
              >
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <Eye size={16} />
                  Vista previa — {resultado.trabajadores.length} trabajador(es)
                </h3>
                {mostrarPreview ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {mostrarPreview && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 text-gray-600 border-b">
                        <th className="text-left py-2 px-3 font-medium">RUT</th>
                        <th className="text-left py-2 px-3 font-medium">Nombres</th>
                        <th className="text-left py-2 px-3 font-medium">Apellidos</th>
                        <th className="text-left py-2 px-3 font-medium">Contrato</th>
                        <th className="text-right py-2 px-3 font-medium">Sueldo Base</th>
                        <th className="text-left py-2 px-3 font-medium">AFP</th>
                        <th className="text-left py-2 px-3 font-medium">Isapre</th>
                        <th className="text-right py-2 px-3 font-medium">Cargas</th>
                        <th className="text-left py-2 px-3 font-medium">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {resultado.trabajadores.map((t: Trabajador) => {
                        const rutLimpio = t.rut.replace(/\./g, '');
                        const duplicado = trabajadoresExistentes.some(e => e.rut.replace(/\./g, '') === rutLimpio);
                        return (
                          <tr key={t.id} className={duplicado ? 'bg-amber-50' : ''}>
                            <td className="py-2 px-3 font-mono">{t.rut}</td>
                            <td className="py-2 px-3">{t.nombres}</td>
                            <td className="py-2 px-3">{t.apellidos}</td>
                            <td className="py-2 px-3">{TIPO_CONTRATO_LABELS[t.tipoContrato] ?? t.tipoContrato}</td>
                            <td className="py-2 px-3 text-right">
                              {t.sueldoBase.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </td>
                            <td className="py-2 px-3">{AFP_NOMBRES[t.afp] ?? t.afp}</td>
                            <td className="py-2 px-3">{t.isapre}</td>
                            <td className="py-2 px-3 text-right">{t.cargasFamiliares}</td>
                            <td className="py-2 px-3">
                              {duplicado
                                ? <span className="text-amber-600 font-medium">⚠ Duplicado (RUT ya existe)</span>
                                : <span className="text-emerald-600">✓ Nuevo</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* Acciones */}
          <div className="flex justify-between gap-3">
            <Button variant="secondary" onClick={handleReset}>
              ← Volver a seleccionar
            </Button>
            {resultado.filas > 0 && (
              <Button onClick={handleConfirmar} icon={<CheckCircle size={16} />}>
                Confirmar e importar {resultado.filas} registro(s)
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── PASO 3: RESULTADO FINAL ──────────────────────────────────────── */}
      {paso === 'resultado' && resultado && (
        <Card>
          <div className="text-center py-6">
            <CheckCircle size={52} className="mx-auto text-emerald-500 mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              Importación completada
            </h3>
            <p className="text-gray-600 mb-1">
              <strong>{resultado.filas}</strong> registro(s) importados correctamente como{' '}
              <strong>{TIPO_LABELS[resultado.tipo]}</strong>
            </p>
            {resultado.errores.filter(e => e.includes('omitido')).map((e, i) => (
              <p key={i} className="text-sm text-amber-600 mb-1">{e}</p>
            ))}
            {resultado.tipo === 'trabajadores' && (
              <p className="text-sm text-gray-500 mt-2">
                Los trabajadores están disponibles en <strong>Remuneraciones</strong>.
              </p>
            )}
            <div className="flex justify-center gap-3 mt-6">
              <Button variant="secondary" onClick={handleReset}>
                Importar más datos
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* HISTORIAL */}
      <Card title="Historial de Importaciones">
        {historial.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <FileSpreadsheet size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No hay importaciones recientes</p>
          </div>
        ) : (
          <div className="space-y-2">
            {historial.slice(0, 8).map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  {getIcono(item.tipo)}
                  <div>
                    <p className="font-medium text-gray-900 text-sm capitalize">
                      {TIPO_LABELS[item.tipo] ?? item.tipo}
                    </p>
                    <p className="text-xs text-gray-500">
                      {item.filas} registros · {new Date(item.fecha).toLocaleString('es-CL')}
                    </p>
                  </div>
                </div>
                {item.errores.length > 0 && (
                  <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full">
                    {item.errores.length} error(es)
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── XML DTE (SII) ────────────────────────────────── */}
      <Card title="Importar XML DTE del SII">
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
            <Code2 size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Importa facturas directamente desde archivos XML del SII</p>
              <p className="text-xs mt-1">Acepta archivos EnvioDTE, SetDTE o documentos DTE individuales (formato XML SII Chile). Los registros se agregarán al Libro de Ventas o Compras según el tipo de documento.</p>
            </div>
          </div>

          <div
            className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => xmlInputRef.current?.click()}
          >
            <Upload size={28} className="text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700">
              {xmlArchivo ? xmlArchivo.name : 'Haz click o arrastra tu archivo XML'}
            </p>
            <p className="text-xs text-gray-400 mt-1">Archivos .xml del SII</p>
            <input
              ref={xmlInputRef}
              type="file"
              accept=".xml"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) { setXmlArchivo(f); setXmlRegistros(null); setXmlError(''); }
              }}
            />
          </div>

          {xmlArchivo && !xmlRegistros && (
            <div className="flex justify-center">
              <button
                onClick={async () => {
                  setXmlCargando(true);
                  setXmlError('');
                  try {
                    const text = await xmlArchivo.text();
                    const regs = parsearXMLDTE(text);
                    if (regs.length === 0) setXmlError('No se encontraron documentos DTE en el archivo. Verifica que sea un XML SII válido.');
                    else setXmlRegistros(regs);
                  } catch {
                    setXmlError('Error al leer el archivo XML.');
                  }
                  setXmlCargando(false);
                }}
                disabled={xmlCargando}
                className="flex items-center gap-2 px-4 py-2 bg-[#1E3A5F] text-white text-sm font-medium rounded-lg hover:bg-[#2D5A87] active:scale-[0.97] transition-[background-color,transform] disabled:opacity-50"
              >
                {xmlCargando ? 'Procesando...' : 'Procesar XML'}
              </button>
            </div>
          )}

          {xmlError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle size={15} />
              {xmlError}
            </div>
          )}

          {xmlRegistros && xmlRegistros.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-800">{xmlRegistros.length} documentos encontrados</p>
                <span className="text-xs text-gray-500">Vista previa — revisa antes de importar</span>
              </div>
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-500 font-semibold">Tipo</th>
                      <th className="px-3 py-2 text-left text-gray-500 font-semibold">Folio</th>
                      <th className="px-3 py-2 text-left text-gray-500 font-semibold">Fecha</th>
                      <th className="px-3 py-2 text-left text-gray-500 font-semibold">RUT</th>
                      <th className="px-3 py-2 text-right text-gray-500 font-semibold">Neto</th>
                      <th className="px-3 py-2 text-right text-gray-500 font-semibold">IVA</th>
                      <th className="px-3 py-2 text-right text-gray-500 font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {xmlRegistros.slice(0, 20).map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-gray-700">{r.tipo}</td>
                        <td className="px-3 py-2 font-mono text-gray-700">{r.folio}</td>
                        <td className="px-3 py-2 text-gray-600">{r.fecha}</td>
                        <td className="px-3 py-2 font-mono text-gray-600">{r.rut}</td>
                        <td className="px-3 py-2 text-right text-gray-800">${r.neto.toLocaleString('es-CL')}</td>
                        <td className="px-3 py-2 text-right text-gray-800">${r.iva.toLocaleString('es-CL')}</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-900">${r.total.toLocaleString('es-CL')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {xmlRegistros.length > 20 && (
                  <p className="text-xs text-gray-400 text-center py-2">... y {xmlRegistros.length - 20} documentos más</p>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <AlertTriangle size={13} className="text-amber-500" />
                <span>La importación a Libro Ventas/Compras estará disponible en la próxima versión. Por ahora usa esta vista para revisar el contenido del XML.</span>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

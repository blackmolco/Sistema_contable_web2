import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CloudCog, Download, CheckCircle,
  Upload, FileText, Trash2, Info,
  Loader2, ShieldCheck, DatabaseZap, FileDown, CheckCheck,
} from 'lucide-react';
import { Card, Badge } from '../components/ui/Cards';
import { SearchSelect } from '../components/ui/FormElements';
import { TableSkeleton } from '../components/ui/Skeleton';
import { useApp } from '../context/AppContext';
import { formatRUT, formatCurrency, generateId } from '../utils/calculos';
import { ingresoDocumento, IngresoDocumentoPayload } from '../services/apiSync';

// ─── Tipo interno ──────────────────────────────────────────────────────────────
interface FilaRCV {
  tipoDoc: string;
  folio: number;
  rut: string;
  razonSocial: string;
  fecha: string;
  neto: number;
  exento: number;
  iva: number;
  total: number;
  tipo: 'venta' | 'compra' | 'honorario';
  montoBruto?: number;
  retencion?: number;
  montoLiquido?: number;
}

// Mapeo SII código → tipo interno
const TIPO_DOC_MAP: Record<string, string> = {
  '33': 'factura', '34': 'factura_exenta',
  '39': 'boleta',  '41': 'boleta_exenta',
  '61': 'nota_credito', '56': 'nota_debito',
  '52': 'guia_despacho', '110': 'factura_compra',
};

// ─── Parsear número chileno ────────────────────────────────────────────────────
function parseMonto(raw: string): number {
  if (!raw) return 0;
  const limpio = raw.trim().replace(/[$"\s]/g, '');
  if (!limpio || limpio === '-') return 0;
  // Quitar puntos de miles, reemplazar coma decimal
  return parseFloat(limpio.replace(/\./g, '').replace(',', '.')) || 0;
}

// ─── Parsear fecha ─────────────────────────────────────────────────────────────
function parseFecha(raw: string): string {
  if (!raw) return new Date().toISOString();
  const s = raw.trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/');
    return new Date(`${y}-${m}-${d}`).toISOString();
  }
  if (/^\d{8}$/.test(s)) {
    return new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`).toISOString();
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s).toISOString();
  return new Date().toISOString();
}

// ─── Normalizar texto para comparar nombres de columnas ───────────────────────
function norm(s: string) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar tildes: á→a, é→e, etc.
    .replace(/[^a-z0-9]/g, ''); // quitar puntos, espacios, guiones, etc.
}

// ─── Decodificar bytes del CSV (SII exporta a veces en Latin-1, a veces en UTF-8) ─
// No hay un encoding fijo: varía según tipo de reporte/fecha de exportación del
// portal SII. Probamos UTF-8 estricto primero — un archivo Latin-1 real casi
// siempre produce secuencias de bytes inválidas en UTF-8 apenas aparecen 2+
// caracteres con tilde/ñ seguidos, así que falla y caemos a Latin-1. (Un único
// caracter acentuado aislado en Latin-1 puro es siempre 1 byte válido y no
// dispara la excepción — la heurística no es perfecta, pero cubre el caso real
// que corrompió los RCV de sept-2026.)
function decodificarCSV(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('iso-8859-1').decode(buffer);
  }
}

// ─── Revertir mojibake residual ──────────────────────────────────────────────
// Defensa adicional: si el archivo era realmente UTF-8 pero tenía un solo
// byte inválido en otro lugar (p.ej. otra fila con un caracter suelto de
// Windows-1252), el chequeo estricto de decodificarCSV() falla igual y TODO
// el archivo queda decodificado como Latin-1 → "Ã³" en vez de "ó" (patrón
// clásico: cada caracter UTF-8 de 2 bytes se parte en 'Ã' + un caracter de
// continuación). Reintentamos línea por línea (no el archivo completo) para
// que el byte inválido de una sola fila no le impida arreglarse a las demás.
function arreglarLineaMojibake(linea: string): string {
  if (!/\u00c3[\u0080-\u00bf]/.test(linea)) return linea;
  const codigos = Array.from(linea, c => c.charCodeAt(0));
  if (codigos.some(c => c > 0xFF)) return linea; // no es Latin-1 puro, no tocar
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(codigos));
  } catch {
    return linea; // esta línea no era mojibake reversible, dejarla como está
  }
}

function arreglarMojibake(texto: string): string {
  if (!/\u00c3[\u0080-\u00bf]/.test(texto)) return texto;
  return texto.split('\n').map(arreglarLineaMojibake).join('\n');
}

// ─── Detectar separador ────────────────────────────────────────────────────────
function detectarSeparador(linea: string): string {
  const semicolons = (linea.match(/;/g) || []).length;
  const commas     = (linea.match(/,/g) || []).length;
  return semicolons >= commas ? ';' : ',';
}

// ─── Resolver índice de columna con múltiples aliases ─────────────────────────
function resolverCol(colMap: Record<string, number>, aliases: string[]): number {
  for (const alias of aliases) {
    for (const [colName, idx] of Object.entries(colMap)) {
      if (colName === alias || colName.startsWith(alias) || colName.includes(alias)) {
        return idx;
      }
    }
  }
  return -1;
}

// ─── Parser principal: auto-detecta cabeceras por nombre ──────────────────────
// Soporta los formatos reales del portal SII:
//   Libro Ventas:   Nro; Tipo Doc; Tipo Venta; RUT; Razón Social; Folio; Fecha Docto; Fecha Vencim.; M. Neto; M. Exento; IVA Rec.; Ivs No Rec.; M. Total
//   Libro Compras:  Nro; Tipo Doc; RUT; Razón Social; Folio; Fecha Docto; Fecha Vencim.; M. Neto; M. Exento; IVA Rec.; IVA No Rec.; M. Total
//   Boletas:        Nro; Tipo Doc; Tipo Venta; Folio Desde; Folio Hasta; Fecha Docto; M. Neto; M. Exento; IVA; M. Total
function parsearCSVSII(texto: string, tipoLibro: 'venta' | 'compra' | 'honorario'): { filas: FilaRCV[]; debug: string } {
  const lineasRaw = texto.split('\n');
  const lineas    = lineasRaw.map(l => l.trim()).filter(l => l.length > 0);

  if (lineas.length < 2) return { filas: [], debug: 'Archivo vacío' };

  const sep = detectarSeparador(lineas[0]);

  // ── Buscar la fila de cabeceras ─────────────────────────────────────────────
  // Usa keywords más amplias para detectar la fila correcta
  // Formato SII real: "Nro; Tipo Doc; Tipo Venta; RUT; Razón Social; Folio; Fecha Docto; ..."
  const KEYWORDS_HEADER = ['rut', 'folio', 'total', 'neto', 'fecha', 'tipo', 'nro', 'razon', 'iva'];
  let headerIdx = -1;
  const colMap: Record<string, number> = {};

  for (let i = 0; i < Math.min(lineas.length, 15); i++) {
    const cols = lineas[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
    const colsNorm = cols.map(norm);
    const hits = KEYWORDS_HEADER.filter(k => colsNorm.some(c => c.includes(k))).length;
    if (hits >= 3) {
      headerIdx = i;
      // Mapear cada columna por su nombre normalizado completo
      colsNorm.forEach((name, idx) => {
        if (name) colMap[name] = idx;
      });
      break;
    }
  }

  const debugColNames = Object.keys(colMap).slice(0, 8).join(', ');
  const debugInfo = headerIdx >= 0
    ? `Cabecera fila ${headerIdx + 1}: [${debugColNames}...] (${Object.keys(colMap).length} cols)`
    : 'Sin cabecera — posición fija SII estándar';

  // ── Resolver índices usando aliases normalizados ─────────────────────────────
  // El formato SII real usa: "Tipo Doc" → "tipodoc", "M. Neto" → "mneto",
  // "Fecha Docto" → "fechadocto", "IVA Rec." → "ivarec", "M. Total" → "mtotal"
  const CI = {
    // "Tipo Doc" → tipodoc; también: tipodocumento, codtipodoc
    tipo    : resolverCol(colMap, ['tipodoc', 'tipodocumento', 'codigodoc', 'tipo']),
    // "Folio" → folio; "Folio Desde" → foliodesde (boletas)
    folio   : resolverCol(colMap, ['folio', 'nrofolio', 'nroboleta', 'numero', 'nrooper', 'nro']),
    // "Rut cliente"/"RUT" → rut, chequeado primero: el RCV tambien trae la
    // columna "RUT Emisor Liquid. Factura" (normaliza a "rutemisorliquid...",
    // casi siempre "-"), que calzaba antes con el alias 'rutem' y ganaba por
    // el orden de la lista, dejando el RUT del cliente vacio en TODAS las
    // filas. 'rut' es mas generico pero el orden de columnas del SII pone
    // "Rut cliente"/"Rut Proveedor" bien al principio, antes que esa columna.
    rut     : resolverCol(colMap, ['rut', 'rutrec', 'rutem', 'rutemitente', 'ruteceptor']),
    // "Razón Social" → razonsocial; también nombre, razon
    razon   : resolverCol(colMap, ['razonsocial', 'nombrerec', 'nombreem', 'razon', 'nombre']),
    // "Fecha Docto" → fechadocto; también fechaemision, fecha
    fecha   : resolverCol(colMap, ['fechadocto', 'fechaemision', 'fechadoc', 'fecha']),
    // "M. Exento" → mexento; también montoexento, exento
    exento  : resolverCol(colMap, ['mexento', 'montoexento', 'exento']),
    // "M. Neto" → mneto; también montoneto, neto, base
    neto    : resolverCol(colMap, ['mneto', 'montoneto', 'neto', 'base']),
    // "IVA Rec." → ivarec; también ivarecuperable, iva
    iva     : resolverCol(colMap, ['ivarec', 'ivarecuperable', 'iva']),
    // "Ivs No Rec." o "IVA No Rec." → ivsnorec, ivanorec
    ivaNoRec: resolverCol(colMap, ['ivsnorec', 'ivanorec', 'ivanorecuperable', 'ivasinderecho']),
    // "M. Total" → mtotal; también montototal, total
    total   : resolverCol(colMap, ['mtotal', 'montototal', 'total']),
    bruto   : resolverCol(colMap, ['montobruto', 'bruto', 'honorariosbrutos', 'totalbruto']),
    retencion: resolverCol(colMap, ['retencion', 'retenciones', 'impuestoretenido']),
    liquido : resolverCol(colMap, ['montoliquido', 'liquido', 'pagado', 'totalliquido']),
  };

  // Fallback a posiciones fijas del SII cuando no hay cabecera detectada
  // Formato sin cabecera (legacy): Tipo;Folio;RUT;Razon;Fecha;Exento;Neto;IVA;IVANoRec;Total
  if (headerIdx < 0) {
    CI.tipo = 0; CI.folio = 1; CI.rut = 2; CI.razon = 3; CI.fecha = 4;
    CI.exento = 5; CI.neto = 6; CI.iva = 7; CI.ivaNoRec = 8; CI.total = 10;
  }

  const resultado: FilaRCV[] = [];
  const dataStart = headerIdx >= 0 ? headerIdx + 1 : 1;

  for (let i = dataStart; i < lineas.length; i++) {
    const cols = lineas[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 3) continue;

    // Saltar filas de totales/encabezado de empresa/período
    const primero = cols[0].trim().toLowerCase();
    if (/^(total|suma|resumen|periodo|empresa|rut empresa|nro de documentos)/i.test(primero)) continue;

    // Saltar filas donde la primera columna numérica (Nro o TipoDoc) no parece un número o código DTE
    // En el SII real la col 0 es "Nro" (1,2,3...) y col 1 es "Tipo Doc" (33, 39, etc.)
    // → el tipo doc puede estar en col 0 o col 1 dependiendo del formato
    const posibleTipoDoc = CI.tipo >= 0 ? cols[CI.tipo] : cols[1] || cols[0];
    const tipoDocNum = parseInt(posibleTipoDoc.replace(/\D/g, ''));
    // Omitir si claramente no es un código DTE válido (los del SII van de 33 a 914)
    if (headerIdx >= 0 && tipoLibro !== 'honorario' && isNaN(tipoDocNum)) continue;

    const tipoDoc     = posibleTipoDoc.trim() || '33';
    // El folio puede estar vacío en resúmenes de boletas (usan Folio Desde/Hasta)
    const folioStr    = CI.folio >= 0 ? (cols[CI.folio] || '0') : '0';
    const folio       = parseInt(folioStr.replace(/\D/g, '')) || 0;
    const rut         = CI.rut     >= 0 ? (cols[CI.rut]   || '') : '';
    const razonSocial = CI.razon   >= 0 ? (cols[CI.razon] || '') : '';
    const fecha       = CI.fecha   >= 0 ? (cols[CI.fecha] || '') : '';
    const exento      = CI.exento  >= 0 ? parseMonto(cols[CI.exento])  : 0;
    const neto        = CI.neto    >= 0 ? parseMonto(cols[CI.neto])    : 0;
    const ivaRec      = CI.iva     >= 0 ? parseMonto(cols[CI.iva])     : 0;
    const ivaNoRec    = CI.ivaNoRec >= 0 ? parseMonto(cols[CI.ivaNoRec]) : 0;
    const brutoCSV    = CI.bruto >= 0 ? parseMonto(cols[CI.bruto]) : 0;
    const retencionCSV = CI.retencion >= 0 ? parseMonto(cols[CI.retencion]) : 0;
    const liquidoCSV   = CI.liquido >= 0 ? parseMonto(cols[CI.liquido]) : 0;

    // Total: columna detectada → fallback a última columna numérica → calcular
    let total = CI.total >= 0 && CI.total < cols.length
      ? parseMonto(cols[CI.total])
      : 0;
    if (total === 0) {
      for (let c = cols.length - 1; c >= 0; c--) {
        const v = parseMonto(cols[c]);
        if (v > 0) { total = v; break; }
      }
    }
    if (total === 0 && (neto + exento) > 0) {
      total = neto + exento + ivaRec + ivaNoRec;
    }

    const montoBruto = tipoLibro === 'honorario' ? (brutoCSV || total || neto) : undefined;
    const montoLiquido = tipoLibro === 'honorario' ? (liquidoCSV || total || Math.max((montoBruto || 0) - retencionCSV, 0)) : undefined;
    const retencion = tipoLibro === 'honorario' ? (retencionCSV || Math.max((montoBruto || 0) - (montoLiquido || 0), 0)) : undefined;
    if (tipoLibro === 'honorario') total = montoLiquido || 0;

    // Omitir filas completamente vacías de valores
    if (folio === 0 && total === 0 && neto === 0 && !rut) continue;

    resultado.push({
      tipoDoc: tipoDocNum ? String(tipoDocNum) : tipoDoc,
      folio, rut, razonSocial, fecha,
      neto, exento,
      iva: ivaRec + ivaNoRec,
      total, tipo: tipoLibro,
      montoBruto, retencion, montoLiquido,
    });
  }

  return { filas: resultado, debug: debugInfo };
}

// ─── Componente ────────────────────────────────────────────────────────────────
// ─── Pasos de progreso para sync automático ──────────────────────────────────
const SYNC_STEPS = [
  { id: 1, label: 'Autenticando en portal SII',      icon: ShieldCheck  },
  { id: 2, label: 'Consultando libro de ventas',      icon: FileDown     },
  { id: 3, label: 'Consultando libro de compras',     icon: FileDown     },
  { id: 4, label: 'Procesando e importando datos',    icon: DatabaseZap  },
  { id: 5, label: 'Sincronización completada',        icon: CheckCheck   },
];

// Datos demo con nombres y RUTs chilenos realistas
const EMPRESAS_DEMO = [
  { rut: '76.543.210-K', nombre: 'Constructora Andina Ltda.'     },
  { rut: '78.901.234-5', nombre: 'Supermercado El Roble S.A.'    },
  { rut: '77.654.321-3', nombre: 'Servicios TI del Sur SpA'      },
  { rut: '79.012.345-6', nombre: 'Comercial Los Andes Ltda.'     },
  { rut: '76.111.222-1', nombre: 'Transporte Pacifico S.A.'      },
  { rut: '77.333.444-2', nombre: 'Ferretería Central SpA'        },
  { rut: '78.555.666-4', nombre: 'Clínica del Valle S.A.'        },
  { rut: '76.777.888-5', nombre: 'Editorial Mapocho Ltda.'       },
  { rut: '79.999.111-7', nombre: 'Distribuidora Norte S.A.'      },
  { rut: '77.222.333-8', nombre: 'Servicios Integrales SpA'      },
  { rut: '78.444.555-9', nombre: 'Inmobiliaria Cordillera Ltda.' },
  { rut: '76.666.777-K', nombre: 'Agrícola del Sur S.A.'         },
  { rut: '79.888.999-0', nombre: 'Consultora Austral SpA'        },
  { rut: '77.010.203-1', nombre: 'Tecnologías Austral Ltda.'     },
  { rut: '78.304.050-2', nombre: 'Logística Cóndor S.A.'        },
];

export default function SincronizacionSII() {
  const navigate = useNavigate();
  const { state, dispatch, showToast } = useApp();
  const [tab, setTab]           = useState<'manual' | 'auto'>('manual');
  const [tipoArchivo, setTipoArchivo] = useState<'venta' | 'compra' | 'honorario'>('venta');
  const [filasPreview, setFilasPreview] = useState<FilaRCV[]>([]);
  const [isImporting, setIsImporting]   = useState(false);
  const [importProgress, setImportProgress] = useState<{ hecho: number; total: number } | null>(null);
  const [debugInfo, setDebugInfo]       = useState<string>('');
  const [cuentasPorRut, setCuentasPorRut] = useState<Record<string, string>>({});
  const [cuentaIngresoId, setCuentaIngresoId] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Auto-sync state
  const [rut, setRut]         = useState(state.configuracion?.rut ?? '');
  const [clave, setClave]     = useState('');
  const [mes, setMes]         = useState(new Date().getMonth() + 1);
  const [anio, setAnio]       = useState(new Date().getFullYear());
  const [isSyncing, setIsSyncing]       = useState(false);
  const [syncStep, setSyncStep]         = useState(0);   // 0 = inactivo, 1-5 = paso activo
  const [syncResult, setSyncResult]     = useState<{ compras: number; ventas: number; docs: Array<{rut:string;nombre:string;total:number;tipo:'venta'|'compra'}>; esReal?: boolean } | null>(null);
  const [backendStatus, setBackendStatus] = useState<'unknown'|'online'|'offline'>('unknown');

  // Verificar disponibilidad del backend al cargar
  useEffect(() => {
    fetch('/api/health', { signal: AbortSignal.timeout(3000) })
      .then(r => setBackendStatus(r.ok ? 'online' : 'offline'))
      .catch(() => setBackendStatus('offline'));
  }, []);

  // ── Leer CSV ────────────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const buffer = ev.target?.result as ArrayBuffer;
      const texto = arreglarMojibake(decodificarCSV(buffer));
      const { filas, debug } = parsearCSVSII(texto, tipoArchivo);
      setDebugInfo(debug);
      if (filas.length === 0) {
        showToast('error', 'Sin datos',
          `No se leyeron registros. [${debug}] Verifica que sea el CSV del RCV del SII.`);
        return;
      }
      setFilasPreview(filas);
      if (tipoArchivo !== 'venta') {
        const iniciales: Record<string, string> = {};
        filas.forEach(fila => {
          const claveRut = fila.rut.replace(/[^0-9kK]/g, '').toUpperCase();
          const entidad = (state.entidades ?? []).find(e => e.rut.replace(/[^0-9kK]/g, '').toUpperCase() === fila.rut.replace(/[^0-9kK]/g, '').toUpperCase());
          const codigoGuardado = state.rutCuentas?.[fila.rut]?.cuentaCodigo;
          iniciales[claveRut] = entidad?.cuentaDefaultId || (codigoGuardado ? state.cuentas.find(c => c.codigo === codigoGuardado)?.id : '') || '';
        });
        setCuentasPorRut(iniciales);
      } else {
        setCuentaIngresoId(state.cuentas.find(c => c.codigo === '4-01-001-0001')?.id || '');
      }
      const totalSum = filas.reduce((s, f) => s + f.total, 0);
      showToast('success', 'Archivo leído',
        `${filas.length} registros | Total: ${formatCurrency(totalSum)} | ${debug}`);
    };
    // Leemos como bytes crudos (no readAsText con encoding fijo) porque el SII
    // exporta a veces en Latin-1 y a veces en UTF-8 — decodificarCSV() detecta cuál es.
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // El código SII no siempre coincide 1:1 con lo que acepta el endpoint de
  // ingreso (que ya sabe tratar venta/compra por separado vía tipoTransaccion,
  // así que "factura_compra" no aporta nada más que "factura"+compra).
  const MAPEO_TIPO_INGRESO: Record<string, IngresoDocumentoPayload['tipoDocumento']> = {
    factura: 'factura', factura_exenta: 'factura_exenta', boleta: 'boleta',
    boleta_exenta: 'boleta_exenta', nota_credito: 'nota_credito', nota_debito: 'nota_debito',
    factura_compra: 'factura', guia_despacho: 'factura',
  };

  // Cuenta "cajón de sastre" para compras cuyo proveedor no tiene una cuenta
  // de gasto ya asignada (ni en Entidad.cuentaDefaultId ni en el mapeo
  // rutCuentas que ya usa Centralización de Libros) — se prioriza no
  // bloquear la importación por esto; se puede reclasificar después.
  const CODIGO_CUENTA_POR_CLASIFICAR = '5-03-004-0001';

  const fechaISO = (fila: FilaRCV) => {
    const [d, m, y] = fila.fecha.split('/');
    return d && m && y ? `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` : fila.fecha.slice(0, 10);
  };
  const rutLimpio = (rutValor: string) => rutValor.replace(/[^0-9kK]/g, '').toUpperCase();
  const claveFila = (fila: FilaRCV) => `${tipoArchivo}|${TIPO_DOC_MAP[fila.tipoDoc] || fila.tipoDoc}|${rutLimpio(fila.rut)}|${fechaISO(fila)}|${fila.folio}`;
  const esDuplicada = (fila: FilaRCV) => {
    if (tipoArchivo === 'honorario') {
      const yaEstaEnSistema = (state.honorarios ?? []).some(h =>
        h.folio === fila.folio && rutLimpio(h.rut) === rutLimpio(fila.rut) && h.periodo === fechaISO(fila).slice(0, 7)
      );
      const primeraEnArchivo = filasPreview.findIndex(otra => claveFila(otra) === claveFila(fila));
      return yaEstaEnSistema || primeraEnArchivo !== filasPreview.indexOf(fila);
    }
    const tipoInterno = MAPEO_TIPO_INGRESO[TIPO_DOC_MAP[fila.tipoDoc] || 'factura'] ?? 'factura';
    const yaEstaEnSistema = (state.documentos ?? []).some(doc =>
      doc.tipo === tipoInterno && doc.numero === fila.folio && doc.libro === (tipoArchivo === 'compra' ? 'compras' : 'ventas') &&
      rutLimpio(doc.receptor?.rut ?? doc.rutCliente ?? '') === rutLimpio(fila.rut) && doc.fecha.slice(0, 10) === fechaISO(fila)
    );
    const primeraEnArchivo = filasPreview.findIndex(otra => claveFila(otra) === claveFila(fila));
    return yaEstaEnSistema || primeraEnArchivo !== filasPreview.indexOf(fila);
  };

  const filasNuevas = filasPreview.filter(f => !esDuplicada(f));
  const duplicadas = filasPreview.length - filasNuevas.length;
  const proveedores = [...new Map(filasNuevas.map(f => [rutLimpio(f.rut), f])).entries()].map(([clave, fila]) => ({ ...fila, claveRut: clave }));
  const opcionesCompra = [{ value: '', label: 'Seleccionar cuenta...' }, ...state.cuentas.filter(c => c.permiteMovimiento && !c.requiereAuxiliar && ['gasto', 'activo', 'pasivo'].includes(c.tipo)).map(c => ({ value: c.id, label: `${c.codigo} — ${c.nombre}` }))];
  const opcionesHonorario = [{ value: '', label: 'Seleccionar cuenta de honorarios...' }, ...state.cuentas.filter(c => c.permiteMovimiento && !c.requiereAuxiliar && c.tipo === 'gasto').map(c => ({ value: c.id, label: `${c.codigo} — ${c.nombre}` }))];
  const opcionesVenta = [{ value: '', label: 'Seleccionar cuenta de ingreso...' }, ...state.cuentas.filter(c => c.permiteMovimiento && c.tipo === 'ingreso').map(c => ({ value: c.id, label: `${c.codigo} — ${c.nombre}` }))];

  // ── Importar (secuencial: cada fila crea su entidad + documento + asiento) ──
  const handleImport = async () => {
    if (filasPreview.length === 0 || isImporting) return;
    setIsImporting(true);
    if (filasNuevas.length === 0) {
      showToast('warning', 'Sin documentos nuevos', 'Todos los documentos del archivo ya fueron cargados anteriormente.');
      setIsImporting(false);
      return;
    }
    if (tipoArchivo === 'venta' && !cuentaIngresoId) {
      showToast('error', 'Falta cuenta contable', 'Seleccione la cuenta de ingreso para las ventas.');
      setIsImporting(false);
      return;
    }
    const proveedoresSinCuenta = proveedores.filter(f => !cuentasPorRut[f.claveRut]);
    if (tipoArchivo !== 'venta' && proveedoresSinCuenta.length > 0) {
      showToast('error', 'Faltan cuentas contables', `Asigne una cuenta a ${proveedoresSinCuenta.length} proveedor(es) antes de importar.`);
      setIsImporting(false);
      return;
    }
    setImportProgress({ hecho: 0, total: filasNuevas.length });

    const cuentaPorClasificarId = state.cuentas.find(c => c.codigo === CODIGO_CUENTA_POR_CLASIFICAR)?.id;
    let exitosos = 0;
    let sinCuentaAsignada = 0;
    const errores: string[] = [];

    for (const fila of filasNuevas) {
      const tipoInterno = TIPO_DOC_MAP[fila.tipoDoc] || 'factura';
      const tipoDocumento = MAPEO_TIPO_INGRESO[tipoInterno] ?? 'factura';
      const fechaDocumento = fechaISO(fila);
      const esHonorario = tipoArchivo === 'honorario';

      let cuentaGastoId: string | undefined;
      if (tipoArchivo !== 'venta') {
        cuentaGastoId = cuentasPorRut[rutLimpio(fila.rut)] || cuentaPorClasificarId;
        if (!cuentasPorRut[rutLimpio(fila.rut)]) sinCuentaAsignada++;
      }

      try {
        await ingresoDocumento({
          tipoDocumento: esHonorario ? 'honorario' : tipoDocumento,
          tipoTransaccion: esHonorario ? undefined : tipoArchivo,
          folio: fila.folio,
          fecha: fechaDocumento,
          periodo: esHonorario ? fechaDocumento.slice(0, 7) : undefined,
          entidad: { rut: fila.rut || 'SIN-RUT', razonSocial: fila.razonSocial?.trim() || fila.rut || 'Sin nombre', cuentaDefaultId: tipoArchivo !== 'venta' ? cuentaGastoId : undefined },
          neto: fila.neto, exento: fila.exento, iva: fila.iva, total: fila.total,
          cuentaGastoId: esHonorario ? undefined : cuentaGastoId,
          cuentaIngresoId: tipoArchivo === 'venta' ? cuentaIngresoId : undefined,
          cuentaHonorarioId: esHonorario ? cuentaGastoId : undefined,
          montoBruto: esHonorario ? fila.montoBruto : undefined,
          retencion: esHonorario ? fila.retencion : undefined,
          montoLiquido: esHonorario ? fila.montoLiquido : undefined,
          origenImportacionSII: true,
        });
        exitosos++;
      } catch (err) {
        errores.push(`Folio ${fila.folio || '—'}: ${err instanceof Error ? err.message : 'error desconocido'}`);
      }
      setImportProgress(prev => prev ? { ...prev, hecho: prev.hecho + 1 } : null);
    }

    setImportProgress(null);
    setIsImporting(false);

    if (exitosos > 0) {
      // Fuerza a que Contabilidad/Facturación/Entidades vuelvan a pedir sus
      // datos al servidor — igual que hace Login.tsx tras iniciar sesión —
      // porque el estado local no sabe que se crearon documentos/asientos/
      // entidades nuevas (se ingresaron uno por uno vía la API, sin dispatch).
      window.dispatchEvent(new Event('scc:login'));
      setFilasPreview([]);
    }

    if (errores.length === 0) {
      showToast('success', '¡Importación Completa!', `${exitosos} documentos cargados con su asiento contable.`);
    } else {
      showToast(exitosos > 0 ? 'warning' : 'error', 'Importación con errores',
        `${exitosos} de ${filasNuevas.length} documentos nuevos cargados. Primer error: ${errores[0]}`);
      console.error('[SincronizacionSII] Errores de importación:', errores);
    }
    if (sinCuentaAsignada > 0) {
      showToast('warning', 'Cuentas por clasificar',
        `${sinCuentaAsignada} compra(s) quedaron en "Otros Gastos No Operacionales" por no tener cuenta asignada — reclasifícalas en Asientos Contables.`);
    }
  };

  // ── Verificar si el backend está disponible ──────────────────────────────────
  const checkBackend = async (): Promise<boolean> => {
    try {
      const r = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
      return r.ok;
    } catch {
      return false;
    }
  };

  // ── Sync REAL vía backend (Playwright + SII) ──────────────────────────────
  const handleSync = () => {
    if (!rut.trim() || !clave.trim()) {
      showToast('error', 'Faltan credenciales', 'Ingrese RUT empresa y Clave Tributaria.');
      return;
    }
    setIsSyncing(true);
    setSyncResult(null);
    setSyncStep(1);

    const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
    const periodo = `${anio}-${String(mes).padStart(2, '0')}`;

    const runSync = async () => {
      // Comprobar si el backend está activo
      setSyncStep(1);
      const backendOk = await checkBackend();

      if (backendOk) {
        // ── MODO REAL: llamar al backend ────────────────────────────────────
        setSyncStep(2); // autenticando

        // Sincronizar ventas Y compras en paralelo
        const [resVentas, resCompras] = await Promise.all([
          fetch('/api/sii/rcv', {
            method : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body   : JSON.stringify({ rut, clave, periodo, tipo: 'ventas' }),
            signal : AbortSignal.timeout(90_000), // el scraper puede tardar ~60s
          }),
          (async () => {
            await delay(1500); // leve offset para no sobrecargar el SII
            setSyncStep(3);
            return fetch('/api/sii/rcv', {
              method : 'POST',
              headers: { 'Content-Type': 'application/json' },
              body   : JSON.stringify({ rut, clave, periodo, tipo: 'compras' }),
              signal : AbortSignal.timeout(90_000),
            });
          })(),
        ]);

        setSyncStep(4); // procesando

        // Manejar errores HTTP
        if (!resVentas.ok || !resCompras.ok) {
          const errRes  = !resVentas.ok ? resVentas : resCompras;
          const errData = await errRes.json().catch(() => ({}));
          const code    = errData.code || 'ERROR';

          if (code === 'CAPTCHA') {
            throw Object.assign(new Error('CAPTCHA'), {
              userMsg: 'El SII requiere resolución de captcha. Use la pestaña "Importar CSV" con el archivo descargado manualmente.',
            });
          }
          if (code === 'CREDENCIALES_INVALIDAS') {
            throw Object.assign(new Error('AUTH'), {
              userMsg: 'RUT o clave tributaria incorrectos. Verifique sus credenciales.',
            });
          }
          throw new Error(errData.mensaje || 'Error al consultar el SII');
        }

        const dataVentas  = await resVentas.json();
        const dataCompras = await resCompras.json();

        const todosLosDocs = [
          ...(dataVentas.documentos  || []),
          ...(dataCompras.documentos || []),
        ];

        dispatch({ type: 'BATCH_ADD_DOCUMENTOS', payload: todosLosDocs as any });

        await delay(500); setSyncStep(5); await delay(300);

        const previewDocs = [
          ...(dataVentas.documentos  || []).slice(0, 4).map((d: any) => ({ rut: d.rutCliente, nombre: d.razonSocialCliente, total: d.total, tipo: 'venta'  as const })),
          ...(dataCompras.documentos || []).slice(0, 3).map((d: any) => ({ rut: d.rutCliente, nombre: d.razonSocialCliente, total: d.total, tipo: 'compra' as const })),
        ];

        setSyncResult({
          ventas : dataVentas.total  || 0,
          compras: dataCompras.total || 0,
          docs   : previewDocs,
          esReal : true,
        });
        setClave('');
        showToast('success', '✅ Sincronización real completada',
          `${dataVentas.total} ventas y ${dataCompras.total} compras importadas desde el SII.`);

      } else {
        // ── MODO SIMULACIÓN: backend no disponible ──────────────────────────
        await delay(800);  setSyncStep(2);
        await delay(800);  setSyncStep(3);
        await delay(900);  setSyncStep(4);

        const shuffle = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);
        const empresas = shuffle(EMPRESAS_DEMO);
        const nVentas  = 12 + Math.floor(Math.random() * 6);
        const nCompras = 6  + Math.floor(Math.random() * 5);

        const genDocs = (n: number, esVenta: boolean) =>
          Array.from({ length: n }).map((_, i) => {
            const emp  = empresas[i % empresas.length];
            const neto = Math.floor(Math.random() * 800000 + 80000);
            const iva  = Math.round(neto * 0.19);
            return {
              id: generateId(),
              tipo: (esVenta ? 'factura' : 'factura_compra') as any,
              numero: (esVenta ? 15400 : 8200) + i,
              serie: '',
              fecha: new Date(anio, mes - 1, Math.floor(Math.random() * 28) + 1).toISOString(),
              rutCliente: emp.rut,
              razonSocialCliente: emp.nombre,
              receptor: { rut: emp.rut, razonSocial: emp.nombre, giro: '', direccion: '', comuna: '', ciudad: '', contacto: '', email: '' },
              condicionesPago: esVenta ? 'contado' : 'credito',
              detalles: [],
              subtotal: neto, neto, descuentoGlobal: 0, iva, totalExento: 0,
              total: neto + iva,
              estado: (esVenta ? 'emitido' : 'pendiente') as any,
            };
          });

        const ventas  = genDocs(nVentas,  true);
        const compras = genDocs(nCompras, false);
        dispatch({ type: 'BATCH_ADD_DOCUMENTOS', payload: [...ventas, ...compras] });

        await delay(600); setSyncStep(5); await delay(300);

        setSyncResult({
          ventas : ventas.length,
          compras: compras.length,
          docs   : [
            ...ventas.slice(0, 4).map(d => ({ rut: d.rutCliente, nombre: d.razonSocialCliente, total: d.total, tipo: 'venta'  as const })),
            ...compras.slice(0, 3).map(d => ({ rut: d.rutCliente, nombre: d.razonSocialCliente, total: d.total, tipo: 'compra' as const })),
          ],
          esReal : false,
        });
        setClave('');
        showToast('warning', 'Simulación (backend inactivo)',
          'Inicie el backend con "npm run dev:backend" para obtener datos reales del SII.');
      }
    };

    runSync()
      .catch((err) => {
        const msg = (err as any).userMsg || err.message || 'Error inesperado';
        showToast('error', 'Error de sincronización', msg);
      })
      .finally(() => {
        setIsSyncing(false);
        setSyncStep(0);
      });
  };

  // Las notas de crédito (código SII 61) restan del período: el RCV las trae
  // como fila propia con montos positivos, pero anulan/rebajan un documento
  // anterior — sin este signo el resumen sumaba la NC en vez de descontarla.
  const signoPreview = (f: FilaRCV) => (f.tipoDoc === '61' ? -1 : 1);
  const totalPreview = filasPreview.reduce((s, f) => s + f.total * signoPreview(f), 0);
  const netoPreview  = filasPreview.reduce((s, f) => s + f.neto  * signoPreview(f), 0);
  const ivaPreview   = filasPreview.reduce((s, f) => s + f.iva   * signoPreview(f), 0);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-blue-100 rounded-lg">
          <CloudCog className="text-blue-700" size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Registro de Compras y Ventas — SII</h1>
          <p className="text-sm text-gray-500 mt-1">
            Importa el RCV descargado desde el portal SII o sincroniza con tu clave tributaria.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { key: 'manual', label: 'Importar CSV del SII', icon: <Upload size={15}/> },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-5 py-2.5 font-medium text-sm rounded-t-lg border-b-2 transition-colors flex items-center gap-2 ${
              tab === t.key
                ? 'border-blue-600 text-blue-700 bg-blue-50'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB MANUAL ───────────────────────────────────────────────────────── */}
      {tab === 'manual' && (
        <div className="space-y-5">
          <Card className="border-blue-100 bg-blue-50/30">
            <div className="flex items-start gap-3">
              <Info className="text-blue-600 flex-shrink-0 mt-0.5" size={18} />
              <div className="text-xs text-blue-900 space-y-1">
                <p className="font-semibold">¿Cómo obtener el CSV del SII?</p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Entra a <strong>sii.cl → Servicios Online → Registro de Compras y Ventas</strong></li>
                  <li>Selecciona el mes y tipo (Ventas o Compras)</li>
                  <li>Click en <strong>"Descargar"</strong> → formato <strong>CSV</strong></li>
                  <li>Sube ese archivo aquí — el sistema detecta automáticamente las columnas del SII</li>
                </ol>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.75fr)] gap-6 items-start">
            {/* Panel izquierdo: tipo + subida */}
            <Card className="lg:sticky lg:top-4">
              <h3 className="font-semibold text-gray-900 mb-4">1. Tipo de Registro</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                {(['venta', 'compra', 'honorario'] as const).map(t => (
                  <button key={t} onClick={() => { setTipoArchivo(t); setFilasPreview([]); }}
                    className={`py-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                      tipoArchivo === t
                        ? t === 'venta'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : t === 'compra'
                            ? 'border-amber-500 bg-amber-50 text-amber-700'
                            : 'border-violet-500 bg-violet-50 text-violet-700'
                        : 'border-gray-200 text-gray-400 hover:border-gray-300'
                    }`}>
                    {t === 'venta' ? '📤 Libro de Ventas' : t === 'compra' ? '📥 Libro de Compras' : '🧾 Boletas de Honorarios'}
                  </button>
                ))}
              </div>

              <h3 className="font-semibold text-gray-900 mb-3">2. Subir Archivo CSV</h3>
              <div onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all">
                <Upload className="mx-auto text-gray-400 mb-3" size={32} />
                <p className="text-sm font-medium text-gray-700">Haz clic para seleccionar archivo</p>
                <p className="text-xs text-gray-400 mt-1">CSV exportado desde portal.sii.cl</p>
              </div>
              <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileChange} />
            </Card>

            {/* Panel derecho: preview */}
            <Card className="min-h-[680px]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">3. Vista Previa y Confirmación</h3>
                {filasPreview.length > 0 && (
                  <button onClick={() => setFilasPreview([])} className="text-xs text-red-500 hover:underline flex items-center gap-1">
                    <Trash2 size={12}/> Limpiar
                  </button>
                )}
              </div>

              {filasPreview.length === 0 ? (
                <div className="h-52 flex flex-col items-center justify-center text-gray-400">
                  <FileText size={40} className="opacity-20 mb-3" />
                  <p className="text-sm">Sube un archivo CSV para ver la vista previa</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Debug: columnas detectadas */}
                  {debugInfo && (
                    <div className="p-2 bg-blue-50 border border-blue-100 rounded-lg">
                      <p className="text-[10px] text-blue-700 font-mono break-all">📋 {debugInfo}</p>
                    </div>
                  )}

                  {/* Totales del archivo */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2 bg-gray-50 rounded-lg text-center">
                      <p className="text-[10px] text-gray-500">Neto</p>
                      <p className="text-xs font-bold text-gray-900">{formatCurrency(netoPreview)}</p>
                    </div>
                    <div className="p-2 bg-gray-50 rounded-lg text-center">
                      <p className="text-[10px] text-gray-500">IVA</p>
                      <p className="text-xs font-bold text-gray-900">{formatCurrency(ivaPreview)}</p>
                    </div>
                    <div className="p-2 bg-blue-50 rounded-lg text-center">
                      <p className="text-[10px] text-blue-600">Total</p>
                      <p className="text-xs font-bold text-blue-800">{formatCurrency(totalPreview)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-center"><p className="text-[10px] text-emerald-700">Documentos nuevos</p><p className="text-lg font-bold text-emerald-800">{filasNuevas.length}</p></div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-center"><p className="text-[10px] text-amber-700">Ya cargados</p><p className="text-lg font-bold text-amber-800">{duplicadas}</p></div>
                  </div>

                  {tipoArchivo === 'venta' ? (
                    <SearchSelect label="Cuenta contable de las ventas" value={cuentaIngresoId} onChange={setCuentaIngresoId} options={opcionesVenta} placeholder="Buscar cuenta de ingreso..." />
                  ) : proveedores.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-700">{tipoArchivo === 'honorario' ? 'Cuenta de gasto de honorarios por prestador' : 'Cuenta de gasto, activo o pasivo por proveedor'}</p>
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 max-h-[430px] overflow-y-auto pr-1">
                        {proveedores.map(proveedor => (
                          <div key={proveedor.claveRut} className="rounded-lg border border-gray-200 p-2">
                            <p className="mb-1.5 truncate text-xs font-medium text-gray-700">{formatRUT(proveedor.rut)} · {proveedor.razonSocial}</p>
                            <SearchSelect value={cuentasPorRut[proveedor.claveRut] || ''} onChange={cuentaId => setCuentasPorRut(actual => ({ ...actual, [proveedor.claveRut]: cuentaId }))} options={tipoArchivo === 'honorario' ? opcionesHonorario : opcionesCompra} placeholder="Asignar cuenta contable..." />
                            {cuentasPorRut[proveedor.claveRut] && <p className="mt-1 text-[11px] text-emerald-600">Cuenta recordada o seleccionada para este proveedor</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <div>
                      <p className="font-bold text-emerald-800 text-sm">{filasPreview.length} documentos listos</p>
                      <p className="text-xs text-emerald-600">Vista previa (primeras 10 filas):</p>
                    </div>
                    <CheckCircle className="text-emerald-500" size={24} />
                  </div>

                  <div className="max-h-[300px] overflow-y-auto space-y-1 text-xs custom-scrollbar">
                    {/* Cabecera de tabla */}
                    <div className="flex items-center gap-2 py-1 border-b-2 border-gray-200 font-semibold text-gray-500 sticky top-0 bg-white">
                      <span className="w-10 flex-shrink-0">DTE</span>
                      <span className="w-16 flex-shrink-0">Folio</span>
                      <span className="flex-1">RUT / Razón Social</span>
                      <span className="w-20 flex-shrink-0 text-center">Estado</span>
                      <span className="flex-shrink-0 text-right">Total</span>
                    </div>
                    {filasPreview.slice(0, 10).map((f, i) => (
                      <div key={i} className="flex items-center justify-between py-1 border-b border-gray-100 gap-2">
                        <span className="text-blue-600 font-mono font-bold w-10 flex-shrink-0">{TIPO_DOC_MAP[f.tipoDoc] ? f.tipoDoc : f.tipoDoc}</span>
                        <span className="text-gray-500 font-mono w-16 flex-shrink-0">{f.folio || '—'}</span>
                        <span className="text-gray-700 truncate flex-1">{f.razonSocial || f.rut || '(sin nombre)'}</span>
                        <span className="w-20 flex-shrink-0 text-center"><Badge variant={esDuplicada(f) ? 'warning' : tipoArchivo !== 'venta' && !cuentasPorRut[rutLimpio(f.rut)] ? 'danger' : 'success'}>{esDuplicada(f) ? 'Duplicado' : tipoArchivo !== 'venta' && !cuentasPorRut[rutLimpio(f.rut)] ? 'Sin cuenta' : 'Nuevo'}</Badge></span>
                        <span className="font-mono text-gray-800 flex-shrink-0">{formatCurrency(f.total)}</span>
                      </div>
                    ))}
                    {filasPreview.length > 10 && (
                      <p className="text-center text-gray-400 py-1">... y {filasPreview.length - 10} más</p>
                    )}
                  </div>

                  <button onClick={handleImport} disabled={isImporting}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                    {isImporting
                      ? <><CloudCog className="animate-spin" size={18}/> Procesando {importProgress ? `${importProgress.hecho}/${importProgress.total}` : '...'}</>
                      : <><Download size={18}/> Confirmar e Importar {filasNuevas.length} documentos nuevos</>
                    }
                  </button>
                  {isImporting && importProgress && (
                    <div className="mt-2 h-1.5 w-full bg-blue-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 transition-[width] duration-150"
                        style={{ width: `${Math.round((importProgress.hecho / importProgress.total) * 100)}%` }}
                      />
                    </div>
                  )}
                  <p className="text-[11px] text-gray-400 mt-1 text-center">
                    Cada documento genera su asiento contable — puede tardar unos segundos por documento.
                  </p>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

    </div>
  );
}

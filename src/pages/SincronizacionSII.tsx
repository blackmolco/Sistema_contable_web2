import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CloudCog, KeyRound, Download, CheckCircle, AlertTriangle,
  Building2, Upload, FileText, Trash2, Info, ArrowRight,
  Loader2, ShieldCheck, DatabaseZap, FileDown, CheckCheck,
  ExternalLink,
} from 'lucide-react';
import { Card } from '../components/ui/Cards';
import { TableSkeleton } from '../components/ui/Skeleton';
import { useApp } from '../context/AppContext';
import { formatRUT, formatCurrency, generateId } from '../utils/calculos';

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
  tipo: 'venta' | 'compra';
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
function parsearCSVSII(texto: string, tipoLibro: 'venta' | 'compra'): { filas: FilaRCV[]; debug: string } {
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
    folio   : resolverCol(colMap, ['folio', 'nrofolio', 'numero', 'nrooper']),
    // "RUT" → rut; también rutrec, rutem, rutemitente
    rut     : resolverCol(colMap, ['rutrec', 'rutem', 'rutemitente', 'ruteceptor', 'rut']),
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
    if (headerIdx >= 0 && isNaN(tipoDocNum)) continue;

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

    // Omitir filas completamente vacías de valores
    if (folio === 0 && total === 0 && neto === 0 && !rut) continue;

    resultado.push({
      tipoDoc: tipoDocNum ? String(tipoDocNum) : tipoDoc,
      folio, rut, razonSocial, fecha,
      neto, exento,
      iva: ivaRec + ivaNoRec,
      total, tipo: tipoLibro,
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
  const [tipoArchivo, setTipoArchivo] = useState<'venta' | 'compra'>('venta');
  const [filasPreview, setFilasPreview] = useState<FilaRCV[]>([]);
  const [isImporting, setIsImporting]   = useState(false);
  const [debugInfo, setDebugInfo]       = useState<string>('');
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
      const texto = ev.target?.result as string;
      const { filas, debug } = parsearCSVSII(texto, tipoArchivo);
      setDebugInfo(debug);
      if (filas.length === 0) {
        showToast('error', 'Sin datos',
          `No se leyeron registros. [${debug}] Verifica que sea el CSV del RCV del SII.`);
        return;
      }
      setFilasPreview(filas);
      const totalSum = filas.reduce((s, f) => s + f.total, 0);
      showToast('success', 'Archivo leído',
        `${filas.length} registros | Total: ${formatCurrency(totalSum)} | ${debug}`);
    };
    // SII exporta en ISO-8859-1 (Latin-1) — si falla, probar UTF-8
    reader.readAsText(file, 'ISO-8859-1');
    e.target.value = '';
  };

  // ── Importar (batch para no congelar) ──────────────────────────────────────
  const handleImport = () => {
    if (filasPreview.length === 0 || isImporting) return;
    setIsImporting(true);

    // Usar requestIdleCallback o setTimeout(0) para no bloquear el hilo
    requestAnimationFrame(() => {
      try {
        const docs = filasPreview.map(fila => ({
          id: generateId(),
          tipo: (TIPO_DOC_MAP[fila.tipoDoc] || (tipoArchivo === 'compra' ? 'factura_compra' : 'factura')) as any,
          numero: fila.folio,
          serie: '',
          fecha: parseFecha(fila.fecha),
          rutCliente: fila.rut,
          razonSocialCliente: fila.razonSocial,
          receptor: {
            rut: fila.rut, razonSocial: fila.razonSocial,
            giro: '', direccion: '', comuna: '', ciudad: '', contacto: '', email: '',
          },
          condicionesPago: tipoArchivo === 'venta' ? 'contado' : 'credito',
          detalles: [],
          subtotal: fila.neto,
          neto: fila.neto,
          descuentoGlobal: 0,
          iva: fila.iva,
          totalExento: fila.exento,
          total: fila.total,
          estado: tipoArchivo === 'venta' ? 'emitido' : 'pendiente' as any,
        }));

        // Un solo dispatch → un solo re-render
        dispatch({ type: 'BATCH_ADD_DOCUMENTOS', payload: docs });

        const totalImportado = filasPreview.reduce((s, f) => s + f.total, 0);
        showToast('success', '¡Importación Completa!',
          `${docs.length} documentos cargados — Total ${formatCurrency(totalImportado)}`);
        setFilasPreview([]);
      } catch (err) {
        showToast('error', 'Error', 'Ocurrió un error al importar. Intenta de nuevo.');
        console.error(err);
      } finally {
        setIsImporting(false);
      }
    });
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

  const totalPreview = filasPreview.reduce((s, f) => s + f.total, 0);
  const netoPreview  = filasPreview.reduce((s, f) => s + f.neto,  0);
  const ivaPreview   = filasPreview.reduce((s, f) => s + f.iva,   0);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
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
          { key: 'auto',   label: 'Sincronización Automática', icon: <CloudCog size={15}/> },
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Panel izquierdo: tipo + subida */}
            <Card>
              <h3 className="font-semibold text-gray-900 mb-4">1. Tipo de Registro</h3>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {(['venta', 'compra'] as const).map(t => (
                  <button key={t} onClick={() => { setTipoArchivo(t); setFilasPreview([]); }}
                    className={`py-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                      tipoArchivo === t
                        ? t === 'venta'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-amber-500 bg-amber-50 text-amber-700'
                        : 'border-gray-200 text-gray-400 hover:border-gray-300'
                    }`}>
                    {t === 'venta' ? '📤 Libro de Ventas' : '📥 Libro de Compras'}
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
            <Card>
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

                  <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <div>
                      <p className="font-bold text-emerald-800 text-sm">{filasPreview.length} documentos listos</p>
                      <p className="text-xs text-emerald-600">Vista previa (primeras 10 filas):</p>
                    </div>
                    <CheckCircle className="text-emerald-500" size={24} />
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-1 text-xs custom-scrollbar">
                    {/* Cabecera de tabla */}
                    <div className="flex items-center gap-2 py-1 border-b-2 border-gray-200 font-semibold text-gray-500 sticky top-0 bg-white">
                      <span className="w-10 flex-shrink-0">DTE</span>
                      <span className="w-16 flex-shrink-0">Folio</span>
                      <span className="flex-1">RUT / Razón Social</span>
                      <span className="flex-shrink-0 text-right">Total</span>
                    </div>
                    {filasPreview.slice(0, 10).map((f, i) => (
                      <div key={i} className="flex items-center justify-between py-1 border-b border-gray-100 gap-2">
                        <span className="text-blue-600 font-mono font-bold w-10 flex-shrink-0">{TIPO_DOC_MAP[f.tipoDoc] ? f.tipoDoc : f.tipoDoc}</span>
                        <span className="text-gray-500 font-mono w-16 flex-shrink-0">{f.folio || '—'}</span>
                        <span className="text-gray-700 truncate flex-1">{f.razonSocial || f.rut || '(sin nombre)'}</span>
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
                      ? <><CloudCog className="animate-spin" size={18}/> Procesando {filasPreview.length} documentos...</>
                      : <><Download size={18}/> Confirmar e Importar {filasPreview.length} documentos</>
                    }
                  </button>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* ── TAB AUTO ─────────────────────────────────────────────────────────── */}
      {tab === 'auto' && (
        <div className="space-y-5">
          {/* Estado del backend */}
          {backendStatus === 'online' ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
              <CheckCircle className="text-emerald-600 flex-shrink-0 mt-0.5" size={18} />
              <div className="text-xs text-emerald-800 space-y-0.5">
                <p className="font-semibold">Backend conectado — Sincronización real activa</p>
                <p>El servidor local está disponible. Se conectará al portal SII usando Playwright para obtener el RCV real.</p>
              </div>
            </div>
          ) : backendStatus === 'offline' ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={18} />
              <div className="text-xs text-amber-800 space-y-1">
                <p className="font-semibold">Backend inactivo — Modo simulación</p>
                <p>Para obtener datos reales del SII, inicie el servidor con <code className="bg-amber-100 px-1 rounded">npm run dev:backend</code> en otra terminal.
                   Sin backend, se usarán datos de prueba.</p>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center gap-2">
              <Loader2 size={14} className="text-gray-400 animate-spin" />
              <p className="text-xs text-gray-500">Verificando conexión con el servidor...</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Credenciales */}
            <Card>
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <ShieldCheck size={16} className="text-[#1E3A5F]"/> Credenciales del Contribuyente
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">RUT Empresa</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-2.5 text-gray-400" size={15}/>
                    <input
                      type="text"
                      value={rut}
                      onChange={e => setRut(e.target.value)}
                      placeholder="76.123.456-7"
                      disabled={isSyncing}
                      className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm disabled:bg-gray-50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Clave Tributaria SII</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-2.5 text-gray-400" size={15}/>
                    <input
                      type="password"
                      value={clave}
                      onChange={e => setClave(e.target.value)}
                      placeholder="Ingrese su clave tributaria"
                      disabled={isSyncing}
                      className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm disabled:bg-gray-50"
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Período + botón */}
            <Card>
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <DatabaseZap size={16} className="text-[#1E3A5F]"/> Período a Descargar
              </h3>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Mes</label>
                  <select
                    value={mes}
                    onChange={e => setMes(Number(e.target.value))}
                    disabled={isSyncing}
                    className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-50"
                  >
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                      <option key={m} value={m}>
                        {new Date(2000, m-1).toLocaleString('es-CL', { month: 'long' }).toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Año</label>
                  <input
                    type="number"
                    value={anio}
                    onChange={e => setAnio(Number(e.target.value))}
                    disabled={isSyncing}
                    className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-50"
                  />
                </div>
              </div>

              <button
                onClick={handleSync}
                disabled={isSyncing}
                className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                  isSyncing
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-[#1E3A5F] text-white hover:bg-[#2D5A87] active:scale-[0.98]'
                }`}
              >
                {isSyncing
                  ? <><Loader2 className="animate-spin" size={16}/> Sincronizando...</>
                  : <><Download size={16}/> Iniciar Sincronización</>
                }
              </button>
            </Card>
          </div>

          {/* ── Progreso animado ── */}
          {isSyncing && (
            <Card padding="md">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Progreso de sincronización</h3>
              <div className="space-y-3">
                {SYNC_STEPS.map(step => {
                  const done    = syncStep > step.id;
                  const active  = syncStep === step.id;
                  const pending = syncStep < step.id;
                  const Icon    = step.icon;
                  return (
                    <div key={step.id} className={`flex items-center gap-3 transition-all duration-300 ${pending ? 'opacity-30' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                        done    ? 'bg-emerald-100'
                        : active ? 'bg-blue-100'
                        : 'bg-gray-100'
                      }`}>
                        {active
                          ? <Loader2 size={15} className="text-blue-600 animate-spin"/>
                          : <Icon size={15} className={done ? 'text-emerald-600' : 'text-gray-400'}/>
                        }
                      </div>
                      <span className={`text-sm ${active ? 'text-blue-700 font-medium' : done ? 'text-emerald-700' : 'text-gray-400'}`}>
                        {step.label}
                        {active && <span className="ml-2 text-xs text-blue-500 animate-pulse">en progreso...</span>}
                        {done   && <span className="ml-2 text-xs text-emerald-500">✓</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* Barra de progreso */}
              <div className="mt-4 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (syncStep / SYNC_STEPS.length) * 100)}%` }}
                />
              </div>
            </Card>
          )}

          {/* Skeleton de la tabla de resultados mientras sincroniza */}
          {isSyncing && <TableSkeleton rows={6} cols={6} />}

          {/* ── Resultado ── */}
          {syncResult && !isSyncing && (
            <Card padding="md" className="border-emerald-200 bg-emerald-50/50">
              {/* Encabezado resultado */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle size={18} className="text-emerald-600"/>
                  </div>
                  <div>
                    <h3 className="font-semibold text-emerald-800">Sincronización completada</h3>
                    {syncResult.esReal
                      ? <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">DATOS REALES SII</span>
                      : <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">DATOS DE PRUEBA</span>
                    }
                  </div>
                </div>
                <button
                  onClick={() => navigate('/facturacion')}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#1E3A5F] hover:underline"
                >
                  Ver en Facturación <ExternalLink size={12}/>
                </button>
              </div>

              {/* Contadores */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-white rounded-xl p-4 border border-emerald-200 text-center">
                  <p className="text-3xl font-black text-[#1E3A5F]">{syncResult.ventas}</p>
                  <p className="text-xs text-gray-500 mt-1">Ventas importadas</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-emerald-200 text-center">
                  <p className="text-3xl font-black text-amber-600">{syncResult.compras}</p>
                  <p className="text-xs text-gray-500 mt-1">Compras importadas</p>
                </div>
              </div>

              {/* Preview de documentos */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Muestra de documentos importados:</p>
                <div className="space-y-1.5">
                  {syncResult.docs.map((doc, i) => (
                    <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                          doc.tipo === 'venta'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {doc.tipo === 'venta' ? 'VENTA' : 'COMPRA'}
                        </span>
                        <span className="text-xs text-gray-700 truncate">{doc.nombre}</span>
                      </div>
                      <span className="text-xs font-mono font-semibold text-gray-800 ml-3 flex-shrink-0">
                        {formatCurrency(doc.total)}
                      </span>
                    </div>
                  ))}
                  <p className="text-center text-xs text-gray-400 pt-1">
                    y {syncResult.ventas + syncResult.compras - syncResult.docs.length} documentos más...
                  </p>
                </div>
              </div>

              {/* CTA */}
              <button
                onClick={() => navigate('/facturacion')}
                className="mt-4 w-full py-2.5 bg-[#1E3A5F] text-white rounded-xl text-sm font-semibold
                           flex items-center justify-center gap-2 hover:bg-[#2D5A87] transition-colors"
              >
                Ver todos los documentos en Facturación <ArrowRight size={15}/>
              </button>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

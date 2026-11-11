// Lectura de archivos del RCV (Registro de Compras y Ventas) del SII.
// El SII los entrega en CSV, pero muchos usuarios los guardan o reciben como
// Excel (.xlsx / .xls). El importador solo sabe leer texto separado por ';',
// asi que un Excel se convierte primero al mismo formato de texto.

/** ¿El contenido es un Excel? xlsx es un zip ("PK") y xls el formato antiguo (OLE2). Se mira el contenido, no el nombre. */
export function esArchivoExcel(buffer: ArrayBuffer): boolean {
  const b = new Uint8Array(buffer.slice(0, 4));
  const xlsx = b[0] === 0x50 && b[1] === 0x4b;
  const xls = b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0;
  return xlsx || xls;
}

function normalizar(s: unknown): string {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}

// Excel guarda las fechas como dias desde el 30/12/1899. El SII las escribe dd/mm/aaaa.
function serialAFecha(serial: number): string {
  const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

const PALABRAS_CABECERA = ['rut', 'folio', 'total', 'neto', 'fecha', 'tipo', 'nro', 'razon', 'iva'];

/**
 * Convierte la primera hoja de un Excel del RCV al mismo texto que traeria el
 * CSV del SII (separado por ';', fechas dd/mm/aaaa, montos sin formato), para
 * que lo lea el mismo importador.
 */
export async function excelATextoSII(buffer: ArrayBuffer): Promise<string> {
  const XLSX = await import('xlsx');
  const libro = XLSX.read(new Uint8Array(buffer), { type: 'array' });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  if (!hoja) return '';
  const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, raw: true, defval: '' });

  // Columnas de fecha: en el Excel llegan como numero de serie, no como texto.
  const filaCabecera = filas.slice(0, 15).findIndex(f => {
    const nombres = f.map(normalizar);
    return PALABRAS_CABECERA.filter(k => nombres.some(n => n.includes(k))).length >= 3;
  });
  const columnasFecha = new Set<number>();
  if (filaCabecera >= 0) filas[filaCabecera].forEach((c, i) => { if (normalizar(c).startsWith('fecha')) columnasFecha.add(i); });

  const celda = (valor: unknown, columna: number, esDato: boolean): string => {
    if (typeof valor === 'number') {
      if (esDato && columnasFecha.has(columna) && valor > 20000 && valor < 80000) return serialAFecha(valor);
      return String(valor); // sin separadores de miles: el importador los interpreta como puntos
    }
    // El importador separa por ';' y no entiende comillas: se evita que un texto parta la fila.
    return String(valor ?? '').replace(/[;\r\n]+/g, ' ').trim();
  };

  return filas
    .map((fila, i) => fila.map((v, c) => celda(v, c, i > filaCabecera)).join(';'))
    .join('\n');
}

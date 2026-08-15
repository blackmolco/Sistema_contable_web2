// Lee el color de marca activo (elegido en Configuración → Identidad visual) para
// usarlo en documentos generados fuera del árbol de React — PDF (jsPDF) y HTML de
// exportación — que no tienen acceso al CSS del árbol vivo de la app.

const FALLBACK_HEX = '#13283D';
const FALLBACK_RGB: [number, number, number] = [19, 40, 61];

function readVar(name: string): string {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Hex del color de marca activo, p.ej. "#2E3F6E". */
export function getBrandHex(): string {
  const hex = readVar('--brand-color');
  return hex || FALLBACK_HEX;
}

/** [r,g,b] del color de marca activo, para APIs que piden componentes RGB (jsPDF). */
export function getBrandRgb(): [number, number, number] {
  const raw = readVar('--brand-rgb'); // formato "R G B"
  const parts = raw.split(/\s+/).map(Number);
  if (parts.length === 3 && parts.every(n => Number.isFinite(n))) {
    return parts as [number, number, number];
  }
  return FALLBACK_RGB;
}

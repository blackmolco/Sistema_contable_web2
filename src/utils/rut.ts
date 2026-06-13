/**
 * Utilidades para RUT chileno — algoritmo módulo 11
 */

/** Elimina puntos y guión */
export function limpiarRut(rut: string): string {
  return rut.replace(/[.-]/g, '').trim().toUpperCase();
}

/** Calcula dígito verificador */
function calcularDV(cuerpo: string): string {
  const rev = cuerpo.split('').reverse();
  const f = [2, 3, 4, 5, 6, 7];
  const suma = rev.reduce((s, d, i) => s + parseInt(d) * f[i % f.length], 0);
  const dv = 11 - (suma % 11);
  if (dv === 11) return '0';
  if (dv === 10) return 'K';
  return String(dv);
}

/** Valida un RUT (acepta formato con o sin puntos/guión) */
export function validarRut(rut: string): boolean {
  if (!rut) return false;
  const s = limpiarRut(rut);
  if (s.length < 2) return false;
  const cuerpo = s.slice(0, -1);
  const dv = s.slice(-1);
  if (!/^\d+$/.test(cuerpo)) return false;
  const n = parseInt(cuerpo);
  if (n < 1000000 || n > 99999999) return false;
  return calcularDV(cuerpo) === dv;
}

/** Formatea XX.XXX.XXX-X */
export function formatearRut(rut: string): string {
  const s = limpiarRut(rut).replace(/[^0-9Kk]/g, '');
  if (!s) return '';
  const cuerpo = s.length > 1 ? s.slice(0, -1) : s;
  const dv = s.length > 1 ? s.slice(-1) : '';
  const c = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return dv ? `${c}-${dv.toUpperCase()}` : c;
}

/** Formatear RUT mientras se escribe */
export function formatearRutEnTiempo(valor: string): string {
  const s = valor.replace(/[^0-9Kk]/g, '').toUpperCase();
  if (!s) return '';
  const tieneGuion = valor.includes('-');
  if (tieneGuion || s.length >= 8) {
    const cuerpo = s.length > 1 ? s.slice(0, -1) : s;
    const dv = s.length > 1 ? s.slice(-1) : '';
    const c = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return dv ? `${c}-${dv}` : c;
  }
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Retorna mensaje de error o null si es válido */
export function mensajeErrorRut(rut: string): string | null {
  if (!rut || rut.trim() === '') return null;
  if (limpiarRut(rut).length < 8) return 'RUT demasiado corto';
  if (!validarRut(rut)) return 'RUT inválido — verifica el dígito verificador';
  return null;
}

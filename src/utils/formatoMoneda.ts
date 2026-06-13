// ─── Formato de moneda chilena (CLP) ─────────────────────────────────────────
// Centraliza el formateo de montos que antes se hacía inline con toLocaleString.

/** Formatea un monto en pesos chilenos sin decimales: $1.234.567 */
export function formatCLP(monto: number): string {
  const safe = Number.isFinite(monto) ? monto : 0;
  return `$${Math.round(safe).toLocaleString('es-CL')}`;
}

/**
 * Formato contable: los negativos se muestran entre paréntesis.
 * -1234567 → ($1.234.567)
 */
export function formatCLPContable(monto: number): { texto: string; esNegativo: boolean } {
  const esNegativo = monto < 0;
  const texto = esNegativo ? `(${formatCLP(Math.abs(monto))})` : formatCLP(monto);
  return { texto, esNegativo };
}

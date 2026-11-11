// Año y mes de una fecha contable ("2026-05-01" o "2026-05-01T00:00:00.000Z")
// SIN pasar por Date. new Date("2026-05-01") es medianoche UTC y en Chile
// (UTC-3/-4) cae el 30 de abril a las 20:00: getMonth() devuelve abril y todo lo
// fechado el dia 1 queda en el mes anterior (el 1 de enero, en el año anterior).
export function anioMesDe(fecha: string | null | undefined): { anio: number; mes: number } | null {
  const m = /^(\d{4})-(\d{2})/.exec(String(fecha ?? ''));
  return m ? { anio: Number(m[1]), mes: Number(m[2]) } : null;
}

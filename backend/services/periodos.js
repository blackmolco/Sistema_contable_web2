async function exigirPeriodoAbierto(tx, empresaId, fecha) {
  if (!empresaId) throw Object.assign(new Error('La operación debe indicar una empresa'), { status: 400 });
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) throw Object.assign(new Error('Fecha no válida'), { status: 400 });
  const anio = d.getUTCFullYear();
  const mes = d.getUTCMonth() + 1;
  const periodo = await tx.periodoContable.findUnique({ where: { empresaId_anio_mes: { empresaId, anio, mes } } });
  if (periodo?.estado === 'cerrado') throw Object.assign(new Error(`El período ${String(mes).padStart(2, '0')}/${anio} está cerrado`), { status: 409 });
  return periodo;
}
module.exports = { exigirPeriodoAbierto };

const { Router } = require('express');
const { z } = require('zod');
const { prisma, logger, auditLog } = require('../shared');
const { authenticateToken } = require('../middlewares/authenticate');
const { exigirAccesoEmpresa } = require('../middlewares/empresaAccess');
const router = Router();

const crearSchema = z.object({
  empresaId: z.string().min(1),
  tipo: z.enum(['venta', 'compra', 'honorario', 'automatico']),
  periodo: z.string().regex(/^\d{4}-\d{2}$/).optional().nullable(),
  nombreArchivo: z.string().max(255).optional().nullable(),
  totalRegistros: z.number().int().min(0).default(0),
});

const actualizarSchema = z.object({
  nuevos: z.number().int().min(0).optional(),
  duplicados: z.number().int().min(0).optional(),
  errores: z.number().int().min(0).optional(),
  estado: z.enum(['procesando', 'completada', 'con_errores', 'fallida', 'revertida']).optional(),
  detalleErrores: z.string().max(10000).optional().nullable(),
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const empresaId = String(req.query.empresaId || '');
    if (!exigirAccesoEmpresa(req, res, empresaId)) return;
    const rows = await prisma.importacionSII.findMany({
      where: { empresaId }, orderBy: { createdAt: 'desc' }, take: 100,
    });
    const reconciliadas = await Promise.all(rows.map(async (row) => {
      if (row.estado !== 'procesando') return row;
      const [documentos, honorarios] = await Promise.all([
        prisma.documentoTributario.count({ where: { empresaId, importacionId: row.id } }),
        prisma.honorario.count({ where: { empresaId, importacionId: row.id } }),
      ]);
      const procesados = documentos + honorarios;
      const antiguedadMinutos = (Date.now() - new Date(row.createdAt).getTime()) / 60000;
      if (procesados >= row.totalRegistros && row.totalRegistros > 0) {
        return prisma.importacionSII.update({ where: { id: row.id }, data: { estado: 'completada', nuevos: procesados, duplicados: row.duplicados || 0, errores: 0 } });
      }
      if (procesados > 0 && antiguedadMinutos >= 5) {
        return prisma.importacionSII.update({ where: { id: row.id }, data: { estado: 'con_errores', nuevos: procesados, errores: Math.max(row.totalRegistros - procesados, 0), detalleErrores: 'El lote se reconcilió automáticamente después de una interrupción.' } });
      }
      // Si el navegador se cerró antes de crear el primer registro, el lote
      // no puede reconciliarse contando documentos. Evitamos que quede
      // eternamente en "procesando" y lo dejamos disponible para revisión.
      if (procesados === 0 && antiguedadMinutos >= 15) {
        return prisma.importacionSII.update({ where: { id: row.id }, data: { estado: 'fallida', nuevos: 0, errores: row.totalRegistros, detalleErrores: 'La carga no recibió registros dentro del tiempo esperado. Puede reintentarse o revertirse.' } });
      }
      return row;
    }));
    res.json(reconciliadas);
  } catch (err) {
    logger.error({ err }, 'Error listando importaciones SII');
    res.status(500).json({ error: 'No se pudo obtener el historial de importaciones' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  const parsed = crearSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Datos de importación inválidos' });
  const { empresaId } = parsed.data;
  if (!exigirAccesoEmpresa(req, res, empresaId)) return;
  try {
    const row = await prisma.importacionSII.create({ data: parsed.data });
    await auditLog(req.usuario.id, 'INICIAR_IMPORTACION', 'ImportacionSII', row.id, parsed.data, req.ip, req.headers['user-agent']).catch((auditError) => logger.warn({ auditError }, 'No se pudo registrar auditoría de inicio de importación'));
    res.status(201).json(row);
  } catch (err) {
    logger.error({ err }, 'Error creando importación SII');
    res.status(500).json({ error: 'No se pudo registrar la importación' });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  const parsed = actualizarSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Resultado de importación inválido' });
  try {
    const actual = await prisma.importacionSII.findUnique({ where: { id: req.params.id } });
    if (!actual) return res.status(404).json({ error: 'Importación no encontrada' });
    if (!exigirAccesoEmpresa(req, res, actual.empresaId)) return;
    const row = await prisma.importacionSII.update({ where: { id: actual.id }, data: parsed.data });
    await auditLog(req.usuario.id, 'FINALIZAR_IMPORTACION', 'ImportacionSII', row.id, parsed.data, req.ip, req.headers['user-agent']).catch((auditError) => logger.warn({ auditError }, 'No se pudo registrar auditoría de cierre de importación'));
    res.json(row);
  } catch (err) {
    logger.error({ err }, 'Error actualizando importación SII');
    res.status(500).json({ error: 'No se pudo actualizar la importación' });
  }
});

// Cierra un lote que quedó abierto porque el navegador se cerró o perdió la
// conexión. No elimina datos: deja el lote disponible para revisión o reverso.
router.post('/:id/cerrar', authenticateToken, async (req, res) => {
  try {
    const lote = await prisma.importacionSII.findUnique({ where: { id: req.params.id } });
    if (!lote) return res.status(404).json({ error: 'Importación no encontrada' });
    if (!exigirAccesoEmpresa(req, res, lote.empresaId)) return;
    if (lote.estado !== 'procesando') return res.status(409).json({ error: 'El lote ya fue cerrado' });
    const row = await prisma.importacionSII.update({
      where: { id: lote.id },
      data: { estado: 'fallida', detalleErrores: 'Carga interrumpida antes de finalizar. Revise los documentos importados o revierta el lote.' },
    });
    await auditLog(req.usuario.id, 'CERRAR_IMPORTACION_INTERRUPTA', 'ImportacionSII', row.id, {}, req.ip, req.headers['user-agent']).catch((auditError) => logger.warn({ auditError }, 'No se pudo registrar auditoría de cierre interrumpido'));
    res.json(row);
  } catch (err) {
    logger.error({ err }, 'Error cerrando importación interrumpida');
    res.status(500).json({ error: 'No se pudo cerrar la importación' });
  }
});

router.post('/:id/revertir', authenticateToken, async (req, res) => {
  try {
    const lote = await prisma.importacionSII.findUnique({ where: { id: req.params.id } });
    if (!lote) return res.status(404).json({ error: 'Importación no encontrada' });
    if (!exigirAccesoEmpresa(req, res, lote.empresaId)) return;
    if (lote.estado === 'revertida') return res.status(409).json({ error: 'El lote ya fue revertido' });
    if (lote.estado === 'procesando') return res.status(409).json({ error: 'Cierre primero la importación interrumpida' });

    const resultado = await prisma.$transaction(async (tx) => {
      const [documentos, honorarios, asientos] = await Promise.all([
        tx.documentoTributario.findMany({ where: { empresaId: lote.empresaId, importacionId: lote.id }, select: { id: true } }),
        tx.honorario.findMany({ where: { empresaId: lote.empresaId, importacionId: lote.id }, select: { id: true } }),
        tx.asientoContable.findMany({ where: { empresaId: lote.empresaId, importacionId: lote.id }, select: { id: true } }),
      ]);
      const asientoIds = asientos.map((a) => a.id);
      if (asientoIds.length) await tx.asientoContable.deleteMany({ where: { id: { in: asientoIds }, empresaId: lote.empresaId } });
      if (documentos.length) await tx.documentoTributario.deleteMany({ where: { id: { in: documentos.map((d) => d.id) }, empresaId: lote.empresaId } });
      if (honorarios.length) await tx.honorario.deleteMany({ where: { id: { in: honorarios.map((h) => h.id) }, empresaId: lote.empresaId } });
      await tx.importacionSII.update({ where: { id: lote.id }, data: { estado: 'revertida' } });
      return { eliminados: documentos.length + honorarios.length, asientosEliminados: asientoIds.length };
    }, { timeout: 15000 });
    await auditLog(req.usuario.id, 'REVERTIR_IMPORTACION', 'ImportacionSII', lote.id, resultado, req.ip, req.headers['user-agent']).catch((auditError) => logger.warn({ auditError }, 'No se pudo registrar auditoría de reversión'));
    res.json(resultado);
  } catch (err) {
    logger.error({ err }, 'Error revirtiendo importación SII');
    res.status(500).json({ error: 'No se pudo revertir el lote' });
  }
});

module.exports = router;

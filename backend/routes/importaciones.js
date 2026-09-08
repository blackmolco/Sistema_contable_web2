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
    res.json(rows);
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
    await auditLog(req.usuario.id, 'INICIAR_IMPORTACION', 'ImportacionSII', row.id, parsed.data, req.ip, req.headers['user-agent']);
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
    await auditLog(req.usuario.id, 'FINALIZAR_IMPORTACION', 'ImportacionSII', row.id, parsed.data, req.ip, req.headers['user-agent']);
    res.json(row);
  } catch (err) {
    logger.error({ err }, 'Error actualizando importación SII');
    res.status(500).json({ error: 'No se pudo actualizar la importación' });
  }
});

router.post('/:id/revertir', authenticateToken, async (req, res) => {
  try {
    const lote = await prisma.importacionSII.findUnique({ where: { id: req.params.id } });
    if (!lote) return res.status(404).json({ error: 'Importación no encontrada' });
    if (!exigirAccesoEmpresa(req, res, lote.empresaId)) return;
    if (lote.estado === 'revertida') return res.status(409).json({ error: 'El lote ya fue revertido' });
    if (lote.estado === 'procesando') return res.status(409).json({ error: 'No se puede revertir un lote en proceso' });

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
    await auditLog(req.usuario.id, 'REVERTIR_IMPORTACION', 'ImportacionSII', lote.id, resultado, req.ip, req.headers['user-agent']);
    res.json(resultado);
  } catch (err) {
    logger.error({ err }, 'Error revirtiendo importación SII');
    res.status(500).json({ error: 'No se pudo revertir el lote' });
  }
});

module.exports = router;

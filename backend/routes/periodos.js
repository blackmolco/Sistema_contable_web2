const { Router } = require('express');
const { z } = require('zod');
const { prisma, logger, auditLog } = require('../shared');
const { authenticateToken } = require('../middlewares/authenticate');
const { validate } = require('../middlewares/validate');
const { exigirAccesoEmpresa } = require('../middlewares/empresaAccess');
const router = Router();
const schema = z.object({ empresaId: z.string().min(1), anio: z.number().int().min(2000).max(2100), mes: z.number().int().min(1).max(12), estado: z.enum(['abierto', 'revision', 'cerrado']), motivo: z.string().max(500).optional() });

router.get('/', authenticateToken, async (req, res) => {
  try {
    const empresaId = String(req.query.empresaId || '');
    if (!exigirAccesoEmpresa(req, res, empresaId)) return;
    const periodos = await prisma.periodoContable.findMany({ where: { empresaId }, orderBy: [{ anio: 'desc' }, { mes: 'desc' }] });
    res.json(periodos);
  } catch (err) { logger.error({ err }, 'Error listando periodos'); res.status(500).json({ error: 'No se pudieron obtener los períodos' }); }
});

router.put('/', authenticateToken, validate(schema), async (req, res) => {
  try {
    const { empresaId, anio, mes, estado, motivo } = req.body;
    if (!exigirAccesoEmpresa(req, res, empresaId)) return;
    const esAdmin = ['admin', 'administrador'].includes(req.usuario.rol);
    if ((estado === 'cerrado' || estado === 'abierto') && !esAdmin) return res.status(403).json({ error: 'Solo un administrador puede cerrar o reabrir períodos' });
    const anterior = await prisma.periodoContable.findUnique({ where: { empresaId_anio_mes: { empresaId, anio, mes } } });
    if (anterior?.estado === 'cerrado' && estado === 'abierto' && (!motivo || motivo.trim().length < 5)) return res.status(400).json({ error: 'La reapertura exige un motivo' });
    const periodo = await prisma.periodoContable.upsert({
      where: { empresaId_anio_mes: { empresaId, anio, mes } },
      create: { empresaId, anio, mes, estado, fechaCierre: estado === 'cerrado' ? new Date() : null, usuarioCierreId: estado === 'cerrado' ? req.usuario.id : null, motivoReapertura: estado === 'abierto' ? motivo || null : null },
      update: { estado, fechaCierre: estado === 'cerrado' ? new Date() : null, usuarioCierreId: estado === 'cerrado' ? req.usuario.id : null, motivoReapertura: estado === 'abierto' ? motivo || null : null },
    });
    await auditLog(req.usuario.id, estado === 'cerrado' ? 'CERRAR_PERIODO' : estado === 'abierto' ? 'ABRIR_PERIODO' : 'REVISAR_PERIODO', 'PeriodoContable', periodo.id, { anio, mes, motivo }, req.ip, req.headers['user-agent']);
    res.json(periodo);
  } catch (err) { logger.error({ err }, 'Error actualizando periodo'); res.status(500).json({ error: 'No se pudo actualizar el período' }); }
});
module.exports = router;

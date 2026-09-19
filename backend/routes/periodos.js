const { Router } = require('express');
const { z } = require('zod');
const { prisma, logger, auditLog } = require('../shared');
const { authenticateToken } = require('../middlewares/authenticate');
const { validate } = require('../middlewares/validate');
const { exigirAccesoEmpresa } = require('../middlewares/empresaAccess');
const { evaluarCierre } = require('../services/cierreMensual');
const router = Router();
const schema = z.object({ empresaId: z.string().min(1), anio: z.number().int().min(2000).max(2100), mes: z.number().int().min(1).max(12), estado: z.enum(['abierto', 'revision', 'cerrado']), motivo: z.string().max(500).optional(), comentario: z.string().max(500).optional(), forzar: z.boolean().optional() });

router.get('/', authenticateToken, async (req, res) => {
  try {
    const empresaId = String(req.query.empresaId || '');
    if (!exigirAccesoEmpresa(req, res, empresaId)) return;
    const periodos = await prisma.periodoContable.findMany({ where: { empresaId }, orderBy: [{ anio: 'desc' }, { mes: 'desc' }] });
    res.json(periodos);
  } catch (err) { logger.error({ err }, 'Error listando periodos'); res.status(500).json({ error: 'No se pudieron obtener los períodos' }); }
});

router.get('/checklist', authenticateToken, async (req, res) => {
  try {
    const empresaId = String(req.query.empresaId || '');
    const anio = parseInt(req.query.anio, 10);
    const mes = parseInt(req.query.mes, 10);
    if (!exigirAccesoEmpresa(req, res, empresaId)) return;
    if (!Number.isInteger(anio) || !Number.isInteger(mes) || mes < 1 || mes > 12) return res.status(400).json({ error: 'anio y mes no válidos' });
    res.json(await evaluarCierre(prisma, empresaId, anio, mes));
  } catch (err) { logger.error({ err }, 'Error evaluando cierre'); res.status(500).json({ error: 'No se pudo evaluar el cierre del período' }); }
});

router.put('/', authenticateToken, validate(schema), async (req, res) => {
  try {
    const { empresaId, anio, mes, estado, motivo, comentario, forzar } = req.body;
    if (!exigirAccesoEmpresa(req, res, empresaId)) return;
    // exigirAccesoEmpresa ya garantizo arriba que este empresaId es el suyo
    // (o que es admin global), asi que sumar 'supervisor' aqui solo habilita
    // cerrar/reabrir los periodos de SU PROPIA empresa, nunca de otra.
    const esAdmin = ['admin', 'administrador', 'supervisor'].includes(req.usuario.rol);
    if ((estado === 'cerrado' || estado === 'abierto') && !esAdmin) return res.status(403).json({ error: 'Solo un administrador puede cerrar o reabrir períodos' });
    // Cerrar exige que el checklist no tenga controles bloqueantes fallando.
    // Un administrador puede forzar el cierre indicando un motivo (queda
    // registrado en el periodo y en la auditoria).
    let cierreForzado = false;
    if (estado === 'cerrado') {
      const cierre = await evaluarCierre(prisma, empresaId, anio, mes);
      if (!cierre.puedeCerrar) {
        if (!forzar) return res.status(409).json({ error: 'El período tiene controles pendientes; corrígelos o fuerza el cierre con un motivo', checklist: cierre });
        if (!motivo || motivo.trim().length < 10) return res.status(400).json({ error: 'Forzar el cierre exige un motivo de al menos 10 caracteres' });
        cierreForzado = true;
      }
    }
    const anterior = await prisma.periodoContable.findUnique({ where: { empresaId_anio_mes: { empresaId, anio, mes } } });
    if (anterior?.estado === 'cerrado' && estado === 'abierto' && (!motivo || motivo.trim().length < 5)) return res.status(400).json({ error: 'La reapertura exige un motivo' });
    const periodo = await prisma.periodoContable.upsert({
      where: { empresaId_anio_mes: { empresaId, anio, mes } },
      create: { empresaId, anio, mes, estado, fechaCierre: estado === 'cerrado' ? new Date() : null, usuarioCierreId: estado === 'cerrado' ? req.usuario.id : null, motivoReapertura: estado === 'abierto' ? motivo || null : null, comentarioCierre: estado === 'cerrado' ? (cierreForzado ? motivo : comentario) || null : null, cierreForzado },
      update: { estado, fechaCierre: estado === 'cerrado' ? new Date() : null, usuarioCierreId: estado === 'cerrado' ? req.usuario.id : null, motivoReapertura: estado === 'abierto' ? motivo || null : null, comentarioCierre: estado === 'cerrado' ? (cierreForzado ? motivo : comentario) || null : null, cierreForzado },
    });
    await auditLog(req.usuario.id, estado === 'cerrado' ? 'CERRAR_PERIODO' : estado === 'abierto' ? 'ABRIR_PERIODO' : 'REVISAR_PERIODO', 'PeriodoContable', periodo.id, { anio, mes, motivo, comentario, cierreForzado }, req.ip, req.headers['user-agent']);
    res.json(periodo);
  } catch (err) { logger.error({ err }, 'Error actualizando periodo'); res.status(500).json({ error: 'No se pudo actualizar el período' }); }
});
module.exports = router;

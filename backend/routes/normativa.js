const { Router } = require('express');
const { logger } = require('../shared');
const { authenticateToken } = require('../middlewares/authenticate');
const { requireRole } = require('../middlewares/requireRole');
const normativa = require('../normativa');
const { prisma } = require('../shared');

const router = Router();

router.get('/', authenticateToken, async (req, res) => {
    try {
        res.json(normativa.getNormativaCompleta());
    } catch (err) {
        logger.error({ err }, 'Error obteniendo normativa');
        res.status(500).json({ error: 'Error al obtener normativa' });
    }
});

router.post('/actualizar', authenticateToken, requireRole('administrador'), async (req, res) => {
    try {
        const resultado = await normativa.actualizarDesdeSII(prisma);
        res.json(resultado);
    } catch (err) {
        logger.error({ err }, 'Error actualizando normativa');
        res.status(500).json({ error: 'Error al actualizar normativa' });
    }
});

router.get('/calculo-impuesto', authenticateToken, async (req, res) => {
    try {
        const renta = parseFloat(req.query.renta);
        if (isNaN(renta)) return res.status(400).json({ error: 'Parametro renta requerido' });
        const resultado = normativa.calcularImpuestoUnico(renta);
        res.json(resultado);
    } catch (err) {
        res.status(500).json({ error: 'Error calculando impuesto' });
    }
});

module.exports = router;

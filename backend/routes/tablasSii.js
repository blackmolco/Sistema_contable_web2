const { Router } = require('express');
const { prisma, logger } = require('../shared');
const { authenticateToken } = require('../middlewares/authenticate');

const router = Router();

router.get('/', authenticateToken, async (req, res) => {
    try {
        const { tipo } = req.query;
        const where = { vigente: true };
        if (tipo) where.tipo = tipo;
        const tablas = await prisma.tablaSII.findMany({ where, orderBy: [{ tipo: 'asc' }, { codigo: 'asc' }] });
        res.json(tablas);
    } catch (err) {
        logger.error({ err }, 'Error obteniendo tablas SII');
        res.status(500).json({ error: 'Error al obtener tablas SII' });
    }
});

module.exports = router;

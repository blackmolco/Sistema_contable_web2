const { Router } = require('express');
const { prisma, logger } = require('../shared');
const { authenticateToken } = require('../middlewares/authenticate');
const { exigirAccesoEmpresa } = require('../middlewares/empresaAccess');

const router = Router();

router.get('/', authenticateToken, async (req, res) => {
    try {
        const { q, limit = 20 } = req.query;
        // La empresa se pide explicitamente (o cae a la del usuario) y se
        // valida el acceso; antes un empresaId nulo buscaba las filas
        // heredadas sin empresa.
        const empresaId = req.query.empresaId || req.usuario.empresaId || null;
        if (!exigirAccesoEmpresa(req, res, empresaId)) return;
        if (!q || q.length < 2) {
            return res.status(400).json({ error: 'Termino de busqueda requerido (min 2 caracteres)' });
        }
        const termino = q.toString();
        const [cuentas, asientos, trabajadores, documentos, honorarios] = await Promise.all([
            prisma.cuenta.findMany({ where: { activo: true, empresaId, OR: [{ codigo: { contains: termino } }, { nombre: { contains: termino } }] }, take: parseInt(limit) }),
            prisma.asientoContable.findMany({ where: { empresaId, glosa: { contains: termino } }, take: parseInt(limit) }),
            prisma.trabajador.findMany({ where: { empresaId, estado: 'activo', OR: [{ nombres: { contains: termino } }, { apellidos: { contains: termino } }, { rut: { contains: termino } }] }, take: parseInt(limit) }),
            prisma.documento.findMany({ where: { activo: true, empresaId, OR: [{ nombre: { contains: termino } }, { descripcion: { contains: termino } }, { etiquetas: { contains: termino } }] }, take: parseInt(limit) }),
            prisma.honorario.findMany({ where: { empresaId, OR: [{ nombre: { contains: termino } }, { rut: { contains: termino } }] }, take: parseInt(limit) }),
        ]);
        res.json({
            cuentas: cuentas.map(c => ({ tipo: 'cuenta', id: c.id, titulo: `${c.codigo} - ${c.nombre}`, subtitulo: c.tipo, ruta: '/plan-cuentas' })),
            asientos: asientos.map(a => ({ tipo: 'asiento', id: a.id, titulo: `Asiento #${a.numero}`, subtitulo: a.glosa, ruta: '/asientos' })),
            trabajadores: trabajadores.map(t => ({ tipo: 'trabajador', id: t.id, titulo: `${t.nombres} ${t.apellidos}`, subtitulo: t.rut, ruta: '/remuneraciones' })),
            documentos: documentos.map(d => ({ tipo: 'documento', id: d.id, titulo: d.nombre, subtitulo: d.categoria, ruta: '/documentos' })),
            honorarios: honorarios.map(h => ({ tipo: 'honorario', id: h.id, titulo: h.nombre, subtitulo: `Periodo ${h.periodo}`, ruta: '/honorarios' })),
        });
    } catch (err) {
        logger.error({ err }, 'Error en busqueda global');
        res.status(500).json({ error: 'Error en busqueda' });
    }
});

module.exports = router;

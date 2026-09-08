const { Router } = require('express');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const { prisma, logger, auditLog } = require('../shared');
const { authenticateToken } = require('../middlewares/authenticate');
const { validate } = require('../middlewares/validate');
const { crearAsiento } = require('../services/generarAsiento');

const router = Router();
const writeLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_WRITE_MAX) || 500,
  message: { error: 'Limite de operaciones alcanzado' },
});

const schema = z.object({
  empresaId: z.string().min(1),
  fecha: z.string().date(),
  cuentaMedioId: z.string().min(1),
  glosa: z.string().min(2).max(500).optional(),
  aplicaciones: z.array(z.object({
    documentoId: z.string().min(1),
    rut: z.string().min(3).max(20),
    nombre: z.string().min(1).max(200),
    cuentaControlId: z.string().min(1),
    monto: z.number().positive(),
  })).min(1),
});

router.post('/aplicar', authenticateToken, writeLimiter, validate(schema), async (req, res) => {
  const { empresaId, fecha, cuentaMedioId, aplicaciones, glosa } = req.body;
  try {
    const asiento = await prisma.$transaction(async tx => {
      const medio = await tx.cuenta.findFirst({ where: { id: cuentaMedioId, empresaId, activo: true, permiteMovimiento: true } });
      if (!medio) throw Object.assign(new Error('La cuenta de banco/caja no pertenece a la empresa'), { status: 400 });

      const detalles = [];
      let totalDebeMedio = 0;
      let totalHaberMedio = 0;
      for (const app of aplicaciones) {
        const control = await tx.cuenta.findFirst({ where: { id: app.cuentaControlId, empresaId, activo: true, requiereAuxiliar: true } });
        if (!control) throw Object.assign(new Error('Cuenta de control no valida'), { status: 400 });
        const previas = await tx.detalleAsiento.findMany({
          where: { documentoId: app.documentoId, rutAuxiliar: app.rut, asiento: { empresaId, estado: { not: 'anulado' } } },
        });
        const saldoFirmado = previas.reduce((s, d) => s + (d.debe - d.haber), 0) * (control.naturaleza === 'acreedora' ? -1 : 1);
        const pendiente = Math.abs(saldoFirmado);
        if (app.monto > pendiente + 0.5) throw Object.assign(new Error(`El monto supera el saldo pendiente de ${app.nombre}`), { status: 409 });
        const pagaProveedor = control.naturaleza === 'acreedora';
        detalles.push({
          cuentaId: control.id, cuentaCodigo: control.codigo, cuentaNombre: control.nombre,
          debe: pagaProveedor ? app.monto : 0, haber: pagaProveedor ? 0 : app.monto,
          rutAuxiliar: app.rut, nombreAuxiliar: app.nombre, documentoId: app.documentoId,
        });
        if (pagaProveedor) totalHaberMedio += app.monto; else totalDebeMedio += app.monto;
      }
      if (totalDebeMedio) detalles.push({ cuentaId: medio.id, cuentaCodigo: medio.codigo, cuentaNombre: medio.nombre, debe: totalDebeMedio, haber: 0 });
      if (totalHaberMedio) detalles.push({ cuentaId: medio.id, cuentaCodigo: medio.codigo, cuentaNombre: medio.nombre, debe: 0, haber: totalHaberMedio });
      return crearAsiento(tx, { empresaId, fecha, glosa: glosa || `Aplicación de ${aplicaciones.length} documento(s)`, tipo: 'pago_cobro', detalles, usuarioId: req.usuario.id });
    }, { timeout: 15000 });
    await auditLog(req.usuario.id, 'APLICAR_PAGO_COBRO', 'AsientoContable', asiento.id, { aplicaciones: aplicaciones.length }, req.ip, req.headers['user-agent']);
    res.status(201).json(asiento);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    logger.error({ err }, 'Error aplicando pago/cobro');
    res.status(500).json({ error: 'No se pudo registrar el pago o cobro' });
  }
});

module.exports = router;

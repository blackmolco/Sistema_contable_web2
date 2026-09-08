// Tabla de reglas para generar el asiento automático de un documento
// (factura venta/compra, boleta, boleta de honorarios, nota de crédito/débito).
// Compartida entre el endpoint en vivo (routes/ingresoDocumentos.js) y el
// script de backfill retroactivo, para que nunca diverjan.

const CODIGOS = {
    clientes: '1-02-001-0001',
    proveedores: '2-01-001-0001',
    ventas: '4-01-001-0001',
    ivaDebito: '2-01-002-0001',
    ivaCredito: '1-02-002-0001',
    honorariosGasto: '5-02-001-0004',
    honorariosPorPagar: '2-01-001-0003',
    retencionHonorarios: '2-01-002-0005',
};

async function buscarCuenta(tx, empresaId, codigo) {
    return tx.cuenta.findFirst({ where: { codigo, empresaId, activo: true } });
}

function base(cuenta) {
    return { cuentaId: cuenta.id, cuentaCodigo: cuenta.codigo, cuentaNombre: cuenta.nombre, debe: 0, haber: 0 };
}

function reglaVenta({ netoTotal, iva, total, cuentaClientes, cuentaVentas, cuentaIvaDebito, entidad, documentoId, invertido }) {
    const D = invertido ? 'haber' : 'debe';
    const H = invertido ? 'debe' : 'haber';
    const detalles = [];
    detalles.push({ ...base(cuentaClientes), [D]: total, rutAuxiliar: entidad.rut, nombreAuxiliar: entidad.razonSocial, documentoId });
    if (netoTotal) detalles.push({ ...base(cuentaVentas), [H]: netoTotal });
    if (iva) detalles.push({ ...base(cuentaIvaDebito), [H]: iva });
    return detalles;
}

function reglaCompra({ netoTotal, iva, total, cuentaGasto, cuentaProveedores, cuentaIvaCredito, entidad, documentoId, invertido }) {
    const D = invertido ? 'haber' : 'debe';
    const H = invertido ? 'debe' : 'haber';
    const detalles = [];
    if (netoTotal) detalles.push({ ...base(cuentaGasto), [D]: netoTotal });
    if (iva) detalles.push({ ...base(cuentaIvaCredito), [D]: iva });
    detalles.push({ ...base(cuentaProveedores), [H]: total, rutAuxiliar: entidad.rut, nombreAuxiliar: entidad.razonSocial, documentoId });
    return detalles;
}

function reglaHonorario({ montoBruto, retencion, montoLiquido, cuentaGastoHonorarios, cuentaRetencion, cuentaPorPagar, entidad, documentoId }) {
    const detalles = [{ ...base(cuentaGastoHonorarios), debe: montoBruto }];
    if (retencion) detalles.push({ ...base(cuentaRetencion), haber: retencion });
    detalles.push({ ...base(cuentaPorPagar), haber: montoLiquido, rutAuxiliar: entidad.rut, nombreAuxiliar: entidad.razonSocial, documentoId });
    return detalles;
}

/**
 * Arma las líneas del asiento para un documento tributario (factura, factura
 * exenta, boleta, nota de crédito/débito) dado su tipo, dirección
 * (venta/compra) y montos. `cuentaGastoId` es obligatorio solo para compras
 * (la cuenta de gasto/activo que el usuario eligió).
 */
async function lineasParaDocumento(tx, empresaId, { tipo, tipoTransaccion, neto = 0, exento = 0, iva = 0, total, cuentaGastoId, entidad, documentoId }) {
    // total - iva (no neto+exento) para que el asiento siempre cuadre por
    // construcción. El RCV del SII trae documentos con un "otro impuesto"
    // (tabaco, combustible, alcohol — códigos 28/35) que se suma al Monto
    // Total pero no aparece ni en Neto ni en IVA Recuperable — con
    // neto+exento esos 16 casos (de 129 compras reales) quedaban
    // descuadrados. Para el caso normal (sin otro impuesto) total-iva es
    // exactamente igual a neto+exento, así que no cambia nada.
    const netoTotal = (total || 0) - (iva || 0);
    const invertido = tipo === 'nota_credito';

    if (tipoTransaccion === 'venta') {
        const [cuentaClientes, cuentaVentas, cuentaIvaDebito] = await Promise.all([
            buscarCuenta(tx, empresaId, CODIGOS.clientes),
            buscarCuenta(tx, empresaId, CODIGOS.ventas),
            buscarCuenta(tx, empresaId, CODIGOS.ivaDebito),
        ]);
        if (!cuentaClientes) throw new Error(`Falta la cuenta ${CODIGOS.clientes} (Clientes) en el plan de cuentas`);
        if (netoTotal && !cuentaVentas) throw new Error(`Falta la cuenta ${CODIGOS.ventas} (Ventas) en el plan de cuentas`);
        if (iva && !cuentaIvaDebito) throw new Error(`Falta la cuenta ${CODIGOS.ivaDebito} (IVA Débito Fiscal) en el plan de cuentas`);
        return reglaVenta({ netoTotal, iva, total, cuentaClientes, cuentaVentas, cuentaIvaDebito, entidad, documentoId, invertido });
    }

    // compra
    const cuentaGasto = cuentaGastoId ? await tx.cuenta.findUnique({ where: { id: cuentaGastoId } }) : null;
    const [cuentaProveedores, cuentaIvaCredito] = await Promise.all([
        buscarCuenta(tx, empresaId, CODIGOS.proveedores),
        buscarCuenta(tx, empresaId, CODIGOS.ivaCredito),
    ]);
    if (!cuentaProveedores) throw new Error(`Falta la cuenta ${CODIGOS.proveedores} (Proveedores) en el plan de cuentas`);
    if (netoTotal && !cuentaGasto) throw new Error('Debe elegir la cuenta de gasto/activo para esta compra');
    if (iva && !cuentaIvaCredito) throw new Error(`Falta la cuenta ${CODIGOS.ivaCredito} (IVA Crédito Fiscal) en el plan de cuentas`);
    return reglaCompra({ netoTotal, iva, total, cuentaGasto, cuentaProveedores, cuentaIvaCredito, entidad, documentoId, invertido });
}

/** Arma las líneas del asiento para una boleta de honorarios. */
async function lineasParaHonorario(tx, empresaId, { montoBruto, retencion, montoLiquido, entidad, documentoId }) {
    const [cuentaGastoHonorarios, cuentaRetencion, cuentaPorPagar] = await Promise.all([
        buscarCuenta(tx, empresaId, CODIGOS.honorariosGasto),
        buscarCuenta(tx, empresaId, CODIGOS.retencionHonorarios),
        buscarCuenta(tx, empresaId, CODIGOS.honorariosPorPagar),
    ]);
    if (!cuentaGastoHonorarios) throw new Error(`Falta la cuenta ${CODIGOS.honorariosGasto} (Honorarios a Terceros) en el plan de cuentas`);
    if (!cuentaPorPagar) throw new Error(`Falta la cuenta ${CODIGOS.honorariosPorPagar} (Honorarios por pagar) en el plan de cuentas`);
    if (retencion && !cuentaRetencion) throw new Error(`Falta la cuenta ${CODIGOS.retencionHonorarios} (Retención 2ª categoría) en el plan de cuentas`);
    return reglaHonorario({ montoBruto, retencion, montoLiquido, cuentaGastoHonorarios, cuentaRetencion, cuentaPorPagar, entidad, documentoId });
}

/**
 * Crea el AsientoContable + DetalleAsiento[] dentro de la transacción `tx`,
 * asignando el número correlativo de forma atómica (increment sobre
 * Empresa.ultimoNumeroAsiento, serializado a nivel de fila por Postgres).
 */
async function crearAsiento(tx, { empresaId, fecha, glosa, tipo, detalles, usuarioId }) {
    let numero = 1;
    if (empresaId) {
        const empresa = await tx.empresa.update({
            where: { id: empresaId },
            data: { ultimoNumeroAsiento: { increment: 1 } },
        });
        numero = empresa.ultimoNumeroAsiento;
    }
    return tx.asientoContable.create({
        data: {
            id: require('crypto').randomUUID(),
            numero,
            fecha: new Date(fecha),
            glosa,
            tipo: tipo || null,
            estado: 'aprobado',
            empresaId,
            usuarioId: usuarioId || null,
            detalles: { create: detalles },
        },
        include: { detalles: true },
    });
}

module.exports = { CODIGOS, lineasParaDocumento, lineasParaHonorario, crearAsiento };

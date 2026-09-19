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

// Centralización de remuneraciones — ver lineasParaRemuneraciones() abajo.
const CODIGOS_REMUNERACIONES = {
    remuneracionesGasto: '5-02-001-0001',       // Remuneraciones del Personal
    cotizacionesGasto: '5-02-002-0001',         // Cotizaciones Previsionales Empleador (aportes patronales)
    remuneracionesPorPagar: '2-01-003-0001',    // líquido a pagar a los trabajadores
    imposicionesPorPagar: '2-01-003-0002',      // AFP (trabajador)
    saludPorPagar: '2-01-003-0003',             // Fonasa/Isapre (trabajador)
    cesantiaPorPagar: '2-01-003-0004',          // AFC, trabajador + empleador
    impuestoUnicoPorPagar: '2-01-003-0007',
    mutualPorPagar: '2-01-003-0008',
    reformaPrevisionalPorPagar: '2-01-003-0009', // SIS + cotización adicional Ley 21.735
    deudoresVarios: '1-02-001-0003',            // reverso de anticipos/préstamos al personal descontados este mes
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
async function lineasParaDocumento(tx, empresaId, { tipo, tipoTransaccion, neto = 0, exento = 0, iva = 0, total, cuentaGastoId, cuentaIngresoId, entidad, documentoId }) {
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
            cuentaIngresoId
                ? tx.cuenta.findFirst({ where: { id: cuentaIngresoId, empresaId, activo: true, permiteMovimiento: true, tipo: 'ingreso' } })
                : buscarCuenta(tx, empresaId, CODIGOS.ventas),
            buscarCuenta(tx, empresaId, CODIGOS.ivaDebito),
        ]);
        if (!cuentaClientes) throw new Error(`Falta la cuenta ${CODIGOS.clientes} (Clientes) en el plan de cuentas`);
        if (netoTotal && !cuentaVentas) throw new Error(`Falta la cuenta ${CODIGOS.ventas} (Ventas) en el plan de cuentas`);
        if (iva && !cuentaIvaDebito) throw new Error(`Falta la cuenta ${CODIGOS.ivaDebito} (IVA Débito Fiscal) en el plan de cuentas`);
        return reglaVenta({ netoTotal, iva, total, cuentaClientes, cuentaVentas, cuentaIvaDebito, entidad, documentoId, invertido });
    }

    // compra
    const cuentaGasto = cuentaGastoId ? await tx.cuenta.findFirst({ where: { id: cuentaGastoId, empresaId, activo: true, permiteMovimiento: true } }) : null;
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
async function lineasParaHonorario(tx, empresaId, { montoBruto, retencion, montoLiquido, entidad, documentoId, cuentaHonorarioId }) {
    const [cuentaGastoHonorarios, cuentaRetencion, cuentaPorPagar] = await Promise.all([
        cuentaHonorarioId
            ? tx.cuenta.findFirst({ where: { id: cuentaHonorarioId, empresaId, activo: true, permiteMovimiento: true, tipo: 'gasto' } })
            : buscarCuenta(tx, empresaId, CODIGOS.honorariosGasto),
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
async function crearAsiento(tx, { empresaId, fecha, glosa, tipo, detalles, usuarioId, importacionId }) {
    if (!empresaId) throw Object.assign(new Error('El asiento debe pertenecer a una empresa'), { status: 400 });
    const empresa = await tx.empresa.update({
        where: { id: empresaId },
        data: { ultimoNumeroAsiento: { increment: 1 } },
    });
    const numero = empresa.ultimoNumeroAsiento;
    return tx.asientoContable.create({
        data: {
            id: require('crypto').randomUUID(),
            numero,
            fecha: new Date(fecha),
            glosa,
            tipo: tipo || null,
            importacionId: importacionId || null,
            // El backend solo reconoce pendiente/contabilizado/anulado (ver
            // asientoSchema en routes/asientos.js) — 'aprobado' no es un
            // valor valido ahi, así que el mapeo estadoFromBackend en
            // apiSync.ts no lo reconocía y todo caía al default 'pendiente'.
            estado: 'contabilizado',
            empresaId,
            usuarioId: usuarioId || null,
            detalles: { create: detalles },
        },
        include: { detalles: true },
    });
}

/**
 * Arma las líneas del asiento de centralización de remuneraciones de un
 * período: suma los conceptos de un conjunto de liquidaciones ya calculadas
 * (una fila por concepto agregado, no una línea por trabajador — igual que
 * hace el sistema de remuneraciones dedicado en su propia centralización).
 * `liquidaciones` son filas de LiquidacionSueldo ya calculadas por
 * motorRemuneraciones.calcularLiquidacion().
 */
// Que columna de ConfigCentralizacionRemuneraciones corresponde a cada
// concepto de CODIGOS_REMUNERACIONES — el admin/supervisor de la empresa
// puede pisar el codigo fijo por una cuenta propia de su plan de cuentas
// (ver routes/empresas.js: GET/PATCH /:id/cuentas-remuneraciones).
const CAMPO_CONFIG_POR_CONCEPTO = {
    remuneracionesGasto: 'cuentaRemuneracionesGastoId',
    cotizacionesGasto: 'cuentaCotizacionesGastoId',
    remuneracionesPorPagar: 'cuentaRemuneracionesPorPagarId',
    imposicionesPorPagar: 'cuentaImposicionesPorPagarId',
    saludPorPagar: 'cuentaSaludPorPagarId',
    cesantiaPorPagar: 'cuentaCesantiaPorPagarId',
    impuestoUnicoPorPagar: 'cuentaImpuestoUnicoPorPagarId',
    mutualPorPagar: 'cuentaMutualPorPagarId',
    reformaPrevisionalPorPagar: 'cuentaReformaPrevisionalPorPagarId',
    deudoresVarios: 'cuentaDeudoresVariosId',
};

async function lineasParaRemuneraciones(tx, empresaId, liquidaciones) {
    const totales = liquidaciones.reduce((t, l) => ({
        totalHaberes: t.totalHaberes + l.totalImponible + l.colacion + l.movilizacion + l.asignacionFamiliar,
        aportesPatronales: t.aportesPatronales + l.aporteSis + l.aporteReformaPrevisional + l.aporteMutual + l.aporteAfcEmpresa,
        afp: t.afp + l.descuentoAFP,
        salud: t.salud + l.descuentoSalud,
        cesantia: t.cesantia + l.descuentoAFC + l.aporteAfcEmpresa,
        impuesto: t.impuesto + l.descuentoImpuesto,
        mutual: t.mutual + l.aporteMutual,
        reforma: t.reforma + l.aporteSis + l.aporteReformaPrevisional,
    }), { totalHaberes: 0, aportesPatronales: 0, afp: 0, salud: 0, cesantia: 0, impuesto: 0, mutual: 0, reforma: 0 });

    const config = await tx.configCentralizacionRemuneraciones.findUnique({ where: { empresaId } });
    const codigosUsados = Object.entries(CODIGOS_REMUNERACIONES);
    const cuentasPorCodigo = {};
    await Promise.all(codigosUsados.map(async ([clave, codigo]) => {
        const cuentaIdPersonalizada = config?.[CAMPO_CONFIG_POR_CONCEPTO[clave]];
        if (cuentaIdPersonalizada) {
            const cuenta = await tx.cuenta.findFirst({ where: { id: cuentaIdPersonalizada, empresaId, activo: true } });
            if (cuenta) { cuentasPorCodigo[clave] = cuenta; return; }
            // La cuenta personalizada ya no existe (se borro/desactivo) —
            // se cae al codigo por defecto en vez de fallar silenciosamente.
        }
        cuentasPorCodigo[clave] = await buscarCuenta(tx, empresaId, codigo);
    }));

    const detalles = [];
    const agregar = (clave, monto, lado) => {
        if (monto <= 0) return;
        const cuenta = cuentasPorCodigo[clave];
        if (!cuenta) throw new Error(`Falta la cuenta ${CODIGOS_REMUNERACIONES[clave]} en el plan de cuentas`);
        detalles.push({ ...base(cuenta), [lado]: Math.round(monto) });
    };

    agregar('remuneracionesGasto', totales.totalHaberes, 'debe');
    agregar('cotizacionesGasto', totales.aportesPatronales, 'debe');
    agregar('imposicionesPorPagar', totales.afp, 'haber');
    agregar('saludPorPagar', totales.salud, 'haber');
    agregar('cesantiaPorPagar', totales.cesantia, 'haber');
    agregar('impuestoUnicoPorPagar', totales.impuesto, 'haber');
    agregar('mutualPorPagar', totales.mutual, 'haber');
    agregar('reformaPrevisionalPorPagar', totales.reforma, 'haber');

    // Sueldo líquido y anticipos/préstamos SÍ se desglosan por trabajador
    // (en vez de una sola línea agregada) para que cada uno quede tageado
    // con su rut/nombre y alimente la Cuenta Corriente por trabajador. Cada
    // concepto usa un documentoId distinto (aunque venga de la misma
    // liquidación) porque son obligaciones económicamente distintas — lo que
    // se le debe al trabajador en sueldo vs. lo que él/ella debe por
    // anticipos/préstamos — y no deben netearse en una sola fila.
    const agregarPorTrabajador = (clave, extraerMonto, lado, sufijoDocumento) => {
        const cuenta = cuentasPorCodigo[clave];
        for (const l of liquidaciones) {
            const monto = extraerMonto(l);
            if (monto <= 0) continue;
            if (!cuenta) throw new Error(`Falta la cuenta ${CODIGOS_REMUNERACIONES[clave]} en el plan de cuentas`);
            detalles.push({
                ...base(cuenta), [lado]: Math.round(monto),
                rutAuxiliar: l.trabajador?.rut, nombreAuxiliar: l.trabajador ? `${l.trabajador.nombres} ${l.trabajador.apellidos}` : undefined,
                documentoId: `${l.id}-${sufijoDocumento}`,
            });
        }
    };
    agregarPorTrabajador('remuneracionesPorPagar', (l) => l.sueldoLiquido, 'haber', 'pagar');
    agregarPorTrabajador('deudoresVarios', (l) => l.anticipos + l.prestamos + l.otrosDescuentos, 'haber', 'deudor');

    return detalles;
}

module.exports = { CODIGOS, CODIGOS_REMUNERACIONES, CAMPO_CONFIG_POR_CONCEPTO, lineasParaDocumento, lineasParaHonorario, lineasParaRemuneraciones, crearAsiento };

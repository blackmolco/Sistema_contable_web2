// "Cuentas del sistema": las cuentas del plan que el programa usa por su
// cuenta al generar asientos automaticos (clientes, proveedores, IVA,
// ventas, honorarios...). Cada empresa puede tener su propio plan de
// cuentas, asi que estas cuentas se buscan asi:
//   1. la que la empresa configuro en ConfigCuentasSistema (por concepto), o
//   2. si no hay configuracion, la cuenta con el codigo del plan estandar
//      (el plan por defecto que se siembra en toda empresa nueva).
// Las cuentas de la centralizacion de remuneraciones se configuran aparte
// (ConfigCentralizacionRemuneraciones, ver services/generarAsiento.js).

// codigo = codigo en el plan estandar. Solo se usa como valor por defecto.
const CONCEPTOS = {
    clientes: { codigo: '1-02-001-0001', label: 'Clientes (cuentas por cobrar)' },
    proveedores: { codigo: '2-01-001-0001', label: 'Proveedores (cuentas por pagar)' },
    ventas: { codigo: '4-01-001-0001', label: 'Ingresos por ventas' },
    ivaDebito: { codigo: '2-01-002-0001', label: 'IVA Débito Fiscal' },
    ivaCredito: { codigo: '1-02-002-0001', label: 'IVA Crédito Fiscal' },
    remanenteIva: { codigo: '1-02-002-0002', label: 'Remanente de Crédito Fiscal' },
    ivaPorPagar: { codigo: '2-01-002-0003', label: 'IVA por Pagar' },
    honorariosGasto: { codigo: '5-02-001-0004', label: 'Gasto por honorarios' },
    honorariosPorPagar: { codigo: '2-01-001-0003', label: 'Honorarios por pagar' },
    retencionHonorarios: { codigo: '2-01-002-0005', label: 'Retención 2ª categoría por pagar' },
    cuentaPorClasificar: { codigo: '5-03-004-0001', label: 'Gasto por clasificar' },
    cajaBoletas: { codigo: '1-01-002-0001', label: 'Caja / cobros de boletas' },
    utilidadesAcumuladas: { codigo: '3-01-003-0001', label: 'Utilidades acumuladas' },
};

const CODIGOS_POR_DEFECTO = Object.fromEntries(Object.entries(CONCEPTOS).map(([k, v]) => [k, v.codigo]));

/**
 * Devuelve { concepto: cuenta | null } para una empresa.
 * `tx` puede ser prisma o una transaccion.
 */
async function resolverCuentas(tx, empresaId) {
    const config = await tx.configCuentasSistema.findUnique({ where: { empresaId } });
    const configuradas = (config && config.cuentas) || {};
    const ids = Object.values(configuradas).filter(Boolean);
    const cuentas = await tx.cuenta.findMany({
        where: {
            empresaId, activo: true,
            OR: [{ id: { in: ids.length ? ids : ['-'] } }, { codigo: { in: Object.values(CODIGOS_POR_DEFECTO) } }],
        },
    });
    const porId = new Map(cuentas.map(c => [c.id, c]));
    const porCodigo = new Map(cuentas.map(c => [c.codigo, c]));
    const resultado = {};
    for (const [concepto, def] of Object.entries(CONCEPTOS)) {
        const idConfigurado = configuradas[concepto];
        resultado[concepto] = (idConfigurado && porId.get(idConfigurado)) || porCodigo.get(def.codigo) || null;
    }
    return resultado;
}

// Mensaje uniforme cuando falta una cuenta del sistema.
function falta(concepto) {
    return Object.assign(new Error(`Falta la cuenta "${CONCEPTOS[concepto].label}": configúrala en Plan de Cuentas > Cuentas del sistema (o crea la cuenta ${CONCEPTOS[concepto].codigo} en el plan estándar).`), { status: 422 });
}

module.exports = { CONCEPTOS, CODIGOS_POR_DEFECTO, resolverCuentas, falta };

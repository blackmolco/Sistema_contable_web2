// Validaciones de pertenencia multiempresa: un id que viene del cliente
// (cuentaId, cuentaDefaultId, ...) solo se acepta si apunta a una fila de la
// MISMA empresa. Sin esto, un usuario de la empresa A podia dejar referencias
// a filas de la empresa B (las FK no distinguen empresas).

async function exigirCuentasDeEmpresa(tx, empresaId, cuentaIds) {
    const ids = [...new Set((cuentaIds || []).filter(Boolean))];
    if (ids.length === 0) return;
    const n = await tx.cuenta.count({ where: { id: { in: ids }, empresaId } });
    if (n !== ids.length) {
        throw Object.assign(new Error('Una o más cuentas contables no pertenecen a la empresa'), { status: 400 });
    }
}

module.exports = { exigirCuentasDeEmpresa };

const ADMIN_ROLES = new Set(['admin', 'administrador']);

function esAdmin(usuario) {
    return Boolean(usuario && ADMIN_ROLES.has(usuario.rol));
}

function puedeAccederEmpresa(usuario, empresaId) {
    if (!usuario || !empresaId) return false;
    return esAdmin(usuario) || usuario.empresaId === empresaId;
}

function exigirAccesoEmpresa(req, res, empresaId) {
    if (!empresaId) {
        res.status(400).json({ error: 'Debe seleccionar una empresa' });
        return false;
    }
    if (!puedeAccederEmpresa(req.usuario, empresaId)) {
        res.status(403).json({ error: 'No tiene acceso a esta empresa' });
        return false;
    }
    return true;
}

function obtenerEmpresaSolicitada(req) {
    return req.body?.empresaId || req.query?.empresaId || req.usuario?.empresaId || null;
}

function requireEmpresaAccess(req, res, next) {
    const empresaId = obtenerEmpresaSolicitada(req);
    if (!exigirAccesoEmpresa(req, res, empresaId)) return;
    req.empresaId = empresaId;
    next();
}

module.exports = { esAdmin, puedeAccederEmpresa, exigirAccesoEmpresa, obtenerEmpresaSolicitada, requireEmpresaAccess };

function tenantGuard(req, res, next) {
    const empresaIdToken = req.usuario?.empresaId || null;
    const empresaIdParam = req.query.empresaId || req.body?.empresaId || null;

    if (empresaIdToken && empresaIdParam && empresaIdToken !== empresaIdParam) {
        return res.status(403).json({ error: 'Acceso denegado: empresa no coincide' });
    }

    // Siempre usar el empresaId del token
    req.empresaId = empresaIdToken;
    next();
}

module.exports = { tenantGuard };

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.usuario || !roles.includes(req.usuario.rol)) {
            return res.status(403).json({ error: 'Permiso insuficiente' });
        }
        next();
    };
}

module.exports = { requireRole };

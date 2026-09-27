const { esAdmin } = require('./empresaAccess');

// Permiso puntual (no un rol nuevo): admin y supervisor siempre tienen
// acceso a Remuneraciones; para contador/usuario depende del campo
// Usuario.accesoRemuneraciones (default true), que viaja en el JWT (ver
// routes/auth.js) para no requerir una consulta a la BD en cada request.
function tieneAccesoRemuneraciones(usuario) {
    if (!usuario) return false;
    if (esAdmin(usuario) || usuario.rol === 'supervisor') return true;
    return usuario.accesoRemuneraciones !== false;
}

function exigirAccesoRemuneraciones(req, res, next) {
    if (!tieneAccesoRemuneraciones(req.usuario)) {
        return res.status(403).json({ error: 'No tiene acceso al módulo de Remuneraciones' });
    }
    next();
}

module.exports = { tieneAccesoRemuneraciones, exigirAccesoRemuneraciones };

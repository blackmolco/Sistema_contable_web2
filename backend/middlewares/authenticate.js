const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../shared');

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Token de autenticacion requerido' });
    }
    try {
        const decoded = jwt.verify(token, getJwtSecret());
        req.usuario = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Token invalido o expirado' });
    }
}

module.exports = { authenticateToken };

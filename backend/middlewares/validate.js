const { z } = require('zod');

function validate(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            const errores = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
            return res.status(400).json({ error: 'Datos invalidos', detalles: errores });
        }
        req.body = result.data;
        next();
    };
}

module.exports = { validate };

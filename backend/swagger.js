const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Sistema Contable Chile API',
            version: '2.0.0',
            description: 'API REST para el sistema de contabilidad chileno',
        },
        servers: [{ url: 'http://localhost:3001', description: 'Desarrollo' }],
        components: {
            securitySchemes: {
                bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
            },
        },
        security: [{ bearerAuth: [] }],
    },
    apis: ['./routes/*.js'],
};

module.exports = swaggerJsdoc(options);

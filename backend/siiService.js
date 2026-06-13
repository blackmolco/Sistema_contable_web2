const { logger } = require('./logger');

const SII_URLS = {
    cert: 'https://palmera.sii.cl',
    prod: 'https://zeus.sii.cl',
};

const TIPOS_DOCUMENTO_SII = {
    '33': 'factura',
    '34': 'factura_exenta',
    '39': 'boleta',
    '41': 'boleta_exenta',
    '56': 'nota_credito',
    '61': 'nota_credito',
    '52': 'guia_despacho',
    '46': 'compra',
};

async function obtenerSemilla(siiEnv = 'cert') {
    const baseUrl = SII_URLS[siiEnv] || SII_URLS.cert;
    try {
        const response = await fetch(`${baseUrl}/DTEWS/services/CRSeed.jws?WSDL`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/xml; charset=utf-8' },
            body: `<?xml version="1.0" encoding="UTF-8"?>
                <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                    <soap:Body>
                        <getSeed xmlns="http://www.sii.cl/DTE"/>
                    </soap:Body>
                </soap:Envelope>`,
        });

        if (!response.ok) {
            throw new Error(`Error obteniendo semilla SII: ${response.status}`);
        }

        const text = await response.text();
        const match = text.match(/<return>(\d+)<\/return>/);
        if (!match) {
            throw new Error('No se pudo extraer la semilla del response SII');
        }

        logger.info('Semilla SII obtenida exitosamente');
        return match[1];
    } catch (err) {
        logger.error({ err }, 'Error obteniendo semilla SII');
        throw err;
    }
}

function firmarSemilla(semilla, certPath, keyPath) {
    const fs = require('fs');
    const crypto = require('crypto');

    const cert = fs.readFileSync(certPath);
    const key = fs.readFileSync(keyPath);

    const signed = crypto.sign('sha1', Buffer.from(semilla), {
        key,
        padding: crypto.constants.RSA_PKCS1_PADDING,
    });

    return signed.toString('base64');
}

async function obtenerTokenAutenticacion(firma, siiEnv = 'cert') {
    const baseUrl = SII_URLS[siiEnv] || SII_URLS.cert;
    try {
        const response = await fetch(`${baseUrl}/DTEWS/services/getTokenFromSeed.jws?WSDL`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/xml; charset=utf-8' },
            body: `<?xml version="1.0" encoding="UTF-8"?>
                <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                    <soap:Body>
                        <getToken xmlns="http://www.sii.cl/DTE">
                            <item>
                                <Seed>${firma}</Seed>
                            </item>
                        </getToken>
                    </soap:Body>
                </soap:Envelope>`,
        });

        if (!response.ok) {
            throw new Error(`Error obteniendo token SII: ${response.status}`);
        }

        const text = await response.text();
        const tokenMatch = text.match(/<token>([^<]+)<\/token>/);
        if (!tokenMatch) {
            throw new Error('No se pudo extraer el token del response SII');
        }

        logger.info('Token SII obtenido exitosamente');
        return tokenMatch[1];
    } catch (err) {
        logger.error({ err }, 'Error obteniendo token SII');
        throw err;
    }
}

async function consultarDTE(rutEmisor, tipoDte, folio, token, siiEnv = 'cert') {
    const baseUrl = SII_URLS[siiEnv] || SII_URLS.cert;
    const url = `${baseUrl}/DTEWS/services/QueryEstDte.jws?WSDL`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'Authorization': `Bearer ${token}`,
            },
            body: `<?xml version="1.0" encoding="UTF-8"?>
                <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                    <soap:Body>
                        <getEstDte xmlns="http://www.sii.cl/DTE">
                            <rutEmisor>${rutEmisor}</rutEmisor>
                            <tipoDte>${tipoDte}</tipoDte>
                            <folio>${folio}</folio>
                        </getEstDte>
                    </soap:Body>
                </soap:Envelope>`,
        });

        if (!response.ok) {
            throw new Error(`Error consultando DTE: ${response.status}`);
        }

        const text = await response.text();
        return { success: true, xml: text };
    } catch (err) {
        logger.error({ err, rutEmisor, tipoDte, folio }, 'Error consultando DTE');
        return { success: false, error: err.message };
    }
}

async function obtenerLibrosSII(rutEmpresa, periodo, token, tipoLibro = 'ventas', siiEnv = 'cert') {
    const baseUrl = SII_URLS[siiEnv] || SII_URLS.cert;
    const [ano, mes] = periodo.split('-');

    logger.info({ rutEmpresa, periodo, tipoLibro }, 'Consultando libros SII');

    return {
        success: true,
        periodo,
        tipo: tipoLibro,
        documentos: [],
        mensaje: 'Integracion completa requiere certificado digital SII configurado',
    };
}

async function enviarDTE(xmlFirmado, token, siiEnv = 'cert') {
    const baseUrl = SII_URLS[siiEnv] || SII_URLS.cert;
    const url = `${baseUrl}/DTEWS/services/UploadDte.jws?WSDL`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'Authorization': `Bearer ${token}`,
            },
            body: `<?xml version="1.0" encoding="UTF-8"?>
                <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                    <soap:Body>
                        <uploadDte xmlns="http://www.sii.cl/DTE">
                            <xmlDoc>${Buffer.from(xmlFirmado).toString('base64')}</xmlDoc>
                        </uploadDte>
                    </soap:Body>
                </soap:Envelope>`,
        });

        if (!response.ok) {
            throw new Error(`Error enviando DTE: ${response.status}`);
        }

        const text = await response.text();
        const trackIdMatch = text.match(/<trackId>(\d+)<\/trackId>/);

        return {
            success: true,
            trackId: trackIdMatch ? trackIdMatch[1] : null,
            response: text,
        };
    } catch (err) {
        logger.error({ err }, 'Error enviando DTE al SII');
        return { success: false, error: err.message };
    };
}

async function consultarEstadoDTE(trackId, token, siiEnv = 'cert') {
    const baseUrl = SII_URLS[siiEnv] || SII_URLS.cert;
    const url = `${baseUrl}/DTEWS/services/QueryEstDteAv.jws?WSDL`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'Authorization': `Bearer ${token}`,
            },
            body: `<?xml version="1.0" encoding="UTF-8"?>
                <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                    <soap:Body>
                        <getEstDteAv xmlns="http://www.sii.cl/DTE">
                            <trackId>${trackId}</trackId>
                        </getEstDteAv>
                    </soap:Body>
                </soap:Envelope>`,
        });

        if (!response.ok) {
            throw new Error(`Error consultando estado DTE: ${response.status}`);
        }

        const text = await response.text();
        return { success: true, response: text };
    } catch (err) {
        logger.error({ err, trackId }, 'Error consultando estado DTE');
        return { success: false, error: err.message };
    }
}

function getTiposDocumentoSII() {
    return TIPOS_DOCUMENTO_SII;
}

function getTipoDocumentoCodigo(tipoNombre) {
    const inverso = {};
    for (const [codigo, nombre] of Object.entries(TIPOS_DOCUMENTO_SII)) {
        inverso[nombre] = codigo;
    }
    return inverso[tipoNombre] || '33';
}

module.exports = {
    obtenerSemilla,
    firmarSemilla,
    obtenerTokenAutenticacion,
    consultarDTE,
    obtenerLibrosSII,
    enviarDTE,
    consultarEstadoDTE,
    getTiposDocumentoSII,
    getTipoDocumentoCodigo,
    SII_URLS,
};

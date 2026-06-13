const { logger } = require('./logger');

const UIT_HISTORICO = {
    2024: 65446,
    2023: 61344,
    2022: 57343,
    2021: 55380,
    2020: 53439,
};

const ESCALA_IMPUESTO_UNICO = {
    2024: [
        { tramo: 1, desde: 0, hasta: 13.5, tasa: 0, deduccion: 0 },
        { tramo: 2, desde: 13.5, hasta: 27, tasa: 0.04, deduccion: 0.54 },
        { tramo: 3, desde: 27, hasta: 54, tasa: 0.08, deduccion: 1.62 },
        { tramo: 4, desde: 54, hasta: 81, tasa: 0.135, deduccion: 4.86 },
        { tramo: 5, desde: 81, hasta: 108, tasa: 0.23, deduccion: 11.88 },
        { tramo: 6, desde: 108, hasta: 144, tasa: 0.30, deduccion: 23.52 },
        { tramo: 7, desde: 144, hasta: Infinity, tasa: 0.35, deduccion: 37.08 },
    ],
    2023: [
        { tramo: 1, desde: 0, hasta: 13.5, tasa: 0, deduccion: 0 },
        { tramo: 2, desde: 13.5, hasta: 27, tasa: 0.04, deduccion: 0.54 },
        { tramo: 3, desde: 27, hasta: 54, tasa: 0.08, deduccion: 1.62 },
        { tramo: 4, desde: 54, hasta: 81, tasa: 0.135, deduccion: 4.86 },
        { tramo: 5, desde: 81, hasta: 108, tasa: 0.23, deduccion: 11.88 },
        { tramo: 6, desde: 108, hasta: 144, tasa: 0.30, deduccion: 23.52 },
        { tramo: 7, desde: 144, hasta: Infinity, tasa: 0.35, deduccion: 37.08 },
    ],
};

const AFP_CONFIG = [
    { nombre: 'AFP Cuprum', comisionFija: 1.44, comisionVariable: 0, sis: 1.53 },
    { nombre: 'AFP Habitat', comisionFija: 1.27, comisionVariable: 0, sis: 1.53 },
    { nombre: 'AFP Capital', comisionFija: 1.48, comisionVariable: 0, sis: 1.53 },
    { nombre: 'AFP Provida', comisionFija: 1.51, comisionVariable: 0, sis: 1.53 },
    { nombre: 'AFP Modelo', comisionFija: 0.93, comisionVariable: 0, sis: 1.53 },
    { nombre: 'AFP Planvital', comisionFija: 1.31, comisionVariable: 0, sis: 1.53 },
    { nombre: 'AFP Uno', comisionFija: 0.99, comisionVariable: 0, sis: 1.53 },
];

const ASIGNACION_FAMILIAR = {
    2024: [
        { cargas: 1, monto: 19366 },
        { cargas: 2, monto: 38732 },
        { cargas: 3, monto: 58098 },
        { cargas: 4, monto: 77464 },
        { cargas: 5, monto: 96830 },
    ],
    topeImponible: 981270,
};

function getUit(ano = new Date().getFullYear()) {
    const uit = process.env.UIT_ACTUAL || UIT_HISTORICO[ano] || UIT_HISTORICO[2024];
    return parseInt(uit, 10);
}

function getEscalaImpuestoUnico(ano = new Date().getFullYear()) {
    return ESCALA_IMPUESTO_UNICO[ano] || ESCALA_IMPUESTO_UNICO[2024];
}

function calcularImpuestoUnico(rentaImponibleMensual, ano = new Date().getFullYear()) {
    const uit = getUit(ano);
    const rentaAnual = rentaImponibleMensual * 12;
    const rentaEnUit = rentaAnual / uit;
    const escala = getEscalaImpuestoUnico(ano);

    const tramo = escala.find(t => rentaEnUit > t.desde && rentaEnUit <= t.hasta);
    if (!tramo || tramo.tasa === 0) {
        return { impuesto: 0, tramo: 1, tasa: 0, deduccion: 0 };
    }

    const impuestoAnual = (rentaAnual * tramo.tasa) - (tramo.deduccion * uit);
    const impuestoMensual = Math.max(0, Math.round(impuestoAnual / 12));

    return {
        impuesto: impuestoMensual,
        tramo: tramo.tramo,
        tasa: tramo.tasa,
        deduccion: tramo.deduccion,
        rentaEnUit: Math.round(rentaEnUit),
    };
}

function getAfpConfig() {
    return AFP_CONFIG;
}

function getAfp(nombre) {
    return AFP_CONFIG.find(a => a.nombre === nombre) || AFP_CONFIG[0];
}

function getAsignacionFamiliar(cargas, ano = new Date().getFullYear()) {
    if (cargas <= 0) return 0;
    const tabla = ASIGNACION_FAMILIAR[ano] || ASIGNACION_FAMILIAR[2024];
    const idx = Math.min(cargas, tabla.length) - 1;
    return tabla[idx]?.monto || 0;
}

function getTasaIva() {
    return parseFloat(process.env.TASA_IVA || '0.19');
}

function getRetencionHonorarios() {
    return parseFloat(process.env.RETENCION_HONORARIOS || '0.10');
}

function getNormativaCompleta() {
    return {
        uit: getUit(),
        tasaIva: getTasaIva(),
        retencionHonorarios: getRetencionHonorarios(),
        afp: getAfpConfig(),
        sis: parseFloat(process.env.SIS_TASA || '0.0153'),
        salud: parseFloat(process.env.SALUD_TASA || '0.07'),
        afcContrata: parseFloat(process.env.AFC_CONTRATA || '0.006'),
        afcPlazoFijo: parseFloat(process.env.AFC_PLAZO_FIJO || '0.024'),
        asignacionFamiliar: ASIGNACION_FAMILIAR,
        escalaImpuestoUnico: getEscalaImpuestoUnico(),
    };
}

async function actualizarDesdeSII(prisma) {
    try {
        logger.info('Iniciando actualizacion de normativa desde SII');

        const response = await fetch('https://api.mindicador.cl/api', {
            headers: { 'Accept': 'application/json' },
        });

        if (!response.ok) {
            logger.warn('No se pudo obtener indicadores economicos');
            return { success: false, error: 'Error fetching mindicador' };
        }

        const data = await response.json();
        const hoy = new Date().toISOString().split('T')[0];

        const indicadores = [
            { clave: 'uf', valor: data.uf?.valor, descripcion: 'Unidad de Fomento' },
            { clave: 'utm', valor: data.utm?.valor, descripcion: 'Unidad Tributaria Mensual' },
            { clave: 'dolar', valor: data.dolar?.valor, descripcion: 'Dolar observado' },
            { clave: 'euro', valor: data.euro?.valor, descripcion: 'Euro observado' },
        ].filter(i => i.valor);

        for (const ind of indicadores) {
            await prisma.configuracionNormativa.upsert({
                where: { clave: ind.clave },
                update: { valor: String(ind.valor), updatedAt: new Date() },
                create: {
                    clave: ind.clave,
                    valor: String(ind.valor),
                    descripcion: ind.descripcion,
                    vigenteDesde: new Date(hoy),
                },
            });
        }

        logger.info({ indicadores: indicadores.length }, 'Normativa actualizada exitosamente');
        return { success: true, indicadores };
    } catch (err) {
        logger.error({ err }, 'Error actualizando normativa');
        return { success: false, error: err.message };
    }
}

module.exports = {
    getUit,
    getEscalaImpuestoUnico,
    calcularImpuestoUnico,
    getAfpConfig,
    getAfp,
    getAsignacionFamiliar,
    getTasaIva,
    getRetencionHonorarios,
    getNormativaCompleta,
    actualizarDesdeSII,
};

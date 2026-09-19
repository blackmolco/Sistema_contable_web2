// Respaldo lógico por empresa: exporta TODOS los datos de una empresa a un
// JSON versionado con checksum, y permite verificarlo y reconstruirlo en otra
// base (ver scripts/restaurar-respaldo.js). Es independiente del respaldo del
// proveedor de base de datos: sirve para portabilidad, para probar
// restauraciones sin tocar producción y como copia fuera de Supabase.
//
// No incluye usuarios, sesiones ni la bitácora de auditoría (no pertenecen a
// una empresa y contienen credenciales).
const crypto = require('crypto');
const { Prisma } = require('@prisma/client');

const FORMATO = 'sistema-contable-respaldo';
const VERSION = 1;

// Orden de inserción al restaurar (padres antes que hijos).
const ORDEN = [
    'Empresa', 'Cuenta', 'Entidad', 'Trabajador', 'ConfigCentralizacionRemuneraciones',
    'AsientoContable', 'DetalleAsiento', 'DocumentoTributario', 'LibroCompra', 'LibroVenta',
    'Honorario', 'ImportacionSII', 'ActivoFijo', 'TesoreriaMovimiento', 'PeriodoContable',
    'LiquidacionSueldo', 'Documento', 'ArchivoVersion',
];

const minuscula = (m) => m.charAt(0).toLowerCase() + m.slice(1);
const modeloDmmf = (nombre) => Prisma.dmmf.datamodel.models.find(m => m.name === nombre);
const campoId = (nombre) => modeloDmmf(nombre).fields.find(f => f.isId).name;

// Modelos que cuelgan de otro (no tienen empresaId): [modelo, campoFK, padre].
const HIJOS = [
    ['DetalleAsiento', 'asientoId', 'AsientoContable'],
    ['LiquidacionSueldo', 'trabajadorId', 'Trabajador'],
    ['ArchivoVersion', 'documentoId', 'Documento'],
];

async function exportarEmpresa(prisma, empresaId) {
    const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } });
    if (!empresa) throw Object.assign(new Error('Empresa no encontrada'), { status: 404 });

    const tablas = { Empresa: [empresa] };
    const conEmpresa = ORDEN.filter(m => m !== 'Empresa' && !HIJOS.some(h => h[0] === m));
    for (const modelo of conEmpresa) {
        tablas[modelo] = await prisma[minuscula(modelo)].findMany({ where: { empresaId }, orderBy: { [campoId(modelo)]: 'asc' } });
    }
    for (const [modelo, fk, padre] of HIJOS) {
        const ids = tablas[padre].map(f => f[campoId(padre)]);
        tablas[modelo] = ids.length
            ? await prisma[minuscula(modelo)].findMany({ where: { [fk]: { in: ids } }, orderBy: { [campoId(modelo)]: 'asc' } })
            : [];
    }

    const ordenado = {};
    ORDEN.forEach(m => { ordenado[m] = tablas[m]; });
    const conteos = Object.fromEntries(ORDEN.map(m => [m, ordenado[m].length]));
    return {
        formato: FORMATO,
        version: VERSION,
        generadoEn: new Date().toISOString(),
        empresa: { id: empresa.id, rut: empresa.rut, razonSocial: empresa.razonSocial },
        conteos,
        checksum: checksum(ordenado),
        tablas: ordenado,
    };
}

function checksum(tablas) {
    return crypto.createHash('sha256').update(JSON.stringify(tablas)).digest('hex');
}

// Devuelve { ok, errores[] }. Detecta archivos alterados, incompletos o de otro formato.
function verificarRespaldo(respaldo) {
    const errores = [];
    if (!respaldo || respaldo.formato !== FORMATO) return { ok: false, errores: ['El archivo no es un respaldo de este sistema'] };
    if (respaldo.version !== VERSION) errores.push(`Versión de respaldo no soportada: ${respaldo.version}`);
    if (!respaldo.tablas) return { ok: false, errores: [...errores, 'El respaldo no tiene datos'] };
    if (checksum(respaldo.tablas) !== respaldo.checksum) errores.push('El checksum no coincide: el archivo fue modificado o está dañado');
    for (const m of ORDEN) {
        if (!Array.isArray(respaldo.tablas[m])) errores.push(`Falta la tabla ${m}`);
        else if (respaldo.conteos?.[m] !== respaldo.tablas[m].length) errores.push(`El conteo de ${m} no coincide`);
    }
    return { ok: errores.length === 0, errores };
}

// El JSON trae las fechas como texto: se convierten a Date según el tipo del campo.
function revivirFilas(modelo, filas) {
    const camposFecha = modeloDmmf(modelo).fields.filter(f => f.type === 'DateTime').map(f => f.name);
    return filas.map(fila => {
        const copia = { ...fila };
        for (const c of camposFecha) if (copia[c] != null) copia[c] = new Date(copia[c]);
        return copia;
    });
}

module.exports = { exportarEmpresa, verificarRespaldo, revivirFilas, checksum, ORDEN, FORMATO, VERSION };

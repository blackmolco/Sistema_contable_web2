// Uso:
//   node backend/scripts/cargar-plan-cuentas.js "<ruta al plan .xls/.xlsx>"            (simulacion, no escribe)
//   node backend/scripts/cargar-plan-cuentas.js "<ruta al plan .xls/.xlsx>" --aplicar  (escribe)
//
// Carga el plan de cuentas propio de UNA empresa (por defecto Inversiones
// Boston Autoparts, RUT 78378856-K; otra con --rut=XXXXXXXX-X) reemplazando el
// plan estandar que tenia. Las demas empresas no se tocan.
//
//   - Cuentas del plan estandar sin movimientos: se eliminan.
//   - Cuentas del plan estandar CON movimientos (asientos): se desactivan, no se
//     borran, para no perder historia.
//   - Se crean las cuentas nuevas (codigos con puntos: 1.1.02.01).
//   - Se configuran las "cuentas del sistema" (clientes, IVA, ventas...) y las
//     de remuneraciones apuntando a las cuentas nuevas.
//   - Los proveedores/clientes que tenian una cuenta por defecto del plan viejo
//     quedan sin cuenta por defecto (se reasignan en Proveedores).
//
// HAZ UN RESPALDO ANTES:  node backend/scripts/respaldo-completo.js
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const prisma = new PrismaClient();

const args = process.argv.slice(2);
const APLICAR = args.includes('--aplicar');
const archivo = args.find(a => !a.startsWith('--'));
const rut = (args.find(a => a.startsWith('--rut=')) || '--rut=78378856-K').slice(6);

// concepto del sistema -> codigo en el plan nuevo (null = el plan no la trae)
const SISTEMA = {
    clientes: '1.1.02.01',
    proveedores: '2.1.01.01',
    ventas: '4.1.01.01',
    ivaDebito: '2.1.04.03',
    ivaCredito: '1.1.05.02',
    remanenteIva: '1.1.05.06',
    ivaPorPagar: '2.1.04.08',
    honorariosGasto: '6.1.01.18',
    honorariosPorPagar: '2.1.02.02',
    retencionHonorarios: '2.1.04.05',
    cuentaPorClasificar: '6.2.01.18',
    cajaBoletas: '1.1.01.01',
    utilidadesAcumuladas: '3.1.01.03',
};
// campo de ConfigCentralizacionRemuneraciones -> codigo
const REMUNERACIONES = {
    cuentaRemuneracionesGastoId: '6.1.01.01',
    cuentaCotizacionesGastoId: '6.1.01.14',
    cuentaRemuneracionesPorPagarId: '2.1.02.01',
    cuentaImposicionesPorPagarId: '2.1.02.03',
    cuentaSaludPorPagarId: '2.1.02.05', // Fonasa; el plan trae Isapre (2.1.02.04) aparte
    cuentaCesantiaPorPagarId: '2.1.02.09',
    cuentaImpuestoUnicoPorPagarId: '2.1.04.04',
    cuentaMutualPorPagarId: '2.1.02.07',
    cuentaReformaPrevisionalPorPagarId: '2.1.02.10',
    cuentaDeudoresVariosId: '1.1.02.08',
};
// Cuentas que el plan entregado no trae y el sistema necesita (agregadas a pedido).
const AGREGADAS = [
    { codigo: '2.1.04.08', nombre: 'IVA por Pagar' },
    { codigo: '2.1.02.09', nombre: 'Seguro de Cesantía por Pagar' },
    { codigo: '2.1.02.10', nombre: 'SIS y Reforma Previsional por Pagar' },
];
const AUXILIAR = {
    '1.1.02.01': 'cliente', '2.1.01.01': 'proveedor', '2.1.02.02': 'honorario',
    '2.1.02.01': 'trabajador', '1.1.02.08': 'trabajador',
};

function leerPlan(ruta) {
    const wb = XLSX.readFile(ruta);
    const filas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
    const cuentas = [];
    for (const f of filas) {
        const m = String(f[0] || '').trim().match(/^(\d(?:\.\d+)*)\.?\s+(.+)$/);
        if (!m) continue;
        const codigo = m[1];
        cuentas.push({ codigo, nombre: m[2].replace(/\s+/g, ' ').trim(), nivel: codigo.split('.').length });
    }
    for (const extra of AGREGADAS) {
        if (!cuentas.some(c => c.codigo === extra.codigo)) cuentas.push({ ...extra, nivel: 4 });
    }
    cuentas.sort((a, b) => a.codigo.split('.').map(n => n.padStart(3, '0')).join('.').localeCompare(b.codigo.split('.').map(n => n.padStart(3, '0')).join('.')));
    const codigos = new Set(cuentas.map(c => c.codigo));
    return cuentas.map(c => {
        const partes = c.codigo.split('.');
        let padreId = null;
        for (let i = partes.length - 1; i >= 1 && !padreId; i--) {
            const cand = partes.slice(0, i).join('.');
            if (codigos.has(cand)) padreId = cand;
        }
        const g = partes[0];
        const tipo = { 1: 'activo', 2: 'pasivo', 3: 'patrimonio', 4: 'ingreso' }[g] || 'gasto'; // 5, 6 y 7 son gastos
        const acreedora = ['2', '3', '4'].includes(g) || c.codigo.startsWith('1.2.03');
        return {
            ...c, padreId, tipo,
            naturaleza: acreedora ? 'acreedora' : 'deudora',
            permiteMovimiento: c.nivel === 4,
            tipoAuxiliar: AUXILIAR[c.codigo] || null,
        };
    });
}

async function main() {
    if (!archivo) throw new Error('Falta la ruta del archivo del plan de cuentas.');
    const plan = leerPlan(path.resolve(archivo));
    console.log(`Plan leido: ${plan.length} cuentas (${plan.filter(c => c.permiteMovimiento).length} imputables).`);
    const duplicados = plan.map(c => c.codigo).filter((c, i, a) => a.indexOf(c) !== i);
    if (duplicados.length) throw new Error('Codigos repetidos en el archivo: ' + duplicados.join(', '));

    const empresas = await prisma.empresa.findMany({ where: { rut: { in: [rut, rut.replace(/\./g, '')] } } });
    if (empresas.length !== 1) throw new Error(`Se esperaba 1 empresa con RUT ${rut}, hay ${empresas.length}.`);
    const empresa = empresas[0];
    console.log(`Empresa: ${empresa.razonSocial || empresa.nombre} (${empresa.id})`);

    const actuales = await prisma.cuenta.findMany({ where: { empresaId: empresa.id } });
    const yaNuevas = actuales.filter(c => c.codigo.includes('.'));
    const viejas = actuales.filter(c => !c.codigo.includes('.'));
    const usadas = await prisma.detalleAsiento.groupBy({
        by: ['cuentaId'], where: { cuentaId: { in: viejas.map(c => c.id) } }, _count: true,
    });
    const idsUsadas = new Set(usadas.map(u => u.cuentaId));
    const entidadesConCuenta = await prisma.entidad.count({ where: { empresaId: empresa.id, cuentaDefaultId: { in: viejas.map(c => c.id) } } });
    console.log(`Plan actual: ${viejas.length} cuentas estandar (${idsUsadas.size} con movimientos), ${yaNuevas.length} ya con codigo de puntos.`);
    console.log(` - se eliminaran ${viejas.length - idsUsadas.size} sin movimientos; se desactivaran ${idsUsadas.size} con movimientos.`);
    console.log(` - ${entidadesConCuenta} proveedor(es)/cliente(s) pierden su cuenta por defecto.`);

    const faltan = [...Object.entries(SISTEMA), ...Object.entries(REMUNERACIONES)].filter(([, cod]) => cod && !plan.some(c => c.codigo === cod));
    if (faltan.length) throw new Error('El archivo no trae estas cuentas esperadas: ' + faltan.map(f => f[1]).join(', '));
    console.log(`Se agregan al plan ${AGREGADAS.length} cuentas que el archivo no trae: ${AGREGADAS.map(a => a.codigo + ' ' + a.nombre).join('; ')}`);

    if (!APLICAR) { console.log('\nSIMULACION: no se escribio nada. Repite con --aplicar para ejecutar.'); return; }

    await prisma.$transaction(async (tx) => {
        const sinUso = viejas.filter(c => !idsUsadas.has(c.id)).map(c => c.id);
        await tx.entidad.updateMany({ where: { empresaId: empresa.id, cuentaDefaultId: { in: viejas.map(c => c.id) } }, data: { cuentaDefaultId: null } });
        await tx.configCentralizacionRemuneraciones.deleteMany({ where: { empresaId: empresa.id } });
        await tx.configCuentasSistema.deleteMany({ where: { empresaId: empresa.id } });
        await tx.cuenta.updateMany({ where: { id: { in: [...idsUsadas] } }, data: { activo: false } });
        await tx.cuenta.deleteMany({ where: { id: { in: sinUso } } });
        const existentes = new Set(yaNuevas.map(c => c.codigo));
        await tx.cuenta.createMany({
            data: plan.filter(c => !existentes.has(c.codigo)).map(c => ({
                codigo: c.codigo, nombre: c.nombre, tipo: c.tipo, naturaleza: c.naturaleza, nivel: c.nivel,
                padreId: c.padreId, permiteMovimiento: c.permiteMovimiento,
                requiereAuxiliar: Boolean(c.tipoAuxiliar), tipoAuxiliar: c.tipoAuxiliar, empresaId: empresa.id,
            })),
        });
        const nuevas = await tx.cuenta.findMany({ where: { empresaId: empresa.id, activo: true, codigo: { contains: '.' } } });
        const id = (cod) => (cod ? nuevas.find(c => c.codigo === cod)?.id ?? null : null);
        const cuentas = {};
        for (const [k, cod] of Object.entries(SISTEMA)) if (cod) cuentas[k] = id(cod);
        await tx.configCuentasSistema.create({ data: { empresaId: empresa.id, cuentas } });
        await tx.configCentralizacionRemuneraciones.create({
            data: { empresaId: empresa.id, ...Object.fromEntries(Object.entries(REMUNERACIONES).map(([k, cod]) => [k, id(cod)])) },
        });
    }, { timeout: 60000 });
    console.log('\nOK: plan de cuentas cargado y configurado.');
}

main()
    .catch((err) => { console.error('ERROR:', err.message); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());

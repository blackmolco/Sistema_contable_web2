// Uso:
//   node backend/scripts/crear-empresa-demo.js             (simulacion: solo dice que haria)
//   node backend/scripts/crear-empresa-demo.js --probar    (ejecuta TODO en una transaccion y la deshace: comprueba que funciona sin dejar nada)
//   node backend/scripts/crear-empresa-demo.js --aplicar   (crea la empresa de muestra)
//   node backend/scripts/crear-empresa-demo.js --borrar    (elimina la empresa de muestra y su usuario)
//
// Crea "Comercial Demo Andina SpA": una empresa FICTICIA, con su propio plan
// de cuentas, clientes, proveedores, facturas con asiento, una boleta de
// honorarios y trabajadores, mas un usuario de rol supervisor que solo ve esa
// empresa (el aislamiento multiempresa del sistema impide que vea otras).
// No lee ni modifica datos de ninguna otra empresa.
//
// La clave del usuario se genera al azar y se muestra UNA vez al final.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { lineasParaDocumento, lineasParaHonorario, crearAsiento } = require('../services/generarAsiento');
const prisma = new PrismaClient();

const APLICAR = process.argv.includes('--aplicar');
const BORRAR = process.argv.includes('--borrar');
const PROBAR = process.argv.includes('--probar');

const EMAIL_DEMO = 'demo@valenzuelaasesorias.cl';

function dv(cuerpo) {
    let suma = 0, mult = 2;
    for (let i = String(cuerpo).length - 1; i >= 0; i--) { suma += Number(String(cuerpo)[i]) * mult; mult = mult < 7 ? mult + 1 : 2; }
    const r = 11 - (suma % 11);
    return r === 11 ? '0' : r === 10 ? 'K' : String(r);
}
const rutDe = (cuerpo) => `${String(cuerpo).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv(cuerpo)}`;
const soloRut = (rut) => rut.replace(/[.\s-]/g, '').toUpperCase();
const RUT_EMPRESA = rutDe(76543210); // ficticio

// Plan de cuentas estandar: se lee de src/data/normativa.ts (el mismo que
// se siembra en toda empresa nueva), sin depender de datos de otra empresa.
function planEstandar() {
    const ts = require(path.join(__dirname, '..', '..', 'node_modules', 'typescript'));
    const fuente = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'data', 'normativa.ts'), 'utf8');
    const js = ts.transpileModule(fuente, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const m = { exports: {} };
    new Function('module', 'exports', 'require', js)(m, m.exports, require);
    return m.exports.PLAN_CUENTAS_DEFAULT;
}

const CLIENTES = [
    { cuerpo: 76111222, razonSocial: 'Ferretería El Roble Ltda.', giro: 'Venta de artículos de ferretería', comuna: 'Providencia' },
    { cuerpo: 77333444, razonSocial: 'Constructora Los Alerces SpA', giro: 'Construcción de edificios', comuna: 'Las Condes' },
    { cuerpo: 76555666, razonSocial: 'Minimarket Don Pepe SpA', giro: 'Venta al por menor de alimentos', comuna: 'Ñuñoa' },
];
const PROVEEDORES = [
    { cuerpo: 76777888, razonSocial: 'Distribuidora Pacífico SpA', giro: 'Venta al por mayor de artículos de oficina', comuna: 'Santiago', gasto: /útiles|oficina|insumo/i },
    { cuerpo: 77999000, razonSocial: 'Inmobiliaria Cordillera Ltda.', giro: 'Arriendo de inmuebles', comuna: 'Vitacura', gasto: /arriendo/i },
    { cuerpo: 76234567, razonSocial: 'Servicios Eléctricos Andes SpA', giro: 'Suministro eléctrico', comuna: 'Santiago', gasto: /electric|luz|energ/i },
];

function fechas() {
    const hoy = new Date();
    const dia = (mesesAtras, d) => new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - mesesAtras, d)).toISOString().slice(0, 10);
    return { dia, periodo: (mesesAtras) => dia(mesesAtras, 1).slice(0, 7) };
}

async function borrar() {
    const empresa = await prisma.empresa.findUnique({ where: { rut: RUT_EMPRESA } });
    const usuario = await prisma.usuario.findUnique({ where: { email: EMAIL_DEMO } });
    if (!empresa) { console.log('No existe la empresa de muestra: nada que borrar.'); }
    if (usuario && empresa && usuario.empresaId !== empresa.id) throw new Error('El usuario demo pertenece a otra empresa; no se borra nada.');
    if (!APLICAR) { console.log(`Se borraria ${empresa ? empresa.razonSocial : '(sin empresa)'} y ${usuario ? EMAIL_DEMO : '(sin usuario)'}. Repite con --aplicar --borrar.`); return; }
    await prisma.$transaction(async (tx) => {
        if (usuario) {
            await tx.sesion.deleteMany({ where: { usuarioId: usuario.id } });
            await tx.restablecerClave.deleteMany({ where: { usuarioId: usuario.id } });
            await tx.auditLog.deleteMany({ where: { usuarioId: usuario.id } });
        }
        if (empresa) {
            const id = empresa.id;
            await tx.detalleAsiento.deleteMany({ where: { asiento: { empresaId: id } } });
            await tx.asientoContable.deleteMany({ where: { empresaId: id } });
            await tx.liquidacionSueldo.deleteMany({ where: { trabajador: { empresaId: id } } });
            await tx.trabajador.deleteMany({ where: { empresaId: id } });
            await tx.documentoTributario.deleteMany({ where: { empresaId: id } });
            await tx.honorario.deleteMany({ where: { empresaId: id } });
            await tx.entidad.deleteMany({ where: { empresaId: id } });
            await tx.periodoContable.deleteMany({ where: { empresaId: id } });
            await tx.configCuentasSistema.deleteMany({ where: { empresaId: id } });
            await tx.configCentralizacionRemuneraciones.deleteMany({ where: { empresaId: id } });
            await tx.cuenta.deleteMany({ where: { empresaId: id } });
        }
        if (usuario) await tx.usuario.delete({ where: { id: usuario.id } });
        if (empresa) await tx.empresa.delete({ where: { id: empresa.id } });
    }, { timeout: 60000 });
    console.log('Empresa de muestra y usuario demo eliminados.');
}

async function crear() {
    if (await prisma.empresa.findUnique({ where: { rut: RUT_EMPRESA } })) throw new Error(`Ya existe una empresa con RUT ${RUT_EMPRESA}. Para rehacerla: --borrar --aplicar y luego --aplicar.`);
    if (await prisma.usuario.findUnique({ where: { email: EMAIL_DEMO } })) throw new Error(`Ya existe el usuario ${EMAIL_DEMO}.`);
    const plan = planEstandar();
    console.log(`Se creara ${RUT_EMPRESA} Comercial Demo Andina SpA con ${plan.length} cuentas, ${CLIENTES.length} clientes, ${PROVEEDORES.length} proveedores, 12 facturas con asiento, 1 honorario y 2 trabajadores, y el usuario ${EMAIL_DEMO} (supervisor).`);
    if (!APLICAR && !PROBAR) { console.log('\nSIMULACION: no se escribio nada. Repite con --probar (prueba sin dejar nada) o --aplicar.'); return; }

    const clave = crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, 'x') + '7Q';
    const F = fechas();

    await prisma.$transaction(async (tx) => {
        const empresa = await tx.empresa.create({ data: {
            id: crypto.randomUUID(), rut: RUT_EMPRESA, razonSocial: 'COMERCIAL DEMO ANDINA SPA', nombreFantasia: 'Demo Andina',
            giro: 'Venta al por menor de artículos de oficina y librería', direccion: 'Av. Ejemplo 1234, Of. 501', comuna: 'Providencia', ciudad: 'Santiago',
            telefono: '+56 2 2000 0000', email: 'contacto@demoandina.cl', representanteLegal: 'María Pérez Soto', rutRepresentante: rutDe(12345678),
        } });
        const empresaId = empresa.id;

        await tx.usuario.create({ data: {
            email: EMAIL_DEMO, nombre: 'Usuario Demo', rut: rutDe(11111111), rol: 'supervisor',
            passwordHash: await bcrypt.hash(clave, 12), activo: true, empresaId,
        } });

        // Plan de cuentas estandar
        await tx.cuenta.createMany({ data: plan.map(c => ({
            codigo: c.codigo, nombre: c.nombre, tipo: c.tipo, naturaleza: c.naturaleza, nivel: c.nivel, padreId: c.padreId ?? null,
            afectaIva: Boolean(c.afectaIva), descripcion: c.descripcion ?? null, permiteMovimiento: c.permiteMovimiento !== false,
            requiereAuxiliar: Boolean(c.requiereAuxiliar), tipoAuxiliar: c.tipoAuxiliar ?? null, empresaId,
        })) });
        const cuentas = await tx.cuenta.findMany({ where: { empresaId, activo: true } });

        const crearEntidad = (e, tipo) => tx.entidad.create({ data: {
            rut: rutDe(e.cuerpo), rutNormalizado: soloRut(rutDe(e.cuerpo)), razonSocial: e.razonSocial, giro: e.giro, comuna: e.comuna, ciudad: 'Santiago', tipo, empresaId,
        } });
        const clientes = []; for (const c of CLIENTES) clientes.push(await crearEntidad(c, 'cliente'));
        const proveedores = []; for (const p of PROVEEDORES) proveedores.push(await crearEntidad(p, 'proveedor'));

        const gastoDe = (patron) => (cuentas.find(c => c.tipo === 'gasto' && c.permiteMovimiento && patron.test(c.nombre))
            ?? cuentas.find(c => c.tipo === 'gasto' && c.permiteMovimiento)).id;

        let folioVenta = 1001, folioCompra = 5001;
        const emitir = async ({ tipoTransaccion, entidad, fecha, neto, cuentaGastoId }) => {
            const iva = Math.round(neto * 0.19), total = neto + iva;
            const folio = tipoTransaccion === 'venta' ? folioVenta++ : folioCompra++;
            const doc = await tx.documentoTributario.create({ data: {
                id: crypto.randomUUID(), tipo: 'factura', folio, rutEmisor: empresa.rut, rutReceptor: entidad.rut, razonSocialReceptor: entidad.razonSocial,
                giroReceptor: entidad.giro, comunaReceptor: entidad.comuna, fechaEmision: new Date(fecha), montoNeto: neto, iva, montoExento: 0, montoTotal: total,
                estado: tipoTransaccion === 'compra' ? 'pendiente' : 'emitido', tipoTransaccion, empresaId,
            } });
            const detalles = await lineasParaDocumento(tx, empresaId, { tipo: 'factura', tipoTransaccion, neto, exento: 0, iva, total, cuentaGastoId, entidad, documentoId: doc.id });
            const asiento = await crearAsiento(tx, {
                empresaId, fecha, tipo: tipoTransaccion === 'venta' ? 'venta' : 'compra',
                glosa: `${tipoTransaccion === 'venta' ? 'Venta' : 'Compra'} factura N° ${folio} - ${entidad.razonSocial}`, detalles,
            });
            await tx.documentoTributario.update({ where: { id: doc.id }, data: { asientoId: asiento.id } });
        };

        // 3 meses (el actual y los 2 anteriores): 2 ventas y 2 compras por mes
        for (const atras of [2, 1, 0]) {
            const base = 1200000 + (2 - atras) * 150000;
            await emitir({ tipoTransaccion: 'venta', entidad: clientes[0], fecha: F.dia(atras, 8), neto: base });
            await emitir({ tipoTransaccion: 'venta', entidad: clientes[1 + (atras % 2)], fecha: F.dia(atras, 18), neto: Math.round(base * 1.6) });
            await emitir({ tipoTransaccion: 'compra', entidad: proveedores[0], fecha: F.dia(atras, 5), neto: 380000, cuentaGastoId: gastoDe(PROVEEDORES[0].gasto) });
            await emitir({ tipoTransaccion: 'compra', entidad: proveedores[1], fecha: F.dia(atras, 10), neto: 650000, cuentaGastoId: gastoDe(PROVEEDORES[1].gasto) });
        }

        // Una boleta de honorarios
        const bruto = 500000, retencion = Math.round(bruto * 0.1525), liquido = bruto - retencion;
        const prestador = { rut: rutDe(15678901), razonSocial: 'Carolina Muñoz Vera (contadora externa)' };
        const honorario = await tx.honorario.create({ data: {
            rut: prestador.rut, nombre: prestador.razonSocial, folio: 87, periodo: F.periodo(1), montoBruto: bruto, retencion, montoLiquido: liquido, estado: 'pendiente', empresaId,
        } });
        const detHon = await lineasParaHonorario(tx, empresaId, { montoBruto: bruto, retencion, montoLiquido: liquido, entidad: prestador, documentoId: honorario.id });
        const asHon = await crearAsiento(tx, { empresaId, fecha: F.dia(1, 28), tipo: 'honorario', glosa: `Honorarios boleta N° 87 - ${prestador.razonSocial}`, detalles: detHon });
        await tx.honorario.update({ where: { id: honorario.id }, data: { asientoId: asHon.id } });

        // Trabajadores de ejemplo (la liquidacion se calcula desde el modulo Remuneraciones)
        const trabajador = (rutCuerpo, nombres, apellidos, cargo, sueldoBase, afp, tasaAfp) => tx.trabajador.create({ data: {
            rut: rutDe(rutCuerpo), nombres, apellidos, cargo, fechaIngreso: new Date('2025-03-01'), tipoContrato: 'indefinido', sueldoBase, colacion: 40000, movilizacion: 30000,
            afp, tasaAfp, tramoAsignacionFamiliar: 'D', estado: 'activo', empresaId,
        } });
        await trabajador(16543210, 'Diego', 'Fuentes Rojas', 'Vendedor', 750000, 'Habitat', 0.1127);
        await trabajador(17654321, 'Camila', 'Soto Araya', 'Administrativa', 620000, 'Modelo', 0.1058);

        if (PROBAR) {
            const asientos = await tx.asientoContable.findMany({ where: { empresaId }, include: { detalles: true } });
            const descuadrados = asientos.filter(a => Math.abs(a.detalles.reduce((t, d) => t + d.debe - d.haber, 0)) >= 1).length;
            console.log(`PRUEBA: ${asientos.length} asientos creados, ${descuadrados} descuadrados.`);
            throw Object.assign(new Error('PRUEBA_OK_REVERTIDA'), { revertir: true });
        }
    }, { timeout: 120000 }).catch((err) => {
        if (err.revertir) { console.log('\nPrueba correcta: todo se deshizo, no quedo nada en la base.'); return; }
        throw err;
    });
    if (PROBAR) return;

    console.log('\nOK: empresa de muestra creada.');
    console.log('  Direccion:  https://contable.valenzuelaasesorias.cl');
    console.log(`  Usuario:    ${EMAIL_DEMO}`);
    console.log(`  Clave:      ${clave}`);
    console.log('  (Anota la clave ahora: no se vuelve a mostrar. Se puede cambiar desde el sistema.)');
}

(BORRAR ? borrar() : crear())
    .catch((err) => { console.error('ERROR:', err.message); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const normativa = require('../normativa');

const prisma = new PrismaClient();

async function main() {
    console.log('Iniciando seed de datos...');

    const BCRYPT_ROUNDS = 10;

    // ============ USUARIO ADMIN ============
    const adminHash = bcrypt.hashSync('admin123', BCRYPT_ROUNDS);
    const admin = await prisma.usuario.upsert({
        where: { email: 'admin@contable.cl' },
        update: {},
        create: {
            email: 'admin@contable.cl',
            nombre: 'Administrador',
            rut: '76.192.600-5',
            rol: 'administrador',
            passwordHash: adminHash,
            activo: true,
        },
    });
    console.log('✓ Usuario admin creado');

    // ============ EMPRESA DEMO ============
    const empresa = await prisma.empresa.upsert({
        where: { rut: '76.192.600-5' },
        update: {},
        create: {
            rut: '76.192.600-5',
            razonSocial: 'Empresa Demo SpA',
            nombreFantasia: 'Demo Contable',
            giro: 'Servicios de consultoria',
            direccion: 'Av. Providencia 1234',
            comuna: 'Providencia',
            ciudad: 'Santiago',
            telefono: '+56 2 2345 6789',
            email: 'contacto@democontable.cl',
            representanteLegal: 'Juan Perez',
            rutRepresentante: '12.345.678-9',
        },
    });
    console.log('✓ Empresa demo creada');

    // ============ PLAN DE CUENTAS CHILENO ============
    const cuentasBase = [
        // ACTIVOS (1xx)
        { codigo: '1000', nombre: 'ACTIVOS', tipo: 'activo', naturaleza: 'deudora', nivel: 1, permiteMovimiento: false },
        { codigo: '1100', nombre: 'Activos Corrientes', tipo: 'activo', naturaleza: 'deudora', nivel: 2, padreId: '1000', permiteMovimiento: false },
        { codigo: '1110', nombre: 'Caja', tipo: 'activo', naturaleza: 'deudora', nivel: 3, padreId: '1100', permiteMovimiento: true },
        { codigo: '1120', nombre: 'Banco Cuenta Corriente', tipo: 'activo', naturaleza: 'deudora', nivel: 3, padreId: '1100', permiteMovimiento: true },
        { codigo: '1130', nombre: 'Caja Chica', tipo: 'activo', naturaleza: 'deudora', nivel: 3, padreId: '1100', permiteMovimiento: true },
        { codigo: '1140', nombre: 'Cuentas por Cobrar Clientes', tipo: 'activo', naturaleza: 'deudora', nivel: 3, padreId: '1100', permiteMovimiento: true },
        { codigo: '1150', nombre: 'Cuentas por Cobrar Empleados', tipo: 'activo', naturaleza: 'deudora', nivel: 3, padreId: '1100', permiteMovimiento: true },
        { codigo: '1160', nombre: 'IVA Credito Fiscal', tipo: 'activo', naturaleza: 'deudora', nivel: 3, padreId: '1100', permiteMovimiento: true, afectaIva: true, refSII: 'IVA_CF' },
        { codigo: '1170', nombre: 'Anticipos a Proveedores', tipo: 'activo', naturaleza: 'deudora', nivel: 3, padreId: '1100', permiteMovimiento: true },
        { codigo: '1180', nombre: 'Inventario de Mercaderias', tipo: 'activo', naturaleza: 'deudora', nivel: 3, padreId: '1100', permiteMovimiento: true },
        { codigo: '1190', nombre: 'Activos Corrientes Otros', tipo: 'activo', naturaleza: 'deudora', nivel: 3, padreId: '1100', permiteMovimiento: true },

        { codigo: '1200', nombre: 'Activos No Corrientes', tipo: 'activo', naturaleza: 'deudora', nivel: 2, padreId: '1000', permiteMovimiento: false },
        { codigo: '1210', nombre: 'Terrenos', tipo: 'activo', naturaleza: 'deudora', nivel: 3, padreId: '1200', permiteMovimiento: true },
        { codigo: '1220', nombre: 'Edificios', tipo: 'activo', naturaleza: 'deudora', nivel: 3, padreId: '1200', permiteMovimiento: true },
        { codigo: '1230', nombre: 'Mobiliario y Equipos', tipo: 'activo', naturaleza: 'deudora', nivel: 3, padreId: '1200', permiteMovimiento: true },
        { codigo: '1240', nombre: 'Equipos de Computacion', tipo: 'activo', naturaleza: 'deudora', nivel: 3, padreId: '1200', permiteMovimiento: true },
        { codigo: '1250', nombre: 'Vehiculos', tipo: 'activo', naturaleza: 'deudora', nivel: 3, padreId: '1200', permiteMovimiento: true },
        { codigo: '1260', nombre: 'Depreciacion Acumulada', tipo: 'activo', naturaleza: 'acreedora', nivel: 3, padreId: '1200', permiteMovimiento: true },
        { codigo: '1270', nombre: 'Propiedad Intelectual', tipo: 'activo', naturaleza: 'deudora', nivel: 3, padreId: '1200', permiteMovimiento: true },

        // PASIVOS (2xx)
        { codigo: '2000', nombre: 'PASIVOS', tipo: 'pasivo', naturaleza: 'acreedora', nivel: 1, permiteMovimiento: false },
        { codigo: '2100', nombre: 'Pasivos Corrientes', tipo: 'pasivo', naturaleza: 'acreedora', nivel: 2, padreId: '2000', permiteMovimiento: false },
        { codigo: '2110', nombre: 'Cuentas por Pagar Proveedores', tipo: 'pasivo', naturaleza: 'acreedora', nivel: 3, padreId: '2100', permiteMovimiento: true },
        { codigo: '2120', nombre: 'Cuentas por Pagar Empleados', tipo: 'pasivo', naturaleza: 'acreedora', nivel: 3, padreId: '2100', permiteMovimiento: true },
        { codigo: '2130', nombre: 'IVA Debito Fiscal', tipo: 'pasivo', naturaleza: 'acreedora', nivel: 3, padreId: '2100', permiteMovimiento: true, afectaIva: true, refSII: 'IVA_DF' },
        { codigo: '2140', nombre: 'Retenciones por Pagar', tipo: 'pasivo', naturaleza: 'acreedora', nivel: 3, padreId: '2100', permiteMovimiento: true },
        { codigo: '2150', nombre: 'Provisiones Remuneraciones', tipo: 'pasivo', naturaleza: 'acreedora', nivel: 3, padreId: '2100', permiteMovimiento: true },
        { codigo: '2160', nombre: 'Impuestos por Pagar', tipo: 'pasivo', naturaleza: 'acreedora', nivel: 3, padreId: '2100', permiteMovimiento: true },
        { codigo: '2170', nombre: 'AFP por Pagar', tipo: 'pasivo', naturaleza: 'acreedora', nivel: 3, padreId: '2100', permiteMovimiento: true },
        { codigo: '2180', nombre: 'Salud por Pagar', tipo: 'pasivo', naturaleza: 'acreedora', nivel: 3, padreId: '2100', permiteMovimiento: true },
        { codigo: '2190', nombre: 'Pasivos Corrientes Otros', tipo: 'pasivo', naturaleza: 'acreedora', nivel: 3, padreId: '2100', permiteMovimiento: true },

        { codigo: '2200', nombre: 'Pasivos No Corrientes', tipo: 'pasivo', naturaleza: 'acreedora', nivel: 2, padreId: '2000', permiteMovimiento: false },
        { codigo: '2210', nombre: 'Prestamos Bancarios LP', tipo: 'pasivo', naturaleza: 'acreedora', nivel: 3, padreId: '2200', permiteMovimiento: true },
        { codigo: '2220', nombre: 'Hipotecas por Pagar', tipo: 'pasivo', naturaleza: 'acreedora', nivel: 3, padreId: '2200', permiteMovimiento: true },
        { codigo: '2230', nombre: 'Pasivos No Corrientes Otros', tipo: 'pasivo', naturaleza: 'acreedora', nivel: 3, padreId: '2200', permiteMovimiento: true },

        // PATRIMONIO (3xx)
        { codigo: '3000', nombre: 'PATRIMONIO', tipo: 'patrimonio', naturaleza: 'acreedora', nivel: 1, permiteMovimiento: false },
        { codigo: '3100', nombre: 'Capital Social', tipo: 'patrimonio', naturaleza: 'acreedora', nivel: 2, padreId: '3000', permiteMovimiento: true },
        { codigo: '3200', nombre: 'Utilidades Acumuladas', tipo: 'patrimonio', naturaleza: 'acreedora', nivel: 2, padreId: '3000', permiteMovimiento: true },
        { codigo: '3300', nombre: 'Utilidad del Ejercicio', tipo: 'patrimonio', naturaleza: 'acreedora', nivel: 2, padreId: '3000', permiteMovimiento: true },
        { codigo: '3400', nombre: 'Reservas Legales', tipo: 'patrimonio', naturaleza: 'acreedora', nivel: 2, padreId: '3000', permiteMovimiento: true },

        // INGRESOS (4xx)
        { codigo: '4000', nombre: 'INGRESOS', tipo: 'ingreso', naturaleza: 'acreedora', nivel: 1, permiteMovimiento: false },
        { codigo: '4100', nombre: 'Ingresos por Ventas', tipo: 'ingreso', naturaleza: 'acreedora', nivel: 2, padreId: '4000', permiteMovimiento: false },
        { codigo: '4110', nombre: 'Ventas de Mercaderias', tipo: 'ingreso', naturaleza: 'acreedora', nivel: 3, padreId: '4100', permiteMovimiento: true },
        { codigo: '4120', nombre: 'Ventas de Servicios', tipo: 'ingreso', naturaleza: 'acreedora', nivel: 3, padreId: '4100', permiteMovimiento: true },
        { codigo: '4130', nombre: 'Devoluciones en Ventas', tipo: 'ingreso', naturaleza: 'deudora', nivel: 3, padreId: '4100', permiteMovimiento: true },
        { codigo: '4140', nombre: 'Descuentos en Ventas', tipo: 'ingreso', naturaleza: 'deudora', nivel: 3, padreId: '4100', permiteMovimiento: true },

        { codigo: '4200', nombre: 'Otros Ingresos', tipo: 'ingreso', naturaleza: 'acreedora', nivel: 2, padreId: '4000', permiteMovimiento: false },
        { codigo: '4210', nombre: 'Ingresos por Intereses', tipo: 'ingreso', naturaleza: 'acreedora', nivel: 3, padreId: '4200', permiteMovimiento: true },
        { codigo: '4220', nombre: 'Ingresos por Arriendos', tipo: 'ingreso', naturaleza: 'acreedora', nivel: 3, padreId: '4200', permiteMovimiento: true },
        { codigo: '4230', nombre: 'Otros Ingresos Operacionales', tipo: 'ingreso', naturaleza: 'acreedora', nivel: 3, padreId: '4200', permiteMovimiento: true },

        // COSTOS (5xx)
        { codigo: '5000', nombre: 'COSTOS', tipo: 'costo', naturaleza: 'deudora', nivel: 1, permiteMovimiento: false },
        { codigo: '5100', nombre: 'Costo de Ventas', tipo: 'costo', naturaleza: 'deudora', nivel: 2, padreId: '5000', permiteMovimiento: false },
        { codigo: '5110', nombre: 'Costo Mercaderias Vendidas', tipo: 'costo', naturaleza: 'deudora', nivel: 3, padreId: '5100', permiteMovimiento: true },
        { codigo: '5120', nombre: 'Costo Servicios Prestados', tipo: 'costo', naturaleza: 'deudora', nivel: 3, padreId: '5100', permiteMovimiento: true },

        // GASTOS (6xx)
        { codigo: '6000', nombre: 'GASTOS', tipo: 'gasto', naturaleza: 'deudora', nivel: 1, permiteMovimiento: false },
        { codigo: '6100', nombre: 'Gastos de Administracion', tipo: 'gasto', naturaleza: 'deudora', nivel: 2, padreId: '6000', permiteMovimiento: false },
        { codigo: '6110', nombre: 'Sueldos y Salarios', tipo: 'gasto', naturaleza: 'deudora', nivel: 3, padreId: '6100', permiteMovimiento: true },
        { codigo: '6120', nombre: 'Cargas Sociales', tipo: 'gasto', naturaleza: 'deudora', nivel: 3, padreId: '6100', permiteMovimiento: true },
        { codigo: '6130', nombre: 'Arriendos', tipo: 'gasto', naturaleza: 'deudora', nivel: 3, padreId: '6100', permiteMovimiento: true },
        { codigo: '6140', nombre: 'Servicios Basicos', tipo: 'gasto', naturaleza: 'deudora', nivel: 3, padreId: '6100', permiteMovimiento: true },
        { codigo: '6150', nombre: 'Seguros', tipo: 'gasto', naturaleza: 'deudora', nivel: 3, padreId: '6100', permiteMovimiento: true },
        { codigo: '6160', nombre: 'Depreciacion', tipo: 'gasto', naturaleza: 'deudora', nivel: 3, padreId: '6100', permiteMovimiento: true },
        { codigo: '6170', nombre: 'Honorarios Profesionales', tipo: 'gasto', naturaleza: 'deudora', nivel: 3, padreId: '6100', permiteMovimiento: true },
        { codigo: '6180', nombre: 'Gastos de Oficina', tipo: 'gasto', naturaleza: 'deudora', nivel: 3, padreId: '6100', permiteMovimiento: true },
        { codigo: '6190', nombre: 'Gastos de Administracion Otros', tipo: 'gasto', naturaleza: 'deudora', nivel: 3, padreId: '6100', permiteMovimiento: true },

        { codigo: '6200', nombre: 'Gastos de Ventas', tipo: 'gasto', naturaleza: 'deudora', nivel: 2, padreId: '6000', permiteMovimiento: false },
        { codigo: '6210', nombre: 'Comisiones de Ventas', tipo: 'gasto', naturaleza: 'deudora', nivel: 3, padreId: '6200', permiteMovimiento: true },
        { codigo: '6220', nombre: 'Publicidad y Propaganda', tipo: 'gasto', naturaleza: 'deudora', nivel: 3, padreId: '6200', permiteMovimiento: true },
        { codigo: '6230', nombre: 'Gastos de Ventas Otros', tipo: 'gasto', naturaleza: 'deudora', nivel: 3, padreId: '6200', permiteMovimiento: true },

        { codigo: '6300', nombre: 'Gastos Financieros', tipo: 'gasto', naturaleza: 'deudora', nivel: 2, padreId: '6000', permiteMovimiento: false },
        { codigo: '6310', nombre: 'Intereses Bancarios', tipo: 'gasto', naturaleza: 'deudora', nivel: 3, padreId: '6300', permiteMovimiento: true },
        { codigo: '6320', nombre: 'Comisiones Bancarias', tipo: 'gasto', naturaleza: 'deudora', nivel: 3, padreId: '6300', permiteMovimiento: true },
        { codigo: '6330', nombre: 'Gastos Financieros Otros', tipo: 'gasto', naturaleza: 'deudora', nivel: 3, padreId: '6300', permiteMovimiento: true },
    ];

    let cuentasCreadas = 0;
    for (const c of cuentasBase) {
        try {
            await prisma.cuenta.upsert({
                where: { codigo_empresaId: { codigo: c.codigo, empresaId: empresa.id } },
                update: {},
                create: {
                    ...c,
                    empresaId: empresa.id,
                },
            });
            cuentasCreadas++;
        } catch {
            // Ya existe
        }
    }
    console.log(`✓ ${cuentasCreadas} cuentas contables creadas`);

    // ============ TABLAS SII ============
    const tiposDocumentoSII = [
        { tipo: 'documento', codigo: '33', descripcion: 'Factura Electronica' },
        { tipo: 'documento', codigo: '34', descripcion: 'Factura Electronica Exenta' },
        { tipo: 'documento', codigo: '39', descripcion: 'Boleta Electronica' },
        { tipo: 'documento', codigo: '41', descripcion: 'Boleta Electronica Exenta' },
        { tipo: 'documento', codigo: '46', descripcion: 'Factura de Compra' },
        { tipo: 'documento', codigo: '52', descripcion: 'Guia de Despacho' },
        { tipo: 'documento', codigo: '56', descripcion: 'Nota de Credito Electronica' },
        { tipo: 'documento', codigo: '61', descripcion: 'Nota de Credito Electronica (receptor)' },
        { tipo: 'documento', codigo: '60', descripcion: 'Nota de Debito Electronica' },
        { tipo: 'documento', codigo: '110', descripcion: 'Factura de Exportacion' },
        { tipo: 'documento', codigo: '111', descripcion: 'Factura Exenta de Exportacion' },
        { tipo: 'documento', codigo: '112', descripcion: 'Nota de Debito de Exportacion' },
        { tipo: 'documento', codigo: '113', descripcion: 'Nota de Credito de Exportacion' },
    ];

    for (const td of tiposDocumentoSII) {
        await prisma.tablaSII.upsert({
            where: { tipo_codigo: { tipo: td.tipo, codigo: td.codigo } },
            update: {},
            create: td,
        });
    }
    console.log(`✓ ${tiposDocumentoSII.length} tipos documento SII creados`);

    // ============ CONFIGURACION NORMATIVA ============
    const normativaData = [
        { clave: 'uit', valor: String(normativa.getUit()), descripcion: 'Unidad Imponible Tributaria' },
        { clave: 'tasa_iva', valor: String(normativa.getTasaIva()), descripcion: 'Tasa de IVA' },
        { clave: 'retencion_honorarios', valor: String(normativa.getRetencionHonorarios()), descripcion: 'Retencion honorarios Art. 42 N2' },
        { clave: 'afp_aporte_trabajador', valor: String(process.env.AFP_APORTE_TRABAJADOR || '0.10'), descripcion: 'Aporte AFP trabajador' },
        { clave: 'sis_tasa', valor: String(process.env.SIS_TASA || '0.0153'), descripcion: 'Seguro Invalidez y Sobrevivencia' },
        { clave: 'salud_tasa', valor: String(process.env.SALUD_TASA || '0.07'), descripcion: 'Cotizacion salud' },
    ];

    const hoy = new Date();
    for (const n of normativaData) {
        await prisma.configuracionNormativa.upsert({
            where: { clave: n.clave },
            update: { valor: n.valor },
            create: {
                ...n,
                vigenteDesde: hoy,
            },
        });
    }
    console.log('✓ Configuracion normativa creada');

    // ============ TRABAJADORES DEMO ============
    const trabajadoresDemo = [
        { rut: '15.234.567-8', nombres: 'Carlos', apellidos: 'Gonzalez Silva', cargo: 'Contador Senior', departamento: 'Administracion', sueldoBase: 1500000, afp: 'AFP Habitat', tipoContrato: 'indefinido', cargasFamiliares: 2 },
        { rut: '16.789.012-3', nombres: 'Maria', apellidos: 'Rodriguez Lopez', cargo: 'Auxiliar Contable', departamento: 'Administracion', sueldoBase: 850000, afp: 'AFP Cuprum', tipoContrato: 'indefinido', cargasFamiliares: 0 },
        { rut: '17.456.789-K', nombres: 'Pedro', apellidos: 'Martinez Torres', cargo: 'Desarrollador', departamento: 'Tecnologia', sueldoBase: 2200000, afp: 'AFP Modelo', tipoContrato: 'indefinido', cargasFamiliares: 1 },
    ];

    for (const t of trabajadoresDemo) {
        await prisma.trabajador.upsert({
            where: { rut: t.rut },
            update: {},
            create: {
                ...t,
                fechaIngreso: new Date('2024-01-15'),
                email: `${t.nombres.toLowerCase()}.${t.apellidos.toLowerCase()}@democontable.cl`,
                empresaId: empresa.id,
                colacion: 10000,
                movilizacion: 30000,
            },
        });
    }
    console.log(`✓ ${trabajadoresDemo.length} trabajadores demo creados`);

    // ============ AFP CONFIG ============
    const afpConfig = normativa.getAfpConfig();
    for (const afp of afpConfig) {
        await prisma.tablaSII.upsert({
            where: { tipo_codigo: { tipo: 'afp', codigo: afp.nombre } },
            update: {},
            create: {
                tipo: 'afp',
                codigo: afp.nombre,
                descripcion: `Comision fija: ${afp.comisionFija}%`,
                valor: JSON.stringify(afp),
            },
        });
    }
    console.log(`✓ ${afpConfig.length} AFP configuradas`);

    console.log('\n✅ Seed completado exitosamente');
}

main()
    .catch((e) => {
        console.error('Error en seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

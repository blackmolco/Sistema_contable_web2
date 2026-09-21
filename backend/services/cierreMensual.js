// Checklist de cierre mensual: revisa, para una empresa y un mes, todo lo que
// deberia estar en orden antes de cerrar el periodo. Cada control devuelve
// { id, titulo, severidad: 'bloqueante' | 'advertencia', ok, cantidad, detalle }.
// Los 'bloqueante' que fallan impiden cerrar (salvo cierre forzado de un
// administrador con motivo, ver routes/periodos.js); las 'advertencia' solo
// informan.

const { resolverCuentas, CODIGOS_POR_DEFECTO } = require('./cuentasSistema');
const TOLERANCIA = 1; // pesos

function rangoDelMes(anio, mes) {
    return { desde: new Date(Date.UTC(anio, mes - 1, 1)), hasta: new Date(Date.UTC(anio, mes, 1)) };
}

function control(id, titulo, severidad, cantidad, detalle) {
    return { id, titulo, severidad, ok: cantidad === 0, cantidad, detalle: cantidad === 0 ? null : detalle };
}

async function evaluarCierre(prisma, empresaId, anio, mes) {
    const { desde, hasta } = rangoDelMes(anio, mes);
    const periodoStr = `${anio}-${String(mes).padStart(2, '0')}`;
    const enPeriodo = { gte: desde, lt: hasta };
    const asientosWhere = { empresaId, fecha: enPeriodo, estado: { not: 'anulado' } };
    // Codigos de IVA segun el plan de ESTA empresa (o el estandar).
    const sistema = await resolverCuentas(prisma, empresaId);
    const CODIGOS_IVA = {
        debito: sistema.ivaDebito?.codigo ?? CODIGOS_POR_DEFECTO.ivaDebito,
        credito: sistema.ivaCredito?.codigo ?? CODIGOS_POR_DEFECTO.ivaCredito,
    };

    const [asientos, pendientes, docsSinAsiento, honSinAsiento, liqSinCentralizar, trabajadoresActivos, liqCalculadas, auxSinRut, activos, asientosDepreciacion, previo] = await Promise.all([
        prisma.asientoContable.findMany({ where: asientosWhere, select: { id: true, numero: true, detalles: { select: { debe: true, haber: true, cuentaCodigo: true } } } }),
        prisma.asientoContable.count({ where: { ...asientosWhere, estado: 'pendiente' } }),
        prisma.documentoTributario.count({ where: { empresaId, fechaEmision: enPeriodo, asientoId: null, estado: { not: 'anulado' } } }),
        prisma.honorario.count({ where: { empresaId, periodo: periodoStr, asientoId: null } }),
        prisma.liquidacionSueldo.count({ where: { periodo: periodoStr, asientoId: null, trabajador: { empresaId } } }),
        prisma.trabajador.count({ where: { empresaId, estado: 'activo' } }),
        prisma.liquidacionSueldo.count({ where: { periodo: periodoStr, trabajador: { empresaId } } }),
        prisma.cuenta.findMany({ where: { empresaId, requiereAuxiliar: true }, select: { id: true } }).then(cs =>
            prisma.detalleAsiento.count({ where: { asiento: asientosWhere, rutAuxiliar: null, cuentaId: { in: cs.map(c => c.id) } } })),
        prisma.activoFijo.count({ where: { empresaId, estado: 'activo' } }),
        prisma.asientoContable.count({ where: { ...asientosWhere, glosa: { contains: 'epreciaci', mode: 'insensitive' } } }),
        prisma.periodoContable.findUnique({
            where: { empresaId_anio_mes: mes === 1 ? { empresaId, anio: anio - 1, mes: 12 } : { empresaId, anio, mes: mes - 1 } },
        }),
    ]);

    const descuadrados = asientos.filter(a => {
        const debe = a.detalles.reduce((s, d) => s + (d.debe || 0), 0);
        const haber = a.detalles.reduce((s, d) => s + (d.haber || 0), 0);
        return Math.abs(debe - haber) > TOLERANCIA;
    });

    // IVA: libros (documentos) vs mayor (asientos) — mismo control que la
    // pantalla Conciliacion Tributaria, pero calculado en el servidor.
    const documentos = await prisma.documentoTributario.findMany({
        where: { empresaId, fechaEmision: enPeriodo, estado: { not: 'anulado' } },
        select: { tipo: true, tipoTransaccion: true, iva: true },
    });
    const signo = d => (d.tipo === 'nota_credito' ? -1 : 1);
    const ivaLibro = { debito: 0, credito: 0 };
    documentos.forEach(d => { ivaLibro[d.tipoTransaccion === 'compra' ? 'credito' : 'debito'] += signo(d) * (d.iva || 0); });
    const ivaMayor = { debito: 0, credito: 0 };
    asientos.forEach(a => a.detalles.forEach(d => {
        if (d.cuentaCodigo === CODIGOS_IVA.debito) ivaMayor.debito += (d.haber || 0) - (d.debe || 0);
        if (d.cuentaCodigo === CODIGOS_IVA.credito) ivaMayor.credito += (d.debe || 0) - (d.haber || 0);
    }));
    const difDebito = Math.round(Math.abs(ivaLibro.debito - ivaMayor.debito));
    const difCredito = Math.round(Math.abs(ivaLibro.credito - ivaMayor.credito));

    const checks = [
        control('asientos_cuadrados', 'Asientos cuadrados (debe = haber)', 'bloqueante', descuadrados.length,
            `${descuadrados.length} asiento(s) descuadrado(s): ${descuadrados.slice(0, 5).map(a => '#' + a.numero).join(', ')}${descuadrados.length > 5 ? '…' : ''}`),
        control('asientos_contabilizados', 'Asientos contabilizados (ninguno pendiente)', 'bloqueante', pendientes,
            `${pendientes} asiento(s) pendiente(s) de contabilizar`),
        control('documentos_con_asiento', 'Documentos del mes con su asiento', 'bloqueante', docsSinAsiento,
            `${docsSinAsiento} documento(s) sin asiento contable`),
        control('honorarios_con_asiento', 'Boletas de honorarios con su asiento', 'bloqueante', honSinAsiento,
            `${honSinAsiento} boleta(s) de honorarios sin asiento`),
        control('auxiliares_con_rut', 'Movimientos de cuenta corriente con RUT', 'bloqueante', auxSinRut,
            `${auxSinRut} línea(s) de cuentas de control sin RUT`),
        control('remuneraciones_centralizadas', 'Liquidaciones calculadas y centralizadas', 'bloqueante', liqSinCentralizar,
            `${liqSinCentralizar} liquidación(es) calculada(s) sin centralizar`),
        control('iva_debito', 'IVA débito: libro de ventas = mayor', 'bloqueante', difDebito > TOLERANCIA ? 1 : 0,
            `Diferencia de $${difDebito.toLocaleString('es-CL')} entre el libro y el mayor`),
        control('iva_credito', 'IVA crédito: libro de compras = mayor', 'bloqueante', difCredito > TOLERANCIA ? 1 : 0,
            `Diferencia de $${difCredito.toLocaleString('es-CL')} entre el libro y el mayor`),
        control('remuneraciones_completas', 'Todos los trabajadores activos tienen liquidación', 'advertencia',
            Math.max(0, trabajadoresActivos - liqCalculadas),
            `${Math.max(0, trabajadoresActivos - liqCalculadas)} trabajador(es) activo(s) sin liquidación este mes`),
        control('depreciacion', 'Depreciación del mes contabilizada', 'advertencia',
            activos > 0 && asientosDepreciacion === 0 ? 1 : 0,
            'Hay activos fijos activos y no se encontró un asiento de depreciación en el mes'),
        control('periodo_anterior', 'Mes anterior cerrado', 'advertencia',
            previo && previo.estado === 'cerrado' ? 0 : 1,
            'El mes anterior todavía no está cerrado'),
    ];

    const bloqueantes = checks.filter(c => c.severidad === 'bloqueante' && !c.ok);
    return { periodo: periodoStr, checks, bloqueantes: bloqueantes.length, puedeCerrar: bloqueantes.length === 0 };
}

module.exports = { evaluarCierre };

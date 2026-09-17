// Motor de calculo de liquidaciones de sueldo — Chile, 2026.
//
// Portado desde Sistema_Remuneraciones_Chile/lib/motor.js (sistema hermano,
// dedicado solo a remuneraciones) hacia este sistema contable, acotado a
// SOLO lo necesario para liquidar y centralizar (sin licencias medicas,
// items personalizados por empresa, remuneracion por hora ni finiquitos —
// eso sigue viviendo unicamente en el sistema de remuneraciones dedicado).
//
// Los indices (UF/UTM/topes/tasa SIS) NO estan hardcodeados: se leen de la
// tabla IndicePrevisional (se cargan a mano una vez al mes) y se pasan como
// parametro.

const TOPE_GRATIFICACION_FACTOR = 4.75; // Art. 50 Codigo del Trabajo: 25% con tope de 4.75 sueldos minimos/ano

// --- REFORMA PREVISIONAL (Ley 21.735): Cotizacion Adicional del Empleador ---
// Calendario fijado por ley (cambia ~1 vez al ano, no mes a mes como UF/UTM).
// Verificado contra los boletines PreviRed mayo-septiembre 2026: desde
// agosto 2026 el "segundo componente" pasa a ser DOS lineas separadas
// (Rentabilidad Protegida 0,90% + Expectativa de Vida 0,72%), que este
// motor suma en un solo total (1,62%) porque aqui solo se centraliza el
// monto agregado — la conciliacion linea por linea contra PreviRed sigue
// siendo tarea del sistema de remuneraciones dedicado.
const REFORMA_PREVISIONAL_TRAMOS = [
    {
        desde: '2025-08',
        cuentaIndividualPct: 0.001,
        segundoComponentePct: 0.009,
        segundoComponenteLabel: 'Seguro Social (Expectativa de Vida)',
        sisPct: null,
    },
    {
        desde: '2026-08',
        cuentaIndividualPct: 0.001,
        segundoComponentePct: 0.0162, // Rentabilidad Protegida 0,90% + Expectativa de Vida 0,72%
        segundoComponenteLabel: 'Rentabilidad Protegida + Expectativa de Vida',
        sisPct: null,
    },
];

function getTramoReformaPrevisional(periodoYYYYMM) {
    let tramoVigente = null;
    for (const tramo of REFORMA_PREVISIONAL_TRAMOS) {
        if (periodoYYYYMM >= tramo.desde) tramoVigente = tramo;
    }
    return tramoVigente;
}

// --- LEY 21.561 ("Ley de 40 horas"): reduccion gradual de la jornada laboral semanal ---
const JORNADA_SEMANAL_TRAMOS = [
    { desde: '2024-04', horas: 44 },
    { desde: '2026-04', horas: 42 },
    { desde: '2028-04', horas: 40 },
];

function getJornadaSemanalLegal(periodoYYYYMM) {
    let horasVigentes = 45;
    for (const tramo of JORNADA_SEMANAL_TRAMOS) {
        if (periodoYYYYMM >= tramo.desde) horasVigentes = tramo.horas;
    }
    return horasVigentes;
}

function calcularImpuestoUnico(baseTributable, valorUtm) {
    const baseUtm = baseTributable / valorUtm;
    let factor = 0;
    let rebajaUtm = 0;

    if (baseUtm <= 13.5) { factor = 0; rebajaUtm = 0; }
    else if (baseUtm <= 30.0) { factor = 0.04; rebajaUtm = 0.54; }
    else if (baseUtm <= 50.0) { factor = 0.08; rebajaUtm = 1.74; }
    else if (baseUtm <= 70.0) { factor = 0.135; rebajaUtm = 4.49; }
    else if (baseUtm <= 90.0) { factor = 0.23; rebajaUtm = 11.14; }
    else if (baseUtm <= 120.0) { factor = 0.304; rebajaUtm = 17.80; }
    else if (baseUtm <= 150.0) { factor = 0.35; rebajaUtm = 23.32; }
    else { factor = 0.40; rebajaUtm = 30.82; }

    const impuesto = (baseTributable * factor) - (rebajaUtm * valorUtm);
    return Math.max(0, Math.round(impuesto));
}

function round(n) {
    return Math.round(n);
}

/**
 * Calcula una liquidacion de sueldo completa (trabajador + costo empresa).
 * @param {object} trabajador - fila de la tabla Trabajador
 * @param {object} entrada - { sueldoBase, diasTrabajados, bonos, aguinaldo, horasExtra,
 *                              horasSemanales, colacion, movilizacion, viaticos, anticipos,
 *                              prestamos, tipoContrato }
 * @param {object} indices - fila de IndicePrevisional del periodo correspondiente
 * @param {string} periodo - 'YYYY-MM'
 * @param {object} opciones - { mutualTasaPct } — tasa real de la Mutual de
 *   la empresa (puntos porcentuales, ej. 0.95 = 0,95%). Si no se indica, se
 *   usa el piso legal 0,90% (Ley 16.744).
 */
function calcularLiquidacion(trabajador, entrada, indices, periodo, opciones = {}) {
    if (!indices) {
        const err = new Error(`No hay indices previsionales cargados para el periodo ${periodo}.`);
        err.status = 400;
        throw err;
    }

    const valorUf = Number(indices.valorUf);
    const valorUtm = Number(indices.valorUtm);
    const sueldoMinimo = Number(indices.sueldoMinimo);
    const topeAfpSaludUf = Number(indices.topeAfpSaludUf);
    const topeCesantiaUf = Number(indices.topeCesantiaUf);
    const tasaSis = Number(indices.tasaSis);

    const topeGratificacionMensual = (TOPE_GRATIFICACION_FACTOR * sueldoMinimo) / 12;

    const diasTrabajados = entrada.diasTrabajados ?? 30;
    const sueldoProporcional = (Number(entrada.sueldoBase ?? trabajador.sueldoBase) / 30) * diasTrabajados;
    const bonos = entrada.bonos || 0;
    const aguinaldo = entrada.aguinaldo || 0;

    // Horas extraordinarias (Art. 32 Codigo del Trabajo): valor hora
    // ordinaria = sueldo base x 28 / (30 x horas semanales x 4); la hora
    // extra se paga con recargo del 50%.
    const cantidadHorasExtra = entrada.horasExtra || 0;
    const horasSemanales = entrada.horasSemanales || getJornadaSemanalLegal(periodo);
    const sueldoBaseParaHoraExtra = Number(entrada.sueldoBase ?? trabajador.sueldoBase);
    const valorHoraOrdinaria = (sueldoBaseParaHoraExtra * 28) / (30 * horasSemanales * 4);
    const valorHoraExtra = valorHoraOrdinaria * 1.5;
    const montoHorasExtra = cantidadHorasExtra * valorHoraExtra;

    const baseGratificacion = sueldoProporcional + bonos + aguinaldo + montoHorasExtra;
    const gratificacion = Math.min(baseGratificacion * 0.25, topeGratificacionMensual);

    const totalImponible = sueldoProporcional + bonos + aguinaldo + montoHorasExtra + gratificacion;

    const colacion = entrada.colacion ?? trabajador.colacion ?? 0;
    const movilizacion = entrada.movilizacion ?? trabajador.movilizacion ?? 0;
    const viaticos = entrada.viaticos || 0;

    // Asignacion Familiar: no imponible, no tributable. Formula de cargas
    // totales segun Previred: simples + 2xinvalidas + maternales.
    const valorPorTramo = { A: Number(indices.valorTramoA || 0), B: Number(indices.valorTramoB || 0), C: Number(indices.valorTramoC || 0), D: 0 };
    const cargasTotales = (trabajador.cargasSimples || 0) + (2 * (trabajador.cargasInvalidez || 0)) + (trabajador.cargasMaternales || 0);
    const valorCarga = valorPorTramo[trabajador.tramoAsignacionFamiliar] || 0;
    const asignacionFamiliar = cargasTotales * valorCarga;

    const totalNoImponible = colacion + movilizacion + viaticos + asignacionFamiliar;
    const totalHaberes = totalImponible + totalNoImponible;

    const montoTopeAfpSalud = topeAfpSaludUf * valorUf;
    const montoTopeCesantia = topeCesantiaUf * valorUf;
    const baseAfpSalud = Math.min(totalImponible, montoTopeAfpSalud);
    const baseCesantia = Math.min(totalImponible, montoTopeCesantia);

    // Tabla N5 Previred: '2' (pensionado y no cotiza) y '8' (exento) no
    // descuentan AFP. '0'/'1'/'3' si.
    const noCotizaAfp = trabajador.tipoTrabajadorPrevired === '2' || trabajador.tipoTrabajadorPrevired === '8';
    const descuentoAfp = noCotizaAfp ? 0 : baseAfpSalud * Number(trabajador.tasaAfp);

    let descuentoSalud;
    if (!trabajador.isapre) {
        descuentoSalud = baseAfpSalud * 0.07;
    } else {
        const pactadoPesos = Number(trabajador.saludPactado || 0) * valorUf;
        const sietePorciento = baseAfpSalud * 0.07;
        descuentoSalud = Math.max(pactadoPesos, sietePorciento);
    }

    // Los pensionados (tipo '1' cotiza AFP o '2' no cotiza) quedan exentos por
    // ley del Seguro de Cesantia/AFC completo -- ni trabajador ni empleador
    // cotizan (excepto pension de invalidez parcial o trabajadores de casa
    // particular, no cubiertos por este motor). Fuente: Subsecretaria de
    // Prevision Social / AFC.cl. No confundir con noCotizaAfp: hay
    // pensionados que SI siguen cotizando AFP (tipo '1') pero igual quedan
    // exentos de AFC.
    const esPensionado = trabajador.tipoTrabajadorPrevired === '1' || trabajador.tipoTrabajadorPrevired === '2';
    const tipoContrato = entrada.tipoContrato || trabajador.tipoContrato || 'indefinido';
    const descuentoCesantia = (!esPensionado && tipoContrato === 'indefinido') ? baseCesantia * 0.006 : 0;

    const totalPrevisional = descuentoAfp + descuentoSalud + descuentoCesantia;

    const baseTributable = Math.max(0, totalImponible - totalPrevisional);
    const descuentoImpuesto = calcularImpuestoUnico(baseTributable, valorUtm);

    const anticipos = entrada.anticipos || 0;
    const prestamos = entrada.prestamos || 0;
    const otrosDescuentos = entrada.otrosDescuentos || 0;

    const totalDescuentos = totalPrevisional + descuentoImpuesto + anticipos + prestamos + otrosDescuentos;
    const sueldoLiquido = totalHaberes - totalDescuentos;

    // --- Costo empresa (aportes patronales, no se descuentan al trabajador) ---
    // SIS y la Reforma Previsional (Ley 21.735) son aportes atados a que el
    // trabajador este cotizando efectivamente a su AFP (se calculan sobre la
    // misma base y alimentan la cuenta individual / el seguro que va con esa
    // cotizacion) — igual que el descuento de AFP mismo, no aplican si
    // noCotizaAfp (pensionado tipo '2'/'8', ver arriba).
    const tramoReforma = getTramoReformaPrevisional(periodo);
    const aporteReformaCuentaIndividual = !noCotizaAfp && tramoReforma ? baseAfpSalud * tramoReforma.cuentaIndividualPct : 0;
    const aporteReformaSegundoComponente = !noCotizaAfp && tramoReforma ? baseAfpSalud * tramoReforma.segundoComponentePct : 0;
    const aporteReformaPrevisional = aporteReformaCuentaIndividual + aporteReformaSegundoComponente;
    const sisIncluidoEnTramo = tramoReforma && tramoReforma.sisPct != null;
    const aporteSis = noCotizaAfp ? 0 : (sisIncluidoEnTramo ? baseAfpSalud * tramoReforma.sisPct : baseAfpSalud * tasaSis);
    // Tasa de cotizacion Mutual/ISL (Ley 16.744): piso legal 0.90%, salvo
    // que la empresa tenga registrada su tasa real (base + adicional segun
    // rubro/siniestralidad, propia de cada Mutual — ver Empresa.mutualTasaPct).
    const mutualTasaPct = opciones.mutualTasaPct ?? 0.90;
    const aporteMutual = totalImponible * (mutualTasaPct / 100);
    const aporteAfcEmpresa = esPensionado ? 0 : (tipoContrato === 'indefinido' ? baseCesantia * 0.024 : baseCesantia * 0.03);

    const totalAportesPatronales = aporteSis + aporteReformaPrevisional + aporteMutual + aporteAfcEmpresa;
    const costoTotalEmpresa = totalHaberes + totalAportesPatronales;

    return {
        periodo,
        diasTrabajados: round(diasTrabajados),
        sueldoBase: round(sueldoProporcional),
        bonos: round(bonos),
        horasExtras: cantidadHorasExtra,
        montoHorasExtras: round(montoHorasExtra),
        gratificacion: round(gratificacion),
        totalImponible: round(totalImponible),
        colacion: round(colacion),
        movilizacion: round(movilizacion),
        asignacionFamiliar: round(asignacionFamiliar),
        // totalNoImponible y totalHaberes NO son columnas de LiquidacionSueldo
        // (se derivan de totalImponible + colacion + movilizacion +
        // asignacionFamiliar donde se necesiten) — incluirlas aqui hacia que
        // Prisma rechazara el create/update entero con "Unknown argument".
        descuentoAFP: round(descuentoAfp),
        descuentoSalud: round(descuentoSalud),
        descuentoAFC: round(descuentoCesantia),
        descuentoImpuesto,
        anticipos: round(anticipos),
        prestamos: round(prestamos),
        otrosDescuentos: round(otrosDescuentos),
        totalDescuentos: round(totalDescuentos),
        sueldoLiquido: round(sueldoLiquido),
        aporteSis: round(aporteSis),
        aporteReformaPrevisional: round(aporteReformaPrevisional),
        aporteMutual: round(aporteMutual),
        aporteAfcEmpresa: round(aporteAfcEmpresa),
        costoTotalEmpresa: round(costoTotalEmpresa),
        ufValor: valorUf,
        utmValor: valorUtm,
    };
}

module.exports = {
    calcularLiquidacion,
    calcularImpuestoUnico,
    getTramoReformaPrevisional,
    getJornadaSemanalLegal,
};

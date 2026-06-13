// backend/tests/remuneraciones.test.mjs
// Tests unitarios para calculos de remuneraciones Chile 2026

import { describe, it, expect } from 'vitest';

// ============ Logica de calculo replicada del backend ============
// (misma logica que usa POST /api/liquidaciones en index.js)

function calcularLiquidacion({
    sueldoBase,
    bonos = 0,
    montoHorasExtras = 0,
    gratificacion = 0,
    descuentoAFP,
    descuentoSalud,
    descuentoAFC = 0,
    descuentoImpuesto,
    otrosDescuentos = 0,
    asignacionFamiliar = 0,
}) {
    const totalImponible = sueldoBase + bonos + montoHorasExtras + gratificacion;
    const totalDescuentos = descuentoAFP + descuentoSalud + descuentoAFC + descuentoImpuesto + otrosDescuentos;
    const sueldoLiquido = totalImponible - totalDescuentos + asignacionFamiliar;
    return { totalImponible, totalDescuentos, sueldoLiquido };
}

// Descuentos previsionales tipicos Chile 2026
const AFP_TASA = 0.10;        // 10% aporte trabajador
const SALUD_TASA = 0.07;      // 7% FONASA o Isapre minimo
const AFC_TASA_INDEFINIDO = 0.006;  // 0.6% contrato indefinido

// Calculo de AFP
function calcularAFP(imponible) { return Math.round(imponible * AFP_TASA); }
// Calculo de salud
function calcularSalud(imponible) { return Math.round(imponible * SALUD_TASA); }
// Calculo AFC
function calcularAFC(imponible, tipo = 'indefinido') {
    return Math.round(imponible * (tipo === 'indefinido' ? AFC_TASA_INDEFINIDO : 0.024));
}
// Gratificacion: 25% del sueldo base mensual (art 50 CT, sin tope anual)
function calcularGratificacion(sueldoBase) { return Math.round(sueldoBase * 0.25); }
// Horas extras: 50% recargo sobre valor hora normal
function calcularHorasExtras(sueldoBase, horasPorMes, horasExtra) {
    const valorHoraNormal = sueldoBase / horasPorMes;
    return Math.round(valorHoraNormal * horasExtra * 1.5);
}

// ============ Tests ============

describe('Calculo sueldo liquido', () => {
    it('sueldo liquido basico: imponible - AFP - Salud', () => {
        const imponible = 1_000_000;
        const r = calcularLiquidacion({
            sueldoBase: imponible,
            descuentoAFP: calcularAFP(imponible),
            descuentoSalud: calcularSalud(imponible),
            descuentoImpuesto: 0,
        });
        expect(r.totalImponible).toBe(1_000_000);
        expect(r.totalDescuentos).toBe(170_000);
        expect(r.sueldoLiquido).toBe(830_000);
    });

    it('suma correcta: bonos y horas extras entran al imponible', () => {
        const r = calcularLiquidacion({
            sueldoBase: 800_000,
            bonos: 100_000,
            montoHorasExtras: 50_000,
            gratificacion: 0,
            descuentoAFP: 95_000,
            descuentoSalud: 66_500,
            descuentoImpuesto: 0,
        });
        expect(r.totalImponible).toBe(950_000);
        expect(r.sueldoLiquido).toBe(950_000 - 161_500);
    });

    it('asignacion familiar suma al liquido (no es imponible)', () => {
        const r = calcularLiquidacion({
            sueldoBase: 500_000,
            descuentoAFP: 50_000,
            descuentoSalud: 35_000,
            descuentoImpuesto: 0,
            asignacionFamiliar: 10_000,
        });
        expect(r.totalImponible).toBe(500_000);
        expect(r.sueldoLiquido).toBe(425_000);
    });

    it('otros descuentos reducen el liquido', () => {
        const r = calcularLiquidacion({
            sueldoBase: 1_000_000,
            descuentoAFP: 100_000,
            descuentoSalud: 70_000,
            descuentoImpuesto: 0,
            otrosDescuentos: 50_000,
        });
        expect(r.sueldoLiquido).toBe(780_000);
    });
});

describe('Descuentos previsionales', () => {
    it('AFP: 10% del imponible', () => {
        expect(calcularAFP(1_000_000)).toBe(100_000);
        expect(calcularAFP(500_000)).toBe(50_000);
        expect(calcularAFP(1_500_000)).toBe(150_000);
    });

    it('Salud FONASA: 7% del imponible', () => {
        expect(calcularSalud(1_000_000)).toBe(70_000);
        expect(calcularSalud(800_000)).toBe(56_000);
    });

    it('AFC contrato indefinido: 0.6% del imponible', () => {
        expect(calcularAFC(1_000_000, 'indefinido')).toBe(6_000);
    });

    it('AFC contrato plazo fijo: 2.4% del imponible', () => {
        expect(calcularAFC(1_000_000, 'plazo_fijo')).toBe(24_000);
    });
});

describe('Otros calculos', () => {
    it('gratificacion: 25% del sueldo base mensual', () => {
        expect(calcularGratificacion(1_000_000)).toBe(250_000);
        expect(calcularGratificacion(800_000)).toBe(200_000);
    });

    it('horas extras con 50% recargo', () => {
        // Sueldo 900.000, jornada 45h/semana = 180h/mes
        // Valor hora normal = 5.000
        // 10 horas extra = 10 * 5.000 * 1.5 = 75.000
        expect(calcularHorasExtras(900_000, 180, 10)).toBe(75_000);
    });

    it('validacion formato periodo YYYY-MM', () => {
        const regex = /^\d{4}-\d{2}$/;
        expect(regex.test('2026-05')).toBe(true);
        expect(regex.test('2026-12')).toBe(true);
        expect(regex.test('26-05')).toBe(false);
        expect(regex.test('2026-5')).toBe(false);
        expect(regex.test('2026/05')).toBe(false);
    });
});

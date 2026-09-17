-- Trabajador: datos previsionales que faltaban para calcular una liquidacion real
ALTER TABLE "Trabajador" ADD COLUMN "tasaAfp" DOUBLE PRECISION NOT NULL DEFAULT 0.10;
ALTER TABLE "Trabajador" ALTER COLUMN "saludPactado" SET DEFAULT 0;
ALTER TABLE "Trabajador" ADD COLUMN "tramoAsignacionFamiliar" TEXT NOT NULL DEFAULT 'D';
ALTER TABLE "Trabajador" ADD COLUMN "cargasSimples" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Trabajador" ADD COLUMN "cargasMaternales" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Trabajador" ADD COLUMN "cargasInvalidez" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Trabajador" ADD COLUMN "tipoTrabajadorPrevired" TEXT NOT NULL DEFAULT '0';

-- LiquidacionSueldo: desglose de descuentos + costo empresa + trazabilidad
-- de centralizacion (antes esta tabla solo guardaba montos que le mandaba
-- el cliente ya calculados, no habia motor de calculo real detras).
ALTER TABLE "LiquidacionSueldo" ADD COLUMN "anticipos" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "LiquidacionSueldo" ADD COLUMN "prestamos" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "LiquidacionSueldo" ADD COLUMN "aporteSis" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "LiquidacionSueldo" ADD COLUMN "aporteReformaPrevisional" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "LiquidacionSueldo" ADD COLUMN "aporteMutual" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "LiquidacionSueldo" ADD COLUMN "aporteAfcEmpresa" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "LiquidacionSueldo" ADD COLUMN "costoTotalEmpresa" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "LiquidacionSueldo" ADD COLUMN "asientoId" TEXT;

-- Indices previsionales mensuales (UF/UTM/topes/tasa SIS) — nacionales, se
-- cargan a mano una vez al mes.
CREATE TABLE "IndicePrevisional" (
    "periodo" TEXT NOT NULL,
    "valorUf" DOUBLE PRECISION NOT NULL,
    "valorUtm" DOUBLE PRECISION NOT NULL,
    "sueldoMinimo" DOUBLE PRECISION NOT NULL,
    "topeAfpSaludUf" DOUBLE PRECISION NOT NULL DEFAULT 90.0,
    "topeCesantiaUf" DOUBLE PRECISION NOT NULL DEFAULT 135.2,
    "tasaSis" DOUBLE PRECISION NOT NULL,
    "valorTramoA" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valorTramoB" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valorTramoC" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoPor" TEXT NOT NULL DEFAULT 'manual',

    CONSTRAINT "IndicePrevisional_pkey" PRIMARY KEY ("periodo")
);

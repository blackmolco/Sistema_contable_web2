CREATE TABLE "ConfigCentralizacionRemuneraciones" (
    "empresaId" TEXT NOT NULL,
    "cuentaRemuneracionesGastoId" TEXT,
    "cuentaCotizacionesGastoId" TEXT,
    "cuentaRemuneracionesPorPagarId" TEXT,
    "cuentaImposicionesPorPagarId" TEXT,
    "cuentaSaludPorPagarId" TEXT,
    "cuentaCesantiaPorPagarId" TEXT,
    "cuentaImpuestoUnicoPorPagarId" TEXT,
    "cuentaMutualPorPagarId" TEXT,
    "cuentaReformaPrevisionalPorPagarId" TEXT,
    "cuentaDeudoresVariosId" TEXT,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfigCentralizacionRemuneraciones_pkey" PRIMARY KEY ("empresaId")
);

-- CreateTable
CREATE TABLE "ConfigCuentasSistema" (
    "empresaId" TEXT NOT NULL,
    "cuentas" JSONB NOT NULL DEFAULT '{}',
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfigCuentasSistema_pkey" PRIMARY KEY ("empresaId")
);

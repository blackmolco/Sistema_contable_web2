CREATE TABLE "PeriodoContable" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "anio" INTEGER NOT NULL,
  "mes" INTEGER NOT NULL,
  "estado" TEXT NOT NULL DEFAULT 'abierto',
  "fechaCierre" TIMESTAMP(3),
  "usuarioCierreId" TEXT,
  "motivoReapertura" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PeriodoContable_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PeriodoContable_empresaId_anio_mes_key" ON "PeriodoContable"("empresaId", "anio", "mes");
CREATE INDEX "PeriodoContable_empresaId_estado_idx" ON "PeriodoContable"("empresaId", "estado");

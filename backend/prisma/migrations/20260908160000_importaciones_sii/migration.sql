CREATE TABLE "ImportacionSII" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "periodo" TEXT,
    "nombreArchivo" TEXT,
    "totalRegistros" INTEGER NOT NULL DEFAULT 0,
    "nuevos" INTEGER NOT NULL DEFAULT 0,
    "duplicados" INTEGER NOT NULL DEFAULT 0,
    "errores" INTEGER NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'procesando',
    "detalleErrores" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ImportacionSII_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ImportacionSII_empresaId_createdAt_idx" ON "ImportacionSII"("empresaId", "createdAt");
CREATE INDEX "ImportacionSII_empresaId_periodo_idx" ON "ImportacionSII"("empresaId", "periodo");

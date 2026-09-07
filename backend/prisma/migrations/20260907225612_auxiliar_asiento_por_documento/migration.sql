-- DropIndex
DROP INDEX "AsientoContable_numero_empresaId_fecha_key";

-- AlterTable
ALTER TABLE "Cuenta" ADD COLUMN     "requiereAuxiliar" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tipoAuxiliar" TEXT;

-- AlterTable
ALTER TABLE "DetalleAsiento" ADD COLUMN     "documentoId" TEXT,
ADD COLUMN     "nombreAuxiliar" TEXT,
ADD COLUMN     "rutAuxiliar" TEXT;

-- AlterTable
ALTER TABLE "DocumentoTributario" ADD COLUMN     "asientoId" TEXT;

-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "ultimoNumeroAsiento" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Honorario" ADD COLUMN     "asientoId" TEXT;

-- CreateTable
CREATE TABLE "Entidad" (
    "id" TEXT NOT NULL,
    "rut" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "giro" TEXT,
    "direccion" TEXT,
    "comuna" TEXT,
    "ciudad" TEXT,
    "email" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'ambos',
    "cuentaDefaultId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "empresaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entidad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Entidad_empresaId_idx" ON "Entidad"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "Entidad_rut_empresaId_key" ON "Entidad"("rut", "empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "AsientoContable_numero_empresaId_key" ON "AsientoContable"("numero", "empresaId");

-- CreateIndex
CREATE INDEX "DetalleAsiento_rutAuxiliar_idx" ON "DetalleAsiento"("rutAuxiliar");

-- CreateIndex
CREATE INDEX "DetalleAsiento_documentoId_idx" ON "DetalleAsiento"("documentoId");

-- CreateIndex
CREATE INDEX "DocumentoTributario_asientoId_idx" ON "DocumentoTributario"("asientoId");


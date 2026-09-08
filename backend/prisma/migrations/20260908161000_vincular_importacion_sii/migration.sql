ALTER TABLE "AsientoContable" ADD COLUMN "importacionId" TEXT;
ALTER TABLE "DocumentoTributario" ADD COLUMN "importacionId" TEXT;
ALTER TABLE "Honorario" ADD COLUMN "importacionId" TEXT;
CREATE INDEX "AsientoContable_importacionId_idx" ON "AsientoContable"("importacionId");
CREATE INDEX "DocumentoTributario_importacionId_idx" ON "DocumentoTributario"("importacionId");
CREATE INDEX "Honorario_importacionId_idx" ON "Honorario"("importacionId");

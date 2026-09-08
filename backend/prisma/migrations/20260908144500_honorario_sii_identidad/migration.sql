ALTER TABLE "Honorario" ADD COLUMN "folio" INTEGER;
ALTER TABLE "Honorario" ADD COLUMN "claveImportacion" TEXT;
CREATE UNIQUE INDEX "Honorario_empresaId_claveImportacion_key" ON "Honorario"("empresaId", "claveImportacion");

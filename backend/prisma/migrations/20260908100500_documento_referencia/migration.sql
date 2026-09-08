ALTER TABLE "DocumentoTributario" ADD COLUMN "documentoReferenciaId" TEXT;
CREATE INDEX "DocumentoTributario_documentoReferenciaId_idx" ON "DocumentoTributario"("documentoReferenciaId");

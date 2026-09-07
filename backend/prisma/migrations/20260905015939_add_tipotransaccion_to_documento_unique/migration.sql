-- DropIndex
DROP INDEX "DocumentoTributario_tipo_folio_empresaId_key";

-- CreateIndex
CREATE UNIQUE INDEX "DocumentoTributario_tipo_folio_tipoTransaccion_empresaId_key" ON "DocumentoTributario"("tipo", "folio", "tipoTransaccion", "empresaId");

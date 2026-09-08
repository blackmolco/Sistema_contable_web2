-- La identidad real de un DTE importado incluye contraparte y fecha. El
-- índice anterior rechazaba facturas legítimas con el mismo folio emitidas
-- por proveedores diferentes.
DROP INDEX IF EXISTS "DocumentoTributario_tipo_folio_tipoTransaccion_empresaId_key";

ALTER TABLE "DocumentoTributario" ADD COLUMN "claveImportacion" TEXT;

CREATE UNIQUE INDEX "DocumentoTributario_empresaId_claveImportacion_key"
ON "DocumentoTributario"("empresaId", "claveImportacion");

-- Rut sin puntos/espacios/guion, en mayuscula -- clave real de identidad de
-- una Entidad. "12.345.678-9", "12345678-9" y "12.345.678 9" deben resolver
-- al mismo registro; hoy el unique constraint compara el string tal como se
-- guardo, asi que dos formatos distintos del mismo rut crean dos filas.

-- 1) Columna nueva, nullable por ahora para poder rellenar filas existentes.
ALTER TABLE "Entidad" ADD COLUMN "rutNormalizado" TEXT;

-- 2) Backfill: mismo calculo que lib/rut.js normalizarRut().
UPDATE "Entidad" SET "rutNormalizado" = UPPER(REGEXP_REPLACE("rut", '[.\s-]', '', 'g'));

-- 3) Ya con todas las filas pobladas (verificado: 0 colisiones en las 197
-- filas existentes), se puede exigir NOT NULL y reemplazar el constraint.
ALTER TABLE "Entidad" ALTER COLUMN "rutNormalizado" SET NOT NULL;

DROP INDEX "Entidad_rut_empresaId_key";
CREATE UNIQUE INDEX "Entidad_rutNormalizado_empresaId_key" ON "Entidad"("rutNormalizado", "empresaId");

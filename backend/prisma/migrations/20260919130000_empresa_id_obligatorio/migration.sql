-- empresaId obligatorio en toda la informacion contable y documental de una
-- empresa. Verificado antes de escribir esta migracion: 0 filas con empresaId
-- nulo en todas estas tablas. Usuario queda opcional (los admins globales no
-- pertenecen a una empresa).

ALTER TABLE "Cuenta" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "AsientoContable" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "Trabajador" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "DocumentoTributario" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "LibroCompra" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "LibroVenta" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "Honorario" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "Entidad" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "ActivoFijo" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "TesoreriaMovimiento" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "Documento" ALTER COLUMN "empresaId" SET NOT NULL;

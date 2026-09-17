ALTER TABLE "ActivoFijo" ADD COLUMN "metodoTributario" TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE "ActivoFijo" ADD COLUMN "vidaUtilMesesTributaria" INTEGER;
ALTER TABLE "ActivoFijo" ADD COLUMN "depreciacionMensualTributaria" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "ActivoFijo" ADD COLUMN "depreciacionAcumuladaTributaria" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "ActivoFijo" ADD COLUMN "valorNetoTributario" DOUBLE PRECISION NOT NULL DEFAULT 0;

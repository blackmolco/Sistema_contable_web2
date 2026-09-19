-- AlterTable
ALTER TABLE "PeriodoContable" ADD COLUMN     "comentarioCierre" TEXT,
ADD COLUMN     "cierreForzado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bloqueadoHasta" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RestablecerClave" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "usadoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RestablecerClave_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RestablecerClave_tokenHash_key" ON "RestablecerClave"("tokenHash");

-- CreateIndex
CREATE INDEX "RestablecerClave_usuarioId_idx" ON "RestablecerClave"("usuarioId");

-- AddForeignKey
ALTER TABLE "RestablecerClave" ADD CONSTRAINT "RestablecerClave_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

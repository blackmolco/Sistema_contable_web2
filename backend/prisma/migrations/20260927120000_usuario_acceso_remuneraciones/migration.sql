-- Permiso puntual por usuario: acceso al modulo de Remuneraciones.
ALTER TABLE "Usuario" ADD COLUMN "accesoRemuneraciones" BOOLEAN NOT NULL DEFAULT true;

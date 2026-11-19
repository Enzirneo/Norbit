-- Cor de perfil: opcional, em hexadecimal minúsculo (como as outras cores).
ALTER TABLE "users" ADD COLUMN "profileColor" TEXT;

ALTER TABLE "users"
  ADD CONSTRAINT "users_profileColor_hex_minusculo"
  CHECK ("profileColor" IS NULL OR "profileColor" ~ '^#[0-9a-f]{6}$');

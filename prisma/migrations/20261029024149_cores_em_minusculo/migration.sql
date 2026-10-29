-- Cor em hexadecimal, sempre minúscula.
--
-- A cor é comparada como texto e usada como chave de tema, então `#6D7CFF` e
-- `#6d7cff` são duas cores para o banco e uma só para quem olha. O contrato
-- `corHex` (libs/contracts) já normalizava a entrada, mas os DEFAULT desta
-- migration inicial estavam em maiúsculas — então a agenda criada junto com a
-- conta nascia com a grafia errada, sem passar por contrato nenhum.
--
-- Encontrado sondando a API de fora, não lendo o código.

-- ─── 1. As linhas que já existem ─────────────────────────────────────────────

UPDATE "calendars" SET "color" = lower("color");
UPDATE "tags" SET "color" = lower("color");
UPDATE "user_settings" SET "accentColor" = lower("accentColor");
UPDATE "calendar_members" SET "colorOverride" = lower("colorOverride")
  WHERE "colorOverride" IS NOT NULL;
UPDATE "events" SET "color" = lower("color") WHERE "color" IS NOT NULL;

-- ─── 2. Os valores padrão ────────────────────────────────────────────────────

ALTER TABLE "calendars" ALTER COLUMN "color" SET DEFAULT '#6d7cff';
ALTER TABLE "tags" ALTER COLUMN "color" SET DEFAULT '#8b8fa3';
ALTER TABLE "user_settings" ALTER COLUMN "accentColor" SET DEFAULT '#6d7cff';

-- ─── 3. A garantia ───────────────────────────────────────────────────────────
--
-- Sem isto a regra depende de todo caminho de escrita passar pelo contrato, e
-- o caminho que falhou foi justamente um que não passava: um DEFAULT do próprio
-- banco. Validação na aplicação é a mensagem decente; a restrição é a garantia.

ALTER TABLE "calendars" ADD CONSTRAINT "calendars_color_hex"
  CHECK ("color" ~ '^#[0-9a-f]{6}$');

ALTER TABLE "tags" ADD CONSTRAINT "tags_color_hex"
  CHECK ("color" ~ '^#[0-9a-f]{6}$');

ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_accent_color_hex"
  CHECK ("accentColor" ~ '^#[0-9a-f]{6}$');

ALTER TABLE "calendar_members" ADD CONSTRAINT "calendar_members_color_hex"
  CHECK ("colorOverride" IS NULL OR "colorOverride" ~ '^#[0-9a-f]{6}$');

ALTER TABLE "events" ADD CONSTRAINT "events_color_hex"
  CHECK ("color" IS NULL OR "color" ~ '^#[0-9a-f]{6}$');

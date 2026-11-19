-- Contrair: o tema vive só em `appearance`; o par antigo sai.
-- A web não lê mais `themePreset` nem `accentColor`.

-- Contas que ainda não tinham o JSON (criadas depois da migração de expandir,
-- já que `appearance` era opcional) recebem o mesmo preenchimento de lá.
UPDATE "user_settings"
SET "appearance" = jsonb_build_object(
  'v', 1,
  'base', CASE WHEN "themePreset" IN ('nebula', 'eclipse', 'dawn', 'vacuum')
               THEN "themePreset" ELSE 'nebula' END,
  'sementes', jsonb_build_object(
    'fundo', CASE "themePreset"
               WHEN 'eclipse' THEN '#140a1f'
               WHEN 'dawn' THEN '#f6f1ea'
               WHEN 'vacuum' THEN '#000000'
               ELSE '#0b0d17' END,
    'destaque', "accentColor",
    'contraste', 'normal'
  ),
  'forma', jsonb_build_object(
    'cantos', 6, 'estrelas', true, 'lua', true, 'hemisferio', 'sul'
  )
)
WHERE "appearance" IS NULL;

-- Conta nova nasce com o tema padrão (nebula), igual ao `TEMA_PADRAO`.
ALTER TABLE "user_settings"
  ALTER COLUMN "appearance" SET DEFAULT '{"v":1,"base":"nebula","sementes":{"fundo":"#0b0d17","destaque":"#6d7cff","contraste":"normal"},"forma":{"cantos":6,"estrelas":true,"lua":true,"hemisferio":"sul"}}',
  ALTER COLUMN "appearance" SET NOT NULL;

ALTER TABLE "user_settings"
  DROP COLUMN "themePreset",
  DROP COLUMN "accentColor";

-- Expandir: guarda o tema como JSON versionado, sem tirar nada ainda.
-- `themePreset` e `accentColor` continuam, e a API os mantém em dia; saem numa
-- migração própria, depois que a web deixar de lê-los.
ALTER TABLE "user_settings" ADD COLUMN "appearance" JSONB;

-- Preenche a partir do par antigo: o nebula com o destaque padrão dá
-- exatamente as sementes do tema pronto, e um preset desconhecido cai no nebula.
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
);

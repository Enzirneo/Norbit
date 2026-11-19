# Design system do Norbit e motor de temas — especificação

**Data:** 2026-11-19 · **Estado:** proposta, aguardando revisão · **Substitui:** nada (evolui
[04 — Design System](../../04-design-system.md))

## 1. Objetivo

Dar ao Norbit um design system **bonito, coerente e personalizável**, que valha para a web agora e para o
iPhone depois (pelo Capacitor, com o mesmo código):

- bonito e atrativo, ligado ao tema espacial **com moderação** ("órbita, não nave espacial");
- personalização profunda, no estilo do Discord, das **cores do app inteiro** e da **identidade do perfil**;
- organizado: todo elemento visual é um componente, e nenhuma tela define cor ou forma por conta própria.

**Sucesso**, em termos que dá para conferir:

1. Uma pessoa troca o tema do app inteiro em segundos, com prévia ao vivo, e **nenhuma combinação que ela
   escolha deixa o texto ilegível**.
2. Nenhuma tela contém cor literal nem raio em pixel fora dos tokens (verificado no CI).
3. Todo componente aparece, em todos os estados, num catálogo, e o e2e mede contraste e acessibilidade
   desse catálogo em cada tema pronto.
4. Trocar o tema, depois dos componentes migrados, **não exige tocar em nenhum componente**.

## 2. Decisões já tomadas

| Decisão                        | Escolha                                                                                                                | Por quê                                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Profundidade da personalização | **Editor completo com proteção.** Temas prontos mais um editor com prévia ao vivo; o app corrige combinações ilegíveis | Dá liberdade de verdade sem permitir tela ilegível. Os temas prontos são só configurações salvas do mesmo editor |
| Identidade visual padrão       | **A · Órbita Profunda**, a evolução do que já existe                                                                   | Calma, familiar, boa para uso diário. B (Aurora) e C (Observatório) ficam como possíveis "estilos" futuros       |
| Motor de temas                 | **Sementes com derivação automática** (formato preparado para ajustes finos)                                           | Resultado sempre coerente, armazenamento pequeno, mesmo algoritmo em qualquer plataforma                         |
| Ordem                          | Componentes **antes** do motor                                                                                         | O resultado visível chega mais cedo, e o motor entra por baixo, sem mexer nos componentes                        |

## 3. Fora de escopo

Não entram nesta especificação, e o desenho **não os impede**: ajustes cor a cor (o campo `ajustes` fica
reservado), planos pagos, a escolha dos estilos B e C, códigos de compartilhar tema, alternar claro e
escuro conforme o sistema, banners, imagens de perfil e efeitos animados.

Os dois últimos grupos (efeitos e imagens) são candidatos naturais a recurso premium, mas **nenhum sistema
de planos é construído aqui**.

## 4. Linguagem visual A

Princípios (os de [04](../../04-design-system.md) continuam valendo): profundidade em vez de enfeite;
três lugares concentram a identidade (o fundo, a linha de "agora", as transições); o teste de qualquer
decisão visual é "isso ainda deixa a agenda legível em dois segundos?".

### 4.1 A camada de forma

Hoje a camada semântica cobre **cor**. A direção A também tem **forma**, e ela passa a ser tokenizada, para
um estilo futuro poder trocá-la sem tocar em componentes. Valores iniciais (extraídos da maquete A, em
múltiplos de `--space-unit`):

| Token               | Valor                                                          | Uso                                     |
| ------------------- | -------------------------------------------------------------- | --------------------------------------- |
| `--raio-p`          | `calc(var(--space-unit) * 2)` (8px)                            | botões, campos, chips                   |
| `--raio-m`          | `calc(var(--space-unit) * 3)` (12px)                           | cartões internos, eventos               |
| `--raio-g`          | `calc(var(--space-unit) * 4)` (16px)                           | cartões de seção, diálogos              |
| `--raio-tela`       | `calc(var(--space-unit) * 5)` (20px)                           | o quadro do calendário                  |
| `--sombra-1`        | `0 1px 2px rgb(0 0 0 / 0.35)`                                  | elementos elevados leves                |
| `--sombra-2`        | `0 8px 24px rgb(0 0 0 / 0.4)`                                  | menus, toasts                           |
| `--sombra-3`        | `0 18px 40px rgb(0 0 0 / 0.5)`                                 | diálogos                                |
| `--vidro-desfoque`  | `6px`                                                          | superfícies de vidro (diálogos, barras) |
| `--brilho-destaque` | `0 0 14px color-mix(in oklab, var(--accent) 35%, transparent)` | botão primário, "hoje"                  |
| `--fundo-estrelas`  | `1` ou `0`                                                     | liga o campo de estrelas do fundo       |
| `--alvo-toque`      | `2rem` (desktop) / `2.75rem` (toque)                           | altura mínima de controles clicáveis    |

As sombras usam preto translúcido (não dependem do tema). Os valores são ponto de partida: a decisão
final é visual e é ajustada na etapa 1, com o catálogo.

### 4.2 O que não muda

Vocabulário ("Órbita", "Nada em órbita…"), motion (arco, nada demora, movimento informa), os contrastes já
medidos em [04](../../04-design-system.md) e as quatro armadilhas de CSS registradas ali.

## 5. O motor de temas

Tudo em `libs/design-tokens`, funções puras, sem DOM, testadas sem navegador.

### 5.1 Unidades

| Unidade            | Responsabilidade                              | Depende de                 |
| ------------------ | --------------------------------------------- | -------------------------- |
| `oklch.ts`         | converter sRGB ↔ OKLCH e limitar à gama       | nada                       |
| `sementes.ts`      | o tipo `Sementes` e a validação               | `oklch.ts`                 |
| `derivar.ts`       | `derivar(sementes)` → `{ tokens, avisos }`    | `oklch.ts`, `contraste.ts` |
| `temas-prontos.ts` | nebula, eclipse, dawn, vacuum como `Sementes` | `sementes.ts`              |
| `libs/contracts`   | `temaSchema` (zod), para a API e a web        | `sementes.ts`              |

`contraste.ts` e `acentos.ts` já existem e são **reaproveitados**: `acentos.ts` hoje deriva `textOnAccent` e
`accentMuted` por busca de contraste, e o motor generaliza isso para qualquer cor.

### 5.2 As sementes

```ts
type Sementes = {
  fundo: string; // hex; o modo claro/escuro sai da claridade dele
  destaque: string; // hex; qualquer cor
  contraste: 'normal' | 'alto';
};
```

O modo (claro ou escuro) **não** é uma escolha separada: sai da claridade do `fundo`.

### 5.3 A derivação

`derivar` devolve os mesmos tokens de `TemaSemantico` (superfícies, texto, bordas, destaque, estados). Os
tokens de forma não dependem das sementes na v1: o brilho do destaque já deriva de `--accent` por
`color-mix` no próprio CSS.

- **superfícies** (`sunken`, `base`, `raised`, `overlay`): degraus de claridade em OKLCH a partir do
  `fundo`, preservando o matiz e a croma;
- **texto**: claridade encontrada por busca até atingir o contraste-alvo contra a superfície em que fica,
  com o matiz do fundo (o texto não é cinza neutro sobre um fundo azul); alvos: `textPrimary` ≥ 7:1 (≥ 10:1
  em `alto`), `textSecondary` e `textMuted` nos mínimos que os testes atuais já exigem
  (`MINIMO_TEXTO` = 4.5);
- **destaque**: `accentHover`, `accentMuted` e `textOnAccent` por busca, como em `acentos.ts`, mas em OKLCH;
- **bordas**: misturas do texto com a superfície; `borderFocus` ≥ `MINIMO_GRAFICO` (3:1) contra a superfície;
- **estados** (`success`, `warning`, `danger`): matizes fixos, claridade ajustada ao contraste da superfície.

**Nunca recusa uma semente.** Se uma combinação não permite atingir o contraste (por exemplo, `fundo` igual
a `destaque`), a derivação ajusta o necessário e devolve um **aviso** em linguagem humana ("ajustamos seu
destaque para ficar legível sobre o fundo"). Quem decide o que mostrar é o editor.

### 5.4 Os dados

`UserSettings.theme`, um JSON versionado, substitui `themePreset` e `accentColor`:

```json
{
  "v": 1,
  "base": "nebula",
  "sementes": {
    "fundo": "#0b0d17",
    "destaque": "#6d7cff",
    "contraste": "normal"
  }
}
```

- `base`: de qual tema pronto a pessoa partiu (`null` se editou as sementes à mão); serve para a interface
  destacar o tema na galeria.
- `ajustes`: **reservado** e ignorado na v1; é por onde virão os ajustes finos.
- **Migração em duas fases** (expandir e contrair): primeiro adiciona `theme` e preenche a partir de
  `themePreset` e `accentColor`; só depois que a web deixa de ler os campos antigos, uma segunda migração os
  remove. O nebula com o destaque padrão tem que dar exatamente as sementes do tema pronto.
- `ThemeMode` continua no schema, **sem uso** na v1 (seguir o sistema está fora de escopo).

### 5.5 Na web

`aplicarAparencia` passa a receber os **tokens derivados** e continua escrevendo as variáveis no `<html>`.
O cache do `localStorage` guarda os **tokens**, e não as sementes: o primeiro quadro pinta com o tema certo
sem rodar a derivação, e sem piscar o tema padrão. Quando as sementes mudam, deriva-se de novo, aplica-se e
atualiza-se o cache.

### 5.6 Erros

| Situação                                          | Comportamento                                              |
| ------------------------------------------------- | ---------------------------------------------------------- |
| hex inválido na API                               | recusado pelo `temaSchema` (400), como os outros contratos |
| semente extrema                                   | derivação corrige e devolve aviso; nunca lança             |
| cache do navegador corrompido ou de versão antiga | ignorado; usa o tema padrão e deriva do servidor           |
| `theme` ausente (conta antiga, antes da migração) | tema padrão                                                |

## 6. Componentes e catálogo

### 6.1 Regra

Todo elemento visual é um componente em `apps/web/src/app/ui/` que consome **somente** tokens (cor e forma).
As telas não definem cor, raio nem sombra.

### 6.2 Inventário (v1)

| Componente                              | Estado hoje                               | Observação                     |
| --------------------------------------- | ----------------------------------------- | ------------------------------ |
| Botão (sólido, contorno, texto, perigo) | existe                                    | passa a usar a camada de forma |
| Campo (rótulo, dica, erro)              | existe                                    |                                |
| Diálogo                                 | existe                                    |                                |
| Marca                                   | existe                                    |                                |
| **Entrada** (input, textarea, select)   | classe global `.nb-entrada`               | vira diretiva ou componente    |
| **Caixa** (checkbox, radio)             | estilo solto em páginas                   | cor do destaque                |
| **Alternador** (Mês, Semana, Dia)       | duplicado em `calendario.scss`            |                                |
| **Cartão de seção**                     | `.secao` duplicado nas páginas de ajustes |                                |
| **Aviso** (info, sucesso, perigo)       | `.aviso`, `.erro` soltos                  | `role` correto por tipo        |
| **Avatar**                              | duplicado no perfil e no calendário       | iniciais; imagem depois        |
| **Etiqueta**                            | texto solto ("padrão")                    |                                |
| **Estado vazio**                        | `.vazio` na página                        |                                |
| **Cabeçalho de página**                 | repetido no perfil e nas preferências     | título e linha de estado       |
| **Chip de evento**                      | em `visao-de-mes` e `visao-de-horas`      | barra do mês e bloco da semana |
| **Toast**                               | "Perfil salvo." solto                     | substitui as linhas de estado  |

### 6.3 Guarda de CI

O job `guard` (que já existe) ganha uma verificação que reprova, em `apps/web/src/**/*.{scss,html,ts}`:
cor literal (`#hex`, `rgb(`, `hsl(`) e raio em pixel, **exceto** em `libs/design-tokens` e em uma lista curta
de exceções comentadas (hoje só o `::backdrop` do diálogo). A verificação tem teste próprio.

### 6.4 Catálogo vivo

Uma rota `/design`, **só em desenvolvimento**: mostra cada componente em cada estado (normal, foco,
desabilitado, erro, ocupado), sob o tema escolhido, com os controles de sementes ao lado (quando o motor
existir). Critérios:

- não vai para o bundle de produção (verificado por um teste que procura a rota no `dist`);
- o e2e visita o catálogo em cada tema pronto, roda **axe** e mede contraste. Isso cumpre o item
  "auditoria de acessibilidade com axe nos quatro presets" do roadmap.

### 6.5 Pronto para o celular

Alvo de toque mínimo por token (`--alvo-toque`), nada que dependa só de hover, margens de área segura no
token. O Capacitor usa o mesmo código, então **não há porte de componentes**. O layout responsivo (visão de
dia como padrão) é uma entrega separada do roadmap, posterior a esta.

### 6.6 Migração

Um componente por PR; cada PR troca as telas que o usam **e apaga o CSS antigo no mesmo PR**.

## 7. O editor de tema e o perfil

### 7.1 O editor (Preferências, seção "Tema")

- galeria dos temas prontos, com miniatura desenhada pelos tokens reais;
- seletores das 3 sementes, com as 5 cores atuais como atalhos;
- **prévia ao vivo no app inteiro** (os tokens são variáveis CSS); só vale ao tocar em "Salvar", e sair sem
  salvar desfaz;
- os avisos do motor aparecem junto ao seletor que os causou;
- restaurar o tema padrão;
- o tema sincroniza entre aparelhos pelo `UserSettings`.

### 7.2 O perfil, em duas camadas

- **Tema do app: privado.** Só quem o escolheu o vê.
- **Identidade do perfil: pública para quem compartilha agenda.** Nesta especificação, uma **cor de perfil**
  (validada pelo mesmo motor de contraste), que colore o avatar nas listas de membros, nos criadores de
  evento e nos convites. Aparece **só** para pessoas que compartilham ao menos uma agenda com a dona da cor
  (a API a inclui onde já devolve dados de membros, e em nenhum outro lugar).
- **Imagem de avatar e banner dependem da decisão de armazenamento de arquivos** e ficam para depois dela.

## 8. Plano de entrega

Estimativa de **15 PRs**, em etapas. Cada PR segue o fluxo do projeto: branch, TDD, mutação nos pontos
críticos, e2e medindo o estilo calculado, documentação atualizada e PR para a `dev`.

| Etapa | PR  | Entrega                                                                                       |
| ----- | --- | --------------------------------------------------------------------------------------------- |
| **1** | 1   | camada de forma (tokens), guarda de CI, componentes Entrada e Caixa                           |
| **2** | 2   | Alternador, Cartão de seção, Aviso                                                            |
|       | 3   | Avatar, Etiqueta, Estado vazio, Cabeçalho de página                                           |
|       | 4   | Chip de evento (mês e semana)                                                                 |
|       | 5   | Toast (substitui as linhas de estado)                                                         |
| **3** | 6   | `oklch.ts` e `derivar` com testes de propriedade (contraste garantido em sementes aleatórias) |
|       | 7   | `temaSchema`, coluna `theme` e migração (expandir)                                            |
|       | 8   | aplicar o tema derivado na web, cache de tokens, preferências migradas                        |
|       | 9   | os quatro temas prontos, com o nebula reproduzindo as cores de hoje (teste dourado)           |
| **4** | 10  | catálogo `/design` com axe e medição de contraste por tema                                    |
|       | 11  | editor de tema: galeria e seletores                                                           |
|       | 12  | editor de tema: prévia ao vivo, avisos, descartar e restaurar                                 |
|       | 13  | migração (contrair): remove `themePreset` e `accentColor`                                     |
| **5** | 14  | cor de perfil: schema, API e exposição só entre quem compartilha                              |
|       | 15  | cor de perfil: edição e uso nos avatares                                                      |

Os primeiros resultados visíveis chegam nas etapas 1 e 2. Imagens de perfil somam cerca de 2 PRs depois da
decisão de armazenamento.

## 9. Verificação

- **Derivação:** testes de propriedade com sementes aleatórias (gerador com semente fixa): todo par
  texto/superfície atinge o contraste-alvo; derivar é determinístico; o nebula reproduz os valores atuais
  (teste dourado); a migração converte `themePreset` e `accentColor` no tema equivalente.
- **Componentes:** specs de comportamento (TestBed) e e2e que medem o **estilo calculado** pelo navegador,
  o método que pegou os defeitos visuais da série anterior (documentado em
  [04](../../04-design-system.md)).
- **Catálogo:** e2e com axe e contraste em cada tema pronto.
- **Guarda:** teste da própria verificação de cor literal (acusa um literal plantado).
- **Mutação**, como no restante do projeto, nos pontos de decisão (busca de contraste, limites, migração).

## 10. Riscos

| Risco                                                | Mitigação                                                                                                                                          |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sementes geram combinações feias, ainda que legíveis | testes de propriedade cobrem a legibilidade, e o catálogo mostra o resultado em todas as superfícies; a beleza é julgada olhando, nas etapas 3 e 4 |
| O primeiro quadro pisca o tema padrão                | cache de tokens no `localStorage`, aplicado antes da primeira pintura                                                                              |
| O app "corrige demais" e a pessoa não entende        | avisos explícitos e específicos, no seletor que os causou                                                                                          |
| Migração de dados quebra contas antigas              | migração em duas fases, com a segunda só depois de a web parar de ler os campos antigos                                                            |
| Escopo crescer                                       | a lista de fora de escopo (seção 3) é o contrato; qualquer item dela vira especificação própria                                                    |

## 11. Decisões adiadas

Nenhuma delas bloqueia a etapa 1.

- **Onde guardar arquivos** (imagem de avatar e banner): depende da hospedagem, ainda em aberto.
- **Seguir o sistema (claro e escuro):** fora de escopo; o `ThemeMode` fica sem uso até alguém pedir.
- **Planos pagos e recursos premium:** fora de escopo; o campo `ajustes` e os efeitos são os candidatos.
- **Os estilos B e C:** possíveis depois, trocando a camada de forma; sem data.

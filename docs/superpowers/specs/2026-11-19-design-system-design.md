# Design system do Norbit e motor de temas — especificação

**Data:** 2026-11-19 · **Revisão 3** · **Estado:** proposta, aguardando revisão · **Substitui:** nada
(evolui [04 — Design System](../../04-design-system.md))

> **O que mudou na revisão 2.** A primeira versão escolhia como identidade "a evolução do que já existe".
> Depois de ver o app rodando, a pessoa dona do produto disse que o visual atual está "perdido" e "blocado"
> (cartões arredondados, todos com o mesmo peso), e pediu **liberdade de forma** e **detalhes de espaço e de
> lua**. Uma proposta interativa ("o calendário como protagonista") foi aprovada como direção. Esta revisão
> reescreve a identidade (seção 4), amplia o que a pessoa pode personalizar, e **reordena o plano para
> começar pelo calendário**.

> **O que mudou na revisão 3.** O plano de entrega passou de **19 para 11 PRs**: vários pares eram o
> mesmo trabalho cortado em fatias, e cada fatia custava uma revisão e um merge. Os PRs 1, 2 e A já foram
> entregues; os 9 restantes (A a I) juntam o que é da mesma natureza. Os dois que **não** se juntam são
> os que dependem do olho de quem decide: a semana e o dia (A) e o editor de tema (H).

## 1. Objetivo

Dar ao Norbit um design system **bonito, coerente e personalizável**, que valha para a web agora e para o
iPhone depois (pelo Capacitor, com o mesmo código):

- bonito e atrativo, ligado ao tema espacial **com moderação**: o espaço aparece como **informação e pontos
  de luz**, e não como ornamento;
- **liberdade real** para quem usa: das **cores**, da **forma** (cantos) e do **espaço** (estrelas e lua),
  no estilo do Discord, e também da **identidade do perfil**;
- organizado: todo elemento visual é um componente, e nenhuma tela define cor ou forma por conta própria;
- **o calendário é o protagonista**; o resto é moldura.

**Sucesso**, em termos que dá para conferir:

1. Uma pessoa troca o tema do app inteiro em segundos, com prévia ao vivo, e **nenhuma combinação que ela
   escolha deixa o texto ilegível**.
2. Ela também ajusta cantos, estrelas e lua, e a tela inteira responde na hora.
3. Nenhuma tela contém cor literal nem raio em pixel fora dos tokens (verificado no CI).
4. Todo componente aparece, em todos os estados, num catálogo, e o e2e mede contraste e acessibilidade
   desse catálogo em cada tema pronto.
5. Trocar o tema, depois dos componentes migrados, **não exige tocar em nenhum componente**.

## 2. Decisões já tomadas

| Decisão                            | Escolha                                                                                                                                                           | Por quê                                                                                                       |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Profundidade da personalização     | **Editor completo com proteção.** Temas prontos mais um editor com prévia ao vivo; o app corrige combinações ilegíveis                                            | Liberdade de verdade sem permitir tela ilegível. Os temas prontos são só configurações salvas do mesmo editor |
| Identidade visual                  | **Órbita Profunda, "o calendário como protagonista"**: moldura macia e conteúdo firme, hierarquia de tempo e a lua como informação (proposta interativa aprovada) | Responde ao "blocado": os cantos são escolha de quem usa, e o conteúdo (eventos) fica mais reto que a moldura |
| Estilos alternativos               | B (Aurora) e C (Observatório) ficam como possíveis "estilos" futuros                                                                                              | O motor trata forma como token, então eles cabem depois sem refazer componentes                               |
| Motor de temas                     | **Sementes com derivação automática** (formato preparado para ajustes finos)                                                                                      | Resultado sempre coerente, armazenamento pequeno, mesmo algoritmo em qualquer plataforma                      |
| Ordem                              | **Calendário primeiro**, depois componentes, depois o motor                                                                                                       | É o que a pessoa mais usa e quer ver bonito; o motor entra por baixo, sem mexer nos componentes               |
| Estrutura de Preferências e Perfil | **Em aberto.** Quatro estruturas foram mostradas (a atual, navegação lateral, perfil em primeiro lugar, gaveta) e **nenhuma** foi escolhida                       | Será decidida com um protótipo próprio, na etapa do editor (seção 11)                                         |

## 3. Fora de escopo

Não entram nesta especificação, e o desenho **não os impede**: ajustes cor a cor (o campo `ajustes` fica
reservado), planos pagos, a escolha dos estilos B e C, códigos de compartilhar tema, alternar claro e
escuro conforme o sistema, banners, imagens de perfil e efeitos animados.

Os dois últimos grupos (efeitos e imagens) são candidatos naturais a recurso premium, mas **nenhum sistema
de planos é construído aqui**.

## 4. Linguagem visual

Princípios (os de [04](../../04-design-system.md) continuam valendo): profundidade em vez de enfeite; o
teste de qualquer decisão visual é "isso ainda deixa a agenda legível em dois segundos?". Somam-se quatro,
vindos da proposta aprovada:

1. **Moldura macia, conteúdo firme.** Botões, painéis e o quadro do calendário seguem o controle de cantos
   da pessoa; **os eventos ficam sempre mais retos** que a moldura (`--r-ev` = 35% de `--r`), com uma barra
   de cor à esquerda. Quebra o "tudo arredondado" sem perder o toque macio.
2. **O espaço é informação.** A lua mostra a fase do dia; o "agora" é uma pequena órbita sobre a linha; as
   estrelas são pontos de luz quase imperceptíveis. Nada disso compete com a leitura, e tudo se desliga.
3. **O tempo tem hierarquia.** O passado escurece, hoje brilha, "agora" é a única linha viva.
4. **Liberdade é sistema, não capricho.** Cantos, cor, fundo, estrelas e lua são tokens; o editor de tema
   controla exatamente isso.

### 4.1 A camada de forma

A camada semântica cobre **cor**; a forma passa a ser tokenizada também, e **parte dela é escolha de quem
usa**. Um único valor-base, `--r` (de 0 a 16px, padrão 6px), gera os raios:

| Token                                 | Valor                                                          | Uso                                        |
| ------------------------------------- | -------------------------------------------------------------- | ------------------------------------------ |
| `--r`                                 | `6px` (a pessoa escolhe de 0 a 16px)                           | a base de todos os raios                   |
| `--raio-p`                            | `var(--r)`                                                     | botões, campos, chips                      |
| `--raio-m`                            | `calc(var(--r) * 1.6)`                                         | painéis internos, cartão da lua            |
| `--raio-tela`                         | `calc(var(--r) * 2.2)`                                         | o quadro do calendário e os diálogos       |
| `--r-ev`                              | `calc(var(--r) * 0.35)`                                        | **eventos**: sempre mais retos que o resto |
| `--raio-pilula`                       | `9999px`                                                       | círculo e pílula: não depende dos cantos   |
| `--sombra-1`                          | `0 1px 2px rgb(0 0 0 / 0.35)`                                  | elementos elevados leves                   |
| `--sombra-2`                          | `0 8px 24px rgb(0 0 0 / 0.4)`                                  | menus, toasts, evento em hover             |
| `--sombra-3`                          | `0 18px 40px rgb(0 0 0 / 0.5)`                                 | diálogos                                   |
| `--vidro-desfoque`                    | `6px`                                                          | superfícies de vidro (diálogos, barras)    |
| `--brilho-destaque`                   | `0 0 14px color-mix(in oklab, var(--accent) 35%, transparent)` | botão primário, "hoje", "agora"            |
| `--estrelas`                          | `1` ou `0` (a pessoa escolhe)                                  | liga o campo de estrelas do fundo          |
| `--fonte-mono`                        | `ui-monospace, 'SF Mono', Menlo, Consolas, monospace`          | horas e números que precisam alinhar       |
| `--alvo-toque`, `--alvo-toque-grosso` | `2rem` (mouse) / `2.75rem` (dedo)                              | altura mínima de controles clicáveis       |

As sombras usam preto translúcido (não dependem do tema). Os números são ponto de partida: a decisão final é
visual e é ajustada olhando o resultado, a partir do PR A.

### 4.2 A lua

- **Função pura** `faseDaLua(data)` em `libs/domain`: fase de 0 a 1 pelo mês sinódico (29,530588853 dias)
  a partir de uma lua nova de referência, mais `iluminacao(fase)` (0 a 100%) e `nomeDaFase(fase)` (nova,
  crescente, quarto crescente, gibosa crescente, cheia, gibosa minguante, quarto minguante, minguante).
  Precisão: a de um modelo simples (cerca de meio dia), suficiente para exibir; **não** é efeméride.
- **Hemisfério:** o desenho da fase depende dele (no sul, a lua crescente fica iluminada à esquerda; no
  norte, à direita). O padrão é **sul** (o produto é brasileiro) e o editor oferece a troca.
- **Componente** `Lua` (SVG, tamanho por parâmetro) e **cartão da lua** na barra lateral (nome da fase e
  porcentagem iluminada de hoje).
- Aparece no cabeçalho de cada dia (semana e dia) e em cada célula (mês). A pessoa pode desligar (`lua`).

### 4.3 O calendário

- **Evento:** bloco com barra de cor à esquerda (3px), fundo tingido pela cor da agenda, horário em fonte
  monoespaçada e `--r-ev`. No hover sobe 1px e ganha sombra.
- **Passado, hoje, agora:** o passado do dia escurece (camada translúcida até a linha de agora); a coluna de
  hoje tem um brilho suave; "agora" é uma linha com um anel (a órbita) e brilho.
- **Eventos de dia inteiro** numa tira acima da grade, com a mesma barra de cor.
- **Mês:** as mesmas barras (horário em mono, título), a lua em cada célula, dias do mês anterior e do
  seguinte mais apagados, "+N mais" quando passa de dois.
- **Barra lateral:** marca, cartão da lua, as "órbitas" (agendas) com a cor de cada uma, Perfil e Preferências
  no pé.

### 4.4 O que não muda

Vocabulário ("Órbita", "Nada em órbita…"), motion (arco, nada demora, movimento informa), os contrastes já
medidos em [04](../../04-design-system.md) e as armadilhas de CSS registradas ali.

## 5. O motor de temas

Tudo em `libs/design-tokens`, funções puras, sem DOM, testadas sem navegador.

### 5.1 Unidades

| Unidade            | Responsabilidade                                                                                               | Depende de                 |
| ------------------ | -------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `oklch.ts`         | converter sRGB ↔ OKLCH e limitar à gama                                                                        | nada                       |
| `sementes.ts`      | o tipo `Sementes` e a validação                                                                                | `oklch.ts`                 |
| `derivar.ts`       | `derivar(sementes)` → `{ tokens, avisos }`                                                                     | `oklch.ts`, `contraste.ts` |
| `temas-prontos.ts` | nebula, eclipse, dawn, vacuum, e os fundos "Noite", "Vazio", "Aurora" e "Eclipse" da proposta, como `Sementes` | `sementes.ts`              |
| `libs/contracts`   | `temaSchema` (zod), para a API e a web                                                                         | `sementes.ts`              |

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
tokens de forma **não** dependem das sementes: o brilho do destaque já deriva de `--accent` por `color-mix`
no próprio CSS, e a forma é a parte `forma` do tema (seção 5.4).

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
  },
  "forma": { "cantos": 6, "estrelas": true, "lua": true, "hemisferio": "sul" }
}
```

- `base`: de qual tema pronto a pessoa partiu (`null` se editou as sementes à mão); serve para a interface
  destacar o tema na galeria.
- `forma`: o que não é cor. `cantos` é um inteiro de 0 a 16 (vira `--r`); `estrelas` e `lua` ligam e
  desligam; `hemisferio` é `"sul"` ou `"norte"`. Validado pelo `temaSchema`; fora da faixa é recusado.
- `ajustes`: **reservado** e ignorado na v1; é por onde virão os ajustes finos de cor.
- **Migração em duas fases** (expandir e contrair): primeiro adiciona `theme` e preenche a partir de
  `themePreset` e `accentColor` (com `forma` padrão); só depois que a web deixa de ler os campos antigos,
  uma segunda migração os remove. O nebula com o destaque padrão tem que dar exatamente as sementes do tema
  pronto.
- `ThemeMode` continua no schema, **sem uso** na v1 (seguir o sistema está fora de escopo).

### 5.5 Na web

`aplicarAparencia` passa a receber os **tokens derivados** e a **forma**, e continua escrevendo as
variáveis no `<html>`. O cache do `localStorage` guarda os **tokens**, e não as sementes: o primeiro quadro
pinta com o tema certo sem rodar a derivação, e sem piscar o tema padrão. Quando algo muda, deriva-se de
novo, aplica-se e atualiza-se o cache.

### 5.6 Erros

| Situação                                          | Comportamento                                              |
| ------------------------------------------------- | ---------------------------------------------------------- |
| hex inválido ou `cantos` fora de 0 a 16 na API    | recusado pelo `temaSchema` (400), como os outros contratos |
| semente extrema                                   | derivação corrige e devolve aviso; nunca lança             |
| cache do navegador corrompido ou de versão antiga | ignorado; usa o tema padrão e deriva do servidor           |
| `theme` ausente (conta antiga, antes da migração) | tema padrão                                                |

## 6. Componentes e catálogo

### 6.1 Regra

Todo elemento visual é um componente em `apps/web/src/app/ui/` que consome **somente** tokens (cor e forma).
As telas não definem cor, raio nem sombra.

### 6.2 Inventário (v1)

| Componente                              | Estado hoje                               | Observação                                             |
| --------------------------------------- | ----------------------------------------- | ------------------------------------------------------ |
| Botão (sólido, contorno, texto, perigo) | existe                                    | passa a usar a camada de forma                         |
| Campo (rótulo, dica, erro)              | existe                                    |                                                        |
| Diálogo                                 | existe                                    |                                                        |
| Marca                                   | existe                                    |                                                        |
| **Lua** (e cartão da lua)               | novo                                      | seção 4.2                                              |
| **Chip de evento**                      | em `visao-de-mes` e `visao-de-horas`      | bloco firme com barra de cor (seção 4.3)               |
| **Linha de agora**                      | dentro da visão de horas                  | anel e brilho                                          |
| **Entrada** (input, textarea, select)   | classe global `.nb-entrada`               | vira diretiva ou componente                            |
| **Caixa** (checkbox, radio)             | estilo solto em páginas                   | cor do destaque                                        |
| **Alternador** (Mês, Semana, Dia)       | duplicado em `calendario.scss`            |                                                        |
| **Cartão de seção**                     | `.secao` duplicado nas páginas de ajustes | usado com parcimônia (a pessoa não quer tudo em bloco) |
| **Aviso** (info, sucesso, perigo)       | `.aviso`, `.erro` soltos                  | `role` correto por tipo                                |
| **Avatar**                              | duplicado no perfil e no calendário       | iniciais; imagem depois                                |
| **Etiqueta**                            | texto solto ("padrão")                    |                                                        |
| **Estado vazio**                        | `.vazio` na página                        |                                                        |
| **Cabeçalho de página**                 | repetido no perfil e nas preferências     | título e linha de estado                               |
| **Toast**                               | "Perfil salvo." solto                     | substitui as linhas de estado                          |

### 6.3 Guarda de CI

A verificação (`npm run estilo:verificar`, regras em `libs/design-tokens/src/lib/guarda-de-estilo.ts`) roda
no job `lint` do CI e no pré-commit. O job `guard` do `ci.yml` é só o portão que espera o `package.json`, e
por isso a verificação não mora nele. Ela reprova, em `apps/web/src/**/*.{scss,html,ts}`:
cor literal (`#hex`, `rgb(`, `hsl(`) e raio em pixel, **exceto** em `libs/design-tokens` e em uma lista curta
de exceções comentadas (hoje só o `::backdrop` do diálogo). A verificação tem teste próprio.

### 6.4 Catálogo vivo

Uma rota `/design`, **só em desenvolvimento**: mostra cada componente em cada estado (normal, foco,
desabilitado, erro, ocupado), sob o tema escolhido, com os controles de sementes e de forma ao lado (quando o
motor existir). Critérios:

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

### 7.1 O editor

- galeria dos temas prontos, com miniatura desenhada pelos tokens reais;
- seletores das 3 sementes, com as 5 cores atuais como atalhos, e os fundos da proposta como temas prontos;
- controles de **forma**: cantos (retos a redondos), estrelas, lua e hemisfério;
- **prévia ao vivo no app inteiro** (os tokens são variáveis CSS); só vale ao tocar em "Salvar", e sair sem
  salvar desfaz;
- os avisos do motor aparecem junto ao seletor que os causou;
- restaurar o tema padrão;
- o tema sincroniza entre aparelhos pelo `UserSettings`.

Onde o editor mora (uma página de Preferências reestruturada, uma gaveta, ou outra coisa) **está em aberto**
(seção 11).

### 7.2 O perfil, em duas camadas

- **Tema do app: privado.** Só quem o escolheu o vê.
- **Identidade do perfil: pública para quem compartilha agenda.** Nesta especificação, uma **cor de perfil**
  (validada pelo mesmo motor de contraste), que colore o avatar nas listas de membros, nos criadores de
  evento e nos convites. Aparece **só** para pessoas que compartilham ao menos uma agenda com a dona da cor
  (a API a inclui onde já devolve dados de membros, e em nenhum outro lugar).
- **Imagem de avatar e banner dependem da decisão de armazenamento de arquivos** e ficam para depois dela.

## 8. Plano de entrega

**11 PRs**: 2 entregues e 9 por vir. Cada PR segue o fluxo do projeto: branch, TDD, mutação nos pontos
críticos, e2e medindo o estilo calculado, olhar a tela de verdade, documentação atualizada e PR para a
`dev`. Quando o PR junta partes, o corpo dele diz o que é de cada uma.

| PR  | Entrega                                                                                                                    | Estado         |
| --- | -------------------------------------------------------------------------------------------------------------------------- | -------------- |
| 1   | camada de forma (`--r` e derivados, estrelas, fonte monoespaçada) e guarda de estilo no CI                                 | **entregue**   |
| 2   | domínio da lua (`faseDaLua`, `iluminacao`, `nomeDaFase`) e o componente `Lua`                                              | **entregue**   |
| A   | **semana e dia**: evento firme com barra de cor, hierarquia de tempo, "agora" em órbita, lua no cabeçalho                  | **entregue**   |
| B   | **mês e casca**: o mesmo vocabulário no mês, a lua em cada célula, e a barra lateral (órbitas, cartão da lua) e a superior | entregue (#37) |
| C   | **componentes de formulário e resposta**: Entrada, Caixa, Alternador, Aviso e Toast                                        | em andamento   |
| D   | **componentes de identidade e estrutura**: Avatar, Etiqueta, Estado vazio, Cabeçalho de página e Cartão de seção           | em andamento   |
| E   | **motor puro**: `oklch.ts`, `derivar` com testes de propriedade e os temas prontos (teste dourado do nebula)               | em andamento   |
| F   | **integração do motor**: `temaSchema` (com `forma`), coluna `theme`, migração (expandir), aplicar na web e cache de tokens |                |
| G   | **catálogo `/design`** com axe e medição de contraste por tema                                                             |                |
| H   | **editor de tema**: galeria, seletores, controles de forma, prévia ao vivo, avisos, restaurar e a migração (contrair)      |                |
| I   | **cor de perfil**: schema, API, exposição só entre quem compartilha, edição e uso nos avatares                             |                |

**Antes do PR H há uma maquete, e não um PR:** a estrutura de Preferências e Perfil (seção 11) é decidida
com um protótipo que a pessoa vê e escolhe, como foi feito com as direções visuais.

Imagens de perfil somam cerca de 2 PRs depois da decisão de armazenamento de arquivos.

## 9. Verificação

- **Derivação:** testes de propriedade com sementes aleatórias (gerador com semente fixa): todo par
  texto/superfície atinge o contraste-alvo; derivar é determinístico; o nebula reproduz os valores atuais
  (teste dourado); a migração converte `themePreset` e `accentColor` no tema equivalente.
- **Lua:** fases em datas conhecidas (lua nova e cheia de referência) dentro de um dia de tolerância;
  iluminação de 0 a 100; a **orientação** (crescente iluminada à esquerda no sul, à direita no norte) tem
  teste próprio.
- **Componentes:** specs de comportamento (TestBed) e e2e que medem o **estilo calculado** pelo navegador,
  o método que pegou os defeitos visuais da série anterior (documentado em
  [04](../../04-design-system.md)); inclusive "o evento é mais reto que a moldura" para qualquer valor de
  cantos.
- **Catálogo:** e2e com axe e contraste em cada tema pronto.
- **Guarda:** teste da própria verificação de cor literal (acusa um literal plantado).
- **Mutação**, como no restante do projeto, nos pontos de decisão (busca de contraste, limites, migração,
  orientação da lua).

## 10. Riscos

| Risco                                                | Mitigação                                                                                                                        |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Sementes geram combinações feias, ainda que legíveis | testes de propriedade cobrem a legibilidade, e o catálogo mostra o resultado em todas as superfícies; a beleza é julgada olhando |
| Cantos em 0 ou em 16 quebram algum componente        | o catálogo e o e2e rodam nos dois extremos                                                                                       |
| A lua dá a fase errada ou na orientação errada       | testes em datas conhecidas e da orientação; o hemisfério é configurável                                                          |
| O primeiro quadro pisca o tema padrão                | cache de tokens no `localStorage`, aplicado antes da primeira pintura                                                            |
| O app "corrige demais" e a pessoa não entende        | avisos explícitos e específicos, no seletor que os causou                                                                        |
| Migração de dados quebra contas antigas              | migração em duas fases, com a segunda só depois de a web parar de ler os campos antigos                                          |
| Escopo crescer                                       | a lista de fora de escopo (seção 3) é o contrato; qualquer item dela vira especificação própria                                  |

## 11. Decisões adiadas

Nenhuma delas bloqueia os PRs A a G.

- **A estrutura de Preferências e Perfil.** Foram mostradas a atual (cartões empilhados), a navegação
  lateral com linhas, o perfil em primeiro lugar e a gaveta sobre o calendário; **nenhuma** foi escolhida, e
  a pessoa pediu menos blocos e mais liberdade. Será decidida com um protótipo próprio (antes do PR H), depois que
  o calendário e os componentes estiverem prontos e houver o que mostrar.
- **Onde guardar arquivos** (imagem de avatar e banner): depende da hospedagem, ainda em aberto.
- **Seguir o sistema (claro e escuro):** fora de escopo; o `ThemeMode` fica sem uso até alguém pedir.
- **Planos pagos e recursos premium:** fora de escopo; o campo `ajustes` e os efeitos são os candidatos.
- **Os estilos B e C:** possíveis depois, trocando a camada de forma; sem data.

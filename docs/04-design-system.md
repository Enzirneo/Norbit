# 04 — Design System

Qualidade visual é requisito do Norbit, não acabamento. Por isso o sistema de tema é
planejado antes da interface: todo componente nasce consumindo tokens, nunca valores
cravados. Trocar de tema depois fica impossível se os componentes forem escritos com
cores literais.

> **Evolução planejada:** o motor de temas (cores derivadas de sementes), a camada de forma e a
> biblioteca completa de componentes estão especificados em
> [docs/superpowers/specs/2026-11-19-design-system-design.md](superpowers/specs/2026-11-19-design-system-design.md).
> Este documento descreve o que **existe**; aquele, o que vem.

## A ideia visual

**Órbita, não nave espacial.** A referência é a quietude do espaço: profundidade,
gradientes muito sutis, movimento circular e contínuo, pontos de luz. Não é HUD de
ficção científica, não tem fonte futurista, não tem borda neon piscando.

O teste para qualquer decisão visual: _isso ainda deixa a agenda legível em dois
segundos?_ Se a resposta for não, o enfeite sai.

Três lugares concentram a identidade, e o resto da interface fica calmo:

1. **O fundo** — gradiente profundo com um brilho radial suave, e um campo de estrelas
   quase imperceptível (opacidade muito baixa, estático)
2. **O indicador de "agora"** — a linha da hora atual nas visões de dia e semana,
   com um ponto luminoso que pulsa lentamente
3. **As transições** — elementos entram em arco, não em linha reta (ver Motion)

## Vocabulário

Temático com moderação. Usado na interface:

| Conceito                                      | Nome na interface     |
| --------------------------------------------- | --------------------- |
| Agenda                                        | **Órbita**            |
| Conjunto de pessoas com quem você compartilha | **Constelação**       |
| Visão geral do dia                            | **Trajetória**        |
| Estado vazio                                  | "Nada em órbita hoje" |

Evento continua "evento" e tarefa continua "tarefa". Renomear o que o usuário faz 20
vezes por dia só cria atrito.

## Tokens

Três camadas, em `libs/design-tokens`, geradas para CSS custom properties e para
constantes TypeScript a partir de uma única fonte:

```
primitivos  →  semânticos  →  componente
#0B0D17        --surface-base    --calendar-grid-line
```

Componente consome **apenas** a camada semântica. Trocar de tema redefine os
semânticos; nenhum componente é tocado.

### Primitivos — paleta base

```css
/* Espaço profundo */
--space-900: #070812;
--space-800: #0b0d17;
--space-700: #13162a;
--space-600: #1c2038;
--space-500: #2a2f4a;

/* Poeira estelar (neutros frios) */
--dust-400: #4a5070;
--dust-300: #6e7595;
--dust-200: #9aa0bc;
--dust-100: #c9cde0;
--dust-000: #f4f5fa;

/* Acentos orbitais */
--nebula: #6d7cff; /* padrão */
--aurora: #4adebb;
--solar: #ffb357;
--pulsar: #ff6b8a;
--cosmos: #a97bff;
```

### Semânticos

```css
--surface-base      /* fundo da aplicação */
--surface-raised    /* cartões, painéis */
--surface-overlay   /* modais, menus */
--surface-sunken    /* grade do calendário */

--text-primary · --text-secondary · --text-muted · --text-on-accent

--border-subtle · --border-default · --border-focus

--accent · --accent-hover · --accent-muted · --accent-glow

--state-success · --state-warning · --state-danger
```

### Presets de tema

Cada preset redefine os semânticos. Quatro no MVP, escolhidos em `UserSettings.themePreset`:

| Preset    | Caráter                              |
| --------- | ------------------------------------ |
| `nebula`  | Escuro azul-violeta — o padrão       |
| `eclipse` | Escuro quase preto, máximo contraste |
| `dawn`    | Claro, quente, fundo creme           |
| `vacuum`  | Claro, neutro frio, mínimo           |

Além do preset, o usuário escolhe livremente a **cor de acento** (`accentColor`). Ela
entra como custom property no `<html>`, e as variações (`hover`, `muted`, `glow`) são
derivadas em OKLCH — espaço perceptualmente uniforme, o que mantém o contraste correto
para qualquer cor que o usuário escolher, inclusive amarelo. Com HSL, um acento amarelo
produziria texto ilegível.

### Densidade

`UserSettings.density` (0, 1, 2) altera um conjunto de tokens de espaçamento e a altura
das linhas da grade. Nenhum componente conhece a densidade; todos leem
`--space-unit` e `--row-height`.

## Camada de forma

A camada semântica cobre **cor**. A **forma** (cantos, sombras, vidro, brilho, estrelas, alvo de
toque) também é token, e parte dela é **escolha de quem usa**. A fonte é
`libs/design-tokens/src/lib/forma.ts`; o gerador a escreve no `:root` de `tokens.generated.css`.

| Token                                 | Valor                                                 | Quem decide                       |
| ------------------------------------- | ----------------------------------------------------- | --------------------------------- |
| `--r`                                 | `6px` (de 0 a 16)                                     | **a pessoa** (cantos)             |
| `--estrelas`                          | `1` ou `0`                                            | **a pessoa**                      |
| `--raio-p`, `--raio-m`, `--raio-tela` | `calc(var(--r) * 1 / 1.6 / 2.2)`                      | deriva de `--r`                   |
| `--r-ev`                              | `calc(var(--r) * 0.35)`                               | deriva de `--r`: **eventos**      |
| `--raio-pilula`                       | `9999px`                                              | fixo: círculo e pílula            |
| `--sombra-1`, `-2`, `-3`              | preto translúcido                                     | fixo (não muda com o tema)        |
| `--vidro-desfoque`                    | `6px`                                                 | fixo                              |
| `--brilho-destaque`                   | `0 0 14px` do `--accent` a 35%                        | acompanha o destaque              |
| `--fonte-mono`                        | `ui-monospace, 'SF Mono', Menlo, Consolas, monospace` | fixo: horas e números que alinham |
| `--alvo-toque`, `--alvo-toque-grosso` | `2rem` / `2.75rem`                                    | mouse / dedo                      |

**O evento é sempre mais reto que a moldura.** Os multiplicadores ficam em
`MULTIPLICADORES_DE_RAIO` (evento 0.35 < pequeno 1 < médio 1.6 < tela 2.2), e um teste garante a ordem:
é ela que quebra o "tudo arredondado" para qualquer valor de `--r` que a pessoa escolha.

`--estrelas` já liga e desliga o campo de estrelas do fundo (`.ceu` em `fundo-orbital.scss`). Os
componentes **ainda não** usam `--raio-*`: cada um migra no PR em que é redesenhado, apagando o CSS antigo
no mesmo PR (ver a especificação, seção 6.6).

## A guarda de estilo

Um token só protege o que o usa. Cor literal (`#6d7cff`, `rgb(...)`, `hsl(...)`, `oklch(...)`) ou
`border-radius` em medida fixa (`8px`, `0.5rem`) fora dos tokens deixa aquele pedaço de fora de qualquer
tema e de qualquer escolha de cantos, e a quebra só aparece quando alguém troca o tema.

- **Regras e testes:** `libs/design-tokens/src/lib/guarda-de-estilo.ts` (função pura, 34 testes).
- **Varredura:** `npm run estilo:verificar` percorre `apps/web/src` e sai com código 1 se achar algo. Roda no
  job `lint` do CI e no pré-commit.
- **Exceção justificada:** um comentário `estilo-literal: <motivo>` na linha, ou na de cima, libera **aquela
  linha**, e só ela. Hoje há uma: o `::backdrop` do diálogo, que não herda as variáveis CSS.
- **O que ela aceita:** `var(--...)`, `color-mix(...)`, `calc(var(--space-unit) * N)`, `50%` e `0`. Os
  raios em `calc(var(--space-unit) * N)` passam até serem migrados para `--raio-*`.
- **Falso positivo conhecido:** uma referência de template do Angular com nome só de dígitos hexadecimais
  (`#add`, `#bad`) parece uma cor. Use o marcador, ou escolha outro nome.

## Motion

### Princípios

1. **Arco, não linha.** Painéis e modais entram seguindo uma curva leve, coerente com a
   ideia orbital. Translação pura é o padrão de todo mundo; o arco é a assinatura.
2. **Nada demora.** Transições de UI entre 150 e 300 ms. Acima de 400 ms a interface
   parece lenta, e numa agenda o usuário repete as mesmas ações dezenas de vezes.
3. **Movimento informa.** Um evento criado entra com um pequeno brilho; um evento
   excluído encolhe e se dissolve. A animação diz o que aconteceu.
4. **Nunca bloqueia.** A interface responde ao clique imediatamente; a animação
   acompanha, não precede.

### Curvas

```ts
export const ease = {
  orbit: 'cubic-bezier(0.34, 1.26, 0.64, 1)', // elástico leve: entradas
  settle: 'cubic-bezier(0.22, 1, 0.36, 1)', // desaceleração: saídas, painéis
  linear: 'linear', // só para progresso e rotação contínua
};

export const duration = {
  instant: 100, // feedback de toque
  quick: 180, // hover, foco, checkbox
  base: 240, // modais, painéis, trocas de aba
  slow: 320, // troca de visão mês↔semana
};
```

### Momentos que recebem motion de verdade

| Momento                  | Animação                                                   |
| ------------------------ | ---------------------------------------------------------- |
| Troca mês ↔ semana ↔ dia | Grade se reorganiza com stagger por coluna, 320 ms         |
| Abrir detalhe do evento  | Cartão cresce da posição clicada (origem compartilhada)    |
| Criar evento             | Entra em arco a partir do cursor, com brilho que decai     |
| Arrastar evento          | Segue o ponteiro com leve atraso e sombra que cresce       |
| Concluir tarefa          | Risco que corre da esquerda, opacidade cai, item recolhe   |
| Linha de "agora"         | Ponto pulsando a cada 3 s, infinito                        |
| Carregamento             | Esqueleto com brilho orbital percorrendo, não spinner      |
| Navegação entre páginas  | View Transitions API, com fallback para Angular Animations |

### Acessibilidade do movimento

Duas chaves, e as duas valem:

```css
@media (prefers-reduced-motion: reduce) {
  /* reduz tudo a fades de 100 ms */
}
```

e `UserSettings.reducedMotion`, para quem quer desligar sem mexer no sistema. A
implementação centraliza isso num serviço Angular que retorna as durações já ajustadas —
nenhum componente decide isso sozinho, senão a opção vaza em algum lugar.

## Tipografia

- **Interface:** Inter variable, ou Geist. Tabular numbers ligado nas horas e nos dias
  do mês, para que os números não dancem ao mudar
- **Acento:** uma display com personalidade apenas no logo, nos títulos grandes e nos
  estados vazios — nunca em texto corrido
- Escala em `rem`, respeitando o tamanho de fonte do sistema

## Acessibilidade (não negociável)

- Contraste mínimo 4.5:1 em texto, 3:1 em elementos gráficos, verificado nos quatro
  presets — escuro bonito é o lugar onde contraste insuficiente mais acontece
- Cor nunca é o único portador de informação: evento de outra pessoa tem cor **e**
  avatar ou inicial. Sobrepor agendas por cor só exclui quem é daltônico
- Navegação completa por teclado, com atalhos: `T` hoje, `D`/`W`/`M` visões,
  `N` novo evento, `Cmd/Ctrl+K` paleta de comandos
- Alvos de toque de 44×44 px mínimo — a visão de mês no celular é o maior risco aqui
- Foco visível e consistente, usando `--border-focus`

### Contrastes já medidos, e um token que não serve para texto

Calculados sobre `space-800`, o fundo padrão do tema escuro. Não estimados: computados
pela fórmula de luminância relativa da WCAG.

| Uso              | Par                          | Razão    | AA texto (4.5:1) |
| ---------------- | ---------------------------- | -------- | ---------------- |
| Texto principal  | `dust-100` sobre `space-800` | 12.26    | ✅               |
| Texto secundário | `dust-200` sobre `space-800` | 7.50     | ✅               |
| Texto secundário | `dust-300` sobre `space-800` | **4.28** | ❌ **falha**     |
| Mensagem de erro | `solar` sobre `space-800`    | 10.92    | ✅               |
| Link             | `nebula` sobre `space-800`   | 5.51     | ✅               |
| Texto em botão   | `space-900` sobre `nebula`   | 5.68     | ✅               |
| Texto em campo   | `dust-100` sobre `space-700` | 11.30    | ✅               |

> **`dust-300` não é um token de texto.** Parece ser — é um neutro de meio-tom, e foi o
> que eu usei por reflexo nas primeiras telas de autenticação. Dá 4.28:1, que reprova.
> Serve para **bordas e divisores**, onde o mínimo é 3:1. Texto secundário é
> `dust-200`.
>
> Isto foi descoberto calculando, não olhando: a 4.28:1 o texto parece perfeitamente
> legível para quem tem visão boa num monitor bom. É exatamente o tipo de falha que a
> auditoria da Fase 7 encontraria tarde, com a interface inteira já construída em cima.

## Duas armadilhas do Angular 22 em estilo de componente

As duas foram encontradas lendo o CSS que o build emite, não a documentação — e as
duas afetam exatamente a arquitetura de tokens deste documento.

### Variáveis CSS em estilo de componente são renomeadas

O compilador reescreve **toda** variável em estilo de componente com um prefixo de
namespace: `var(--surface-base)` sai do build como `var(--%NS%surface-base)`.

Isso parece quebrar a camada semântica inteira, e não quebra: o renderizador substitui
`%NS%` por string vazia por padrão, então `--surface-base` resolve normalmente. O
namespace é opt-in, pensado para embutir a aplicação dentro de outra sem que os tokens
dos dois colidam.

> **O que isto custa, se um dia for ligado:** cada referência a um token global em
> estilo de componente passa a precisar do prefixo `--global--`
> (`var(--global--surface-base)`), que é o escape hatch que o compilador reconhece.
> Ligar o namespace sem reescrever essas referências deixaria a aplicação sem cor
> nenhuma, e o sintoma seria "o tema sumiu", não um erro.

### `@keyframes` só é escopado no nível superior

Um `@keyframes` declarado no topo do arquivo de estilo do componente sai do build como
`@keyframes _ngcontent-…_nome`. **Aninhado dentro de um `@media`, sai como
`@keyframes nome`** — global, e passível de colisão com qualquer outro componente que
use o mesmo nome.

A primeira versão da animação de entrada reduzida tinha o `@keyframes` dentro do bloco
de `prefers-reduced-motion`, e funcionava — porque uso e declaração ficaram os dois sem
prefixo. Funcionava por coincidência. Agora os keyframes ficam no nível superior e o
`@media` só redefine qual deles o elemento usa.

## Camada semântica: o que já existe

Implementada em `libs/design-tokens/src/lib/semanticos.ts`, com o preset `nebula`. Os
outros três são a Fase 4, e cada um vai passar pelo mesmo teste de contraste.

O gerador emite as duas nomenclaturas, com papéis diferentes:

| Saída                                 | Para quê                                                                      |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| `--surface-base`, `--text-primary`, … | o contrato do tema, com os nomes deste documento; usado em SCSS de componente |
| `--color-surface`, `--color-muted`, … | o `@theme` do Tailwind, que gera `bg-surface`, `text-muted`, `border-edge`    |

A segunda existe porque mapear `--text-primary` direto produziria a classe
`text-text-primary`. Verificado no CSS final, nos três níveis:

```
.text-danger{color:var(--color-danger)}
  --color-danger: var(--state-danger)
    --state-danger: #FF6B8A
```

### Duas atribuições que saíram de medir, não de escolher

- **`borderDefault` é `dust-300`, não `dust-400`.** O `dust-400` dá 2.47:1 contra a
  superfície base e reprova o mínimo de 3:1 de um contorno de componente. É o mesmo
  token que **não** serve para texto: bom para borda, ruim para letra.
- **`textOnAccent` é `space-900`, não `dust-000`.** Texto claro sobre o acento dá
  3.23:1 e reprova; texto escuro dá 5.68:1. Botão de acento leva letra escura, mesmo
  que o instinto diga o contrário.

## Componentes do MVP

Em `apps/web/src/app/ui`, construídos nesta ordem porque cada um depende dos anteriores:

**Base:** Button · Input · Select · Checkbox · Switch · Textarea · DatePicker ·
TimePicker · ColorPicker · Avatar · Badge · Tooltip · Dropdown · Modal · Sheet ·
Toast · Skeleton

**Do domínio:** CalendarGrid (mês) · TimeGrid (semana/dia) · EventChip · EventCard ·
TaskRow · OrbitPill (seletor de agenda) · MemberStack · ActivityItem · EmptyState ·
CommandPalette

## Componentes de formulário e de resposta

- **Entrada** (`.nb-entrada`, global em `styles.scss`): um campo só, no raio de forma (`--raio-p`) e com **16px**
  (abaixo disso o iPhone dá zoom ao focar). Borda de foco, `aria-invalid` em perigo, desabilitado apagado,
  `textarea` só cresce na vertical. As cópias locais `.entrada` foram removidas; não devem voltar.
- **Caixa** (`.nb-caixa`, global): checkbox e rádio com `appearance: none`, cantos a 60% do raio de forma
  (o rádio é círculo) e a cor vinda de `--c` (a cor da órbita) ou, sem ela, do destaque do tema. Substitui o
  `accent-color`.
- **Alternador** (`nb-alternador`): grupo de rádio de verdade (`radiogroup`/`radio`, `aria-checked`). Teclado
  como num grupo de rádio: só a escolhida entra no Tab; setas partem da opção **com o foco**, dão a volta nas
  pontas; Home/End; o foco acompanha.
- **Aviso** (`nb-aviso tipo="info|sucesso|perigo"`): o `role` vem do tipo (`alert` para perigo, `status` nos
  demais). Substitui os `<p role="alert" class="text-danger">` espalhados.
- **Toast** (`ToastService` + `nb-toasts` na raiz): confirmações curtas que somem sozinhas (4s; perigo 8s),
  repetido reinicia o tempo, no máximo 3. Substitui as linhas "Salvando…/Perfil salvo." das telas.

### Identidade e estrutura

- **Avatar** (`nb-avatar`, tamanhos `p`/`m`/`g` = 24/32/56px): iniciais num círculo na cor do destaque;
  decorativo (`aria-hidden`), o nome vem ao lado.
- **Etiqueta** (`nb-etiqueta`, tom `neutro`/`destaque`): rótulo curto em mono e caixa-alta ("Dono").
- **Estado vazio** (`nb-estado-vazio titulo="…"`): título e explicação centralizados.
- **Cabeçalho de página** (`nb-cabecalho-de-pagina`): o `h1` das telas de ajuste.
- **Cartão de seção** (`nb-cartao-de-secao`): `section` nomeada pelo título (`aria-labelledby`), no raio de tela.

## O motor de temas (funções puras)

Em `libs/design-tokens`, sem DOM: `oklch.ts` (sRGB ↔ OKLCH, com corte de croma na gama), `sementes.ts`
(`{ fundo, destaque, contraste }`, `modoDe`), `derivar.ts` e `temas-prontos.ts`.

`derivar(sementes)` devolve `{ tokens, avisos, modo }` com todos os tokens semânticos:

- **modo** sai da claridade do fundo (corte 0.6 em OKLCH); superfícies sobem em degraus (clareiam no escuro);
- **texto**: principal ≥ 7:1 (10:1 em contraste alto); apoio é o mais discreto que ainda passa o alvo;
- **destaque** mantido exatamente se legível (≥ 4.5:1 sobre as superfícies **e** com texto legível por cima);
  senão ajustado, com aviso. Hover afasta-se da frente; fundo de seleção é o mais sutil com tinta ≥ 1.25:1;
- **nunca recusa**: fundo de claridade média ou destaque igual ao fundo são ajustados e geram um aviso
  ("Ajustamos …"). Uma varredura de 288 combinações de fundo, destaque e nível confere os mesmos pares de
  contraste dos presets.

Os temas prontos (`nebula`, `eclipse`, `dawn`, `vacuum`) e os fundos (`noite`, `vazio`, `aurora`, `eclipse`)
são sementes; os valores de `eclipse`, `dawn`, `vacuum` e dos fundos são um primeiro palpite, ajustáveis.
O `nebula` derivado mantém fundo e destaque idênticos aos de hoje, mas os tons intermediários (texto de
apoio, bordas) não são os escritos à mão em `semanticos.ts`: só passam a valer quando a web usar o motor (PR F).

### O tema na conta e na web

- `UserSettings.appearance` (JSON, `temaSchema` em `libs/contracts`): `{ v, base, sementes, forma }`. Nulo numa
  conta ainda não migrada: a API deriva do par antigo (`temaLegado`); inválido: tema padrão. Escrever `tema`
  mantém `accentColor` em dia, e escrever só `accentColor` atualiza o destaque do tema (expandir/contrair: o par
  antigo sai numa migração própria, quando a web deixar de lê-lo).
- A web chama `derivar(sementes)` e escreve **todos** os tokens, mais `--r`, `--estrelas` e `color-scheme`, no
  `<html>`; o cache guarda esses valores. O CSS padrão (`tokens.generated.css`) é o nebula **derivado**, então
  não há troca visível no primeiro quadro. Ao sair, o tema da pessoa é tirado da página.
- A migração preenche `appearance` do par antigo: a conta com `themePreset: dawn` (Maria, no seed) passa a ter
  de fato o tema claro, que antes era ignorado.

## O catálogo vivo (`/design`)

Só em desenvolvimento: a constante de build `CATALOGO` (`define` no `project.json`) é `true` no build de
desenvolvimento e `false` na produção, e com ela falsa o bundler elimina o `import()` da rota.
`npm run catalogo:verificar` (roda no job `build` do CI) procura o catálogo no `dist` e reprova se ele estiver lá.

A página mostra cada componente em cada estado e tem controles de tema (pronto, fundo, destaque, contraste alto),
cantos e estrelas, que valem **só para a página** (não vão para a conta nem para o cache). Os avisos do motor
aparecem quando ele ajusta uma semente. O e2e (`catalogo.spec.ts`) visita cada tema pronto, com e sem contraste
alto, e roda **axe** (WCAG A/AA, `color-contrast` incluído); num build de produção os testes se pulam.

## Armadilhas de CSS que já custaram caro

Os testes de componente não enxergam CSS, e foi por isso que estes dois passaram por dezenas de
PRs com tudo verde. Cada um tem agora um teste e2e que mede o estilo **calculado** pelo navegador
(`apps/web-e2e/src/aparencia.spec.ts`).

- **Estilo de componente que usa `host` não alcança o hospedeiro.** `Botao` põe as classes `botao`
  e `botao--*` no próprio elemento (`host: { '[class]': ... }`). Com a encapsulação padrão do Angular,
  um seletor `.botao` é escopado ao _conteúdo_ do componente e nunca casa com o elemento hospedeiro:
  **nenhum botão do app tinha estilo**. A forma que casa é `:host(.botao)`. Regra: classe que o
  componente aplica em si mesmo se estiliza com `:host(...)`.
- **O reset do Tailwind zera a margem de todo elemento, inclusive a que centraliza o `<dialog>`.** O
  diálogo modal depende de `margin: auto` (com o `inset: 0` do navegador) para abrir no centro; sem ela
  ele abre colado no canto superior esquerdo. `dialogo.scss` devolve a margem.
- **Dois campos em colunas apertadas passam um por cima do outro.** Data e hora lado a lado em
  ~226px não cabem; o formulário de evento empilha Início e Fim e deixa a data crescer
  (`minmax(0, 1fr)`) com a hora em largura fixa.
- **`margin-top: auto` em vários irmãos divide o espaço livre entre eles.** Os links Perfil e
  Preferências tinham um `margin-top: auto` cada: um flutuava no meio da barra lateral e o outro
  ficava no rodapé. Quem empurra para baixo é o **grupo** (`.lateral-rodape`), uma vez.
- **Texto ao lado de um botão de texto disputa a largura da linha.** "Compartilhar" ao lado do nome da
  agenda reduzia o nome a "M…". Ações repetidas em lista são **ícones** com `aria-label` e `title`, e a
  largura fica com o conteúdo. O teste exige largura para "Minha agenda" (o nome padrão), e não só que
  cada nome caiba em si mesmo: os nomes curtos do seed passavam com a linha apertada.
- **Cabeçalho com vários grupos precisa saber quebrar.** Em tela estreita o topo passa para duas
  linhas (marca e conta em cima, navegação e visões embaixo); numa linha só a página rolava na
  horizontal.
- **Tamanho mínimo de texto na grade: 12px nos rótulos e 13px nos eventos.** Rótulos de hora em 11px
  e eventos em 12px eram pequenos demais para ler de relance numa grade densa. O e2e mede o
  `font-size` calculado, para um ajuste de estilo não encolhê-los de novo sem ninguém notar.
- **Estado vazio diz o que fazer.** "Nada em órbita por aqui." sozinho só informa; a segunda linha
  ("Clique num dia ou num horário para criar um evento.") dá o próximo passo.
- **Componente cujo conteúdo é "texto + campos + botão" precisa de `:host` com `gap`.** As seções
  do perfil projetam componentes filhos (`nb-troca-de-email`, `nb-sessoes-ativas`, `nb-apagar-conta`),
  e o `gap` do cartão vale só para filhos diretos: dentro do componente, o parágrafo ficava colado no
  campo seguinte. O teste mede o vão entre filhos consecutivos (mínimo de 12px).
- **Ação destrutiva tem aparência própria (`perigo`).** Contorno e texto em `--state-danger`, com o
  fundo só no hover. "Apagar minha conta" era um botão de contorno igual aos neutros, e nada avisava
  antes do clique. Fica com a largura do texto: em largura total pesaria mais que o "Salvar" ao lado.
- **Uma linha de estado que reserva altura abre um vão morto.** O "Salvando… / Perfil salvo." era
  irmã solta do título e, mesmo vazia, abria ~64px antes do primeiro cartão. Agora divide a linha com o
  título.

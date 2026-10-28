# 04 — Design System

Qualidade visual é requisito do Norbit, não acabamento. Por isso o sistema de tema é
planejado antes da interface: todo componente nasce consumindo tokens, nunca valores
cravados. Trocar de tema depois fica impossível se os componentes forem escritos com
cores literais.

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

# 13 — Visão de semana e dia

A grade de horas, com linha de agora e eventos simultâneos lado a lado. Com ela a Fase 2
fecha as visões que o roadmap pedia, menos a lista de próximos.

```
libs/domain/src/lib/calendario/
├─ grade-de-horas.ts   marcas de hora e posição de faixa, como fração do dia
├─ colunas.ts          eventos simultâneos, lado a lado
└─ navegacao.ts        andar no tamanho da visão

apps/web/src/app/calendario/
└─ visao-de-horas.ts   as duas visões, num componente só
```

Um componente para semana e dia: a diferença é a quantidade de colunas, e duplicá-lo
criaria dois lugares para corrigir o mesmo defeito de posicionamento.

## Um dia não tem sempre 24 horas

É a armadilha que justifica `grade-de-horas.ts` existir. Nos dois dias de virada de
horário de verão o dia tem 23 ou 25 horas, e a conta usual — minutos desde a meia-noite
dividido por 1440 — desloca tudo depois da virada. **Num dia de 23 horas, as 23:00
cairiam fora da grade.**

A referência aqui é sempre o tempo decorrido entre a meia-noite local e a meia-noite
local seguinte, que é a duração real daquele dia. A consequência visível é correta e
estranha: num dia de 25 horas as marcas de hora **não** ficam igualmente espaçadas, e o
meio-dia está a 13/25 do começo. Espaçar igual seria desenhar um dia de 24 horas e
colocar os eventos no lugar errado.

As duas horas difíceis também aparecem nas marcas:

| Situação                                           | O que a grade mostra                                                                |
| -------------------------------------------------- | ----------------------------------------------------------------------------------- |
| a hora que **não existe** (relógio salta)          | nenhuma marca — uma linha apontando para nada                                       |
| a hora que acontece **duas vezes** (relógio volta) | uma marca, na primeira passagem — duas linhas escritas "1h" seriam incompreensíveis |

A linha de agora usa `faixaNoDia` com um instante de duração zero: a posição de "agora" é
o mesmo cálculo de onde começa uma faixa. Refazê-lo à mão abriria espaço para a linha e as
faixas discordarem — justamente nos dias de virada.

## Eventos simultâneos

Duas reuniões das 9h às 10h não podem ser desenhadas uma sobre a outra. `distribuirColunas`
decide em que coluna cada uma entra e em quantas a vizinhança se divide.

Ele opera sobre a **geometria** — topo e altura, já calculados —, e não sobre instantes: é
a geometria que não pode se sobrepor na tela, e é nela que a altura mínima de um marco de
duração zero já está aplicada. Refazer a conta a partir dos instantes abriria espaço para
as duas discordarem.

As decisões:

- **Terminar exatamente onde o outro começa não é sobreposição.** Uma reunião das 9h às
  10h e outra das 10h às 11h são sequenciais; dividir a largura entre elas seria
  desperdício.
- **A vizinhança é transitiva, e a coluna é reaproveitada.** `A` cruza `B`, `B` cruza `C`,
  `A` não cruza `C`: os três formam uma vizinhança, mas `A` e `C` dividem a mesma coluna.
  Duas colunas, não três — com três, um terço da largura ficaria vazio o tempo todo.
- **A contagem é por vizinhança, não do dia.** Contar o dia faria o evento solitário da
  tarde aparecer com um terço da largura porque a manhã estava cheia.
- **Desempate pelo `id`**, senão as faixas trocam de coluna a cada renderização.

## Cada hora é um botão

A primeira versão era um `div` por coluna com `(click)`, e a hora saía da posição vertical
do cursor — arredondada para meia hora. Mais preciso para o mouse, e **inalcançável** para
quem navega por teclado. O lint apontou, e estava certo.

Agora cada hora é um `<button>` com rótulo "Criar evento às 14h de 15 de junho". Além de
acessível, ficou mais simples: a hora vem do botão, e não de uma conta de posição.

A altura de cada célula é a distância até a hora seguinte, e não 1/24 — nos dias de virada
as células precisam acompanhar as marcas, ou a grade mostra uma linha num lugar e aceita o
clique em outro.

> **Uma consequência aceita:** a faixa de um evento cobre a célula daquela hora, então não
> dá para clicar ali de novo para criar um segundo evento no mesmo horário. É o
> comportamento esperado de um calendário — não se clica "dentro" de um evento para criar
> outro —, e o caminho é criar numa hora livre e ajustar o horário no formulário.

## A linguagem: "o calendário como protagonista"

A semana e o dia seguem a [especificação do design system](superpowers/specs/2026-11-19-design-system-design.md):
a moldura é macia, o conteúdo é firme, o tempo tem hierarquia e o espaço é informação.

- **O evento é mais reto que a moldura.** O quadro usa `--raio-tela` (`--r` × 2,2) e o evento, `--r-ev`
  (`--r` × 0,35): com cantos de 6px, 13,2px e 2,1px; com 16px, 35,2px e 5,6px; com 0, tudo reto. O teste
  mede os três valores.
- **Barra de cor à esquerda.** 3px na cor da agenda (a mesma que a barra lateral mostra na caixa de
  seleção), com o fundo tingido a 17% sobre a superfície afundada. A cor chega ao CSS como a variável
  `--c` (`[style.--c]`), e **o CSS é quem calcula** a barra, o fundo e a cor do horário: o TypeScript deixou
  de carregar `color-mix` e de devolver `fundo` e `borda`. O evento de dia inteiro tem a mesma barra e o
  mesmo raio.
- **O horário em fonte monoespaçada** (`--fonte-mono`, da camada de forma), na cor da agenda, e o título em
  negrito.
- **O passado recua.** Uma camada translúcida cobre a coluna de cima até a linha de agora, e a coluna
  inteira num dia que já acabou; o futuro não é tocado. A regra é `fracaoDoPassado` (função pura, testada),
  e a camada tem `pointer-events: none`: **dá para criar um evento numa hora que já passou**, e há um teste
  que clica sob a camada.
- **Hoje brilha**, com `--brilho-destaque` no número e um gradiente suave na coluna.
- **O "agora" é uma órbita:** um anel de 11px com o miolo da cor do fundo e brilho, na ponta da linha.
- **A lua em cada dia**, ao lado do número, com a fase do dia (ver [24](24-lua.md)).
- **A grade ganhou a meia hora**: um tracejado no meio de cada hora.

Um defeito meu, achado olhando a tela com eventos reais: para o teste do passado usei um relógio fixo
(`page.clock.setFixedTime`), mas os eventos que o teste mede ele mesmo cria, porque os do seed são
relativos ao dia real em que a suíte roda.

## Onde a grade abre

A grade tem 24 horas e a janela mostra umas 13, então onde ela **abre** importa. Abrir à meia-noite
mostra oito horas em que quase ninguém marca nada e empurra o dia útil para baixo da dobra.

- **Com hoje na tela**, a linha de agora fica um terço abaixo do topo: o passado recente em cima e o
  que vem a seguir embaixo.
- **Sem hoje** (outra semana, outro dia), a grade abre às 7h, perto do topo.

A rolagem acontece quando **os dias da tela mudam**, e só então. Rolar de novo a cada minuto (a linha
de agora se move) ou a cada recarga de eventos tiraria a grade de debaixo de quem está usando; é por
isso que o efeito depende só de `dias()` e lê o resto sem rastrear (`untracked`).

O primeiro rótulo do eixo (a meia-noite, fração 0) não é desenhado: centrado no traço de cima da
grade, metade dele ficava para fora e cortada. O traço continua lá.

Os testes fixam o relógio (`page.clock.setFixedTime`): sem isso "perto da hora atual" dependeria da
hora em que a suíte roda, e à 0h30 o topo da grade **é** a hora atual.

## Dia inteiro vai para uma tira

Acima da grade, não dentro dela: um evento sem horário desenhado na grade de horas
ocuparia a coluna toda e esconderia o resto.

A tira reusa o empilhamento da visão de mês (`faixasDaSemana`): ela é uma semana de uma
linha só, e o problema de duas barras compartilharem um dia é o mesmo.

## Navegar anda no tamanho da visão

Mês anda mês, semana anda sete dias, dia anda um. Andar sempre em dias faria a seta do mês
parar em 30 de janeiro e depois em 2 de março.

A aritmética virou `avancarPeriodo`, em `libs/domain`, porque tem um caso que se erra
calado: **somar um mês a 31 de janeiro não tem resposta boa.** 28 de fevereiro perde
informação; 3 de março muda de mês. Na visão de mês o dia da referência não é usado — o
que importa é o par ano/mês —, então ele volta para o dia 1º, que é a resposta que não
inventa nada.

**A data de referência é uma só, comum às três visões.** Trocar de visão mantém a pessoa
onde ela estava, que é o comportamento esperado — e dois estados concordando é a forma mais
fácil de eles discordarem.

### O tipo `DataCivil` passou a ser exportado

Só o tipo. As funções de aritmética (`somarDias`, `diasNoMes`) seguem internas, pela razão
registrada no índice da lib: expô-las convidaria a interface a fazer conta de calendário
por conta própria. Um tipo não faz conta, e sem ele a interface não tem como nomear o que
recebe.

Foi o que permitiu `avancarPeriodo` existir em vez de exportar `somarDias` — a página pede
a operação que ela quer, não a ferramenta para montá-la.

## O que foi verificado

**55 testes novos em `libs/domain`**, escritos antes e verificados por mutação: 15
defeitos plantados, 15 pegos. Dois deles só foram pegos depois de um teste ser reescrito:

**1. A borda da vizinhança de colunas.** Com dois eventos sequenciais, tratar a borda como
sobreposição dá a mesma resposta — a vizinhança tem uma coluna nos dois casos. A diferença
aparece com um terceiro: `a` seria arrastado para o grupo de `b` e `c` e apareceria com
metade da largura sem ter vizinho nenhum.

**2. O marco exatamente na meia-noite.** O teste de duração zero usava meio-dia, onde as
duas implementações coincidem. Na meia-noite, a regra geral ("termina na meia-noite que
abre o dia → é do dia anterior") excluiria o marco dos **dois** dias, e ele desapareceria.

**3. O recuo da semana com resto negativo.** `diasDaSemanaDe` precisa do `+ 7` antes do
módulo, e todos os meus casos tinham `inicioDaSemana <= dia da semana`. O caso que expõe é
um domingo com a semana começando na segunda: sem o `+ 7`, a semana começaria no dia
seguinte à data pedida.

**11 testes de ponta a ponta** cobrem a costura, incluindo um que mede as caixas de duas
faixas simultâneas para provar que elas ficam lado a lado sem se sobrepor.

> Duas correções na suíte, as duas pela mesma causa: `innerText()` não tem auto-retry.
> Lido logo depois de um clique, devolve o estado anterior — e o teste falha com um valor
> que _parece_ resultado de um defeito de navegação. Agora há um ajudante que clica e
> espera a mudança.

## Uma pendência de desempenho, medida

O teste que exercita o limite de expansão (`LIMITE_DE_PERIODOS = 20 000`) **quebrou no
CI** neste PR, por tempo: ~1 s nesta máquina, **7,4 s** no runner com `--coverage`, contra
os 5 s do padrão do vitest. Não foi regressão — ele sempre esteve nessa borda, e passava ou
falhava conforme a máquina do dia. Ganhou prazo explícito, com o motivo escrito ao lado.

O prazo resolve o teste e **não** resolve a causa: a expansão percorre todos os períodos
desde o **início da série**, não desde a janela consultada. Uma série diária criada em 2020
e consultada em 2035 paga cerca de 5 500 iterações por consulta, cada uma com conversões de
fuso. Hoje é imperceptível; não será.

A correção é pular direto para a janela quando a regra permite — o que exclui séries com
`COUNT`, porque a contagem é da série e não do intervalo (ver [08](08-recorrencia.md)).
Fica como entrega própria, com medição antes e depois.

> Um ganho veio junto, e esse era meu: `horaDe` construía um `Intl.DateTimeFormat` a cada
> chamada — 168 por renderização de semana. Agora é cacheado por fuso, pelo mesmo motivo
> registrado em `tempo/zona.ts`.

## O que ainda não existe

- **Lista de próximos**, a quarta visão do roadmap.
- **Arrastar para criar.** Mover e redimensionar existem: [23](23-arrastar-eventos.md).
- **A visão de dia como padrão no celular** — ela existe, mas a escolha ainda é manual.
- **`UserSettings.defaultView` e `weekStartsOn`**: o banco os tem, a API não os expõe.
  A tela abre no mês e começa a semana no domingo.

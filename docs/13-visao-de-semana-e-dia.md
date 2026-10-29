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

## O que ainda não existe

- **Lista de próximos**, a quarta visão do roadmap.
- **Arrastar** para criar, mover e redimensionar.
- **A visão de dia como padrão no celular** — ela existe, mas a escolha ainda é manual.
- **`UserSettings.defaultView` e `weekStartsOn`**: o banco os tem, a API não os expõe.
  A tela abre no mês e começa a semana no domingo.
- **Rolar até a hora atual** ao abrir: hoje a grade começa à meia-noite.

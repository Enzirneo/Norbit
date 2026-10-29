# 08 — Recorrência

A primeira entrega da Fase 2, e a que o [roadmap](05-roadmap.md) marca como o risco da
fase: _"é onde quase todo projeto de calendário erra"_. Por isso ela vem antes de
qualquer tela — com a interface pronta, a tentação de "resolver no front" é grande e o
resultado divergente.

O código é puro, vive em `libs/domain` e é compartilhado pelo servidor e pelo navegador.
Nada aqui conhece banco, Nest ou Angular.

```
libs/domain/src/lib/
├─ tempo/zona.ts            hora de parede ↔ instante, num fuso IANA
└─ recorrencia/
   ├─ rrule.ts              leitura do subconjunto de RRULE que o produto oferece
   ├─ civil.ts              aritmética de data civil (interno)
   └─ expandir.ts           de uma regra para as ocorrências de um intervalo
```

## O risco real não é o RRULE: é fuso horário

A regra em si é simples de iterar. O que quebra implementações é que **"toda terça às
9h" significa 9h locais** — e o banco guarda UTC.

Uma expansão feita em UTC mantém o mesmo instante e, depois de uma virada de horário de
verão, o evento passa a acontecer às 8h ou às 10h. É por isso que `Event` guarda
`timeZone` além do UTC (ver [03](03-modelo-de-dados.md)), e por isso o raciocínio todo
acontece em data civil e hora de parede, convertendo para instante só no fim.

Sem biblioteca de datas: o `Intl` do runtime já carrega a base IANA, que é quem sabe
quando cada país mudou de regra. Fixar uma tabela de offsets seria garantir erro na
próxima vez que algum governo alterar o calendário — o que acontece todo ano em algum
lugar.

### As duas horas difíceis, e a política de cada uma

Converter hora de parede para instante não tem solução direta: para saber o
deslocamento preciso-se do instante, e para achar o instante preciso-se do
deslocamento. A saída é amostrar os dois lados da virada e gerar um candidato com cada
deslocamento.

| Candidatos válidos | Situação                                       | Política                                                                        |
| ------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------- |
| os dois            | a hora acontece **duas vezes** (relógio volta) | o **primeiro**, porque quem marcou 01:30 quis dizer "assim que der 01:30"       |
| um só              | hora normal                                    | ele                                                                             |
| nenhum             | a hora **não existe** (relógio salta)          | **empurra para frente**: 02:30 num dia que salta de 02:00 para 03:00 vira 03:30 |

Recusar a hora inexistente faria um evento semanal àquele horário desaparecer uma vez
por ano, sem explicação para quem o criou.

> Uma primeira versão fazia duas passadas com palpite e, no caso da hora inexistente,
> empurrava para **trás** — 02:30 virava 01:30. O teste apontou. Olhando o código
> depois, o comentário afirmava o contrário do que ele fazia.

## O subconjunto de RRULE, e o que é recusado

Suportado: `FREQ` (`DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`), `INTERVAL`, `BYDAY` (com ou
sem ordem, como `2TU` e `-1FR`), `BYMONTHDAY` (inclusive negativo), `COUNT`, `UNTIL`.

Recusado com erro: `BYSETPOS`, `BYWEEKNO`, `BYYEARDAY`, `BYHOUR`, `BYMINUTE`,
`BYSECOND`, `BYMONTH`, `WKST`, e qualquer parâmetro desconhecido.

**O princípio é recusar, nunca ignorar.** Um `BYSETPOS` descartado em silêncio geraria
ocorrências diferentes das que a pessoa pediu, e o sintoma seria "o evento aparece no
dia errado" — sem nada no log. Falhar na gravação é muito mais barato.

`WKST` entra nessa lista: a semana começa na segunda, fixo. Mudar o início da semana
muda qual semana contém um dia, então assumir em silêncio seria alterar o significado
da regra.

## Decisões da expansão

### `COUNT` conta a série, não o intervalo consultado

`COUNT=3` são três ocorrências na vida da série. Consultar o quarto mês não "renova" a
contagem. É um erro fácil de cometer e difícil de notar, porque a visão de um mês
isolado pareceria correta.

### A exclusão vem depois da contagem

`COUNT=4` com duas datas excluídas dá **duas** ocorrências, não quatro. A contagem
pertence à regra; a exclusão é posterior. Devolver a vaga para a contagem faria o
"excluir só este" empurrar a série para frente.

### Mês sem o dia pedido é pulado, não aproximado

`BYMONTHDAY=31` não gera nada em fevereiro, abril, junho, setembro e novembro — como a
RFC manda. Aproximar para o dia 30 ou 28 inventaria um compromisso num dia que a pessoa
não escolheu.

### Sobreposição, não contenção — num intervalo semiaberto

A consulta de intervalo devolve a ocorrência que **cruza** o intervalo, não só a que
começa dentro dele. A viagem de uma semana que começou no mês passado tem de aparecer na
visão deste mês.

O intervalo é semiaberto: `[de, ate)`. A primeira versão fechava a borda de baixo
(`fim >= de`), e isso só ficou visível quando o evento de dia inteiro passou a ter fim
exclusivo (ver [09](09-agendas-e-eventos.md)): o dia inteiro do dia 15 termina exatamente
na meia-noite que abre o 16, e aparecia nas duas visões. Dois dias consecutivos não podem
reivindicar o mesmo instante.

O marco de duração zero é a exceção, e está escrito como tal: `fim > de` o descartaria do
intervalo que começa nele, e um evento sem duração ("entrega do relatório") não apareceria
em visão nenhuma. Tratado como ponto, ele cai em exatamente um dos dois intervalos
vizinhos.

### Duração exata, e não de parede

As duas interpretações são indistinguíveis no caso comum: um evento de 09:00 às 10:00
continua de 09:00 às 10:00 locais depois da virada, porque as duas pontas deslocam
juntas.

Elas só divergem num evento que **atravessa** a virada, e aí a escolha é a duração
exata, como a RFC 5545 define para evento com hora e `DTEND`: uma reunião de três horas
continua de três horas. O efeito visível é que, na noite em que o relógio volta, ela
termina uma hora mais cedo no relógio — 23:00 às 01:00 em vez de 23:00 às 02:00.

> **Esta decisão nasceu de um teste ruim.** O teste que eu havia escrito para "duração
> nominal" passava com as duas implementações, porque usava um evento de uma hora que
> não atravessa virada nenhuma. Descobri plantando o bug de propósito e vendo o teste
> passar. O teste atual usa um evento de sábado 23:00 a domingo 02:00 na noite da virada,
> e aí as duas respostas diferem: 06:00Z para duração exata, 07:00Z para duração de
> parede.

### Data de início que não casa com a regra

A regra manda. Um evento que começa numa segunda com `BYDAY=TU` não tem ocorrência na
segunda. A interface sempre monta a regra a partir da data de início, então isso só
acontece com regra escrita à mão.

### Teto de expansão

20.000 períodos examinados por expansão. Sem isso, uma série diária consultada por mil
anos travaria o servidor. O erro é explícito, para que a causa apareça no log em vez de
virar um tempo de resposta inexplicável.

## As três operações que o usuário espera

| Operação            | Como é resolvida                                              |
| ------------------- | ------------------------------------------------------------- |
| **Editar todos**    | altera a linha-mãe; a expansão passa a usar a regra nova      |
| **Excluir só este** | a data entra em `excludedDates`, e a expansão a remove        |
| **Editar só este**  | uma linha filha com `recurrenceParentId` e `originalStartsAt` |

A terceira depende do campo `inicioOriginal` que cada ocorrência carrega: é a identidade
dela, e é por ele que a exceção se refere à instância que substitui.

> **A escrita existe.** As rotas que criam a linha de exceção e que suprimem a instância
> substituída foram entregues junto com o CRUD de eventos — ver
> [09](09-agendas-e-eventos.md). `excludedDates` e `originalStartsAt` são mecanismos
> separados de propósito: um é a exclusão, o outro é a substituição, e separá-los é o que
> permite desfazer um sem o outro.

## O que os testes cobrem

55 testes em `libs/domain`, todos escritos antes da implementação.

| Área     | Casos                                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Fuso     | horário padrão, horário de verão, fuso sem DST, a hora que não existe, a hora que acontece duas vezes, travessia de meia-noite, ida e volta |
| RRULE    | cada parte aceita, e cada recusa — incluindo `COUNT` com `UNTIL` juntos                                                                     |
| Expansão | as quatro frequências, intervalo, ordem no mês, último dia, mês sem o dia, limites, exclusão, identidade, sobreposição, teto                |

### Os testes foram verificados por mutação

Escrever o teste antes não garante que ele pegue algo. Plantei defeitos de propósito:

| Defeito plantado                         | Resultado                                                   |
| ---------------------------------------- | ----------------------------------------------------------- |
| Contagem reiniciando dentro do intervalo | **7 testes falharam**                                       |
| Duração por instante em vez de parede    | **nenhum teste falhou** → o teste era ruim, e foi reescrito |
| Duração de parede em vez de exata        | **1 teste falhou**, com os dois instantes na mensagem       |

O segundo é o achado que importa: um teste verde que não distinguia as implementações.

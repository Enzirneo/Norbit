# 10 — Tarefas

A API das tarefas, que fecha o modelo de dados da Fase 2: criar, concluir, aninhar em um
nível, filtrar e **reordenar à mão**. Mesma forma de [09](09-agendas-e-eventos.md) — a
autorização é a mesma matriz, e a parte nova é a ordenação.

```
libs/domain/src/lib/tarefas/
└─ ordenacao.ts            posição fracionária, e quando ela acaba

apps/api/src/app/tarefas/
├─ tarefas.service.ts      CRUD, conclusão, subtarefas, responsável
├─ posicionamento.service.ts  onde a ordenação encontra o banco
├─ visivel.ts              da linha para a resposta
└─ tarefas.controller.ts
```

## A ordenação manual, e o limite da afirmação do schema

`Task.position` é `Float`, e o comentário no `schema.prisma` diz por quê: inserir entre
dois itens é **uma** escrita, e não uma reindexação da lista. Isso é verdade, e tem um
ponto de ruptura.

Arrastar sempre para a mesma fenda divide o intervalo pela metade. Entre 50 e 70
inserções no mesmo lugar, com `PASSO` de 1024, não existe mais `double` representável
entre os dois vizinhos — e a média **arredonda** para um deles.

O modo de falha, se ninguém verificar, é silencioso: duas tarefas com a mesma posição, e
a lista passa a mudar de ordem sozinha a cada recarga, porque o desempate é o que o
Postgres resolver devolver naquele dia.

Por isso `posicaoEntre` não devolve um número. Devolve uma **decisão**:

```ts
type Reordenacao = { tipo: 'posicao'; valor: number } | { tipo: 'renumerar' };
```

Quando o espaço acaba, o serviço renumera as irmãs — numa transação, porque uma
renumeração pela metade deixa a lista em ordem arbitrária, que é pior que a lista
apertada de antes.

### Três decisões menores, cada uma com motivo

- **A primeira tarefa nasce em `PASSO`, não em zero.** Deixar espaço antes do primeiro
  item é o que permite arrastar algo para o topo depois sem renumerar nada.
- **No topo, recua um passo em vez de dividir por dois.** A posição pode ser negativa, e
  `proxima / 2` andaria no sentido **errado** para valores negativos. Posição negativa é
  legítima: a ordem é relativa, e `0` não é um piso.
- **Vizinhos fora de ordem lançam erro.** Chutar uma posição ali esconderia o defeito de
  quem chamou e produziria uma lista fora de ordem.

### O cliente manda vizinhos, não posições

`PATCH /tarefas/:id/posicao` recebe `{ anteriorId, proximaId }`.

Calcular a posição no navegador espalharia essa aritmética — e o limite dela — por cada
cliente. O primeiro que errasse gravaria duas tarefas na mesma posição, e o sintoma
("a lista muda de ordem sozinha") não apontaria para o cliente que causou.

É também por isso que reordenar é uma rota **separada** da alteração de campos: ela pode
renumerar a lista inteira como efeito, e misturar isso com "mudar o título" faria uma
rota que às vezes escreve vinte linhas sem o cliente saber por quê.

### "Irmãs" é a mesma agenda **e** a mesma mãe

Uma subtarefa é ordenada dentro da mãe, não na lista de cima. Sem isso, arrastar uma
subtarefa mexeria na ordem das tarefas principais.

E o filtro de mãe faz mais do que ordenar: é ele que recusa uma tarefa principal como
vizinha de uma subtarefa. Sem ele, a subtarefa receberia uma posição calculada contra
outra lista e apareceria em lugar nenhum previsível.

## Prazo de dia inteiro: fim exclusivo

`dueAt` com `isDueAllDay` é guardado como o **fim exclusivo** do dia, no fuso da agenda —
a mesma regra dos eventos de dia inteiro. Em São Paulo, "dia 15" vira `2026-06-16T03:00Z`.

A razão é a comparação: **"está atrasada" é `dueAt <= now()`**, exato, sem ajuste nenhum.
A alternativa — guardar o começo do dia — exigiria somar um dia em toda consulta, e é o
tipo de ajuste que alguém esquece de repetir numa query nova. Guardar a forma que torna o
SQL trivial vale mais que poupar uma subtração no cliente.

Para exibir a data, a interface usa o dia local de `dueAt - 1ms`.

### A idempotência importa aqui também

`fimExclusivoDoDia` trata um instante que **já** é meia-noite local como o limite
exclusivo que ele é, em vez de adiar mais um dia. Sem isso, um PATCH que não mexe no
prazo empurraria a tarefa um dia para frente a cada salvamento — e ninguém notaria até
reclamarem que a tarefa "nunca fica atrasada".

A função é separada da normalização de evento por um detalhe: o evento tem **piso de um
dia**, porque um evento de duração zero não serve. Um prazo não tem duração, e para ele a
meia-noite do dia 15 fecha o dia 14 — o que é o correto.

## Subtarefas: um nível, e por quê

Subtarefa de subtarefa é recusada. O banco aceita profundidade qualquer (`parentTaskId` é
auto-relação), e aceitar também significaria construir uma interface de árvore e abrir
espaço para ciclo.

**Com um nível, o ciclo é impossível por construção:** se a mãe nunca tem mãe, não existe
caminho de volta. Verificar ciclo em árvore livre exigiria percorrer a cadeia a cada
escrita, e o custo de errar é uma listagem que entra em laço.

O limite tem dois lados, e os dois são verificados:

- uma tarefa que já é subtarefa não pode ser mãe;
- uma tarefa **com** subtarefas não pode virar subtarefa — permitir empurraria as filhas
  para o segundo nível por via indireta, sem passar por validação nenhuma.

### Excluir a mãe leva as filhas

O `onDelete: Cascade` do banco só vale para exclusão **física**, e aqui a exclusão é
lógica. Sem levar as filhas junto, elas continuariam na listagem apontando para uma mãe
que já não aparece: subtarefa órfã, que a interface não sabe onde desenhar.

## As outras decisões

| Decisão                                               | Motivo                                                                                                                                                                                        |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Concluir é booleano na entrada, instante no banco** | a data alimenta o "concluída hoje", e o cliente não tem relógio confiável para decidir qual dia foi                                                                                           |
| **Concluídas ficam fora da listagem por padrão**      | uma lista de tarefas que nasce cheia de coisa resolvida não é uma lista de tarefas                                                                                                            |
| **`incluirConcluidas` só aceita `true`/`false`**      | parâmetro de rota é texto; aceitar qualquer coisa e tratar como falso faria `incluirConcluidas=1` virar um filtro que não faz nada e ninguém entende por quê                                  |
| **O responsável tem de ser membro da agenda**         | atribuir a quem não vê a agenda cria uma tarefa que o responsável nunca encontra — e quem atribuiu acha que delegou                                                                           |
| **A lista vem plana, com `parentTaskId`**             | a profundidade é de um nível, então agrupar no cliente é uma linha; e plano não duplica a mãe nem obriga a inventar outro formato quando a tela quiser ordenar tudo por prazo                 |
| **`position` só é comparável entre irmãs**            | cada mãe tem a numeração dela, e a lista chega ordenada por posição sem separar níveis — renderizar na ordem recebida, sem agrupar por `parentTaskId` primeiro, produz uma árvore embaralhada |
| **`PRIVATE` filtrado na query**                       | igual aos eventos, e pelo mesmo motivo: filtrar depois deixa o dado passar pela aplicação                                                                                                     |

## As rotas

| Método | Rota                                                         | Exige            |
| ------ | ------------------------------------------------------------ | ---------------- |
| GET    | `/api/tarefas?agendas=…&incluirConcluidas=…&responsavelId=…` | sessão           |
| POST   | `/api/agendas/:id/tarefas`                                   | `criar-tarefa`   |
| PATCH  | `/api/tarefas/:id`                                           | `editar-tarefa`  |
| PATCH  | `/api/tarefas/:id/posicao`                                   | `editar-tarefa`  |
| DELETE | `/api/tarefas/:id`                                           | `excluir-tarefa` |

### A matriz ganhou ações, não exceções

`criar-tarefa`, `editar-tarefa` e `excluir-tarefa` entraram na
[matriz de permissões](09-agendas-e-eventos.md#autorização-uma-tabela-um-lugar) ao lado
das de evento, com as mesmas linhas. Reusar `criar-evento` para uma tarefa seria uma
mentira no código; um `criar-conteudo` genérico pouparia duas strings e custaria a
mensagem de recusa, que hoje diz **qual** das duas coisas a pessoa tentou mexer.

O **alcance** (próprios versus quaisquer) continua sendo um só, porque a regra hoje é a
mesma. A `acao` está na assinatura de `podeNoItem` justamente para que o dia em que as
duas divergirem seja uma alteração naquela função, e não uma função nova solta em algum
controller.

## O que foi verificado, e o que isso encontrou

A ordenação foi escrita com teste antes e verificada por mutação. Seis defeitos plantados,
seis pegos — incluindo o que importa: **remover a verificação de espaço** faz dois testes
falharem, um deles o que insere repetidamente na mesma fenda até o `double` acabar.

Nos testes de integração, nove mutações. Quatro foram pegas de primeira; **cinco não**, e
três delas eram mutações inválidas (não compilavam — um import ou uma variável ficava
sem uso, e o relatório diz "0 testes" em vez de "nenhum teste falhou"). As outras duas
eram lacunas reais:

**1. `entra no fim da lista` não distinguia "primeira" de "última".** Com duas tarefas,
pegar a primeira irmã em vez da última dá a mesma resposta. A terceira é que separa — ela
colidiria com a segunda. O teste foi reescrito com três.

**2. O filtro de mãe nas irmãs passava verde sem estar lá.** O teste de reordenar
subtarefa ainda saía com a ordem certa, por acidente: a subtarefa ganhava posição `0`, que
por sorte ficava antes da irmã. O que o filtro realmente protege é outra coisa — aceitar
uma tarefa **principal** como vizinha de uma subtarefa. Esse teste veio depois, e é ele
que pega a mutação.

> As duas são a mesma lição do PR anterior, de outro ângulo: um teste verde não diz nada
> até alguém plantar o defeito; e quando a mutação passa, a primeira pergunta é se ela foi
> mesmo aplicada e compilou.

## O que ainda não existe

- **Tarefa recorrente.** `Task.recurrenceRule` está no banco, e o contrato **não aceita o
  campo** — de propósito. Aceitar um campo que o servidor não honra é a mesma armadilha do
  `PRIVATE` que não escondia nada. Quando entrar, a decisão a tomar é o que "concluir"
  significa numa série: rolar o prazo para a próxima ocorrência, ou fechar aquela e abrir
  outra linha.
- **Etiquetas** (`Tag`, `TaskTag`) e **lembretes** (`Reminder`): no banco, sem rota.
- **Qualquer tela.** Como em [09](09-agendas-e-eventos.md), esta entrega é só a API — e
  com ela a Fase 2 fecha tudo o que não é interface.

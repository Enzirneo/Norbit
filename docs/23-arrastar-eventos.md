# 23 — Mover e redimensionar eventos arrastando

Na grade de horas ([13](13-visao-de-semana-e-dia.md)), um evento pode ser **movido** (arrastar o corpo,
para outro horário ou outro dia) e **redimensionado** (arrastar a alça da borda de baixo, para mudar o
fim). Criar arrastando ainda não existe: criar continua sendo clicar numa hora.

```
libs/domain/src/lib/calendario/
└─ arrastar.ts          a conta: instante sob o ponteiro, mover, redimensionar, célula da grade

apps/web/src/app/calendario/
├─ gesto-de-arrasto.ts  a máquina de estados do gesto (clique ou arrasto), sem DOM
├─ apoio-da-grade.ts    rótulos e formatação da grade, tirados do componente
└─ visao-de-horas.ts    liga o ponteiro ao gesto e desenha o horário provisório
```

## A conta é de tempo decorrido, não de linhas da tela

O ponteiro vira um **instante**: `celulaDaGrade` acha a coluna e a fração do dia, e `instanteNaGrade`
traduz a fração em tempo real sobre a duração daquele dia. É a inversa de `faixaNoDia`, e vale a mesma
armadilha: num dia de 23 ou 25 horas a fração não é sobre 24 horas. O teste usa a virada de Nova York
(a metade do dia de 23 horas é 12h30) e a mutação que fixa 24 horas foi pega.

O deslocamento é a diferença entre o instante de agora e o de quando se pegou o evento. Por ser tempo
decorrido, atravessar dias e dias de virada não pede nenhuma conta especial.

**O que é arredondado ao passo de 15 minutos é o deslocamento, não o instante resultante.** Um evento
das 9h05 movido uma hora vai para 10h05, não para 10h00. Arredondar o resultado desalinharia o evento de
si mesmo a cada gesto, e um tremor do mouse mudaria o horário de quem nem quis arrastar. Dois testes
travam isso (o evento fora do passo, e o deslocamento menor que meio passo).

Redimensionar mexe só no fim, e **nunca abaixo de um passo de duração**: um evento que encolhe até virar
nada some da grade, e arrastar para cima do início o faria acabar antes de começar. Um marco de duração
zero que não foi arrastado continua marco.

## Clique ou arrasto

O botão do evento ainda abre o formulário ao ser clicado. `GestoDeArrasto` só vira arrasto depois de o
ponteiro andar 4 px; antes disso é um clique e nada acontece. Passado o limiar:

- o horário provisório aparece na grade na hora (o próprio evento muda de lugar, e o texto da faixa
  mostra "09:00 – 10:00" enquanto dura o gesto), recalculando as colunas dos simultâneos;
- ao soltar, o clique que o navegador dispara é **engolido**, senão todo arrasto terminaria abrindo o
  formulário. A escuta sai no turno seguinte, para não engolir um clique legítimo logo depois;
- **Esc desiste**: o horário volta, nada é gravado e o clique do fim também é engolido;
- arrastar e voltar ao ponto de partida não grava nada.

## O que é gravado

`CalendarioService.reagendar` faz um `PATCH` com o novo início e fim. Numa **série** vale **só esta
ocorrência**: é o mesmo caminho do formulário com o escopo "este evento" — destacar a ocorrência e alterar
a exceção, **sem a regra**, ou nasceria uma segunda série paralela. Arrastar uma ocorrência não reescreve
a série inteira sem a pessoa ter pedido; para isso existe o formulário.

A página recarrega as ocorrências nos dois desfechos: se deu certo, para mostrar o que o servidor guardou;
se falhou, para a tela voltar ao que de fato existe, com a mensagem "Não foi possível mudar o horário do
evento". O horário provisório fica até as ocorrências novas chegarem, para o evento não voltar ao lugar
antigo por um instante antes de pular para o novo.

## Quem pode arrastar

A tela consulta a mesma matriz de papéis da API (`podeNoItem`, ação `editar-evento`): dono e editor
arrastam qualquer evento da agenda, o colaborador só os que criou, quem só vê não arrasta nada — e não vê a
alça. A API continua sendo a barreira; a tela só não oferece o que seria recusado.

Num evento de **vários dias**, qualquer trecho pode ser pego para mover, mas a **alça só aparece no
trecho onde o evento termina**: esticar o primeiro mexeria num fim que ele não mostra.

## Decisões de escopo

- **O toque fica de fora.** Arrastar com o dedo brigaria com a rolagem da grade; o mouse e a caneta
  arrastam. Quem não usa o ponteiro tem o formulário: clicar no evento abre os campos de início e fim, o
  que também cobre o requisito de ter alternativa a arrastar (WCAG 2.5.7).
- **Eventos de dia inteiro e a visão de mês não arrastam.** Não há grade de horas onde soltá-los.
- **Só a borda de baixo redimensiona.** Mudar o início sem mover é a alça de cima, que não existe ainda.

## Como foi verificado

- 25 testes de domínio (`arrastar`), incluindo o dia de 23 horas, o deslocamento fora do passo e a célula
  fora da grade; 9 do gesto, 3 do serviço HTTP, 6 do componente (a matriz de papéis e o evento de vários
  dias) e 6 e2e com o ponteiro de verdade (arrastar grava e não abre o formulário; a alça muda só o fim; o
  clique ainda abre; Esc desiste; arrastar para o lado muda o dia; numa série só a ocorrência muda).
- Mutação, todas pegas: sem arredondar ao passo, sem duração mínima, fração sobre 24 horas fixas, coluna
  sem recorte, sem limiar, soltar entregando sem mudança, exceção nascendo com a regra, série sem destacar,
  colaborador arrastando o que não criou, todo papel como dono, alça em todo trecho, clique não engolido e
  Esc que não desiste. Duas mutações não valiam (não compilavam) e foram refeitas, e a da alça por trecho
  só foi pega depois de eu escrever o teste do evento de vários dias.
- Um defeito do **teste**, não do produto: o e2e da série recarregava a página assim que a faixa mostrava
  o horário provisório, abortando o segundo dos dois pedidos em voo. Agora ele espera a resposta da
  gravação. A API e a tela estavam corretas (conferi os pedidos e as respostas).

## O que ainda não existe

- **Criar arrastando** (selecionar um intervalo vazio da grade).
- **Alça de cima** e **mover entre agendas**.
- **Arrastar no toque**, provavelmente com pressão longa.
- **Rolar a grade sozinha** quando o ponteiro chega à borda durante o arrasto.
- **Desfazer** o último arrasto, e **atalhos de teclado** para mover e redimensionar.

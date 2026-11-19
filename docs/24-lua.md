# 24 — A lua

A fase da lua é **informação** no calendário, e não enfeite: em cada dia, a fase; num cartão, o nome e
quanto dela está iluminada. A conta e o desenho entraram num PR sem uso na tela; a **semana e o dia** já mostram a lua em cada dia (ver
[13](13-visao-de-semana-e-dia.md)). O mês e o cartão da barra lateral vêm no PR B da
[especificação](superpowers/specs/2026-11-19-design-system-design.md).

```
libs/domain/src/lib/calendario/
└─ lua.ts        a fase, o nome, a iluminação e o desenho (função pura)

apps/web/src/app/ui/
└─ lua.ts        o componente nb-lua: coloca o desenho num SVG
```

## A conta

`faseDaLua(instante)` devolve a fase de 0 a 1: 0 é lua nova, 0,25 quarto crescente, 0,5 lua cheia, 0,75
quarto minguante. Sempre em [0, 1), inclusive antes da referência (o `%` do JavaScript conserva o sinal, e
um teste cobre datas de 1950 a 2100).

O modelo é o do **mês sinódico médio** (29,530588853 dias) a partir de uma lua nova real (6 de janeiro de
2000, 18h14 UTC). Ele erra por até cerca de **meio dia**, porque a órbita real acelera e desacelera. Basta
para um calendário, e há um teste contra as quatro fases reais de janeiro e fevereiro de 2024 (e a lua nova
seguinte), com a tolerância de um dia. **Não é uma efeméride**: não use para nada que dependa do instante
exato.

`faseDoDia(dia)` avalia a fase de um dia civil **ao meio-dia (UTC)**. É o meio do dia, o erro de escolher
outro instante é menor que o do modelo, e fixar o instante faz o mesmo dia dar a mesma fase em qualquer
fuso.

`iluminacao(fase)` é a porcentagem do disco iluminada, inteira, de 0 a 100: `(1 − cos(2π·fase)) / 2`.
`nomeDaFase(fase)` dá um dos oito nomes (Lua nova, Crescente, Quarto crescente, Gibosa crescente, Lua cheia,
Gibosa minguante, Quarto minguante, Minguante). Os limites ficam em 0,03, 0,22, 0,28, 0,47, 0,53, 0,72,
0,78 e 0,97, e o teste confere **os dois lados de cada um**: um limite deslocado muda o nome de dias
inteiros do mês e só aparece na fronteira, não no meio de cada fase.

## A orientação depende do hemisfério

No **sul**, a lua crescente aparece iluminada à **esquerda** e a minguante à direita; no **norte**, o
contrário. O padrão do produto é o sul, e o hemisfério vira escolha no editor de tema (PR H da especificação).
`ladoIluminado(fase, hemisferio)` é a única parte da lógica que depende dele.

## O desenho

`caminhoDaLua(fase, raio, hemisferio)` devolve o caminho SVG da parte **iluminada**: um arco do contorno,
do lado iluminado, fechado pela elipse do terminador (a linha entre o claro e o escuro). A largura da
elipse é `|cos(2π·fase)|`: zero nos quartos (terminador reto), igual ao raio na lua nova e na cheia. Se o
terminador curva para o lado iluminado, a parte clara é uma foice (crescente ou minguante); se curva para
o escuro, é gibosa.

As flags de varredura do SVG são o que deixa isto difícil de ler, então o teste confere o **caminho
inteiro** nas fases que importam (crescente, gibosa crescente, gibosa minguante, minguante, nova, cheia e o
quarto), nos dois hemisférios, e confirma que o norte é o espelho do sul.

## O componente

`<nb-lua [fase]="..." [tamanho]="14" [hemisferio]="'sul'" />`

- desenha sempre no mesmo raio, num `viewBox` fixo; o tamanho em pixels só **escala** o SVG, então o
  traço fino do contorno e o desenho não mudam com o tamanho;
- as cores são tokens (`--surface-sunken`, `--border-default`, `--text-primary`), e a guarda de estilo
  confere que não há cor literal: a lua acompanha o tema;
- `role="img"` com o rótulo "Lua cheia, 100% iluminada", para quem não vê.

## Como foi verificado

- **56 testes de domínio** e **7 do componente**.
- **Mutação em 12 pontos, todos pegos**: o mês sinódico, a lua nova de referência, o resto negativo antes
  da referência, o meio-dia de `faseDoDia`, o sinal da iluminação, o limite do quarto crescente, o
  hemisfério, a troca entre foice e gibosa, o módulo da largura do terminador, e no componente o
  hemisfério, o tamanho mexendo no desenho e o rótulo. **A do limite do quarto crescente sobreviveu na
  primeira rodada**: os testes só provavam o meio de cada fase. Os testes de fronteira a pegam.
- **Olhei o desenho**: um quadro de dez fases nos dois hemisférios, gerado pela função real. O sul cresce
  pela esquerda e o norte é o espelho. Um teste que confere o caminho gerado pelo mesmo raciocínio que o
  código não detectaria um erro de geometria dos dois.

Um erro meu durante o caminho, no teste e não no código: escrevi 65% de iluminação para a fase 0,4, que é
`(1 − cos(0,8π)) / 2 = 90%`. O componente estava certo.

## O que ainda não existe

- **A lua no mês e o cartão da lua na barra lateral**: PR B da especificação.
- **A escolha do hemisfério pela pessoa**: o editor de tema (PR H).

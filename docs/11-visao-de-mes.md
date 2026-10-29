# 11 — Visão de mês

A primeira tela com dado de verdade. Fecha o ciclo que começou em
[09](09-agendas-e-eventos.md): a API tinha agendas e eventos, e agora eles aparecem.

```
libs/domain/src/lib/calendario/
├─ grade-de-mes.ts    quais dias a grade mostra, e qual intervalo consultar
├─ faixas.ts          empilhamento das barras em trilhas
└─ semana.ts          de ocorrência (instante) para célula (coluna)

apps/web/src/app/calendario/
├─ calendario.service.ts     acesso à API
├─ visao-de-mes.ts           a grade
└─ paginas/calendario.ts     a casca: cabeçalho, barra lateral, visão
```

**Nenhuma conta de calendário acontece no componente.** Ela vive em `libs/domain`, com
47 testes rodando sem navegador — é onde nasce o defeito mais visível de um produto de
agenda, e navegador é um lugar caro para descobrir que o evento está na linha errada.

## Seis semanas, sempre

Altura fixa. Com quatro, cinco ou seis linhas conforme o mês, a grade muda de tamanho ao
navegar e tudo abaixo dela pula. O preço é uma linha de dias vizinhos a mais em alguns
meses, e o único caso visível é fevereiro começando no primeiro dia da semana — ele
caberia em quatro linhas cravadas e mostra seis.

A decisão mora em `grade-de-mes.ts`, e não no CSS, porque **muda o cálculo**: é o número
de células que a função produz.

### O intervalo consultado sai da grade, não do mês

`intervaloDaGrade` vai da meia-noite do primeiro dia **visível** à meia-noite depois do
último — 42 dias, fim exclusivo como todo intervalo do produto. Consultar só o mês
deixaria as duas pontas da grade vazias, e o evento de 31 de maio sumiria da visão de
junho onde ele aparece.

### No fuso de quem está vendo

A grade mostra o dia local de quem olha. O fuso em que o evento foi **criado** é outra
coisa, vive na linha dele e serve para a recorrência (ver [08](08-recorrencia.md)).

Confundir os dois é o bug clássico: `2026-06-15T03:30Z` é 00:30 do dia 15 em São Paulo e
23:30 do dia **14** em Nova York. Uma coluna de diferença.

## Barras, não chips repetidos

Um evento de vários dias é **uma** barra atravessando as células. Repetir um chip em cada
dia faria "Viagem" aparecer sete vezes.

Duas barras que compartilham um dia precisam de alturas diferentes, e é isso que
`empilharFaixas` resolve. As decisões:

- **`ate` é inclusivo, e terminar numa coluna conflita com começar nela.** Terminar na 1 e
  começar na 2 **não** conflita — tratar como conflito deixaria um buraco de uma linha em
  toda semana com dois eventos seguidos.
- **O mais longo fica na trilha de cima**, independente de quem chegou primeiro. A barra
  longa é a que se lê de ponta a ponta; embaixo, as curtas a quebrariam visualmente.
- **O desempate final é pelo `id`.** Sem ele, dois eventos do mesmo dia e tamanho trocam
  de altura conforme a ordem em que a API os devolve — barras que pulam a cada
  renderização são pior que barras mal empilhadas.
- **Três trilhas por célula**, e o resto vira "+N". Sem teto, um dia cheio esticaria a
  linha e as outras semanas encolheriam: a altura fixa de seis semanas só vale se a altura
  de cada linha também for previsível.

### O id de uma ocorrência não é o id da linha

`OcorrenciaVisivel.id` é o id do **evento**, e ele repete entre as ocorrências de uma
série. A identidade de uma instância é o par `id` + `inicioOriginal` (ver
[08](08-recorrencia.md)).

Montar as faixas só pelo `id` faria duas terças da mesma série virarem uma — e o sintoma
("o evento semanal aparece uma vez por semana") não apontaria para a causa. Por isso
`empilharFaixas` **recusa id repetido** em vez de deixar passar.

### O fim exclusivo, de novo

O dia inteiro de 15/06 termina na meia-noite que **abre** o 16, e não pode pintar a
coluna do 16. `semana.ts` recua um milissegundo para achar o último dia pintado — com a
exceção do marco de duração zero, que usa o próprio início.

> Essa exceção só é visível num marco exatamente à meia-noite local. O primeiro teste
> usava meio-dia e passava com as duas implementações; descoberto plantando o defeito.

## Decisões da tela

| Decisão                                            | Motivo                                                                                                                                                                                                                           |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Esconder agenda filtra na memória**              | a API já devolveu tudo o que a pessoa vê; ir ao servidor para esconder algo que já chegou é uma espera sem informação nova                                                                                                       |
| **Carregamento explícito, não `effect`**           | com `effect` a ordem entre "o sinal mudou" e "a requisição saiu" fica implícita, e duas navegações rápidas podem resolver fora de ordem                                                                                          |
| **Caixa de seleção de verdade na barra lateral**   | `aria-checked` à mão é uma reimplementação que sempre falta algo                                                                                                                                                                 |
| **`aria-live` no título do mês**                   | quem navega por teclado e leitor de tela precisa ouvir que o mês mudou; sem isso as setas parecem não fazer nada                                                                                                                 |
| **Cores resolvidas em TS, não em custom property** | o compilador do Angular 22 renomeia custom properties do estilo do componente para `--%NS%x`, e um `[style.--x]` do template escreve o nome cru — as duas pontas só se encontram porque a substituição está desligada por padrão |
| **Sem fundo orbital nesta tela**                   | ele é da moldura de entrada, onde há espaço vazio para respirar; atrás de uma grade de dados vira ruído (ver [04](04-design-system.md))                                                                                          |

### O que não está exposto ainda

`UserSettings.weekStartsOn` existe no banco e a grade já o recebe como parâmetro — mas
`GET /auth/eu` devolve o usuário, não as preferências. A tela usa domingo, o padrão do
schema. Quando a API expuser, vira uma leitura e nada mais muda.

Esconder uma agenda também não persiste: `CalendarMember.isHidden` existe e a rota para
alterá-lo não. A tela diz isso em voz alta, em vez de fingir que lembrou.

## O e2e passou a existir

O `example.spec.ts` gerado pelo Nx esperava um `h1` com "Welcome" e nunca rodou. No lugar
dele há seis testes que atravessam as duas aplicações, o banco e um navegador de verdade:

- entrar leva à grade do mês atual;
- a grade tem **seis semanas de sete dias** no DOM;
- a série recorrente do seed aparece **mais de uma vez** — a expansão chega à tela;
- navegar troca o título, e "Hoje" volta;
- esconder todas as agendas esvazia a grade e mostra o estado vazio;
- sem sessão, a raiz leva para a entrada.

Duas mudanças de configuração foram necessárias:

1. **O Playwright passou a subir a API também.** A aplicação não tem o que mostrar sem
   ela, e o `serve-static` do CI não tem o proxy de desenvolvimento.
2. **Só Chromium.** Firefox e WebKit vinham do gerador do Nx, e o job de CI instala apenas
   Chromium — eles falhariam por navegador ausente. Triplicar o custo de um job que o
   próprio workflow chama de caro precisa de um motivo melhor que "o gerador deixou
   assim".

> **O job de e2e roda só em PR para `main`.** É decisão registrada no workflow ("E2E é
> caro: só no caminho para produção"), tomada quando não havia suíte. Agora que há,
> o efeito é que uma quebra entra em `dev` e só aparece no PR de release. Vale reavaliar.

### O que o e2e **não** verifica

Que a tela está bonita. Ele prova que a grade existe, tem a forma certa e mostra os dados
certos — não que o espaçamento, o brilho e o raio de canto estão bons. Isso continua
precisando de olho humano.

## O que foi corrigido no caminho

**O seed criava contas que não conseguiam entrar.** O `passwordHash` era um texto que
parecia um hash Argon2 e não era, com um comentário afirmando ser o de `norbit123`. O
resultado: `npm run db:seed` populava o banco e nenhuma das contas servia para abrir a
aplicação — exatamente a única coisa que o seed existe para permitir. Agora o hash é
calculado, com os parâmetros do `SenhasService`.

**O seed gerava UUID v4.** O schema documenta v7 ("ordenáveis por tempo, o que mantém a
localidade dos índices") e as rotas validam a versão com `ParseUUIDPipe({ version: '7' })`
— uma agenda semeada seria recusada com 400 ao ser editada pela API. A aplicação
pareceria quebrada por um motivo que não tem nada a ver com ela.

> Os dois só apareceram porque o teste tentou **usar** o seed. Um seed que roda sem erro
> não é um seed que funciona.

## O que vem depois

- **Criar e editar evento pela tela** — é o que falta para a visão de mês ser utilizável
  sem `curl`, e traz consigo um formulário e um diálogo.
- **Visões de semana e dia**, com grade de horas e linha de agora.
- **Arrastar para criar, mover e redimensionar.**
- A **visão de dia como padrão no celular**: hoje a grade de mês no celular reduz as
  barras a pontos, o que é legível mas não é a resposta certa.

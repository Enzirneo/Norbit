# 12 — Formulário de evento

Criar, alterar e excluir evento pela tela. É o que faltava para a
[visão de mês](11-visao-de-mes.md) ser usável sem `curl`.

```
libs/domain/src/lib/formulario/
├─ campos-de-tempo.ts   texto de parede ↔ instante, no fuso do evento
└─ repeticao.ts         o seletor de repetição ↔ RRULE

apps/web/src/app/ui/
└─ dialogo.ts           `<dialog>` nativo

apps/web/src/app/calendario/
└─ formulario-de-evento.ts    o formulário e as três operações de série
```

## O seletor de repetição não reescreve o que não entende

Ele oferece quatro opções; a RFC 5545 tem muito mais. A decisão que define o módulo
não é como montar a regra — é **o que fazer com uma regra que ele não sabe expressar**.

A resposta é preservar, intacta, e mostrar como "personalizada". Um seletor que exibisse
"toda semana" para `FREQ=WEEKLY;UNTIL=20261231T000000Z` e salvasse `FREQ=WEEKLY` teria
apagado o fim da série — e quem salvou só queria corrigir o título.

É o mesmo princípio do parser em [08](08-recorrencia.md): **recusar, nunca ignorar**.
Aqui a forma de recusar é não mexer.

A propriedade que protege isso é testada para cada forma:

```
montarRrule(lerRepeticao(regra)) === regra
```

Inclusive para regras que o próprio parser **recusa** (`BYSETPOS` e companhia). O
formulário não pode quebrar ao abrir um evento assim, e salvar sem mexer tem de devolver
a mesma regra — aí a API recusa com a mensagem dela, em vez de o formulário apagar o
campo.

A única reescrita que o módulo se permite é ordenar `BYDAY` de forma canônica, porque
`TH,TU` e `TU,TH` são a mesma regra para a RFC. Sem ordem fixa, salvar duas vezes sem
mexer em nada produziria dois textos diferentes no banco.

## Texto de parede não tem fuso

`<input type="date">` e `<input type="time">` devolvem `"2026-06-15"` e `"09:00"`, sem
fuso nenhum. Virar instante exige saber em que fuso aquelas 9h acontecem, e é aqui que
nasce o defeito "marquei 9h e salvou 6h": usar o fuso do navegador quando o evento é de
outro.

A ida e a volta precisam fechar, e isso é testado para quatro combinações de data, hora e
fuso: o formulário de edição lê o instante, mostra o texto, e o texto volta a virar o
mesmo instante se ninguém mexeu.

Duas recusas valem a pena: `2026-02-31` passa pela expressão regular e **não é um dia** —
`Date.UTC` o aceitaria virando 3 de março em silêncio. E `25:00` não é hora. O navegador
nunca produz nenhum dos dois; um POST produz.

A hora que não existe (virada de horário de verão) segue a política de `paraInstante`:
empurrada para frente. Recusar faria o formulário rejeitar um horário que a pessoa tem
todo o direito de querer, com uma explicação que não cabe num campo.

## O diálogo é o `<dialog>` nativo

`showModal()`, e não uma `div` com `role="dialog"`. O elemento nativo traz de graça o que
uma reimplementação sempre erra em algum detalhe: foco preso dentro do diálogo, `Esc`
fechando, o resto da página inerte para leitor de tela e para o `Tab`, e o fundo por
`::backdrop`.

O que continua sendo nosso: devolver o foco a quem abriu — sem isso o foco volta ao começo
da página, e quem navega por teclado percorre a tela toda para chegar de novo onde estava.

## As três operações de uma série, pela tela

| Escolha                       | O que acontece                                                 |
| ----------------------------- | -------------------------------------------------------------- |
| **Todos os eventos da série** | `PATCH` na linha-mãe                                           |
| **Somente este evento**       | `POST .../destacar` cria a linha filha, e o `PATCH` é **dela** |
| Excluir, somente este         | `DELETE .../ocorrencias/:inicio`                               |
| Excluir, todos                | `DELETE /eventos/:id`                                          |

**A exceção nasce sem a regra.** O seletor de repetição continua mostrando a regra da
série enquanto você edita uma ocorrência; mandá-la no corpo do `PATCH` da filha faria a
exceção virar uma **segunda série paralela**. Por isso a repetição fica indisponível com
"somente este" escolhido, com uma frase dizendo por quê — alterar a repetição é, por
definição, uma alteração da série.

Excluir pede confirmação em dois passos: numa série, o que o botão apaga depende do escopo
escolhido acima, e isso é informação demais para um clique só.

## O que o e2e encontrou

A aritmética de tempo e a montagem da RRULE têm 44 testes em `libs/domain`, verificados
por mutação. Os 14 testes de ponta a ponta cobrem a costura — e encontraram **seis
defeitos reais**, nenhum deles detectável por teste de unidade:

**1. Clicar num dia não criava nada.** O número do dia fica na primeira linha da mesma
coluna e vem depois no DOM, então ele cobria o fundo clicável inteiro. `pointer-events:
none` no número resolve: ele não é interativo.

**2. A grade não preenchia a tela.** O elemento de um componente Angular nasce
`display: inline`, então o `flex: 1` de dentro não encontrava ninguém esticando por fora:
cada semana ficava com a altura do número do dia.

**3. As semanas se sobrepunham.** Com `flex: 1; min-height: 0`, cada semana recebia uma
fatia igual da altura — e uma semana com as três trilhas ocupadas precisa de mais que
isso. O grid transbordava e o fundo de uma semana invadia a seguinte: faixas desenhadas
sobre as células da outra, e cliques capturados pela semana errada. Agora a semana cresce
para preencher mas **nunca encolhe abaixo do conteúdo**, e a grade rola quando não cabe.

**4. Um dia cheio não tinha onde clicar.** Com as três trilhas ocupadas, a última linha
sobrava em frações de pixel. A linha ganhou piso (`minmax(14px, 1fr)`): é o espaço que o
produto reserva para que um dia cheio continue clicável.

**5. O formulário descartava o que já havia sido digitado.** Ao editar, ele é preenchido
quando a resposta da API chega, e `reset()` sobrescreve tudo. Quem começasse a digitar
antes perdia a digitação em silêncio. Os campos agora só aparecem quando há o que mostrar.

**6. "Editar só este" criava uma série paralela.** O `PATCH` da filha levava a regra de
recorrência junto, e a exceção nascia como uma segunda série: **dez ocorrências no lugar
de uma**. É o pior dos seis, porque corrompe dado em vez de só atrapalhar.

> Os defeitos 2 e 3 são visuais, e estavam na tela que eu havia entregado como pronta em
> [11](11-visao-de-mes.md) — o e2e daquele PR verificava a **forma** da grade (seis
> semanas, sete dias, as faixas certas) e não a geometria dela.

### A suíte ficou determinística

Três mudanças, cada uma por um sintoma que custou tempo:

- **Um worker só.** Os testes compartilham um banco. Em paralelo, um que conta faixas vê o
  que outro acabou de criar, e a falha aparece de forma intermitente e sem relação com o
  código que a causou.
- **Banco restaurado antes de cada teste.** Sem isso, cada teste que cria uma série deixa
  faixas nas mesmas colunas, as células enchem as três trilhas, e as faixas do teste
  seguinte ficam escondidas atrás do "+N" — o teste falha dizendo que não encontrou o que
  ele mesmo acabou de criar.
- **60 s por teste.** Cada um entra pela interface de verdade e espera a grade com dados.

> **A lição de depuração:** um "Test timeout exceeded" sem passo é a pior mensagem
> possível, e foi o que apareceu nas primeiras cinco tentativas. O que destravou foi rodar
> o Playwright **direto**, fora do Nx, cuja saída estava engolindo o log de chamadas — e
> ali estava a frase que entregou o defeito 3: `subtree intercepts pointer events`.
>
> Depois disso, `document.elementFromPoint` no ponto do clique respondeu em uma linha o
> que cinco execuções de 5 minutos não responderam.

## O que ainda não existe

- **Participantes, lembretes, etiquetas e cor por evento.** Os campos existem no banco; o
  formulário cobre o essencial.
- **Arrastar para criar, mover e redimensionar.**
- **Editar a repetição de forma completa** — intervalo ("a cada duas semanas"), fim da
  série e ordem no mês. Hoje essas regras são preservadas, não editadas.
- **Mover evento entre agendas:** o seletor mostra a agenda, e trocá-la exige verificar
  permissão nas duas pontas.

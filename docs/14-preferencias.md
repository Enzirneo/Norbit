# 14 — Preferências

`UserSettings` existe no banco desde a primeira migration e não era exposto. A consequência
era uma tela que sempre abria no mês, sempre começava a semana no domingo, e esquecia as
agendas escondidas ao recarregar. Este bloco é a ponte — e a primeira parte do bloco de
customização que o produto prometeu.

```
libs/design-tokens/src/lib/
└─ acentos.ts           a paleta oferecida e a derivação das cores companheiras

libs/contracts/src/lib/preferencias/
└─ preferencias.ts      schemas de entrada e tipos de saída

apps/api/src/app/preferencias/
└─ preferencias.service.ts / controller    GET e PATCH /api/preferencias

apps/web/src/app/preferencias/
├─ preferencias.service.ts   acesso à API e aplicação no documento
└─ paginas/preferencias.ts   a tela
```

## O que é oferecido

| Preferência         | Efeito                                                                       |
| ------------------- | ---------------------------------------------------------------------------- |
| Cor de destaque     | uma de cinco, e todas as cores companheiras derivam dela                     |
| Densidade           | compacta, confortável ou espaçosa — multiplica a unidade base de espaçamento |
| Reduzir movimento   | desliga transições e animações; **soma** à preferência do sistema            |
| Visão ao abrir      | mês, semana ou dia                                                           |
| A semana começa em  | domingo ou segunda                                                           |
| Relógio de 24 horas | também no eixo das horas e nos horários das faixas                           |
| Esconder agenda     | por agenda, guardado no servidor; ver abaixo                                 |

A tela **salva a cada alteração**, sem botão. Preferência é ajuste fino: a pessoa muda, olha
o resultado e muda de novo, e um botão no meio desse laço obriga a confirmar algo que já está
visível.

## Cinco acentos, e não um seletor de cor livre

O `semanticos.ts` escolheu `textOnAccent` e `accentMuted` **à mão**, por medição, para o
acento do `nebula`, e deixou escrito que derivá-los para qualquer acento era a Fase 4. Um
seletor livre produziria botão ilegível: `accentHover`, o fundo de seleção e a cor do texto
em cima precisam manter contraste, e o acento pode ser qualquer coisa.

A oferta honesta, até a derivação perceptual (OKLCH) existir, é uma **paleta curada**: cada
acento passa pelo teste de contraste, que reprova a build. O contrato valida a escolha contra
essa mesma lista — importada de `design-tokens`, não copiada.

### O que é derivado, e como

| Token          | Como                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------- |
| `textOnAccent` | a frente (quase preto ou quase branco) com mais contraste; **recusa** se nenhuma alcançar 4.5:1 |
| `accentHover`  | o acento afastado até alcançar 1.15:1, **na direção que tem espaço**                            |
| `accentMuted`  | o acento diluído na superfície até ter tinta perceptível e o texto ainda passar                 |

Três coisas foram medidas, e cada uma desfez uma suposição minha:

**1. Clarear 12% é invisível num acento claro.** O `aurora` tem luminância 0.57 e o hover por
mistura fixa dava 1.046:1 — uma mudança que ninguém vê. Hoje a derivação busca a distância, e
acentos acima de 0.45 de luminância **escurecem** em vez de clarear.

**2. Existe uma faixa de tons em que nenhuma das duas frentes serve.** `#74747e` dá 4.32:1 com
o quase preto e 4.25:1 com o quase branco. Um botão assim é ilegível para quem precisa do
mínimo e parece aceitável para quem não precisa, e por isso a derivação lança.

**3. "Passa no contraste" não define um fundo de seleção.** Eu havia escrito a busca para
parar na primeira diluição que passava no texto — e a mais diluída passa com folga, devolvendo
um fundo igual à superfície. O comentário dizia "o mais colorido que ainda passa", o contrário
do código; inverter a busca produzia um bloco de cor saturado. O critério certo é **tinta
perceptível e ainda fundo** (1.25:1 contra a superfície).

> Esse critério foi validado contra a única referência independente que existia: o `#1F2547`
> escolhido à mão para o `nebula`. A derivação devolve `#1f2345`. Chegar praticamente no mesmo
> lugar por um critério explícito é o que dá confiança de que o critério é o certo, e não um
> número que encaixou. Vale como teste.

### Hexadecimal sempre minúsculo, de novo

Os primitivos estavam em maiúsculas. O banco tem CHECK exigindo minúsculas
([03](03-modelo-de-dados.md)) e o contrato `corHex` normaliza a entrada — então a paleta de
acentos **nunca casava** com a cor que chegava do formulário, e a validação recusava uma cor
que ela mesma oferecia. É a mesma inconsistência do `#6D7CFF` do PR #10, em outro lugar.

## A fronteira que mudou

`libs/contracts` agora pode depender de `libs/design-tokens`, e só dela. Sem isso a lista de
acentos existiria em duas cópias, e acrescentar um acento deixaria o contrato recusando a cor
nova.

A dependência é segura porque `design-tokens` é folha: não depende de nada, nem de Angular,
nem de Nest, nem do Prisma. A API **não** ganhou a dependência — o servidor não tem nada a ver
com cor —, e o teste de integração escreve o acento padrão como literal, que é de fato a
asserção.

## Aplicar é escrever na raiz

O serviço grava custom properties em `document.documentElement`: `--accent`, `--accent-hover`,
`--accent-muted`, `--text-on-accent`, `--border-focus` e `--space-unit`. É o que a camada
semântica dos tokens existe para permitir — trocar o acento redefine `--accent` e nenhum
componente é tocado.

**A densidade escreve `--space-unit`**, e não uma variável nova. Uma primeira versão escrevia
`--row-height`, que nada lia: uma variável inventada para o seletor de densidade parecer
funcionar. Todo espaçamento do projeto é `calc(var(--space-unit) * n)`, então mudar a unidade
muda a tela inteira.

**Reduzir movimento é um atributo**, `data-sem-movimento`, com uma regra global. Ela soma à
consulta de mídia do sistema em vez de substituí-la: quem já pediu menos movimento no sistema
operacional continua sendo atendido com a preferência do Norbit desligada. A duração vai para
`0.01ms` e não `0`, porque transição de duração zero não dispara `transitionend`.

## Esconder agenda é do membro, não do dono

`PATCH /api/agendas/:id/minhas-preferencias` exige apenas `ver`, e não `editar-agenda`. Esconder
uma agenda das próprias visões, ou escolher com que cor **eu** a vejo, não altera nada para os
outros — e exigir ser dono prenderia o membro a ver tudo o que entrou na lista dele.

O nome da rota (`minhas-preferencias`) existe para não ser confundido com o `PATCH :id`, que
altera a agenda e é do dono.

É um `upsert`, e não `update`: o dono tem acesso por `ownerId` e pode não ter linha de membro
([09](09-agendas-e-eventos.md)). Com `update`, a preferência dele iria para nenhuma linha e
sumiria sem erro. Há teste que apaga a linha do dono antes de esconder.

`escondida` e `corPropria` viajam **dentro da agenda**, e não numa segunda chamada: a barra
lateral precisa do estado para desenhar as caixas, e uma requisição a mais faria a lista
aparecer toda marcada por um instante antes de corrigir. A linha de membro já vinha na consulta
de acesso; só faltava propagá-la.

A caixa muda **antes** de a resposta chegar e volta se a gravação falhar: esconder é uma ação
cujo resultado a pessoa está olhando, e esperar a ida e volta faria a caixa parecer travada.

## Antes do primeiro paint

As preferências chegam da API depois do carregamento, então, sozinhas, a tela nasceria com
o acento padrão e trocaria de cor diante de quem olha. Um script **inline e síncrono** no
`index.html` aplica o que foi guardado na abertura anterior, antes de o Angular existir.

O cache guarda os **valores resolvidos** (`--accent: #ff6b8a`, ...), e não as preferências.
Guardar as preferências obrigaria o script a repetir a derivação de cores — uma segunda
implementação de `derivarAcento`, escrita à mão num HTML, onde ninguém a testa.

O script é **cego**: recebe um mapa genérico de propriedades e as aplica sem saber o nome
de nenhuma. A lista mora em `aparencia.ts` e em lugar nenhum mais. A única duplicação é a
chave do `localStorage`, que o script não pode importar — por isso um teste fixa o valor.

Quatro decisões:

- **Conteúdo corrompido vira "nada guardado".** O armazenamento é do navegador, e qualquer
  extensão mexe nele. Quebrar o carregamento por isso trocaria um flash de cor por uma tela
  branca. O script inteiro está num `try`.
- **Falhar ao guardar não falha a preferência.** Janela privada e dados bloqueados fazem o
  acessor lançar; o cache é uma otimização, e a preferência já está no servidor.
- **Sair apaga o cache.** A aparência é informação sobre quem usava o navegador; a próxima
  pessoa não deve ver, nem por um instante, a cor da anterior.
- **Não vale na primeira abertura num navegador.** Sem cache, o acento padrão aparece até a
  API responder. Eliminar isso exigiria renderização no servidor ou um cookie lido pela
  própria resposta do HTML, e nenhum dos dois existe aqui.

O teste que prova o ponto **bloqueia a API de preferências na recarga** — ela nunca responde
— e confere que o acento está lá mesmo assim, lido logo após o `commit` da navegação.
Verificado por mutação: removido o script, a variável chega vazia.

## Preferências carregam antes dos eventos

A visão inicial e o início da semana mudam o intervalo a consultar. Carregar em paralelo faria
a primeira consulta sair com o mês e, logo depois, uma segunda com o que a pessoa escolheu —
duas idas ao servidor e uma piscada. Se as preferências falharem, a tela abre nos padrões em
vez de ficar vazia.

## O que o e2e encontrou

Nove testes novos, 40 no total. O primeiro que **recarrega a página** expôs um defeito que
estava em todos os specs desde o início:

**O helper `entrar()` esperava um `<h1>` — e a página de login tem um `<h1>Entrar</h1>`.** A
espera passava instantaneamente, antes de o login terminar. Os outros testes escapavam porque
esperavam a grade carregar; o novo navegava logo em seguida, abortava a requisição em voo, e
terminava sem cookie e de volta em `/entrar`.

A pista que enganou: uma sonda minha concluiu "o cookie nunca é gravado", porque lia
`context.cookies()` no instante em que a espera já havia passado. Só quando pedi ao Chromium
os cookies **bloqueados** (nenhum) e li depois de esperar a resposta é que a hipótese caiu.

O helper agora vive em `apoio.ts`, uma cópia só, e espera a saída de `/entrar`.

### Um comportamento que mudou

A tela passou a respeitar `defaultView`, cujo padrão no banco é **`WEEK`**. Contas novas abrem
na semana. Os testes antigos assumiam o mês porque a preferência era ignorada; agora a conta de
teste declara `MONTH` explicitamente no seed, em vez de depender de um padrão que não sabia que
dependia.

## O que ainda não existe

- **Mais presets** (`eclipse`, `dawn`, `vacuum`) e o seletor de tema claro/escuro. A derivação
  de acento está pronta; faltam os presets, e cada um precisa passar pelo mesmo teste.
- **Um seletor de cor livre**, que exige a derivação em OKLCH.
- **Cor própria por agenda na tela.** A API e o modelo existem (`corPropria`); a interface
  ainda só esconde.
- **`defaultView = AGENDA`** é aceito pelo contrato e cai no mês: a visão de lista não existe.
- **Preferências de notificação**, do mesmo `UserSettings`, ficam para o bloco de notificações.

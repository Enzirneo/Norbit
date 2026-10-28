# 06 — Fluxo de Trabalho

Branches, commits, TDD e Clean Code. Este documento é o contrato de como o código entra
no Norbit. O princípio por trás de tudo aqui: **nada chega em produção sem passar por
homologação, e nada passa por homologação sem teste automatizado.**

---

## Branches

Três níveis, sem exceção.

```
main          produção · protegida · sempre implantável · tags de versão
  ▲
  │ merge commit (--no-ff), após validação em homologação
  │
dev           homologação · protegida · integração contínua de tudo
  ▲
  │ squash merge, via Pull Request
  │
feat/* fix/* chore/* …          trabalho do dia a dia
```

### `main` — produção

- Reflete exatamente o que está no ar
- **Nunca** recebe commit direto, nem seu
- Só recebe merge vindo de `dev` (ou de `hotfix/*`)
- Cada merge aqui gera uma tag `vMAJOR.MINOR.PATCH`

### `dev` — homologação

- Onde tudo se integra e é testado de verdade, com dados realistas
- Só recebe merge vindo de branches de trabalho, sempre via PR
- Pode quebrar temporariamente; é para isso que ela existe
- É a base de toda branch nova

### Branches de trabalho

Padrão: `tipo/escopo-curto-em-kebab-case`

| Prefixo | Para quê | Exemplo |
|---|---|---|
| `feat/` | Funcionalidade nova | `feat/recorrencia-eventos` |
| `fix/` | Correção de bug | `fix/fuso-horario-verao` |
| `refactor/` | Melhoria interna, sem mudar comportamento | `refactor/extrai-calendar-access-guard` |
| `test/` | Apenas testes | `test/expansao-rrule` |
| `chore/` | Build, deps, configuração | `chore/atualiza-prisma` |
| `docs/` | Documentação | `docs/revisa-modelo-dados` |
| `hotfix/` | Emergência em produção | `hotfix/login-500` |

Regras:

- Uma branch, **um** assunto. Se você precisar de "e" para descrever o que ela faz, são duas branches
- Sai de `dev` atualizada: `git switch dev && git pull && git switch -c feat/x`
- Vida curta. Passando de ~3 dias, o merge vira arqueologia — quebre em pedaços menores
- Rebase em `dev` antes de abrir o PR, para o PR mostrar só o seu trabalho

### Hotfix — a única exceção ao fluxo

Produção quebrada não espera homologação:

```bash
git switch main && git pull
git switch -c hotfix/login-500
# corrigir, COM teste que reproduz a falha
```

O PR do hotfix vai para `main`. Depois do merge, **imediatamente** traga `main` de volta
para `dev`:

```bash
git switch dev && git merge main && git push
```

Esquecer esse último passo é o erro clássico: a correção vive em produção, desaparece na
próxima entrega vinda de `dev`, e o bug "volta sozinho".

---

## Merges

A estratégia é diferente em cada nível, e isso é deliberado:

| Caminho | Estratégia | Por quê |
|---|---|---|
| `feat/*` → `dev` | **Squash merge** | Uma funcionalidade = um commit em `dev`. O histórico fica legível, e os 14 commits de "ajuste", "wip" e "agora vai" desaparecem |
| `dev` → `main` | **Merge commit** (`--no-ff`) | Preserva o histórico e, principalmente, mantém as duas branches convergentes. Squash aqui faria `main` e `dev` divergirem e cada entrega daria conflito |
| `hotfix/*` → `main` | Merge commit | Mesma razão |

Depois do squash merge, apague a branch. O GitHub faz isso automaticamente se
configurado.

---

## Commits

[Conventional Commits](https://www.conventionalcommits.org), em português no corpo:

```
tipo(escopo): resumo no imperativo, minúsculo, sem ponto final

Por que a mudança foi necessária, não o que o diff já mostra.

Refs #12
```

Tipos: `feat` · `fix` · `refactor` · `test` · `docs` · `chore` · `perf` · `style`

Escopos do projeto: `auth` · `calendar` · `events` · `tasks` · `sharing` ·
`notifications` · `settings` · `ui` · `domain` · `db` · `ci`

```bash
# bom
feat(events): expande recorrência respeitando horário de verão
fix(auth): revoga família de sessões ao detectar reúso de refresh token
test(domain): cobre exclusão de ocorrência única em série semanal

# ruim
ajustes
feat: várias coisas
fix(events): corrige bug
```

O `BREAKING CHANGE:` no corpo, ou `!` após o escopo, marca mudança incompatível —
relevante quando a API tiver cliente mobile em campo.

Isso é validado automaticamente por **commitlint** no hook `commit-msg`, não pela sua
memória.

---

## Pull Requests

Mesmo trabalhando sozinho, todo merge passa por PR. A razão não é revisão por outra
pessoa: é que **o PR é o gatilho do CI**. Sem ele, o código entra em `dev` sem que nada
tenha rodado.

Um PR só pode ser mesclado quando:

- [ ] O CI passou inteiro (lint, testes, build)
- [ ] A cobertura não caiu abaixo do mínimo da camada tocada
- [ ] Existe teste cobrindo a mudança (ou está escrito no PR por que não se aplica)
- [ ] A descrição diz **por que**, não só o que
- [ ] Não há `console.log`, código comentado, `TODO` sem issue associada
- [ ] Se tocou o banco, a migration está versionada e foi aplicada em `dev`

### Proteção das branches (configurar no GitHub)

Em `Settings → Branches`, para `main` e `dev`:

- Require a pull request before merging
- Require status checks to pass → marcar os jobs do CI
- Require branches to be up to date before merging
- Require linear history (só em `dev`; **não** em `main`, que recebe merge commits)
- Block force pushes
- Em `main`: Require deployments to succeed, quando houver ambiente configurado

Sem isso, o fluxo é só uma intenção — e numa sexta-feira à noite a intenção perde.

---

## Ambientes

| Ambiente | Branch | Banco | Para quê |
|---|---|---|---|
| Local | qualquer | Postgres em Docker, com seed | Desenvolver |
| Homologação | `dev` | Postgres próprio, dados realistas | Validar de verdade, no celular |
| Produção | `main` | Postgres com backup automático | Uso real |

Homologação **não** compartilha banco com produção. Parece obvio, mas é o atalho que
todo projeto pessoal tenta tomar, e é como se apaga dado real rodando um `migrate reset`.

As migrations são aplicadas por `prisma migrate deploy` no deploy — nunca
`migrate dev`, que em produção pode propor recriar o banco.

---

## CI

Pipeline em [`.github/workflows/ci.yml`](../.github/workflows/ci.yml), disparado em todo
PR para `dev` e `main`:

```
lint  →  test (com Postgres de serviço)  →  build  →  (em main) tag + deploy
```

Usa `nx affected` para rodar só o que a mudança atingiu — o que mantém o CI em segundos
em vez de minutos conforme o monorepo cresce.

---

## TDD

O ciclo, aplicado de verdade:

```
🔴 RED      escreva o teste. Rode. Ele DEVE falhar.
🟢 GREEN    o código mais simples que faz passar. Feio é permitido aqui.
🔵 REFACTOR limpe, com os testes verdes o tempo todo.
```

O passo vermelho não é cerimônia. Um teste que nunca falhou não provou nada — pode estar
testando o lugar errado, ou passando por acidente. Ver a falha primeiro é o que valida o
teste.

### Onde TDD é obrigatório

**`libs/domain`** — sem exceção. Expansão de recorrência, resolução de permissões,
detecção de conflito de horário, cálculo de lembretes. É código puro, sem framework e
sem I/O, o que torna o TDD natural e rápido. E é exatamente onde um bug é mais caro:
uma regra de recorrência errada corrompe silenciosamente a agenda de todo mundo.

**Correção de bug** — sempre. O primeiro passo de todo `fix/` é um teste que reproduz a
falha e falha. Sem isso você não sabe se corrigiu, e nada impede a regressão daqui a
três meses.

### Onde ser pragmático

- **Serviços NestJS:** teste de integração com banco real (Postgres de teste em
  container, transação revertida ao fim). Mock de Prisma testa o mock, não a query
- **Componentes Angular:** teste de comportamento depois de implementar, via
  Testing Library — "o usuário vê o evento após criar", não "o método `onSubmit` chamou
  o service"
- **Layout e animação:** não se testa em unidade. Vai para E2E e para o olho

### A pirâmide do projeto

```
        ╱  E2E (Playwright)  ╲         poucos, nos fluxos que não podem quebrar:
       ╱   ~8 cenários        ╲        cadastro · criar evento · compartilhar · lembrete
      ╱─────────────────────────╲
     ╱  Integração (api + banco) ╲     rotas com permissão e persistência reais
    ╱    ~60 testes               ╲
   ╱───────────────────────────────╲
  ╱   Unidade (libs/domain)         ╲  a maior parte, rápida, sem I/O
 ╱      ~200 testes                  ╲
╱─────────────────────────────────────╲
```

### Cobertura mínima, por camada

Número global de cobertura é fácil de enganar. Por camada, não:

| Camada | Mínimo | Por quê |
|---|---|---|
| `libs/domain` | **95%** | Lógica pura e crítica. Não há desculpa |
| `apps/api` (services) | 80% | Caminho felizes e erros de permissão |
| `libs/contracts` | — | Só tipos e schemas |
| `apps/web` | 60% | Estado e serviços sim; template não |

Travado no CI. Cobertura que cai reprova o PR.

### Nomes de teste

Descreva o comportamento esperado, não o método:

```ts
// bom
it('mantém a ocorrência às 9h locais após a virada do horário de verão', …)
it('não retorna evento privado de outro membro da mesma agenda', …)
it('revoga a família de sessões quando um refresh token já usado reaparece', …)

// ruim
it('testa expandRecurrence', …)
it('funciona', …)
```

---

## Clean Code

Princípios viram discussão; limites viram CI. Então a maior parte disto está no ESLint.

### Aplicado automaticamente

```jsonc
// .eslintrc — limites que reprovam o build
{
  "complexity": ["error", 10],              // ramificação demais = extraia
  "max-depth": ["error", 3],                // 4 níveis de if aninhado = repense
  "max-lines-per-function": ["error", 50],
  "max-lines": ["error", 400],              // arquivo maior = tem mais de uma razão de existir
  "max-params": ["error", 4],               // mais que isso = passe um objeto
  "no-console": "error",
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/explicit-function-return-type": "error",
  "@typescript-eslint/no-floating-promises": "error"   // promise sem await engole erro
}
```

### Fronteiras entre camadas, também automáticas

O recurso mais valioso do Nx aqui é `@nx/enforce-module-boundaries`. Com tags nos
projetos, o lint **impede** o import errado:

```jsonc
{
  "depConstraints": [
    // o domínio é puro: não conhece Angular, Nest, Prisma nem HTTP
    { "sourceTag": "scope:domain",   "onlyDependOnLibsWithTags": ["scope:domain"] },
    { "sourceTag": "scope:contracts","onlyDependOnLibsWithTags": ["scope:contracts"] },
    { "sourceTag": "scope:api",      "onlyDependOnLibsWithTags": ["scope:domain", "scope:contracts"] },
    { "sourceTag": "scope:web",      "onlyDependOnLibsWithTags": ["scope:domain", "scope:contracts", "scope:ui"] }
  ]
}
```

Isso é o que garante, meses adiante, que `libs/domain` continue puro. Sem a regra, um
dia alguém importa o `PrismaService` lá dentro "só para resolver rápido", e a lib deixa
de ser testável sem banco.

### Regras de escrita

**Nomes.** Revelam intenção e são em inglês no código, português na interface e nos
commits. `expandRecurrence`, não `expand` ou `doStuff`. Booleano começa com `is`, `has`
ou `can`. Nada de abreviação inventada: `calendar`, não `cal`.

**Funções.** Fazem uma coisa, num só nível de abstração. Se você precisa de comentário
explicando *o que* o bloco faz, ele quer ser uma função com aquele nome.

**Comentários.** Explicam **por quê**, nunca o quê. O código já diz o quê, e diz a
verdade — o comentário envelhece e mente. Comentário bom:

```ts
// O fuso de origem é necessário aqui: só com ele a ocorrência semanal se mantém
// às 9h locais depois da virada do horário de verão. UTC sozinho desloca uma hora.
```

**Código morto.** Apagado, não comentado. O histórico do git é o arquivo morto, e ele é
bom nisso.

**Erros.** Nunca engolidos. Exceções tipadas no domínio
(`EventNotFoundError`, `InsufficientRoleError`), traduzidas em HTTP por um filtro do
Nest. `catch` vazio é proibido pelo lint.

**Estado no Angular.** Signals para estado local, store por feature quando passar de um
componente. Sem `any` em resposta de API — o tipo vem de `libs/contracts`, e é o mesmo
que o back-end usa.

---

## Definition of Done

Uma tarefa está pronta quando **todas** as linhas valem:

- [ ] Funciona, e você usou na mão para confirmar
- [ ] Tem teste automatizado, escrito antes quando a camada exige TDD
- [ ] Lint e type-check passam sem aviso suprimido
- [ ] Cobertura da camada mantida
- [ ] Acessível: teclado funciona, contraste verificado, alvo de toque adequado
- [ ] Responsivo: testado em largura de celular
- [ ] Migration versionada, se tocou o banco
- [ ] Documentação atualizada, se mudou arquitetura ou modelo de dados
- [ ] Mesclado em `dev` via PR, e validado lá antes de ir para `main`

---

## Comandos do dia a dia

Os comandos `gh` abaixo precisam do [GitHub CLI](https://cli.github.com), que ainda
**não está instalado** nesta máquina (`winget install GitHub.cli`). Sem ele, abra os PRs
pela interface web — o fluxo é o mesmo.

```bash
# começar algo
git switch dev && git pull
git switch -c feat/recorrencia-eventos

# durante (TDD)
nx test domain --watch
nx affected -t lint test

# antes do PR
git fetch origin && git rebase origin/dev
nx affected -t lint test build
git push -u origin feat/recorrencia-eventos
gh pr create --base dev --fill

# entregar em produção
gh pr create --base main --head dev --title "release: v0.2.0"
# após o merge:
git switch main && git pull
git tag -a v0.2.0 -m "Recorrência de eventos" && git push --tags
```

# 05 — Roadmap

Oito fases. Cada uma termina em algo que funciona de ponta a ponta e pode ser usado —
não em "o back-end está pronto, falta a tela". As estimativas pressupõem um
desenvolvedor trabalhando em ritmo de projeto pessoal.

A ordem não é arbitrária: cada fase depende da anterior, e as fases 2 e 3 vêm antes de
notificações porque não há o que notificar antes de existirem eventos e pessoas.

Cada item marcável é uma branch `feat/*` própria, que vai para `dev` por PR e chega em
`main` quando validada. O [fluxo de trabalho](06-fluxo-de-trabalho.md) define isso, e as
estimativas abaixo **já contam** o tempo de escrever os testes primeiro.

---

## Fase 0 — Fundação · ✅ concluída

Ambiente de pé e banco criado, sem produto ainda.

- [x] Monorepo Nx 24 com `apps/web` (Angular 22), `apps/api` (NestJS) e as libs
      `domain`, `contracts` e `design-tokens`, com aliases `@norbit/*`
- [x] `docker-compose.yml` com Postgres 17, Redis 7, Adminer e Mailpit — os quatro
      containers no ar
- [x] Migration aplicada num Postgres real; as quatro restrições extras conferidas no
      banco e testadas contra dados inválidos
- [x] Tailwind 4 configurado, consumindo os tokens de `libs/design-tokens` via
      `@theme` — verificado no CSS final: `bg-space-800{background-color:var(--color-space-800)}`
- [x] Gerador de tokens (`npm run tokens:build`): os valores vivem só no TypeScript e
      o CSS é derivado, em vez de duas cópias que divergiriam
- [x] ESLint com os limites de Clean Code e as fronteiras de módulo, com a fronteira
      testada: um import de `@prisma/client` em `libs/domain` é rejeitado
- [x] Prettier, Husky e commitlint ativos — e os dois hooks já barraram coisa de
      verdade no primeiro uso
- [x] `prisma/seed.ts`: dois usuários, três agendas, quatro eventos (recorrente, dia
      inteiro, privado e comum) e duas tarefas
- [x] Pipeline de CI escrito e verde
- [x] Branch `dev` criada, `main` e `dev` protegidas, com o bloqueio de push direto
      verificado na prática
- [x] Primeiro ciclo de TDD: 8 testes em `libs/design-tokens`, escritos antes da
      implementação, com a falha observada antes de cada correção

**Pronto quando:** `docker compose up -d && nx run-many -t serve` sobe tudo, o Adminer
mostra as tabelas, e um PR de teste para `dev` roda o CI até o verde. ✅

**Estado final:** 6/6 lint, 5/5 testes, 2/2 builds.

### O que a Fase 0 ensinou, e que muda as fases seguintes

1. ~~**O CI precisa dos checks reais agora.**~~ ✅ Resolvido: `lint`, `test` e `build`
   são status checks obrigatórios em `main` e `dev`. O `e2e` ficou **de fora** de
   propósito — ele só roda quando a base do PR é `main` e até agora sempre apareceu
   como `skipping`, então exigi-lo travaria o próximo PR de release sem nenhuma prova
   de que passa. Entra depois que rodar verde uma vez.
2. ~~**A lib `@norbit/db` entra na Fase 1.**~~ ✅ Feito: o gerador agora escreve em
   `libs/db/src/generated/`, a lib reexporta o client, e o `PrismaService` está ligado
   ao `AppModule`. Só a tag `scope:api` alcança `scope:db` — verificado com imports
   plantados em `web` e em `domain`, ambos rejeitados.
3. ~~**Nenhuma regra type-aware do ESLint está ativa.**~~ ✅ Resolvido na branch
   `feat/eslint-type-aware`, antes de qualquer código de serviço. Cinco regras ativas
   (`no-floating-promises`, `no-misused-promises`, `await-thenable`, `require-await`,
   `explicit-function-return-type`), e elas já pegaram três defeitos reais no esqueleto
   que o Nx gerou — inclusive um `bootstrap()` sem `catch` em `apps/api/src/main.ts`.

---

## Fase 1 — Contas e identidade · ~4 dias

- [ ] Cadastro, login, logout, refresh com rotação e detecção de reúso
- [ ] Argon2id para senhas, `AuthGuard` e `CurrentUser` decorator no Nest
- [ ] Interceptor Angular que renova o access token de forma transparente
- [ ] Rotas protegidas por guard, redirecionamento após login
- [ ] Perfil: nome de exibição, handle, avatar, fuso horário
- [ ] `UserSettings` criado automaticamente junto com a conta
- [ ] Recuperação de senha por e-mail (Mailpit no Docker para testar sem enviar nada)

**Pronto quando:** criar conta, fechar o navegador, reabrir e continuar logado.

---

## Fase 2 — Núcleo da agenda · ~2 semanas

A fase maior e a mais importante. Aqui o produto passa a existir.

- [ ] CRUD de agendas, com a agenda pessoal padrão criada no cadastro
- [ ] CRUD de eventos: título, descrição, local, início/fim, dia inteiro, cor
- [ ] Recorrência: RRULE em `libs/domain`, expansão por intervalo, com testes cobrindo
      horário de verão, "editar só este" e "excluir só este"
- [ ] CRUD de tarefas: prazo, prioridade, concluir, subtarefas, reordenar
- [ ] Visão de mês (grade), semana e dia (grade de horas), e lista de próximos
- [ ] Navegação de datas, "hoje", linha de agora
- [ ] Criar evento clicando/arrastando na grade
- [ ] Arrastar para mover e redimensionar para mudar a duração
- [ ] Paleta de comandos (`Cmd/Ctrl+K`) e atalhos de teclado
- [ ] Layout responsivo, com a visão de dia como padrão no celular

**Pronto quando:** dá para usar como agenda pessoal de verdade, sem compartilhar nada.

> **Risco desta fase:** a recorrência. É a parte onde quase todo projeto de calendário
> erra. Escreva os testes de `libs/domain` **antes** da interface — depois, com a tela
> pronta, a tentação de "resolver no front" é grande e o resultado divergente.

---

## Fase 3 — Compartilhamento · ~1 semana e meia

- [ ] Convites por e-mail e por link, com token de uso único e expiração
- [ ] Aceitar/recusar convite, entrada na agenda
- [ ] Gestão de membros: alterar papel, remover, sair da agenda
- [ ] `CalendarAccessGuard` aplicando a matriz de papéis em toda rota
- [ ] Visibilidade `PRIVATE` filtrada na query, com teste que prova que o evento
      privado de A não aparece na resposta da API para B
- [ ] Sobreposição de agendas, com seletor na barra lateral e cor por membro
- [ ] Participantes e RSVP nos eventos
- [ ] Atribuir tarefa a um membro
- [ ] Feed de atividade da agenda
- [ ] Socket.IO: salas por agenda, aplicação das mutações ao estado local

**Pronto quando:** duas abas com usuários diferentes, lado a lado, uma cria um evento e
a outra o vê aparecer sem recarregar.

---

## Fase 4 — Customização e tema · ~1 semana

- [ ] Os quatro presets implementados e com contraste verificado
- [ ] Seletor de cor de acento, com derivação OKLCH
- [ ] Preferências: densidade, formato de hora, início da semana, visão padrão,
      início/fim do dia, mostrar fins de semana
- [ ] Preferências persistidas no servidor e aplicadas antes do primeiro paint
      (sem piscar branco ao carregar no tema escuro)
- [ ] Cor e ícone por agenda, mais o override pessoal por membro
- [ ] Fundo orbital, linha de agora animada, esqueletos de carregamento
- [ ] Motion: transições de visão, abertura de detalhe, criação e conclusão
- [ ] `prefers-reduced-motion` e a opção manual, as duas funcionando

**Pronto quando:** trocar preset, acento e densidade muda a aplicação inteira
coerentemente, e nada fica ilegível em nenhuma combinação.

---

## Fase 5 — Notificações e lembretes · ~1 semana

- [ ] Chaves VAPID, service worker, assinatura e remoção de push
- [ ] Lembretes por evento e por tarefa, com múltiplos deslocamentos, por usuário
- [ ] BullMQ: jobs delayed, worker com revalidação contra o banco antes do envio
- [ ] Cron diário reabastecendo a janela dos recorrentes
- [ ] Limpeza de assinaturas mortas em resposta a 404/410
- [ ] Notificações in-app: central, contador de não lidas, marcar como lida
- [ ] Horário de silêncio e resumo diário
- [ ] Preferências de notificação por agenda (`isMuted` do membro)

**Pronto quando:** um evento criado para dentro de 2 minutos gera a notificação no
celular, e um evento excluído antes disso **não** gera.

---

## Fase 6 — PWA e implantação · ~4 dias

- [ ] Manifest, ícones, splash, instalável no Android e no iOS
- [ ] Service worker com cache de shell e funcionamento offline em leitura
- [ ] Dockerfiles multi-stage para web e api
- [ ] Decisão de hospedagem (ver [arquitetura](02-arquitetura.md)) e deploy
- [ ] Domínio, TLS, backup automático do Postgres
- [ ] Sentry ou equivalente para erros, e health checks

**Pronto quando:** o Norbit está instalado na tela de início do seu celular, rodando no
domínio real, e o banco tem backup.

---

## Fase 7 — Polimento · contínuo

- [ ] Playwright cobrindo os fluxos críticos: cadastro, criar evento, compartilhar,
      receber lembrete
- [ ] Auditoria de acessibilidade com axe nos quatro presets
- [ ] Orçamento de performance: mês com 500 eventos renderizando em menos de 100 ms
- [ ] Estados vazios, estados de erro, estados de carregamento — todos desenhados
- [ ] Textos de interface revisados (o microcopy é metade da sensação de qualidade)
- [ ] Onboarding da primeira sessão

---

## Depois do MVP

Ideias registradas para não se perderem, em ordem de valor percebido:

1. **Importar/exportar `.ics`** — o pedido mais provável de quem for usar
2. **Sincronização com Google Calendar** — os campos `externalId`/`externalSource` já
   existem no esquema para isso
3. **Capacitor** — APK Android e build iOS, com push nativo
4. **Encontrar horário livre** — interseção de disponibilidade entre membros
5. **Anexos** em eventos e tarefas
6. **Widgets** de tela inicial (exige Capacitor)
7. **Exportar a "trajetória"** do mês como imagem bonita para compartilhar

---

## Totais

| Fase                 | Estimativa         |
| -------------------- | ------------------ |
| 0 — Fundação         | ✅ concluída       |
| 1 — Contas           | 4 dias             |
| 2 — Núcleo           | 2 semanas          |
| 3 — Compartilhamento | 1,5 semana         |
| 4 — Tema             | 1 semana           |
| 5 — Notificações     | 1 semana           |
| 6 — PWA e deploy     | 4 dias             |
| **MVP completo**     | **~7 a 8 semanas** |

É uma estimativa de trabalho concentrado. Em ritmo de projeto noturno e de fim de
semana, conte com três a quatro meses — e note que **a fase 2 sozinha vale mais que as
fases 4, 5 e 6 juntas** em termos de produto. Se o tempo apertar, é melhor ter o núcleo
impecável e o tema simples do que o contrário.

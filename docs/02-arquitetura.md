# 02 — Arquitetura

## Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Monorepo | **Nx** | Generators para Angular e NestJS, build por afetados, tipos compartilhados sem publicar pacote |
| Front-end | **Angular** (major atual, 20+) com standalone components e signals | Estrutura opinativa, DI de primeira classe, escala bem com o projeto crescendo |
| Estilo | **Tailwind CSS** + CSS custom properties | Tokens de tema trocáveis em runtime, sem recompilar |
| Motion | **GSAP** + Angular Animations + View Transitions API | Timelines orbitais precisas e transições de rota suaves |
| Back-end | **NestJS** (11+) | Módulos, DI e decorators espelham o modelo mental do Angular |
| ORM | **Prisma 7** | Esquema declarativo como fonte da verdade, migrations versionadas, tipos gerados |
| Banco | **PostgreSQL 17** (Docker) | `timestamptz`, `jsonb`, ranges e índices GIST — tudo que uma agenda precisa |
| Cache / filas | **Redis** + BullMQ | Agendamento dos lembretes, rate limit, sessões |
| Tempo real | **Socket.IO** (gateway NestJS) | Agenda compartilhada atualizando ao vivo |
| Validação | **Zod** em lib compartilhada | Um único schema valida no front e no back |
| Testes | Vitest / Jest + Playwright | Unidade no domínio, E2E nos fluxos críticos |

> **Versões:** confirme a major atual de Angular e NestJS no momento do `nx init` em
> vez de fixar pelos números acima — o ciclo de release do Angular é semestral.
>
> **Node:** a sua máquina está no Node 22.14. Fixe o Prisma na major 7; a 8 (em RC)
> exige Node ≥ 22.18. Vale adicionar um `.nvmrc` para travar a versão do projeto.

## Estrutura do monorepo

```
norbit/
├─ docker-compose.yml           # postgres · redis · adminer
├─ .env.example
├─ prisma/
│  ├─ schema.prisma             # fonte da verdade do banco
│  └─ migrations/
├─ apps/
│  ├─ web/                      # Angular
│  │  └─ src/app/
│  │     ├─ core/               # interceptors, guards, auth, socket, config
│  │     ├─ layout/             # shell, navegação, comando (Cmd+K)
│  │     ├─ features/
│  │     │  ├─ auth/
│  │     │  ├─ calendar/        # visões de mês/semana/dia/agenda
│  │     │  ├─ events/
│  │     │  ├─ tasks/
│  │     │  ├─ sharing/         # convites, membros, papéis
│  │     │  ├─ notifications/
│  │     │  └─ settings/        # tema, preferências, perfil
│  │     └─ ui/                 # design system: botões, campos, modais, motion
│  └─ api/                      # NestJS
│     └─ src/
│        ├─ auth/               # login, refresh, guards, hashing
│        ├─ users/
│        ├─ calendars/          # agendas + membros + convites
│        ├─ events/             # eventos + recorrência + exceções
│        ├─ tasks/
│        ├─ reminders/          # produtor BullMQ
│        ├─ notifications/      # web push + in-app
│        ├─ realtime/           # gateway Socket.IO
│        ├─ activity/           # feed de atividade
│        └─ prisma/             # PrismaService
└─ libs/
   ├─ contracts/                # DTOs + schemas Zod + tipos de resposta
   ├─ domain/                   # regras puras: recorrência, permissões, conflitos
   └─ design-tokens/            # tokens de tema gerados para CSS e TS
```

O ponto mais importante dessa estrutura é `libs/domain`: **as regras de recorrência,
de permissão e de detecção de conflito são código puro, sem Angular e sem NestJS.**
Isso permite testá-las isoladamente e usá-las nos dois lados — o front calcula as
ocorrências de uma recorrência para pintar o calendário com exatamente a mesma função
que o back usa para disparar os lembretes. Sem essa lib, essa lógica seria duplicada
e as duas cópias divergiriam.

## Fluxo de camadas no back-end

```
HTTP/WS  →  Controller  →  Service  →  Repository (Prisma)  →  Postgres
                 ↓            ↓
            Zod (contracts)  libs/domain (regras puras)
```

Regra: controller não conhece Prisma, service não conhece HTTP. Toda consulta que
envolve agenda compartilhada passa por um `CalendarAccessGuard` que resolve o papel do
usuário naquela agenda antes de qualquer leitura ou escrita.

## Autenticação

Autenticação própria, sem provedor externo no MVP:

- Senha com **Argon2id** (não bcrypt — Argon2 é o padrão atual recomendado)
- **Access token** JWT curto (15 min) em memória no front
- **Refresh token** opaco, rotativo, em cookie `httpOnly` + `Secure` + `SameSite=Lax`,
  com hash armazenado na tabela `Session`
- Rotação detecta reúso: se um refresh já usado reaparece, a família de sessões é
  revogada (defesa contra roubo de token)
- Convites por token de uso único com expiração

OAuth (Google/Apple) fica para depois; o modelo de dados já tem a tabela
`OAuthAccount` prevista para não exigir migration estrutural na época.

## Permissões

Quatro papéis, resolvidos sempre no servidor:

| Papel | Ver | Criar | Editar próprio | Editar de outros | Convidar | Config. agenda |
|---|---|---|---|---|---|---|
| `OWNER` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `EDITOR` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `CONTRIBUTOR` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `VIEWER` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

Independente do papel, um evento com `visibility = PRIVATE` só aparece para quem o
criou. Para os demais membros ele simplesmente não existe na resposta da API — não é
escondido no front-end, onde seria recuperável via DevTools.

## Tempo real

Socket.IO com uma sala por agenda (`calendar:{id}`). Ao entrar na aplicação, o cliente
se inscreve nas salas das agendas visíveis. Mutações emitem eventos tipados
(`event.created`, `event.updated`, `task.completed`, `member.joined`) que o Angular
aplica ao estado local. Se o socket cair, o cliente refaz um fetch do intervalo visível
na reconexão — a verdade está sempre no banco, o socket é só o atalho.

## Lembretes

Lembrete não pode ser `setTimeout`: o processo reinicia e tudo se perde.

1. Ao criar/editar um evento, o service calcula as próximas ocorrências dentro de uma
   janela (ex.: 60 dias) e agenda jobs **delayed** no BullMQ
2. Um worker consome o job, revalida contra o banco (o evento pode ter mudado ou sido
   excluído) e só então envia
3. Um job cron diário reabastece a janela para eventos recorrentes de longo prazo

Essa revalidação antes do envio é o que impede o clássico "recebi lembrete de um evento
que eu já tinha cancelado".

## Docker

Em desenvolvimento, **só a infraestrutura roda em container**: Postgres, Redis e
Adminer. Angular e NestJS rodam no host via `nx serve`, porque hot reload dentro de
container no Windows é lento e sofre com file watching. Isso é uma escolha consciente
de produtividade, não uma limitação.

Para produção existirá um `Dockerfile` multi-stage por app — mas isso só é escrito na
fase de deploy, quando a hospedagem estiver decidida.

## Caminho para produção (postergado, não esquecido)

A arquitetura é deliberadamente portável. Quando chegar a hora, estas são as opções,
e nenhuma exige reescrever código:

| Opção | Como fica | Custo/Esforço |
|---|---|---|
| VPS (Hetzner/Contabo) + Docker Compose | Tudo num servidor, Caddy com TLS automático | ~€5/mês, mais trabalho manual |
| Railway / Render | Push e sobe, Postgres e Redis gerenciados | Grátis para começar, simples |
| Vercel (web) + Fly.io (api) + Neon (banco) | Cada peça no melhor lugar | Grátis no início, mais partes móveis |

O que mantém essa portabilidade: Postgres puro com migrations Prisma, zero dependência
de recurso proprietário de nuvem, e toda configuração via variável de ambiente.

## Empacotamento mobile

1. **Agora:** PWA — manifest, service worker, instalável no Android e no iOS pelo
   "Adicionar à Tela de Início". Resolve o pedido de "quero que seja app" sem loja
2. **Depois:** Capacitor envolvendo o mesmo build Angular, gerando APK Android e
   projeto Xcode para iOS. O Angular não muda; só se adicionam plugins nativos onde
   fizer diferença (push nativo, haptics, biometria)

A limitação real a saber desde já: no iOS, Web Push em PWA funciona **apenas** quando o
app foi instalado na tela de início (iOS 16.4+). É a razão pela qual o Capacitor
eventualmente entra.

## Nota sobre `anthropic-model-router/`

Esse diretório é ferramenta interna de desenvolvimento, não parte do produto, e **não é
versionado** — está no `.gitignore`. Ele vive só na máquina local.

Uma observação sobre ele: **os IDs de modelo estão desatualizados**
(`claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5` não existem). Os atuais são:

```ts
const MODEL_IDS: Record<ModelTier, string> = {
  haiku:  "claude-haiku-5-5",
  sonnet: "claude-sonnet-5-5",
  opus:   "claude-opus-5-5",
};
```

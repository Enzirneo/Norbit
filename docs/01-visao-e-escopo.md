# 01 — Visão e Escopo

## O que é o Norbit

Uma agenda pessoal que se abre para outras pessoas. Cada usuário tem suas próprias
agendas e escolhe quais compartilhar, com quem e em que nível. O ponto central do
produto não é "marcar reunião" — é **saber o que está acontecendo na vida de quem
importa para você**, sem precisar perguntar.

O nome vem de *orbit*: pessoas que orbitam em volta umas das outras, cada uma no seu
próprio ciclo, visíveis entre si.

## Para quem

Grupos pequenos e de alta confiança: um casal, uma família, um grupo de amigos, uma
dupla de sócios. Não é uma ferramenta corporativa de agendamento. Isso tem
consequências concretas de design:

- Convites por link/e-mail direto, sem diretório de organização
- Nenhum conceito de "sala", "recurso" ou "disponibilidade de equipe"
- Privacidade granular importa mais que gestão: eu quero compartilhar minha agenda
  *e ainda assim* ter eventos que ninguém vê

## Princípios de produto

1. **Bonito não é enfeite.** A qualidade visual e o motion são requisito, não polimento
   final. Isso entra no planejamento desde a fase 0, via design tokens.
2. **Temática espacial sutil.** Vocabulário e estética orbital na medida — gradientes
   profundos, movimento orbital em transições, nomenclatura leve. Sem exageros de
   ficção científica: o produto é uma agenda, precisa ser legível em 2 segundos.
3. **Customizável de verdade.** Tema, cores por agenda, densidade, primeiro dia da
   semana, visão padrão. O usuário molda a ferramenta.
4. **Web primeiro, app depois.** PWA instalável resolve Android e iOS hoje sem loja,
   sem taxa e sem revisão. Capacitor entra quando houver motivo real (push nativo,
   widgets, publicação).

## Escopo do MVP

Todos os quatro blocos foram confirmados como parte da primeira versão utilizável.
A ordem de execução está no [roadmap](05-roadmap.md).

### A. Núcleo da agenda
- Conta própria com e-mail e senha, sessão persistente
- Agendas pessoais (criar, renomear, cor, arquivar)
- Eventos: título, descrição, local, início/fim, dia inteiro, recorrência
- Tarefas: título, notas, prazo, concluir, prioridade, responsável
- Visões de mês, semana, dia e uma lista de "próximos"

### B. Compartilhamento
- Convidar pessoas para uma agenda por e-mail ou link
- Papéis: dono, editor, colaborador, leitor
- Sobreposição das agendas de várias pessoas, cada uma com sua cor
- Eventos marcados como privados ficam invisíveis para os outros membros
- Feed de atividade: quem criou ou mudou o quê

### C. Customização e tema
- Temas (claro, escuro e variantes orbitais) com cor de acento escolhida
- Cor e ícone por agenda, mais um override pessoal de cor por membro
- Densidade da visão, formato de hora, primeiro dia da semana, visão padrão
- Respeito a `prefers-reduced-motion` e opção manual de reduzir animações

### D. Notificações e lembretes
- Lembretes por evento, com múltiplos deslocamentos (10 min antes, 1 dia antes…)
- Web Push, com service worker
- Notificações in-app para convites, mudanças e atribuições
- Resumo diário opcional

## Fora do escopo (explicitamente)

Registrado para não virar escopo acidental:

- Sincronização bidirecional com Google Calendar / Apple Calendar — depois, via CalDAV
  ou ICS. O modelo de dados já prevê os campos (`externalId`, `externalSource`)
- Chat ou comentários em eventos
- Fuso horário por evento com conversão visual completa (o MVP guarda tudo em UTC e
  exibe no fuso do usuário, o que resolve 99% dos casos de um grupo próximo)
- Anexos de arquivo
- Publicação em App Store / Play Store
- Múltiplas organizações / workspaces

## Como saberemos que o MVP está pronto

Duas pessoas em dispositivos diferentes conseguem, sem instruções:
criar conta, criar uma agenda, compartilhá-la, ver os eventos uma da outra na mesma
tela em cores distintas, receber um lembrete e trocar o tema sem que nada quebre.

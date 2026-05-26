# RS-SCOUT — Plano de adequação do app completo

> Documento de escopo. Foi fechado em conversa antes de qualquer código.
> A EXECUÇÃO deve ser feita no Claude Code (arquivo grande, trabalho amplo
> e multi-sessão, testes rodando localmente). Este documento + o
> CONTEXTO_RS-SCOUT.md + o rs-scout-kit.zip são o ponto de partida lá.

## Objetivo

Hoje o app tem duas faces que não conversam: o "app geral" (visual claro
antigo, abas) e o "torneio USA" (visual escuro de transmissão, página
isolada por token + senha). O torneio USA ficou bonito e aprovado.

A adequação faz o **visual e o fluxo do torneio virarem o padrão de todo o
app**. O app inteiro passa a ser escuro, com cards, logo RS à direita como
marca d'água. O torneio USA deixa de ser página especial e vira só mais um
card — selado como histórico.

## Decisões de arquitetura (fechadas com o cliente)

1. **Torneios viram a tela inicial.**
   Após o login, o usuário cai nos CARDS DE TORNEIOS. Cada card de torneio
   abre os CARDS DE JOGOS daquele torneio. Cada jogo abre o scout.
   As abas atuais (Scout, Agenda, Stats, Perfil, Config) NÃO somem — viram
   um menu secundário, ainda acessível, repaginado no tema escuro.
   NÃO existe "listão" de jogos: a consulta de jogos é sempre via cards.

2. **Torneio USA = histórico, card cinza/selado, só leitura.**
   O torneio USA abre normalmente, mas em modo somente-leitura: sem criar
   jogo, sem editar jogo, sem marcar scout. Visualmente o card é
   cinza/selado (selo "ENCERRADO"), distinto dos torneios ativos.
   É preciso criar a noção de "torneio encerrado/histórico" — hoje não
   existe essa flag.

3. **Sem senha por torneio. O login geral basta.**
   O fluxo paralelo `?torneio=usa` + senha (`TOURNEY_ACCESS`,
   `torneioMode`, senha de acesso/admin do torneio) é REMOVIDO. Quem está
   logado no app acessa os torneios conforme seu papel (admin/coord/
   scouter/atleta). O USA deixa de ser página isolada.

## Estado do app hoje (mapa, para referência)

App de arquivo único `index.html` (~410KB). Render central em `render()`,
que roteia por `tab`:
- `rCfg`   — aba Config (inclui sub-aba Usuários / gestão de papéis)
- `rSct`   — aba Scout (tem modo scouter e modo visitante/atleta)
- `rTor`   — aba Torneios: JÁ tem listagem (`rTor`) + detalhe (`rTorDetail`)
- `rAge`   — aba Agenda (jogos com filtros por torneio/categoria)
- `rSts`   — aba Stats (privada: coord/scouter/atleta)
- `rPerfilAtleta` — aba Perfil do atleta

O torneio USA é um modo à parte: `torneioMode` → `renderTorneioIsolado()`,
fora do fluxo de abas. É esse modo que tem o visual escuro bonito hoje
(`renderTorneioCards`, `renderGameDayCard`, tela de scout do torneio,
painel AO VIVO, criar/editar/excluir jogo).

PONTO-CHAVE: a aba Torneios já tem a estrutura "lista → detalhe". A
adequação aproveita isso — não constrói do zero. O trabalho é migrar o
VISUAL escuro (que hoje só existe no modo isolado) para a aba Torneios e
para as demais, e dobrar os dois fluxos num só.

## Linguagem visual a propagar (já aprovada no torneio USA)

- Fundo escuro navy em gradiente (`#0c1322 / #141d33 / #0a0f1c`).
- Logo RS como marca d'água à direita (`var(--rs-watermark)`, ~7% opacidade).
- Bebas Neue nos números e títulos grandes; Inter no corpo.
- Acento dourado (`#fbbf24`) para destaques; azul (`#2563eb`) para ação.
- Cards com borda sutil clara, brilho interno, sombra funda.
- Selos no canto do card (padrão já usado: "PRÓXIMO JOGO", "FINALIZADO").
- Semáforo verde/amarelo/vermelho para indicadores.
- Classes namespaced: `sc-*` (scout), `gd-*` (game day card), `lv-*`
  (painel ao vivo), `tnj-*` (modal de jogo). Seguir esse padrão.

## Funcionalidades que o novo fluxo precisa ter

Por torneio (cards de jogos), o que o USA já tem e deve valer para todos:
- Criar novo jogo (formulário tnj-*).
- Editar jogo pendente.
- Excluir jogo.
- Cards de jogo (GAME DAY) — PODEM SER MENORES, já que torneios ativos
  terão mais jogos. Ajustar densidade do `gd-card`.
- Ordenação dos jogos: mais recente em cima (já feito no USA).
- Selo "PRÓXIMO JOGO" no próximo jogo pendente (já feito no USA).
- Painel AO VIVO (já feito no USA).

Falta criar (NÃO existe hoje):
- Noção de torneio "ativo" vs "encerrado/histórico" (flag no torneio).
- Tela/card de gestão de torneios: criar torneio, marcar como encerrado.
- Modo somente-leitura para torneio encerrado.

## Ordem de execução sugerida (para o Claude Code)

Fazer em fatias pequenas, cada uma com seus testes, na ordem:

FASE A — Fundação visual
  A1. Tema escuro global: variáveis CSS, fundo, marca d'água, tipografia.
      Aplicar ao shell do app (header, tabs) sem ainda mexer no conteúdo.
  A2. Repaginar a aba Torneios (`rTor` + `rTorDetail`) no tema escuro,
      reusando os cards do torneio USA. Esta vira a tela inicial.

FASE B — Unificar o fluxo de torneios
  B1. Dobrar o "modo isolado USA" e a "aba Torneios" num fluxo só.
      Remover `torneioMode` / `renderTorneioIsolado` / `?torneio=usa`.
  B2. Migrar criar/editar/excluir jogo e painel AO VIVO para funcionarem
      na aba Torneios unificada (hoje só funcionam no modo isolado).
  B3. Remover `TOURNEY_ACCESS` e as senhas de torneio. Acesso passa a ser
      pelo login geral + papéis.

FASE C — Histórico
  C1. Criar a flag de torneio encerrado + a UI para marcá-lo.
  C2. Card cinza/selado "ENCERRADO" + modo somente-leitura.
  C3. Marcar o torneio USA como encerrado (vira histórico).

FASE D — Demais abas
  D1. Repaginar Scout, Agenda, Stats, Perfil, Config no tema escuro.
  D2. Transformar as abas num menu secundário (a tela inicial é Torneios).

Cada fase = uma ou mais sessões. Cada mudança = testes antes de entregar.
NÃO tentar fazer tudo de uma vez.

## Riscos e cuidados (ler antes de codar)

- A FASE B mexe na estrutura, não no visual. É a mais arriscada: remover
  `torneioMode` toca navegação, deep-link, sessão. Cada passo precisa de
  teste de regressão (os 8 testes atuais + novos).
- NUNCA remover o guard `_dataLoaded` do `save()`.
- O torneio USA tem dados reais de jogos. Ao virar histórico, esses dados
  NÃO podem ser perdidos nem alterados — o modo leitura existe justamente
  para protegê-los.
- A remoção de `TOURNEY_ACCESS` precisa garantir que ninguém que hoje
  acessa o USA por senha fique de fora — todos passam a entrar pelo login.
- Preview com moldura de celular não testa `@media`. Conferir o tema
  escuro em tela real / CSS mobile forçado.

## Não está neste escopo

- White-label / virar SaaS (marca como configuração por cliente).
- Os PDFs antigos (`exAthPDF` etc.) — decisão anterior: deixar como estão.
- Webhook Coolify, DNS Locaweb, Firebase Rules — pendências de infra,
  tratar à parte.

# RS-SCOUT — Documentação do Projeto

> Retrato completo do projeto em **2026-07-02**. Build no código: `APP_BUILD 2026-06-24p`.
> Este documento substitui o antigo `docs/CONTEXTO_RS-SCOUT.md` (de 26/05, obsoleto).
> Serve tanto de referência para continuar o RS-SCOUT quanto de base para derivar outro app.

---

## 1. O que é

**RS-SCOUT** = aplicativo web de **scout (estatística) de vôlei**, usado **ao vivo em quadra**
pela comissão técnica da Associação Escola de Voleibol (RS). Registra cada ação da partida
(saque, recepção, levantamento, ataque, bloqueio, defesa) com resultado, gera placar,
estatística por atleta e relatório em PDF. Erro de registro = dado perdido em tempo real,
então robustez e simplicidade de operação são prioridade.

Uso real: mesa de scout numa partida, muitas vezes por uma pessoa só, no tablet ou celular.

---

## 2. Stack & arquitetura

- **Front-end:** arquivo **único** `index.html` (~796 KB, **7.744 linhas**, HTML + CSS + JS
  **inline**, sem build step, sem framework, JS vanilla). Encoding CRLF; várias strings usam
  escapes `\uXXXX`/`\u{...}` (atenção ao editar — o texto casado precisa bater com a forma
  escapada).
- **Back-end / dados:** **Firebase Realtime Database** (RTDB), projeto `scola-volei`
  (`databaseURL: scola-volei-default-rtdb`). Sem servidor próprio. Leitura/escrita direto do
  client via SDK do Firebase. A `apiKey` no HTML é pública **por design** (padrão Firebase);
  a segurança real vem das Security Rules + Auth.
- **Auth:** Firebase Auth (Google + email/senha), perfis e papéis em `users/{uid}`.
- **Hospedagem:** GitHub → **Coolify** (deploy **manual**, ver §7).
- **Testes:** Node + **jsdom** com um **mock do Firebase** (sem rede). 38 arquivos.

Filosofia: single-file, zero dependência de runtime, tudo versionado num `index.html`.
Fácil de servir (qualquer host estático), difícil de escalar em manutenção (arquivo gigante).

---

## 3. Estrutura do repositório

```
APP SCOUT/
├── index.html            ← O APP INTEIRO (HTML+CSS+JS, 7.744 linhas)
├── firebase-rules.json   ← Security Rules do RTDB (versionadas; aplicar no console)
├── serve-local.cjs       ← servidor estático local p/ abrir o app sem deploy
├── package.json          ← só dev-deps de teste (jsdom)
├── README.md             ← praticamente vazio (1 linha)
├── HANDOFF_PROXIMA_SESSAO.md ← handoff da última sessão (próximos passos)
├── PROJETO_RSSCOUT.md    ← ESTE documento
├── .claude/
│   ├── launch.json       ← config do preview (dev server)
│   └── settings.local.json
├── docs/                 ← docs ANTIGOS (26/05, defasados): CONTEXTO, PLANO_ADEQUACAO, SKILL
├── tests/                ← 38 test_*.js (jsdom + mock Firebase)
├── preview/              ← mockups e geradores de snapshot (_gen-*.cjs) — não versionar geral
├── legacy-usa-import/    ← import legado do torneio USA (histórico)
└── node_modules/         ← jsdom etc.
```

> **Importante:** a `.claude/` **do projeto** guarda só config do preview.
> A **memória do assistente** (que persiste entre sessões) fica FORA do repo, em
> `C:\Users\RBENTO\.claude\projects\C--Users-RBENTO-Documents-GitHub-APP-SCOUT\memory\`.
> Ver §12.

---

## 4. Modelo de dados (Firebase RTDB)

Raiz de dados: **`torneio-master-santos/`** com 6 nós:

| Nó            | Conteúdo                                                              |
|---------------|----------------------------------------------------------------------|
| `teams`       | equipes `{id,n,c(cor),logo,roster:[{aid}]}`                          |
| `athletes`    | atletas `{aid,nm,po(posição),nu(número)}`                            |
| `tournaments` | torneios `{id,n,cat,season,color,...}`                               |
| `games`       | jogos (o coração) — ver abaixo                                       |
| `invites`     | convites de cadastro                                                  |
| `users`       | perfis/papéis `{uid,email,roles:[...],athleteId}`                    |

**Jogo (`games/{idx}`)** — campos principais: `id`, `torId`, `tid` (equipe), `opp`
(adversário), `st` (status: `pending`/`live`/`done`), `ss` (sets: `[{u,t,sq}]` — `u`=nós,
`t`=adversário, `sq`=sequência de pontos), `act` (ações registradas), `lineup`, e
`court`/`courtMode` (posicionamento em quadra, opt-in).

Lidos com `.on("value")` (tempo real → re-render). Gravados de forma **granular** por
jogo com `saveGame(g)` (grava só `games/{idx}`, leve, para o telão atualizar rápido).

> **Dívida técnica conhecida (C1):** jogos são indexados por **posição no array** (`games/idx`),
> não por id. Se a ordem do array muda, uma escrita pode cair no jogo errado. O fix real é
> **migração keyed-by-id** (`games/{id}` em vez de `games/{idx}`) — pendente (ver §11).

---

## 5. Funcionalidades

### Scout (registro de ações)
- **Por ponto:** `rcO` (registra ação+resultado), `scUp`/`scDn` (placar +/−). Grava com
  `saveGame`. `undo` reverte ação e ponto juntos.
- **Ponto automático (`autoScoreSide`):** Ace / Ataque-Ponto / Bloqueio-Ponto sobem o nosso
  placar; Saque/Ataque/Bloqueio com **Erro**, e **Recepção/Defesa com Erro**, sobem o
  adversário; Ataque **Bloqueado** = ponto adversário.
- **Correção de atleta:** `reassignActions(gid,from,to,setNum?)` reatribui ações de um atleta
  para outro (mantém placar, muda só a estatística). Disponível em jogo `live` e `done`.

### Modo Quadra (`courtMode`, opt-in por jogo)
Posicionamento 1–6 (`cs.pos`), rotação automática no side-out, quem saca (`serving`),
substituição, líbero. Setup obriga escalar os 6 (quadra **inicia vazia**), bloqueia líbero
na frente (P2/P3/P4) e exige escolher quem saca.

### Modo Tablet (landscape, 1 toque)
Tela dedicada `rSctTablet` (ativada por **botão/localStorage**, nunca por largura de tela).
3 colunas: quadra | botões combinados fundamento+resultado que gravam em 1 toque
(`scTap`, reusa `rcO`) | controles+feed. Toggles Quadra/Lista e rótulo A-B-C/Verbal,
líberos como cards, pedidos de tempo por set, ladder (sequência de pontos), atalhos de teclado.

### Modo Note (scout 100% teclado, estilo Data Volley)
Seleciona o atleta **digitando o número**. 1ª tecla decide: letra (atleta já em foco →
grava `A 3`); dígito (monta o número, a letra fecha → `10 A 3`). `_sctKeydown`, visor mostra
qualidades válidas do fundamento armado.

### Torneios & "cards rápidos" (`?torneio=<token>`)
Torneios standalone configurados em `TOURNEY_ACCESS[token]`: `standalone` (página isolada),
`openAccess` (sem senha), branding próprio. 1 equipe (`teamId`+`rosterVar`) ou multi-equipe
(`teamsVar`+`ensureStandaloneTeams`). Tokens atuais: `usa`, `pg` (legados), `minis`, `taca`.

### Telão (`?telao=<token>`)
`renderTelao` — tela cheia read-only que segue o jogo ao vivo do torneio (realtime + refresh
5 s). Sem senha.

### Relatórios / PDF
`exGamePDF` — relatório profissional da partida: 2 pizzas SVG (pontos ganhos/perdidos por
fundamento), eficiência % por atleta, sequência de pontos por set (só quando é real).
**`print-color-adjust:exact`** força as cores de fundo a saírem no PDF salvo. Há PDFs antigos
por atleta (`exAthPDF`, `exAllAthPDF`) mantidos como estão.

### Estatística ao vivo
Painel `📊 AO VIVO` (`openLivePanel`) — KPIs do time e por atleta, lê `gm.act`.

---

## 6. Autenticação & segurança

- **Entrada por senha** (não login Google): o gate `renderLoginGate` pede senha e faz
  `signInWithEmailAndPassword(MESA_EMAIL, senha)` numa **conta de serviço fixa**
  `mesa@rsvoleibol.com.br` (papel **coordenador**: marca/edita jogo/PDF, não é admin).
  As **senhas ficam com o Rodrigo, fora do código** (JS é público — senha hardcodada vazaria).
- **Gate 2 (só-comissão):** depois de logar, quem não tem papel (visitor/Google aleatório)
  cai em `renderNoAccess`. Conta-mesa e admin passam por email (anti-trava ao vivo).
- **Security Rules (`firebase-rules.json`):** leitura **pública** (`.read:true` — telão,
  cards, o app minis leem sem login), escrita **só autenticada** (`.write:"auth != null"`).
  `invites` fica `read:true` (o listener carrega antes do login). `users` é `read:auth`.
  **Já aplicadas no console — RTDB fechado** para escrita anônima.
- Choke point de escrita: 5 wrappers — `save()`, `saveGame`, `saveTeam`, `saveAthlete`,
  `saveChild` — todos exigem `currentUser`.

---

## 7. Deploy

- Repo GitHub: **`rodrigosvolei-creator/scout-master-santos`** (branch `main`, commit direto).
- GitHub → **Coolify** (`coolify.plataformacaf.digital`, app `scout-master-santos`
  uuid `z1yoxknyx5ldkkr0htopa6kg`).
- **AUTO-DEPLOY NÃO DISPARA.** Deploy é **MANUAL: botão Redeploy no Coolify.**
- Sempre bumpar `var APP_BUILD="..."` (aparece no rodapé `#buildStamp`) — é a forma de
  confirmar qual versão está no ar e matar dúvida de cache. **O app no ar costuma ficar
  builds atrás do código no GitHub** enquanto o Redeploy não é feito.

---

## 8. Testes

38 arquivos `tests/test_*.js`, rodados com `node tests/test_X.js` (jsdom + mock Firebase).
Regra do projeto: **rodar a suíte inteira antes de commitar**; mudança nova precisa de teste
novo (ou asserção nova). Cobrem: scout, autoscore, torneios, fases A/B/C/D, quadra (setup,
líbero, rotação, saque), tablet, modo note, PDF, gate de auth, galeria-first, minis, etc.

> Detalhe de teste (pegadinha recorrente): o mock do `saveGame` **deep-copia** o jogo (via
> JSON), então após um save o objeto anterior fica obsoleto — nos testes, **re-ler `gF`**
> depois de cada save, nunca cachear a referência do jogo.

Guard sagrado: **nunca remover o `_dataLoaded` do `save()`** (protege contra perda de dados —
houve incidente real de 249 ações perdidas).

---

## 9. Ecossistema (apps e domínios relacionados)

- **`scout.rsvoleibol.com.br`** — este app (RS-SCOUT).
- **`rsvoleibol.com.br`** — SITE institucional (repo `rsvoleibol-site`, deploy automático).
  Tem uma aba "RS Scout 🏐" na navbar apontando pro subdomínio do scout.
- **`minis.rsvoleibol.com.br`** — OUTRO app (repo `minis-junino-app`, Vite+React+TS+Supabase)
  que só **lê** o Firebase do RS-SCOUT para telão/classificação do torneio junino. Separado.

---

## 10. Convenções de código

- Commit direto na `main` (sem branch/PR), autoria `rodrigosvolei@gmail.com`.
- Hot path de scout: `rcO`/`scUp`/`scDn` → `saveGame` (leve). Evitar `save()` (reescreve os
  4 nós, pesado) fora de operações estruturais.
- Torneios standalone isolados do app principal por `isSpecialTour/isSpecialTeam/isSpecialGame`.
- Rótulos/cores de fundamentos: `ACT`, `OC` (outcome), `FCOL` (fundamento).

---

## 11. Pendências conhecidas / roadmap

- **Migração keyed-by-id (C1):** trocar `games/{idx}` por `games/{id}` — fix real do bug
  "grava no jogo errado". Precisa backup + autorização + validação com dados de produção.
- **Undo pós-reload:** o histórico de undo (`S.us`) é volátil; some ao recarregar.
- **Limpar cards legados USA/PG** do `TOURNEY_ACCESS` (senhas `usa2026`/`PG2026` ainda no
  código; com o banco fechado viraram decorativas). Antes, checar se há jogos vinculados.
- **Passo 2 — "Criador de Cards":** página separada que cria torneios/jogos e gera config
  (o RS-SCOUT vira um app configurável, não hardcoded). Em design (mockup em
  `preview/card-builder-mockup.html`).
- **Acesso admin:** hoje a senha entra como coordenador; "criar torneio"/"gerenciar usuários"
  pedem admin e não estão ligados (decisão: deixar como está). 3 caminhos documentados se
  quiser ligar depois.

---

## 12. Onde mora o contexto/memória do assistente

Separado do repositório, na pasta do usuário:

- **Memória do projeto** (persiste entre sessões):
  `C:\Users\RBENTO\.claude\projects\C--Users-RBENTO-Documents-GitHub-APP-SCOUT\memory\`
  → `MEMORY.md` (índice, lido em toda sessão) + ~15 arquivos `.md` (1 fato cada).
- **Instruções globais** (todos os projetos): `C:\Users\RBENTO\.claude\CLAUDE.md`.
- **Transcrições brutas das conversas:**
  `C:\Users\RBENTO\.claude\projects\C--Users-RBENTO-Documents-GitHub-APP-SCOUT\*.jsonl`.

> Para **partir para outro projeto**: o que é reutilizável aqui é o padrão single-file +
> Firebase RTDB + save-wrappers + gate por senha + `TOURNEY_ACCESS` (multi-torneio
> configurável) + modo tablet/note + geração de PDF client-side. O que é específico do RS é o
> branding, o roster e as regras de vôlei. O "Passo 2" (Criador de Cards) é justamente a rota
> para transformar este app num template configurável.

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
- **Testes:** Node + **jsdom** com um **mock do Firebase** (sem rede). 63 arquivos.

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
├── tests/                ← 63 test_*.js (jsdom + mock Firebase)
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

Lidos com `.on("value")` (tempo real → re-render). **No banco**, desde 18/09/2026 (C2):
`act` é **objeto chaveado** (`games/{idx}/act/{aid}`, id = `"a"+Date.now()+"_"+rand`, com
`dev` = aparelho que marcou) e `ss[i].sq` também (`ss/{i}/sq/{k}`, `k` ordena cronologicamente);
`ss[i].u`/`.t`/`.toU`/`.toT` são contadores. **Localmente** o app segue com arrays: o listener
passa cada jogo por `_gmNormalize` (act → array em ordem cronológica; sq → array + `sqk` com as
chaves alinhadas; jogo ainda no formato antigo ganha `_legacy=true`). Escrita no jogo ao vivo é
**granular** via `_gmUpdate(gm, up)` = `update()` multi-caminho só com o que mudou (ação nova,
`increment(±1)` no contador, entrada do sq, `ss/{n}`, `st`…); jogo `_legacy`
é convertido **junto com a 1ª escrita** (`_gmFixPaths`: apaga `act/0..n-1`, grava `act/{aid}`;
idem sq), sem migração em lote. `saveGame(g)` (jogo inteiro, serializado por `_gmSerialize`)
fica só pra criar/editar jogo e repetir escalação; `save()` serializa todos os jogos do mesmo
jeito. Campos internos (`_legacy`, `_actN`, `sqk`, `_sqN`) nunca vão pro banco.

> **Dívida técnica conhecida (C1):** jogos são indexados por **posição no array** (`games/idx`),
> não por id. Se a ordem do array muda, uma escrita pode cair no jogo errado. O fix real é
> **migração keyed-by-id** (`games/{id}` em vez de `games/{idx}`) — pendente (ver §11).
> O C2 (acima) não mexeu nisso: `_gmRef` ainda resolve o índice pela lista local.

> **Quadra (courtMode) é DERIVADA:** `court/{set}` guarda só a **base** (escalação declarada ou
> última edição manual: rodar, líbero, substituição) + `after` = chave do último ponto do `sq`
> já aplicado nela. O estado atual = base + replay (`courtApplyPoint`) dos pontos com chave >
> `after` (`_courtDerive`, no listener). **Ponto não grava a quadra** — 2 tablets rodando com
> estado velho convergem quando o `sq` completo chega. Consequência: "−" manual e `undo` tiram
> a entrada do `sq` e a rotação volta sozinha nos 2 aparelhos (antes o "−" não desfazia rotação;
> agora a quadra segue a sequência de pontos). `undo` só regrava a base se uma edição manual
> posterior já tinha "assado" o ponto nela (restaura o snapshot de antes do ponto, como antes).
> Base do formato antigo (sem `after`) já tem todos os pontos legados aplicados: `after` é
> inferido = última chave sintética do set e pinado no banco na conversão (`_courtAfterFix`).

> **Limites conhecidos do C2:** contadores podem ficar negativos se 2 aparelhos desfazem o
> mesmo ponto (visível na tela, corrige com "+"). Duas edições manuais de quadra simultâneas:
> a última grava (é coordenação humana). Versões **misturadas** do app (um tablet ainda no
> build antigo) reintroduzem o bug: o antigo grava o jogo inteiro em array por cima. Recarregar
> todos os aparelhos após o Redeploy.

---

## 5. Funcionalidades

### Scout (registro de ações)
- **Por ponto:** `rcO` (registra ação+resultado), `scUp`/`scDn` (placar +/−). Grava
  **granular** (`_gmUpdate`: `act/{aid}` + `increment` no contador + entrada do sq + quadra).
  `undo` reverte ação e ponto juntos — e é **por aparelho** (pilha `S.us` local): só tira o
  que este aparelho marcou, nunca a ação do colega no outro tablet.
- **Ponto automático (`autoScoreSide`):** Ace / Ataque-Ponto / Bloqueio-Ponto sobem o nosso
  placar; Saque/Ataque/Bloqueio com **Erro**, e **Recepção/Defesa com Erro**, sobem o
  adversário; Ataque **Bloqueado** = ponto adversário.
- **Correção de atleta:** `reassignActions(gid,from,to,setNum?)` reatribui ações de um atleta
  para outro (mantém placar, muda só a estatística). Disponível em jogo `live` e `done`.

### Modo Quadra (`courtMode`, opt-in por jogo)
Posicionamento 1–6 (`cs.pos`), rotação automática no side-out, quem saca (`serving`),
substituição, líbero. Setup obriga escalar os 6 (quadra **inicia vazia**), bloqueia líbero
na frente (P2/P3/P4) e exige escolher quem saca. Estado atual é **derivado** (base + replay do
`sq`, ver §4) — só escalar/rodar manual/líbero/substituição gravam `court/{set}`.

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
fundamento), eficiência % por atleta, sequência de pontos por set (só quando é real) e, desde
21/09/2026, a seção **"Fases do jogo"** (`_pdfFasesHTML`): SO% (side-out), FBSO% (1ª bola),
BP% (break point), origem/perda dos pontos, ataque e distribuição do levantamento por fase,
recepção × side-out, por atleta e legenda. Motor puro `rallyModel(gm)` (rally = trecho entre 2
pontos do `sq` com hora; sacador = vencedor do anterior) + `fasesStats(gm)`. Jogo no formato
antigo (sq sem hora) sai com tarja "estimado · cobertura N%" (rallies reconstruídos pela ordem
das ações). Teste: `tests/test_fases.js`.
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

63 arquivos `tests/test_*.js`, rodados com `node tests/test_X.js` (jsdom + mock Firebase).
`test_cores_e2e.js` demora ~7 min (torneio inteiro); os demais são segundos.
Regra do projeto: **rodar a suíte inteira antes de commitar**; mudança nova precisa de teste
novo (ou asserção nova). Cobrem: scout, autoscore, torneios, fases A/B/C/D, quadra (setup,
líbero, rotação, saque), tablet, modo note, PDF, gate de auth, galeria-first, minis, etc.

> Detalhe de teste (pegadinha recorrente): o mock do `saveGame` **deep-copia** o jogo (via
> JSON), então após um save o objeto anterior fica obsoleto — nos testes, **re-ler `gF`**
> depois de cada save, nunca cachear a referência do jogo.

> Desde o C2: o listener **repõe o estado do banco** a cada escrita — mutação local sem gravar
> (ex: `g.st='live'` direto no objeto) **se perde** na próxima escrita granular. Nos testes,
> usar o caminho real (`startG()`, `rcO()`…). Mock que exercita o hot path precisa de `update()`
> multi-caminho de verdade (null apaga, `{".sv":{increment:n}}` soma) — ver
> `test_games_multidevice.js` (2 aparelhos, aba suspensa, conversão do formato antigo) e
> `test_multidevice.js`. Os mocks antigos com `update()` vazio continuam válidos pra testes
> que só olham o estado local.

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
- Hot path de scout: `rcO`/`scUp`/`scDn`/`undo`/sets/quadra → `_gmUpdate` (granular, C2).
  `saveGame` só pra criar/editar jogo. Evitar `save()` (reescreve os 4 nós, pesado) fora de
  operações estruturais — **nunca** no meio de um jogo ao vivo.
- Torneios standalone isolados do app principal por `isSpecialTour/isSpecialTeam/isSpecialGame`.
- Rótulos/cores de fundamentos: `ACT`, `OC` (outcome), `FCOL` (fundamento).
- **Posição (função) do atleta é padronizada (21/09/2026):** 5 códigos fixos `POSK`
  (`lev/opo/pon/cen/lib`) com rótulo no **gênero** do atleta (`gender`) ou do time
  (`teamGender`: `t.gen` → nome FEM/MASC → maioria do roster): "Ponteira" / "Ponteiro" /
  "Ponteiro(a)" quando não se sabe. **Nunca texto livre**: toda tela usa `posOptions()` (select)
  e toda gravação passa por `posCanon()`; `posShow()` normaliza grafia antiga na exibição
  (perfil `pFind`, listas, PDF, quadra); `posGroup()` é o que as estatísticas por posição usam.
  Grafias antigas ("Ponteira/Oposta", "Levantadora", "Ponteiro") seguem no banco até a
  próxima edição do atleta — não houve migração em lote. Teste: `tests/test_posicoes.js`.

---

## 11. Pendências conhecidas / roadmap

- **Migração keyed-by-id (C1):** trocar `games/{idx}` por `games/{id}` — fix real do bug
  "grava no jogo errado". Precisa backup + autorização + validação com dados de produção.
  Próximo passo depois que o C2 (escrita granular, 18/09/2026) estiver estável em produção.
- **C2 — validar em produção:** depois do Redeploy, recarregar TODOS os tablets (build
  `2026-09-18b` no rodapé) e testar com 2 aparelhos num jogo de teste antes do jogo real.
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

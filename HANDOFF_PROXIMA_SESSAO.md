# Handoff — próxima sessão (2026-09-18, feito via Claude Opus 5 direto nesta pasta)

> Sessão anterior (ASV-SCOUT/Sonnet) só investigou e deixou o plano do **C2**. Esta sessão
> **implementou o C2 inteiro** (escrita granular no jogo, 2+ aparelhos no mesmo jogo) **e a
> quadra derivada** (rotação convergente entre tablets — o Rodrigo disse que sem isso não
> adiantava), com teste novo, docs atualizados, 2 commits na `main` e **push feito**. O
> **Redeploy no Coolify é manual e ainda não foi feito** — a correção só vale no ar depois
> dos passos da seção "Deploy" abaixo (é a 1ª vez que o app vai escrever no formato novo no
> banco real).

## O que foi feito (não precisa reinvestigar)

- **Código (`index.html`, build `2026-09-18b`)** — ver `PROJETO_RSSCOUT.md` §4 pra o modelo:
  - `act` vira **objeto chaveado** no banco (`games/{idx}/act/{aid}`), `ss[i].sq` também
    (`ss/{i}/sq/{k}`); placar `ss[i].u/.t` (e tempos `toU/toT`) sobem com
    `ServerValue.increment`. Localmente o app segue com arrays (`_gmNormalize` no listener).
  - Todo o caminho quente do scout grava via `_gmUpdate(gm, up)` = `update()` multi-caminho
    só com o que mudou: `rcO`, `scUp`, `scDn`, `scErrAdv`, `undo`, `nxS`, `delLastSet`,
    `resetSet`, `sctTimeoutAdd`, `enG` (finalizar), `startG`, `openG` (pendente), zerar
    partida, `reassignActions`, `toggleLockGame` e TODA a quadra (`courtConfirmSetup`,
    `courtManualRotate`, `courtLiberoSwap`, `courtSubDoIn`, `sctLibIn/Out`, `toggleCourtMode`,
    `courtSetPos`, `courtRepeatFromGame`, `rSctTablet`). Nenhum `save()`/`saveGame` sobrou
    no meio de um jogo ao vivo.
  - Jogo no formato antigo (array) é marcado `_legacy` e **convertido junto com a 1ª escrita
    granular** (`_gmFixPaths`, no mesmo `update()` — atômico). Sem script de migração.
  - `saveGame`/`save()` continuam existindo pra criar/editar jogo e serializam pelo formato
    novo (`_gmSerialize`). Campos internos (`_legacy`, `_actN`, `sqk`, `_sqN`) não vão pro banco.
  - Ação nova: `id = uid("a")` (`a<ms>_<rand>`, sem colisão entre aparelhos) e `dev` = aparelho
    (mesmo id de `_trnDev()`). Undo já era por aparelho (pilha `S.us` local) — só tira a própria.
  - **Quadra DERIVADA (commit 2):** `court/{set}` guarda só a base (escalação / última edição
    manual) + `after` (chave do último ponto do `sq` já aplicado). Estado atual = base + replay
    dos pontos do `sq` depois de `after` (`_courtDerive`, no listener). Ponto **não grava**
    quadra; "−" e `undo` desfazem rotação sozinhos (tiram a entrada do `sq`); só rodar
    manual/líbero/substituição/escalar gravam base nova. Base legada (sem `after`) já tem os
    pontos antigos aplicados → `after` inferido = última chave sintética, pinado na conversão.
- **Testes:** `tests/test_games_multidevice.js` (novo, 68 asserções: 2 aparelhos online, aba
  suspensa com estado velho, undo por aparelho, +/− manual, conversão do legado com 2º aparelho
  ainda velho, sets, tempos, **quadra: 2 tablets rodando com estado velho convergem, "−"
  desroda, rotação manual re-basea, jogo legado com quadra**, corrigir atleta, finalizar,
  `save()` inteiro). Mocks de
  `test_multidevice`, `test_autoscore`, `test_scout` ganharam `update()` de verdade. **Suíte:
  61/61** (o `test_cores_e2e.js` demora ~7 min; os outros 60 rodam em ~2 min).
- **Validado contra dados reais (só leitura):** o backup de 18/09 e o banco de produção aberto
  no navegador (sem login) — 35 jogos / 5.806 ações normalizam sem erro; 26 jogos são
  `_legacy` (converteriam na 1ª marcação); serializar→normalizar é idempotente; ladder do PDF
  continua "real" nos 26; **59 sets com quadra: derivada == gravada em todos**. Custo da
  normalização: ~3,5 ms por snapshot. Conversão do maior jogo (485 ações): 1.177 caminhos /
  67 KB num único `update()`.
- **Achado nos dados reais:** 2 jogos têm 3 pares de ações a 140–170 ms fora de ordem
  cronológica no array — assinatura do bug antigo (2 aparelhos, `set()` inteiro). Após a
  conversão, a ordem local passa a ser cronológica (pelo instante do id). Efeito prático nulo.
- **Docs:** `PROJETO_RSSCOUT.md` (§2, §3, §4, §5, §8, §10, §11) e `REVIEW_SCOUT.md` (C2 ✅).

## Limites conhecidos (documentados em PROJETO §4)

- Duas edições **manuais** de quadra ao mesmo tempo (rodar/líbero/substituição em 2 tablets):
  a última grava a base. Pontos nunca conflitam mais.
- `increment(-1)` em 2 aparelhos desfazendo o mesmo ponto pode deixar contador negativo
  (visível; corrige com "+").
- **Versões misturadas** (um tablet ainda no build antigo) reintroduzem o bug: o antigo grava
  o jogo inteiro em array por cima. O SW é network-first pro HTML — basta recarregar.
- C1 (`games/{idx}` → `games/{id}`) continua pendente; `_gmRef` ainda resolve o índice pela
  lista local. Próximo item depois que o C2 estiver estável em produção.

## Deploy — passo a passo (depende do Rodrigo)

1. Push já feito. Coolify **não redeploya sozinho**: apertar **Redeploy manual** no Coolify
   (app `scout-master-santos`).
2. Recarregar **todos** os aparelhos e confirmar `build 2026-09-18b` no rodapé (`#buildStamp`).
3. **Antes de jogo real:** criar um jogo de teste, iniciar, marcar com 2 aparelhos ao mesmo
   tempo (inclusive um em background por 1 min e voltando), desfazer nos dois, +/−, novo set,
   finalizar. **Em modo quadra:** os dois marcam pontos que rodam (side-out) e conferem que a
   quadra fica igual nos 2 tablets; um roda manual e o outro vê. Conferir no console do
   Firebase que `games/{idx}/act` virou objeto (chaves `a...`), `ss/0/sq` também, e que
   `court/1` tem `after`. Depois **excluir** o jogo de teste.
4. Só então usar num jogo de verdade. O 1º ponto marcado em cada jogo antigo faz a conversão
   dele (é esperado ver `act` virar objeto no console).
5. **Rollback não é só reverter o commit:** o build antigo lê `act` com `.length`/`slice` —
   um jogo já convertido (objeto) quebraria nele. Se precisar voltar depois de jogos
   convertidos, restaurar o backup (`C:\Users\rodri\Downloads\scola-volei-default-rtdb-
   torneio-master-santos-export.json`, 18/09 21:03, fora do repo) ou converter de volta com
   script. Por isso o jogo de teste primeiro (passo 3).

## Mencionado na conversa, mas NÃO combinado/planejado (não fazer sem pedir de novo)

- **Comando de voz** (Web Speech API) no RS-SCOUT: só foi levantado como possibilidade ("dá
  pra portar quase direto do ASV Scout, é JS puro, sem framework") — nunca virou plano, nunca
  foi confirmado como algo a fazer. Se o usuário quiser, é um item novo e separado do C2
  (feature nova, não correção de bug); não misturar no mesmo commit.
- **C3 (multi-tenant / SaaS)** — citado no REVIEW_SCOUT.md como o maior bloco de trabalho pra
  virar produto comercial; não discutido em profundidade, não está planejado.

## Antes de rodar qualquer script em produção

O backup de 18/09 21:03 existe (fora do repo). Esta sessão **não escreveu nada** no banco
real — só leitura. A 1ª escrita no formato novo acontece quando o build novo estiver no ar e
alguém marcar um ponto (Redeploy é decisão do Rodrigo).

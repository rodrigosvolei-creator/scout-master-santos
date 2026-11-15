# Handoff — próxima sessão (atualizado 2026-11-15, sessão "dois aparelhos + cache")

> **Estado em 15/11/2026 (leia primeiro).** O build **`2026-11-14a`** (commit `5192be7`) foi enviado,
> publicado pelo Rodrigo e conferido no ar em 15/11 (arquivos idênticos ao commit; usado em jogo real no
> mesmo dia). Depois dele veio o **`2026-11-15a`**: só texto do painel de erros ao vivo ("erro do
> adversário" separado de "ataque bloqueado" — o Rodrigo leu as duas notas na mesma linha como se fossem
> a mesma coisa) e a remoção do `test_cores_e2e`. **O deploy é sempre manual** (Redeploy no Coolify):
> confira com `git log` e com o `<meta name="rs-build">` do site qual build está de fato no ar.
>
> **Pedido do Rodrigo (14/11):** corrigir conexão e marcação com 2 celulares, o cache do iPhone/iPad
> ("a página não atualiza, e isso interfere na marcação dupla"), uma classificação melhor no relatório
> ("quem recebeu 100 bolas e rodou 90 não pode ficar abaixo de quem recebeu 4 e rodou as 4") e, durante
> a partida, ver rápido quantos saques errados / erros de ataque etc.
>
> **O que o diagnóstico achou (medido, não suposto):**
> - `once("value")`/`get()` num nó com listener respondem do **cache local do SDK** (0 ms, mesmo
>   offline — testado no SDK 9.22 real). O `_resyncGames` antigo, portanto, **não relia nada** do
>   servidor. Só reconectar (`goOffline`+`goOnline`, ~1 s) faz o listener reler.
> - Aparelho com estado velho apagava o jogo do colega: `startG` gravava `ss` inteiro, `nxS` gravava
>   `ss/{n}={u:0,t:0}`, `openG` gravava `act:null`, e **`save()` (≈40 pontos de chamada: escalar,
>   editar atleta/jogo, abrir card sem escalação…) regravava os 4 nós inteiros** (~2,5 MB por save).
> - Dados reais dos jogos com 2 aparelhos (9 jogos): **ponto duplicado** — os dois marcam o ponto do
>   mesmo rally com 2–4 s de diferença; 12 de 18 ações de ponto "sem ponto no placar" tinham outro
>   ponto a menos de 8 s. Pares legítimos de aparelhos diferentes a menos de 6 s: 2 em 1.087 pontos.
> - iOS só entrega o `click` se o botão tocado ainda for o mesmo elemento quando o dedo sobe; o app
>   redesenha a tela inteira a cada evento do banco → toque perdido quando o colega marca no meio.
> - O servidor (nginx do Coolify) **não manda `Cache-Control`**: o Safari guarda o `index.html` pela
>   heurística do `Last-Modified` (deploy de 30 dias atrás ≈ 3 dias de cache) e o SW v1 buscava a
>   navegação com `fetch(req)`, que passa por esse cache. PWA na tela de início é retomado da memória.
> - Relatório: ordenado por aproveitamento % com corte de 4 ações. RS Masc 35+ × Fluminense (14/11):
>   quem teve 51 ações e saldo +35 aparecia em **7º**; o 1º tinha 14 de 14.
>
> **O que entrou no `2026-11-14a`** (tudo em `index.html` + `sw.js`; bloco "DOIS APARELHOS" antes dos
> listeners):
> 1. **Gravação segura com estado velho:** `save()` por diferença (`_saveNode`/`_diffInto`: compara com
>    o último snapshot do servidor, `_srvSnap`, e grava só os caminhos mudados num `update()`; vetor e
>    ação/base da quadra vão inteiros; `ss` desce por campo; nó sem mudança não é gravado). `startG` e
>    `nxS` usam `increment(0)` (criam sem sobrescrever). `openG` apaga só o que conhece. Escalação
>    automática do card: `_lineupInit` (transação: só grava se o servidor não tiver).
>    `repeatLineupToOthers` grava só `lineup`.
> 2. **Conexão:** `.info/connected` + fila de envio (`_netTrack`), reconexão forçada ao voltar do 2º
>    plano / rede de volta / timers destravarem / gravação parada >10 s / sonda sem resposta
>    (`_netResume`, `_netTick`, `_netProbe`). Selo no placar (`_netChip`) e faixa no topo (`#netBar`).
>    Erro de permissão com usuário logado renova o token e tenta 1 vez; não é mais silencioso.
> 3. **Set aberto no outro aparelho** é acompanhado sozinho (`_sctFollowSets`); `nxS` só avança se o
>    set seguinte já existe (fim do set fantasma).
> 4. **Ponto duplicado** (`_ptWatch`/`_ptDup`/`_ptAsk`): por 6 s depois de um ponto vindo de OUTRO
>    aparelho, `rcO` grava a ação sem somar ponto (a MESMA ação não é gravada 2×) e `+`/erro do
>    adversário pedem um 2º toque. Pontos seguidos do próprio aparelho não são segurados.
> 5. **Toque seguro:** listeners e cronômetro chamam `renderSoon()` (espera o dedo sair da tela).
> 6. **Versão:** `<meta name="rs-build">` no `<head>` + `_verCheckNow` (lê os 2 KB iniciais do
>    `index.html` sem cache). Fora de jogo recarrega sozinho; dentro mostra a faixa `#updBar` e, ao
>    atualizar, volta pro mesmo jogo/set (`_sessKeep`/`_sessRestore`). `games/{idx}/devs/{aparelho}`
>    guarda o build de cada aparelho → aviso de versões misturadas. **SW v2** (`sw.js`): navegação com
>    `cache:'no-store'`, só estáticos em cache, página antiga é recarregada na troca do SW.
> 7. **Relatório (jogo e torneio):** ordem pelo **saldo** (positivas − erros), `_repRankCmp`; % só
>    desempata; medalha só com saldo positivo; última coluna "Saldo · Aprov.".
> 8. **Erros ao vivo:** `errStats` + quadro na mesa (clássica: abaixo do placar; tablet: coluna
>    esquerda) + atalho no centro do placar + detalhe por atleta (`openErrPanel`).
>
> **Testes:** `tests/test_dois_aparelhos.js` (85), `tests/test_sw.js` (26), `tests/test_erros_ao_vivo.js`
> (29), mais asserções em `test_relatorio.js` (100) e `test_pwa.js` (32). Mocks de `test_excluir`,
> `test_fase3`, `test_games_multidevice`, `test_srv0_courthist`, `test_repetir_escalacao` ajustados
> (`update()` de verdade; `ss` criado por caminho vira vetor; janela da trava de ponto zerada entre
> rallies). Suíte: 67 arquivos, todos rápidos.
>
> **`tests/test_cores_e2e.js` foi REMOVIDO em 15/11/2026 a pedido do Rodrigo** ("suma com esse teste,
> não fazer nunca mais — torneio por cores já acabou faz muito tempo"). Ele travava na etapa dos 10
> jogos (29 min sem terminar, sozinho). As menções a ele mais abaixo são históricas: não recriar, não
> rodar. O módulo de cores (`cores.html`, `cores-core.js` e os outros `test_cores_*`) continua no
> repositório, sem manutenção.
>
> **Validado com os dados reais (só leitura, nada gravado):** `save()` sem mudança = 0 caminhos nos 62
> jogos / 87 atletas; mexer na escalação de um jogo ao vivo = só `games/{idx}/lineup`; reconexão
> forçada no SDK real = ~1 s. Bancada visual de 2 aparelhos com banco falso:
> `preview/_real/dois-aparelhos.html` (pasta ignorada pelo git; abrir via `npx http-server`).
> Backup de leitura do banco antes do deploy: `preview/_real/backup-rtdb-2026-11-15.json`.
>
> **Aguardando o Rodrigo:** (a) Redeploy; (b) validar o critério do relatório — a versão para análise
> está em `preview/_real/relatorio-analise.html` (antes × depois nos 2 jogos de 14/11; alternativa
> avaliada e não adotada: Wilson 95%); (c) se quiser ranking **por função** (o saldo favorece quem toca
> mais na bola: levantador, líbero).
>
> **Limites que ficaram:** C1 (jogos por índice) continua — dois aparelhos criando jogo ao mesmo tempo
> ainda disputam o mesmo índice. A fila de envio é só memória (fechar o app sem conexão perde o que não
> subiu — a faixa avisa). No iPhone estreito, com conta de coordenador, o cabeçalho da mesa clássica já
> estourava (o "Desfazer" fica parcialmente cortado) — não mexi no layout. Não testei em iPhone físico:
> o comportamento do toque no iOS vem da lógica do WebKit, reproduzida em teste com eventos de toque.

## Deploy do 2026-11-14a — passo a passo (depende do Rodrigo)

1. Commit + push (se ainda não foi) e **Redeploy manual** no Coolify.
2. **Em cada aparelho, uma vez:** fechar o app por completo e abrir de novo (iPhone/iPad: deslizar o
   app pra cima no seletor de apps; no Safari, recarregar a página). É a última vez que isso é
   necessário: a versão antiga não sabe se atualizar sozinha; a nova sabe.
   - Conferir `build 2026-11-14a` no rodapé da tela de login.
   - Aparelho que ficar pra trás aparece no jogo como "outro aparelho neste jogo está numa versão
     ANTIGA" na tela de quem já atualizou.
3. **Antes de jogo real**, jogo de teste com 2 aparelhos: os dois abrem, um inicia, os dois marcam;
   marcar ponto nos dois quase juntos (o 2º deve avisar e não somar); bloquear a tela de um por 1 min
   e voltar (deve mostrar o selo verde de novo em ~1–2 s e o placar certo); modo avião num deles,
   marcar 2 ações, tirar do modo avião (faixa vermelha "SEM CONEXÃO — 2 marcações guardadas" e depois
   some); fechar o set e abrir o próximo em um só (o outro acompanha). Excluir o jogo de teste.
4. A partir daqui, um Redeploy novo chega sozinho: fora de jogo o app recarrega; dentro de jogo aparece
   a faixa azul "Nova versão — Atualizar agora".
5. **A cada build:** bumpar `var APP_BUILD` **e** o `<meta name="rs-build">` (o `test_pwa.js` falha se
   não baterem).

---

# Histórico — sessões anteriores (atualizado 2026-09-21, Claude Opus 5 direto nesta pasta)

> **Estado em 21/09 (leia primeiro):** tudo abaixo já está na `main` e no GitHub. **No ar** (Redeploy
> feito em 19/09) está o build `2026-09-18b` (C2 + quadra derivada) — o jogo de 20/09 (Fenerbouas,
> 292 ações) já foi marcado com ele, no formato novo. **Ainda NÃO deployado**: builds `2026-09-21a…e`:
> posição padronizada (select, gênero do time), e a seção **"Fases do jogo"** (side-out / 1ª bola /
> break / contra-ataque) no **Relatório visual** (`exTeamReport`, `_repFasesHTML`) e no PDF Partida
> (`_pdfFasesHTML`), ambos do mesmo motor `rallyModel`/`fasesStats`; contra-ataque dividido em "no
> break" (nós sacamos) × "em transição" (eles sacaram); 1º rally do set sem saque/recepção resolvido
> pela alternância de saque entre sets. Testes: `test_fases.js` (39), `test_posicoes.js` (31),
> `test_games_multidevice.js` (68); suíte 62/62 rápidos (+ `test_cores_e2e` ~7 min). Módulo
> equivalente pro ASV-SCOUT (Next/Supabase) foi entregue ao Rodrigo como `lib/fases.ts` (fora deste repo).
> Próximo passo natural: botão tipado "ponto adversário" (ataque/ace/bloqueio deles) pra tirar os pontos
> "só no +" da análise; depois C1.


> **21/09 à noite (sessão das rotações, Opus 5):** builds `21f`…`21h` na `main` (ver `git log`):
> nomenclatura do Rodrigo nos relatórios (ataque de side-out × contra-ataque; "rallies recebendo/sacando";
> recepção em rally do nosso saque vira defesa), "Para quem foi a bola, por fase" (por função e atleta,
> com % e pontos) e a **marcação pra análise por rotação**: `ss[i].srv0` + `courtHist/{set}/{key}`
> (PROJETO §4). A análise por posição do levantador (P1–P6) existe como protótipo FORA do app
> (dashboard HTML + PDF pros atletas do jogo Fenerbouas, na memória da sessão); a seção no app é o
> próximo passo (PROJETO §11). Vocabulário: 5x1 (não 5-1), "inversão" (não 6-2), categoria Adulto.

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

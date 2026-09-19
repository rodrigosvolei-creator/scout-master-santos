# Handoff — próxima sessão (2026-09-18, feito via ASV-SCOUT/Claude Sonnet 5)

> Contexto: esta sessão rodou dentro do repositório do **ASV-SCOUT** (outro
> projeto), com o RS-SCOUT clonado à parte em `C:\dev\scout-master-santos`
> só pra investigação. Nenhum código foi alterado aqui ainda — só leitura,
> mais um backup do banco. Recomendação: continuar isto numa sessão nova,
> aberta direto nesta pasta, de preferência no modelo **Opus** (mexe em
> fluxo de dado de partida ao vivo, produção real, com uso pessoal ativo).

## O que já está confirmado (não precisa reinvestigar)

- **Backup do RTDB tirado em 18/09/2026 21:03**, local:
  `C:\Users\rodri\Downloads\scola-volei-default-rtdb-torneio-master-santos-export.json`
  (1,67 MB, 7 nós, 8 jogos — validado, JSON íntegro). **Fora do repo de
  propósito** (dado pessoal real, não versionar).
- **REVIEW_SCOUT.md e PROJETO_RSSCOUT.md já documentam C1/C2/C3** — leia
  os dois primeiro, são a base de tudo.
- **C2 (escrita concorrente no mesmo jogo) é o bug prioritário**, não C1.
  Confirmado lendo o código de verdade (não só o documento):
  - `saveGame(g)` (`index.html:2218`) grava `games/{idx}` = o **objeto do
    jogo inteiro**.
  - `rcO(oc)` (`index.html:7415`, grava cada marcação) muta `gm.act`
    (push no array), `gm.ss[set].u/.t/.sq`, estado de quadra — tudo em
    memória — e no final chama `saveGame(gm)`: reescreve tudo. Dois
    aparelhos marcando o mesmo jogo quase junto = um apaga o outro.
  - `scUp`/`scDn` (`index.html:7761`/`7778`, placar manual +/-) fazem o
    mesmo: mutam `gm` local e chamam `saveGame(gm)` inteiro.
- **Já existe um padrão pronto e testado pra copiar**: commit `511f1a1`
  ("fix(treinos): multi-operador sem sobrepor", 15/09/2026, co-autoria
  Claude Opus 5) resolveu exatamente esse problema pro módulo de
  **Treinos** — `trainings/{id}/marks/{mid}` e `athletes/{taid}` viram
  nós próprios em vez de arrays, com conversão preguiçosa do formato
  antigo (`_trnKeyedFix`, só na 1ª escrita, sem precisar de migração em
  lote) e um id de aparelho (`_trnDev()`) pra "desfazer" só tirar a
  própria marcação. Ver `git show 511f1a1 -- index.html` pro diff
  completo. Isso NÃO foi aplicado a `games` ainda — só a `trainings`.
- Existe também um fix mais antigo (~3 meses, "fix: scout multi-
  dispositivo robusto") que já tornou `saveGame` granular **entre
  jogos diferentes** (escalar/rodar num jogo não apaga outro jogo) —
  mas isso não resolve C2, que é sobre dois aparelhos no **mesmo** jogo.

## Plano acordado com o usuário (escopo: só C2, não mexer em C1 agora)

1. `act` deixa de ser array e vira objeto chaveado
   (`games/{idx}/act/{aid}`), com `_gmKeyedFix` convertendo jogos
   antigos (array) na 1ª escrita granular — mesmo molde do
   `_trnKeyedFix`.
2. `rcO`/`scUp`/`scDn` passam a usar `update()` multi-caminho tocando só
   os campos que mudaram (`act/{aid}`, `ss/{set}/u`, `ss/{set}/sq`) em
   vez de `saveGame(gm)` inteiro.
3. Avaliar usar `firebase.database.ServerValue.increment(1)` pros
   contadores `ss[i].u`/`.t` — deixa a contagem seguro sob concorrência
   de verdade, não só "grava em nó separado" (o `_trn*` não precisou
   disso porque treino não tem placar incremental, só lista de marcas).
4. Desfazer ganha esquema de `_gmDev()` (id do aparelho) — só desfaz a
   própria marcação, igual `undoTreinoMark`.
5. `saveGame()` inteiro continua existindo só pra criar jogo/edição
   estrutural grande (igual `saveTraining`), não no caminho quente.
6. **Novo `tests/test_games_multidevice.js`**, mesmo molde do
   `test_multidevice.js`/`test_treinos.js` (simula 2 aparelhos no mesmo
   jogo). Rodar a suíte inteira (39/39 hoje) antes de commitar — regra
   do projeto.
7. **C1 (`games/{idx}` → `games/{id}`) fica de fora deste escopo** — é
   maior, toca muito mais lugares do arquivo. Registrar como próximo
   item depois que C2 estiver estável em produção.

## Deploy — não esquecer

Coolify **não redeploya sozinho**. Depois do push, precisa apertar
**Redeploy manual** no Coolify (app `scout-master-santos`) pra a
correção valer no ar. Bumpar `APP_BUILD` no `index.html` (rodapé
`#buildStamp`) pra confirmar visualmente qual versão está publicada.

## Antes de rodar qualquer script em produção

O usuário já autorizou o backup (feito, ver acima) mas **ainda não
autorizou rodar migração/escrita em produção** — só o plano de código.
Confirmar de novo antes do primeiro `set()`/`update()` granular tocar o
banco real, e preferir testar num jogo de teste (criado e apagado
depois) antes de confiar no fluxo com jogo real.

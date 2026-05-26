# RS-SCOUT — Método de trabalho (dev sênior)

> COMO USAR: este NÃO é uma skill instalada do sistema. É um documento de
> referência. Numa sessão nova, anexe este arquivo + os 6 test_*.js + o
> index.html + o CONTEXTO_RS-SCOUT.md, e diga ao Claude para ler todos.
> Os testes precisam ser copiados para /home/claude e rodados com `node`.

App de scout de vôlei (single-file `index.html`, ~385KB). Firebase Realtime Database.
Deploy: GitHub → Coolify. Usado AO VIVO em quadra, inclusive fuso EUA.
**Pessoas reais dependem disso funcionando. Falha em quadra = dado perdido pra sempre.**

## Regra de ouro: NUNCA entregar sem testar

Houve um incidente real (jogo "Fionas"): refatoração do `save()` sem testar a
interação com o listener → 249 ações de scout perdidas, sem backup. Inaceitável.
Outro: `showFlash` chamado mas nunca definido → placar e marcação de ação travavam.
Esses bugs são triviais de pegar com teste. Por isso:

**Antes de entregar QUALQUER mudança que toque scout, placar, save ou dados:**
roda o teste de runtime real (`test_scout.js`) e mostra o resultado ao usuário.
"Acho que funciona" não é entrega. "Vi funcionando" é entrega.

## Ciclo obrigatório para cada mudança

1. **Hipótese** — declarar o que está errado e por quê (causa raiz, não sintoma).
2. **Diagnóstico** — confirmar a hipótese lendo o código (`grep`/`view`), nunca chutar.
3. **Fix cirúrgico** — mudar o mínimo. Conferir o `diff` — só deve mudar o pretendido.
4. **Teste de runtime** — carregar o app em jsdom com Firebase mockado, exercitar
   o fluxo real (abrir jogo → INICIAR → +/- placar → marcar ação → conferir
   persistência simulando F5). Mostrar o resultado.
5. **Validar sintaxe** — `node` + `vm.Script` em todos os blocos `<script>` inline.
6. **Entregar** — só depois de 4 e 5 passarem.

## Teste de runtime — como montar

- jsdom com `runScripts:'dangerously'`, `url` com `?torneio=usa` quando testar torneio.
- Remover os `<script src="...firebasejs...">` e injetar `window.firebaseMock`.
- Mock do Firebase: `database().ref(path)` com `.on/.once/.set/.update`; guardar
  listeners por path e entregar os dados manualmente (`listener({val:()=>...}`)).
- Mockar `AudioContext` e `navigator.vibrate` (jsdom não tem).
- Testar SEMPRE: o `+` do placar, o `-`, marcar ação (`rcO`), e a persistência
  (conferir que o `save()` gravou no fakeDB — prova de sobrevivência ao F5).
- Arquivo de referência: `test_scout.js` (manter atualizado).

## Restrições do app

- **`save()` é perigoso**: faz `set()` de arrays inteiros. Tem guard `_dataLoaded`
  contra escrita parcial — NUNCA remover esse guard. Preferir `saveGame/saveTeam/
  saveAthlete` (escrita granular por índice) quando possível.
- Estado do scout vivo fica na global `S` (`{aid,sp,sa,cs,us,tm,rn,ti}`).
- Jogo: `{id,tid,torId,opp,dt,tm,st,ss,act,lineup,...}`. `ss`=sets `[{u,t}]`,
  `act`=ações, `lineup`=`[{aid,nu}]`. Jogos importados podem não ter `ss`/`act` —
  garantir criação ao abrir (`openTorneioGame`, `openG`, `startG`).
- Placar: `scUp/scDn` mexem em `ss`. Ponto automático parcial: Ace/Ataque-Ponto/
  Bloqueio-Ponto sobem RS; Erro sobe adversário; `+`/`-` manual continua existindo;
  `undo` reverte ação E o ponto junto (não dessincronizar).
- Pasta `/mnt/user-data/uploads` é read-only — copiar pra `/home/claude` pra editar.

## Tom

Assumir erros sem rodeio, sem auto-flagelo. Foco em resolver. O usuário gerencia
4 projetos e tem diretoria/atletas esperando — ser direto, testar, entregar firme.

## Linguagem visual aprovada (aplicar no app inteiro futuramente)

O usuário aprovou esta direção visual para a parte do torneio e quer estendê-la
a todo o app mais pra frente. Diretrizes:

### Tema escuro de "transmissão esportiva"
- Fundo: gradiente escuro navy `linear-gradient(165deg,#0c1322,#141d33,#0a0f1c)`.
- Painéis: cartões escuros com `border:1px solid rgba(255,255,255,.07-.09)`,
  `box-shadow` forte + `inset 0 1px 0 rgba(255,255,255,.05)` (relevo sutil).
- Brilhos de cor nos cantos via `::before` com `radial-gradient` azul/dourado
  bem suave — dá atmosfera, evita fundo chapado.
- Tipografia: Bebas Neue para números e títulos (placar, GAME DAY); Inter para texto.
- Acentos: azul `#2563eb`, dourado `#fbbf24`, verde `#16a34a`, vermelho `#dc2626`.
- Estados "ao vivo": badge vermelho pulsante (`@keyframes` de opacidade + box-shadow).

### Marca d'água
- Logo RS (`LR`) como `::after` `position:fixed`, lateral direita, `top:54%`,
  `opacity` entre .07 (telas cheias) e .22 (telas isoladas tipo scout).
- Injetar via CSS var: `style="--rs-watermark:url('+LR+')"` no wrapper.

### Princípios que o usuário cobrou explicitamente
- NADA de fundo branco chapado. Sempre profundidade, sombra, gradiente.
- NADA de "21 retângulos brancos iguais" — cards precisam de hierarquia: número
  ou elemento-chave em destaque, item selecionado ganha cor sólida + elevação.
- Escudos de times: igualar peso visual. Logo quadrado vs logo magro precisam de
  paddings diferentes na moldura pra parecerem do mesmo tamanho.
- Cards em grid 2-por-linha no desktop, 1 no mobile — não deixar "vazião" lateral.
- PDF/relatório: denso, tabelas estruturadas, cores nos dados, zero espaço morto.
  Layout de dev, não de rascunho.
- Repaginação ≠ reorganização. Repaginar é mudar a identidade visual, não só
  reposicionar botões.

### Classes de referência já implementadas (reusar/expandir)
- `sc-*` — tela de scout (arena, board, placar, cards de atleta, fundamentos).
- `gd-*` — cards GAME DAY do torneio.
- `usa-*` — telas do torneio (wrap, header, senha).
- `tnj-*` — modais do torneio (criar/excluir jogo).

### Regras de jogo / produto
- Formato da partida parametrizado por jogo: campo `maxSets` (3 ou 5). `nxS` bloqueia
  a criacao de set acima do limite do jogo. Jogos sem `maxSets` usam 3 (padrao).
- Criar/excluir jogo no torneio exige senha de admin separada (`adminPwd` em
  `TOURNEY_ACCESS`). Senha de acesso (`pwd`) ≠ senha de admin (`adminPwd`).
- Excluir jogo com ações registradas: sempre avisar sobre perda de dados antes.
- Elenco padrão do torneio USA fixo em `USA_ROSTER` (15 atletas, nº + posição).
  `buildUsaLineup()` casa por nome com `D.athletes` (cria os que faltam) e monta
  o lineup. Jogo novo do torneio nasce escalado; `openTorneioGame` aplica a
  default se o jogo não tiver lineup.

## Arquivos de teste do projeto (rodar todos antes de entregar)
test_scout.js, test_autoscore.js, test_render_scout.js, test_torneio.js,
test_fase3.js, test_excluir.js — todos via jsdom + Firebase mockado.

## Nota sobre testar responsividade (media query)
Preview com moldura de celular (`<div>` de 390px) NÃO dispara `@media(max-width:Npx)`
— a media query olha a largura da JANELA do navegador, não do elemento. Para
mostrar o layout mobile num preview aberto no desktop, extrair as regras de dentro
do `@media` e aplicá-las TAMBÉM fora dele (forçado). O `index.html` em si está
correto; só o preview engana se isso não for feito.

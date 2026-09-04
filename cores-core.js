/* ==========================================================================
   RS-SCOUT · MODULO "MINI MINIS - CORES" — MOTOR PURO
   --------------------------------------------------------------------------
   Modulo ISOLADO. Nao importa, nao altera e nao depende do index.html.
   Sem DOM, sem Firebase: so funcao pura -> da pra testar em Node.

   PRINCIPIO CENTRAL (o que resolve os 2 operadores simultaneos):
     Nada de estado mutavel compartilhado. O unico dado gravado e o EVENTO
     (append-only, push do Firebase = insert). Placar, saque, estatistica e
     classificacao sao SEMPRE recalculados a partir da lista de eventos.
     -> Dois aparelhos gravando ao mesmo tempo NAO se sobrescrevem.
     -> Os dois chegam ao mesmo resultado (a ordem e a das chaves do push).

   DEDUPE DE PONTO (a duvida do "ponto automatico") — DUAS TRAVAS:
     1) RALLY: cada evento carrega o numero do rally em que foi marcado. O
        primeiro evento terminal daquele rally (na ordem das chaves) define o
        ponto; os demais entram como ESTATISTICA e nao mexem no placar.
        Pega o caso simultaneo (os dois marcam antes de a rede entregar).
     2) JANELA (dedupeMs): se o OUTRO operador marca, poucos segundos depois,
        uma acao terminal que aponta para o MESMO vencedor, e o mesmo rally
        visto do outro lado (ele ja tinha recebido o ponto, entao gravaria no
        rally seguinte) -> vira estatistica. Sem isso o rally contaria 2 pontos.
        Os dois filtros importam: acao seguida do MESMO aparelho e rally novo
        dele; e acao que da o ponto para o OUTRO lado e rally novo de verdade
        (no volei o intervalo entre pontos consecutivos passa de 4s).
     -> Operador A marca "ataque ponto" e B marca "defesa erro" do mesmo rally:
        conta 1 ponto, nao 2 — junto ou com alguns segundos de diferenca.
        As duas acoes ficam no scout dos atletas.
   ========================================================================== */

var CORES_ACT = {
  saque:        { l: "Saque",     i: "\u{1F3D0}",      o: ["Ace", "Erro", "Cont"] },
  recepcao:     { l: "Recepção", i: "\u{1F932}", o: ["A", "B", "C", "Erro"] },
  levantamento: { l: "Levant.",   i: "\u{1F446}",      o: ["A", "B", "C", "Erro"] },
  ataque:       { l: "Ataque",    i: "\u{1F4A5}",      o: ["Ponto", "Bloq", "Erro", "Cont"] },
  bloqueio:     { l: "Bloqueio",  i: "\u{1F9F1}",      o: ["Ponto", "Erro", "Cont"] },
  defesa:       { l: "Defesa",    i: "\u{1F6E1}️", o: ["A", "B", "C", "Erro"] },
  /* Fora do painel de fundamentos — entra por um botao proprio, sem atleta. */
  falta:        { l: "Falta",     i: "⚠", o: ["Erro"] },
  pontoadv:     { l: "Ponto do adversário", i: "➕", o: ["Erro"] },
  pontonos:     { l: "Ponto da equipe",     i: "➕", o: ["Ponto"] }
};
/* Os 6 fundamentos que aparecem no painel (a falta nao entra: nao tem atleta). */
var CORES_FUND = ["saque", "recepcao", "levantamento", "ataque", "bloqueio", "defesa"];
/* Um degrau mais escuras que o padrao Tailwind: com texto branco em cima, as
   originais ficavam em 3.2-3.8:1 (abaixo do minimo 4.5:1) e sumiam com sol na
   tela do ginasio. As MATIZES nao mudam — verde continua verde: e vocabulario
   que o operador ja aprendeu, nao decoracao. */
var CORES_OC = { Ace: "#047857", Ponto: "#047857", A: "#047857", B: "#b45309", Cont: "#556070", C: "#c2410c", Bloq: "#c2410c", Erro: "#b91c1c" };
var CORES_FCOL = { saque: "#1d4ed8", recepcao: "#047857", levantamento: "#6d28d9", ataque: "#b91c1c", bloqueio: "#c2410c", defesa: "#0e7490" };

var CORES_CFG_PADRAO = {
  setPoints: 21,     // set unico ate 21
  vantagem: 2,       // com 2 de vantagem
  capPoints: 0,      // 0 = sem teto (vai ate a vantagem de 2)
  emQuadra: 4,       // 4x4
  ptsVitoria: 3,
  ptsDerrota: 1,
  dedupeMs: 4000     // janela anti-ponto-duplo entre os 2 operadores (0 = desliga)
};

function coresCfg(c) {
  var o = {}, k;
  for (k in CORES_CFG_PADRAO) o[k] = CORES_CFG_PADRAO[k];
  if (c) for (k in CORES_CFG_PADRAO) if (c[k] != null && c[k] !== "") o[k] = c[k];
  o.setPoints = parseInt(o.setPoints, 10) || 21;
  o.vantagem = parseInt(o.vantagem, 10); if (isNaN(o.vantagem)) o.vantagem = 2;
  o.capPoints = parseInt(o.capPoints, 10) || 0;
  o.emQuadra = parseInt(o.emQuadra, 10) || 4;
  o.ptsVitoria = parseInt(o.ptsVitoria, 10); if (isNaN(o.ptsVitoria)) o.ptsVitoria = 3;
  o.ptsDerrota = parseInt(o.ptsDerrota, 10); if (isNaN(o.ptsDerrota)) o.ptsDerrota = 1;
  o.dedupeMs = parseInt(o.dedupeMs, 10); if (isNaN(o.dedupeMs)) o.dedupeMs = 4000;
  return o;
}

/* Quem leva o ponto de uma acao terminal.
   'self' = a equipe que marcou · 'opp' = a adversaria · null = nao encerra o rally.
   Mesma regra do RS-SCOUT (autoScoreSide), inclusive: ERRO DE LEVANTAMENTO NAO
   PONTUA — decisao do Rodrigo (nem sempre e ponto direto; usa-se o + manual). */
function coresTerminal(ak, oc) {
  /* Falta da equipe sem fundamento (rodizio/posicional/conducao/invasao/tempo):
     nao tem atleta nem fundamento, e sempre ponto do adversario. */
  if (ak === "falta") return "opp";
  /* "O adversario pontuou" — registrado pelo operador do lado que SOFREU o
     ponto, sem atribuir falta a ninguem. Existe para o placar e o RODIZIO
     andarem sem depender de o outro operador marcar a jogada dele. Se os dois
     marcarem o mesmo rally, o dedupe garante 1 ponto so. */
  if (ak === "pontoadv") return "opp";
  /* Simetrico: a NOSSA equipe pontuou sem que exista acao nossa para marcar —
     o adversario errou o saque, mandou a bola fora ou cometeu falta. Sem isto o
     operador so conseguia registrar ponto PARA o adversario, e o side-out a
     favor (recuperar o saque) dependia do outro operador marcar o erro dele. */
  if (ak === "pontonos") return "self";
  if (oc === "Ace") return "self";
  if ((ak === "ataque" || ak === "bloqueio") && oc === "Ponto") return "self";
  if ((ak === "saque" || ak === "ataque" || ak === "bloqueio") && oc === "Erro") return "opp";
  if ((ak === "recepcao" || ak === "defesa") && oc === "Erro") return "opp";
  if (ak === "ataque" && oc === "Bloq") return "opp";
  return null;
}

/* Eventos vem do Firebase como objeto {pushKey: ev}. As chaves do push sao
   cronologicas e ordenaveis como string -> ordem igual em todos os aparelhos. */
function coresEventList(evObj) {
  var out = [], k;
  if (!evObj) return out;
  if (Object.prototype.toString.call(evObj) === "[object Array]") {
    for (k = 0; k < evObj.length; k++) if (evObj[k]) out.push(evObj[k]);
    return out;
  }
  var keys = Object.keys(evObj);
  keys.sort();
  for (k = 0; k < keys.length; k++) {
    var e = evObj[keys[k]];
    if (!e) continue;
    if (!e.k) e.k = keys[k];
    out.push(e);
  }
  return out;
}

function coresOther(side) { return side === "A" ? "B" : "A"; }

/* Jogadores em quadra (a ordem da lista E a ordem de saque; os N primeiros jogam). */
function coresOnCourt(team, cfg) {
  var ps = (team && team.players) || [];
  var n = (team && team.emQuadra) || cfg.emQuadra;
  var out = [];
  for (var i = 0; i < ps.length && out.length < n; i++) if (ps[i]) out.push(ps[i]);
  return out;
}

function coresNextServer(team, lastJid, cfg) {
  var court = coresOnCourt(team, cfg);
  if (!court.length) return null;
  var idx = -1;
  for (var i = 0; i < court.length; i++) if (court[i].id === lastJid) { idx = i; break; }
  if (idx < 0) return court[0].id;
  return court[(idx + 1) % court.length].id;
}

/* ==========================================================================
   computeGame — o coracao. Recebe o jogo, os eventos crus e as equipes;
   devolve TODO o estado derivado. Nao muta nada.
   ========================================================================== */
function coresComputeGame(game, evObj, teamsById, cfgIn) {
  var cfg = coresCfg(cfgIn);
  var evs = coresEventList(evObj);
  var tA = teamsById[game.a] || { id: game.a, players: [] };
  var tB = teamsById[game.b] || { id: game.b, players: [] };
  var teamOf = { A: tA, B: tB };

  var pts = { A: 0, B: 0 };
  var adj = { A: 0, B: 0 };          // quanto do placar veio de ajuste manual
  var rally = 0;                      // rally em disputa
  var rallyOwner = {};                // rally -> lado que pontuou (dedupe)
  var serve = null;                   // {side, jid} sacador atual
  var lastServer = { A: null, B: null }; // ultimo sacador de cada equipe (histerico)
  var needServer = null;              // lado sem nenhum atleta para sacar (caso degenerado)
  /* Escalacao = a ORDEM DE SAQUE posicionada 1..N pelo operador (evento 'lineup').
     Enquanto nao houver, vale a ordem do cadastro da equipe. Substituicao ('sub')
     troca o atleta MANTENDO a posicao, entao o rodizio segue certo. */
  var lineup = { A: coresOnCourt(tA, cfg).map(function (p) { return p.id; }),
                 B: coresOnCourt(tB, cfg).map(function (p) { return p.id; }) };
  var lineupSet = { A: false, B: false };
  var subs = [];                      // historico de substituicoes
  var firstServeSide = null;          // qual EQUIPE saca o primeiro rally
  var manualServe = false;            // houve escolha manual de sacador ('girar saque')
  var stats = {};                     // jid -> {n, tid, ak:{...}}
  var pointLog = [];                  // sequencia de pontos (ladder/telao)
  var dupes = [];                     // acoes que nao pontuaram (mesmo rally)
  var lastPointTs = 0, lastPointTid = null, lastPointWin = null;  // ultimo ponto: quando, por quem, para quem
  var done = false, winner = null;

  function sideOfTid(tid) { return tid === game.a ? "A" : (tid === game.b ? "B" : null); }

  function bumpStat(ev, side) {
    if (!ev.jid) return;
    var s = stats[ev.jid];
    if (!s) { s = stats[ev.jid] = { jid: ev.jid, tid: ev.tid, side: side, n: 0, ak: {} }; }
    s.n++;
    var a = s.ak[ev.ak];
    if (!a) a = s.ak[ev.ak] = { n: 0, oc: {} };
    a.n++;
    a.oc[ev.oc] = (a.oc[ev.oc] || 0) + 1;
  }

  function checkDone() {
    var hi = Math.max(pts.A, pts.B), lo = Math.min(pts.A, pts.B);
    var okCap = cfg.capPoints > 0 && hi >= cfg.capPoints;
    if (hi >= cfg.setPoints && (hi - lo >= cfg.vantagem || okCap)) {
      done = true; winner = pts.A > pts.B ? "A" : (pts.B > pts.A ? "B" : null);
    } else { done = false; winner = null; }
  }

  /* Proximo na ordem de saque da equipe (circular). Sem ultimo sacador, e o #1. */
  function nextOf(side, last) {
    var lst = lineup[side] || [];
    if (!lst.length) return null;
    if (!last) return lst[0];
    var i = lst.indexOf(last);
    if (i < 0) return lst[0];
    return lst[(i + 1) % lst.length];
  }
  function advanceServe(winSide) {
    if (serve && serve.side === winSide) return;      // manteve o saque: mesmo sacador
    var nx = nextOf(winSide, lastServer[winSide]);
    if (!nx) { serve = null; needServer = winSide; return; }
    serve = { side: winSide, jid: nx };
    lastServer[winSide] = nx;
    needServer = null;
  }
  /* O primeiro saque do jogo sai da escalacao: e o #1 da equipe que abre sacando.
     O operador nao escolhe sacador em lista nenhuma — ele posiciona 1..N. */
  /* permitirFallback=false: enquanto a equipe que abre sacando NAO tiver
     posicionado a ordem, nao aponta sacador nenhum — apontar o #1 do cadastro
     mostrava um nome que o operador nao escolheu e trocava sozinho depois. */
  function ensureInitialServe(permitirFallback) {
    if (serve || !firstServeSide) return;
    if (!permitirFallback && !lineupSet[firstServeSide]) return;
    var nx = nextOf(firstServeSide, null);
    if (!nx) { needServer = firstServeSide; return; }
    serve = { side: firstServeSide, jid: nx };
    lastServer[firstServeSide] = nx;
    needServer = null;
  }

  for (var i = 0; i < evs.length; i++) {
    var ev = evs[i];
    if (!ev || !ev.t) continue;

    if (ev.t === "lineup") {                // ordem de saque posicionada 1..N
      var lSide = sideOfTid(ev.tid);
      if (!lSide || !ev.ordem || !ev.ordem.length) continue;
      lineup[lSide] = ev.ordem.slice();
      lineupSet[lSide] = true;
      /* Com o jogo ainda 0x0 e sem escolha manual, o sacador inicial vem da
         escalacao nova. Sem isto, quem escolhe "quem saca" ANTES de posicionar
         (a ordem dos passos na tela) travava o sacador pela lista do cadastro. */
      if (rally === 0 && !manualServe) { serve = null; lastServer = { A: null, B: null }; ensureInitialServe(false); }
      continue;
    }
    if (ev.t === "sub") {                   // substituicao: entra na posicao de quem sai
      var sbSide = sideOfTid(ev.tid);
      if (!sbSide) continue;
      var lst = lineup[sbSide] || [], pos = lst.indexOf(ev.out);
      if (pos < 0) continue;
      lst[pos] = ev.in;
      if (lastServer[sbSide] === ev.out) lastServer[sbSide] = ev.in;   // mantem o rodizio
      if (serve && serve.side === sbSide && serve.jid === ev.out) serve.jid = ev.in;
      subs.push({ side: sbSide, tid: ev.tid, out: ev.out, in: ev.in });
      continue;
    }
    if (ev.t === "first") {                 // qual equipe saca o primeiro rally
      var fSide = sideOfTid(ev.tid);
      if (!fSide) continue;
      firstServeSide = fSide;
      if (rally === 0 && !manualServe) { serve = null; lastServer = { A: null, B: null }; ensureInitialServe(false); }
      continue;
    }
    if (ev.t === "serve") {
      var sSide = sideOfTid(ev.tid);
      if (!sSide) continue;
      serve = { side: sSide, jid: ev.jid };
      lastServer[sSide] = ev.jid;
      manualServe = true;
      needServer = null;
      continue;
    }

    if (ev.t === "adj") {                   // correcao manual de placar: NAO mexe no saque (§4.6)
      var aSide = sideOfTid(ev.tid);
      if (!aSide) continue;
      var d = parseInt(ev.delta, 10) || 0;
      if (pts[aSide] + d < 0) d = -pts[aSide];
      pts[aSide] += d; adj[aSide] += d;
      checkDone();
      continue;
    }

    if (ev.t !== "act") continue;
    var side = sideOfTid(ev.tid);
    if (!side) continue;
    bumpStat(ev, side);

    var term = coresTerminal(ev.ak, ev.oc);
    if (!term) continue;
    ensureInitialServe(true);   /* ja esta marcando: melhor o #1 do cadastro que nada */

    var r = (ev.rally == null) ? rally : (parseInt(ev.rally, 10) || 0);
    /* Trava 1 — mesmo numero de rally (marcacoes simultaneas). */
    var mesmoRally = (rallyOwner[r] != null);
    var win = (term === "self") ? side : coresOther(side);
    /* Trava 2 — o OUTRO operador marcando o fim do rally que acabou de ser
       pontuado (ele ja recebeu o evento, entao gravaria no rally seguinte).
       So conta como repeticao se aponta para o MESMO vencedor: ponto para o
       outro lado e rally novo, e acao seguida do mesmo aparelho tambem. */
    /* dt precisa ser POSITIVO e pequeno. Sem o dt>=0, um aparelho com o relogio
       adiantado fazia os eventos do outro chegarem "no passado" e a janela
       engolia pontos legitimos. Relogios de maquinas diferentes divergem —
       por isso o ts tambem passou a ser carimbado pelo servidor. */
    var dt = (typeof ev.ts === "number" && lastPointTs) ? (ev.ts - lastPointTs) : null;
    var janela = (cfg.dedupeMs > 0 && dt !== null && dt >= 0 && dt < cfg.dedupeMs &&
                  ev.tid !== lastPointTid && win === lastPointWin);
    if (mesmoRally || janela) {
      ev._dupWhy = mesmoRally ? "rally" : "janela";
      dupes.push(ev);
      continue;
    }
    rallyOwner[r] = win;
    pts[win]++;
    pointLog.push({ rally: r, side: win, jid: ev.jid, tid: ev.tid, ak: ev.ak, oc: ev.oc, by: side });
    if (r + 1 > rally) rally = r + 1;
    lastPointTs = (typeof ev.ts === "number") ? ev.ts : 0; lastPointTid = ev.tid; lastPointWin = win;
    advanceServe(win);
    checkDone();
  }

  return {
    cfg: cfg,
    a: game.a, b: game.b,
    teamA: tA, teamB: tB,
    pts: pts, adj: adj,
    rally: rally,
    serve: serve,
    lastServer: lastServer,
    needServer: needServer,
    stats: stats,
    lineup: lineup,
    lineupSet: lineupSet,
    subs: subs,
    firstServeSide: firstServeSide,
    pointLog: pointLog,
    dupes: dupes,
    events: evs,
    done: done,
    winner: winner,
    winnerTid: winner ? (winner === "A" ? game.a : game.b) : null
  };
}

/* Aproveitamento do atleta: acertos / (acertos + erros) — mesma regua do
   relatorio do RS-SCOUT. No saque, "colocar em jogo" (Cont) ja e positivo. */
function coresPlayerLine(st) {
  var ac = 0, er = 0, n = 0, pos = 0;
  for (var ak in st.ak) {
    var a = st.ak[ak];
    for (var oc in a.oc) {
      var q = a.oc[oc]; n += q;
      if (oc === "Erro") { er += q; continue; }
      if (ak === "saque") { ac += q; if (oc === "Ace") pos += q; continue; }  // Cont conta como acerto no saque
      if (oc === "Ace" || oc === "Ponto" || oc === "A") { ac += q; if (oc !== "A") pos += q; continue; }
      if (oc === "B") { ac += q; continue; }
      if (oc === "C" || oc === "Bloq" || oc === "Cont") { continue; }         // neutro
    }
  }
  var den = ac + er;
  return { n: n, ac: ac, er: er, pos: pos, aprov: den ? Math.round(ac * 100 / den) : null };
}

/* ==========================================================================
   FASES — classificatoria + mata-mata
   --------------------------------------------------------------------------
   g.fase: "class" (padrao, tambem quando o campo nao existe) | "semi" |
           "final" | "terceiro".
   Um jogo de mata-mata pode nascer SEM as equipes definidas, dependendo do
   resultado de outro: g.srcA = { from:<id do jogo>, tipo:"win"|"lose" } e
   g.labelA = o que mostrar enquanto nao houver resultado ("Vencedor SF1").
   Nada disso e gravado de volta: as equipes sao resolvidas na hora de exibir.
   ========================================================================== */
var CORES_FASES = {
  class:    { l: "Classificatória", ordem: 0 },
  semi:     { l: "Semifinal",       ordem: 1 },
  terceiro: { l: "3º lugar",        ordem: 2 },
  final:    { l: "Final",           ordem: 3 }
};
function coresFase(g) { return (g && g.fase && CORES_FASES[g.fase]) ? g.fase : "class"; }

/* Vencedor/perdedor de um jogo — so quando ha resultado de verdade. */
function coresOutcome(game, evByGame, teamsById, cfg) {
  if (!game || !game.a || !game.b) return null;
  var st = coresComputeGame(game, (evByGame && evByGame[game.id]) || null, teamsById, cfg);
  var acabou = (game.st === "finalizada") || st.done;
  if (!acabou || st.pts.A === st.pts.B) return null;
  var aGanhou = st.pts.A > st.pts.B;
  return { win: aGanhou ? game.a : game.b, lose: aGanhou ? game.b : game.a };
}

/* Preenche as equipes dos jogos que dependem de outros. Varias passadas porque
   a final depende das semis (2 niveis); para quando nada mais muda. */
function coresResolveGames(games, evByGame, teamsById, cfgIn) {
  var cfg = coresCfg(cfgIn);
  var out = [], byId = {}, i;
  for (i = 0; i < games.length; i++) {
    var c = {}; for (var k in games[i]) c[k] = games[i][k];
    out.push(c); byId[c.id] = c;
  }
  for (var passo = 0; passo < 4; passo++) {
    var mudou = false;
    for (i = 0; i < out.length; i++) {
      var g = out[i];
      ["A", "B"].forEach(function (lado) {
        var campo = lado === "A" ? "a" : "b", src = g["src" + lado];
        if (g[campo] || !src || !src.from) return;
        var oc = coresOutcome(byId[src.from], evByGame, teamsById, cfg);
        if (!oc) return;
        g[campo] = (src.tipo === "lose") ? oc.lose : oc.win;
        mudou = true;
      });
    }
    if (!mudou) break;
  }
  return out;
}

/* Nome para exibir num lado do jogo, resolvido ou nao. */
function coresLadoLabel(g, lado, teamsById) {
  var tid = (lado === "A") ? g.a : g.b;
  if (tid && teamsById[tid]) return teamsById[tid].n;
  return g["label" + lado] || "A definir";
}

/* Monta os jogos da fase final a partir da classificacao.
   modo: "final" (1o x 2o) | "semi" (1o x 4o e 2o x 3o + final)
   com3o: inclui a disputa de 3o lugar (so no modo semi).
   Devolve os jogos prontos para gravar — nao grava nada. */
function coresBracket(standings, modo, com3o, base) {
  base = base || {};
  var mk = function (id, fase, extra) {
    var g = { id: id, a: "", b: "", fase: fase, st: "agendada",
              dt: base.dt || "", tm: "", ordem: CORES_FASES[fase].ordem };
    for (var k in extra) g[k] = extra[k];
    return g;
  };
  var pos = function (i) { return standings[i] ? standings[i].tid : ""; };
  var nome = function (i) { return standings[i] ? standings[i].n : (i + 1) + "º colocado"; };
  var pref = base.prefixo || ("f_" + Date.now().toString(36));

  if (modo === "final") {
    if (standings.length < 2) return [];
    return [mk(pref + "_fin", "final", {
      a: pos(0), b: pos(1), labelA: nome(0), labelB: nome(1), tm: base.tmFinal || ""
    })];
  }
  if (modo === "semi") {
    if (standings.length < 4) return [];
    var s1 = mk(pref + "_sf1", "semi", { a: pos(0), b: pos(3), labelA: nome(0), labelB: nome(3), tm: base.tmSemi || "" });
    var s2 = mk(pref + "_sf2", "semi", { a: pos(1), b: pos(2), labelA: nome(1), labelB: nome(2), tm: base.tmSemi || "" });
    var jogos = [s1, s2];
    if (com3o) {
      jogos.push(mk(pref + "_3o", "terceiro", {
        srcA: { from: s1.id, tipo: "lose" }, srcB: { from: s2.id, tipo: "lose" },
        labelA: "Perdedor Semifinal 1", labelB: "Perdedor Semifinal 2", tm: base.tm3o || ""
      }));
    }
    jogos.push(mk(pref + "_fin", "final", {
      srcA: { from: s1.id, tipo: "win" }, srcB: { from: s2.id, tipo: "win" },
      labelA: "Vencedor Semifinal 1", labelB: "Vencedor Semifinal 2", tm: base.tmFinal || ""
    }));
    return jogos;
  }
  return [];
}

/* Campeao do torneio: vencedor da final, quando houver. */
function coresCampeao(games, evByGame, teamsById, cfgIn) {
  var gs = coresResolveGames(games, evByGame, teamsById, cfgIn);
  for (var i = 0; i < gs.length; i++) {
    if (coresFase(gs[i]) !== "final") continue;
    var oc = coresOutcome(gs[i], evByGame, teamsById, coresCfg(cfgIn));
    if (oc) return oc.win;
  }
  return null;
}

/* ==========================================================================
   CLASSIFICACAO — §6 do brief. So conta jogo finalizado.
   Vitoria=3 · Derrota=1 · desempate: pontos > saldo > pontos pro > confronto direto.
   ========================================================================== */
function coresStandings(games, teams, evByGame, cfgIn) {
  var cfg = coresCfg(cfgIn);
  var byId = {}, i;
  for (i = 0; i < teams.length; i++) byId[teams[i].id] = teams[i];

  var row = {};
  for (i = 0; i < teams.length; i++) {
    row[teams[i].id] = {
      tid: teams[i].id, n: teams[i].n, cor: teams[i].cor, ordem: teams[i].ordem || i,
      j: 0, v: 0, d: 0, pp: 0, pc: 0, saldo: 0, pts: 0
    };
  }
  var h2h = {};   // "a|b" -> vitorias de a sobre b

  for (i = 0; i < games.length; i++) {
    var g = games[i];
    if (!g || !row[g.a] || !row[g.b]) continue;
    if (coresFase(g) !== "class") continue;   /* mata-mata nao mexe na tabela */
    var st = coresComputeGame(g, (evByGame && evByGame[g.id]) || null, byId, cfg);
    var fim = (g.st === "finalizada") || st.done;
    if (!fim) continue;
    if (st.pts.A === st.pts.B) continue;           // sem vencedor definido: fora da conta
    var ra = row[g.a], rb = row[g.b];
    ra.j++; rb.j++;
    ra.pp += st.pts.A; ra.pc += st.pts.B;
    rb.pp += st.pts.B; rb.pc += st.pts.A;
    var wa = st.pts.A > st.pts.B;
    if (wa) { ra.v++; rb.d++; h2h[g.a + "|" + g.b] = (h2h[g.a + "|" + g.b] || 0) + 1; }
    else { rb.v++; ra.d++; h2h[g.b + "|" + g.a] = (h2h[g.b + "|" + g.a] || 0) + 1; }
  }

  var out = [];
  for (var k in row) {
    var r = row[k];
    r.saldo = r.pp - r.pc;
    r.pts = r.v * cfg.ptsVitoria + r.d * cfg.ptsDerrota;
    out.push(r);
  }
  out.sort(function (x, y) {
    if (y.pts !== x.pts) return y.pts - x.pts;
    if (y.saldo !== x.saldo) return y.saldo - x.saldo;
    if (y.pp !== x.pp) return y.pp - x.pp;
    var xy = h2h[x.tid + "|" + y.tid] || 0, yx = h2h[y.tid + "|" + x.tid] || 0;
    if (xy !== yx) return yx - xy;
    return (x.ordem - y.ordem) || String(x.n).localeCompare(String(y.n));
  });
  for (i = 0; i < out.length; i++) out[i].pos = i + 1;
  return out;
}

/* ==========================================================================
   RELATORIOS — rankings do torneio (ou de um jogo)
   --------------------------------------------------------------------------
   Duas leituras que o Rodrigo pediu:
   1) MAIORES PONTUADORES: so acoes que encerram o rally A FAVOR de quem fez —
      ace, ataque ponto, bloqueio ponto. Erro do adversario nao entra: nao e
      merito de um atleta identificado (e por isso nem tem jid).
   2) POR FUNDAMENTO, TIPO A: para os fundamentos que tem classificacao de
      qualidade (recepcao, levantamento, defesa), o ranking e o % de A.
      Saque, ataque e bloqueio nao tem A/B/C — entram com a metrica que faz
      sentido em cada um (ace, ponto, ponto).
   Quem tem pouquissimas acoes fica fora dos rankings de PORCENTAGEM (um unico
   A viraria 100%): minAcoes, ajustavel.
   ========================================================================== */
var CORES_FUND_ABC = ["recepcao", "levantamento", "defesa"];  /* tem A/B/C */

/* Acoes que valem PONTO para quem executou. */
function coresEhPonto(ak, oc) {
  return (ak === "saque" && oc === "Ace") ||
         ((ak === "ataque" || ak === "bloqueio") && oc === "Ponto");
}

function coresRankings(games, teams, evByGame, cfgIn, opts) {
  var cfg = coresCfg(cfgIn);
  opts = opts || {};
  /* 3 e o piso razoavel para set unico de 21 no 4x4: com 5 quase ninguem
     entrava no ranking de um fundamento so. */
  var minAcoes = (opts.minAcoes == null) ? 3 : opts.minAcoes;
  var soJogo = opts.gameId || null;

  var byId = {}, i, j;
  for (i = 0; i < teams.length; i++) byId[teams[i].id] = teams[i];

  /* indice de atletas: um jogador pode aparecer em varios jogos */
  var info = {};
  for (i = 0; i < teams.length; i++) {
    var ps = teams[i].players || [];
    for (j = 0; j < ps.length; j++) {
      info[ps[j].id] = { jid: ps[j].id, nm: ps[j].nm, nu: ps[j].nu,
                         tid: teams[i].id, equipe: teams[i].n, cor: teams[i].cor };
    }
  }

  var linha = {};   /* jid -> acumulado */
  function pega(jid) {
    if (!info[jid]) return null;
    if (!linha[jid]) {
      var L = { jid: jid, nm: info[jid].nm, nu: info[jid].nu, tid: info[jid].tid,
                equipe: info[jid].equipe, cor: info[jid].cor,
                acoes: 0, pontos: 0, erros: 0, jogos: {},
                porFund: {} };
      for (var k in CORES_ACT) if (CORES_FUND.indexOf(k) >= 0) {
        L.porFund[k] = { n: 0, A: 0, B: 0, C: 0, Erro: 0, Ace: 0, Ponto: 0, Bloq: 0, Cont: 0 };
      }
      linha[jid] = L;
    }
    return linha[jid];
  }

  for (i = 0; i < games.length; i++) {
    var g = games[i];
    if (!g) continue;
    if (soJogo && g.id !== soJogo) continue;
    var evs = coresEventList((evByGame && evByGame[g.id]) || null);
    for (j = 0; j < evs.length; j++) {
      var e = evs[j];
      if (!e || e.t !== "act" || !e.jid) continue;      /* falta/ponto avulso nao tem atleta */
      var L = pega(e.jid);
      if (!L) continue;
      var f = L.porFund[e.ak];
      if (!f) continue;                                  /* fundamento fora do painel */
      L.acoes++;
      L.jogos[g.id] = 1;
      f.n++;
      if (f[e.oc] != null) f[e.oc]++;
      if (e.oc === "Erro") L.erros++;
      if (coresEhPonto(e.ak, e.oc)) L.pontos++;
    }
  }

  var todos = [];
  for (var jid in linha) {
    var L = linha[jid];
    L.njogos = Object.keys(L.jogos).length;
    delete L.jogos;
    todos.push(L);
  }

  function ordena(arr, chave) {
    arr.sort(function (a, b) {
      if (b[chave] !== a[chave]) return b[chave] - a[chave];
      if (b.acoes !== a.acoes) return b.acoes - a.acoes;     /* mais volume desempata */
      return String(a.nm).localeCompare(String(b.nm));
    });
    for (var i = 0; i < arr.length; i++) arr[i].pos = i + 1;
    return arr;
  }

  /* 1) maiores pontuadores */
  var pontuadores = ordena(todos.filter(function (L) { return L.pontos > 0; }).map(function (L) {
    return { jid: L.jid, nm: L.nm, nu: L.nu, equipe: L.equipe, cor: L.cor, tid: L.tid,
             pontos: L.pontos, acoes: L.acoes, njogos: L.njogos,
             ace: L.porFund.saque.Ace, ataque: L.porFund.ataque.Ponto, bloqueio: L.porFund.bloqueio.Ponto };
  }), "pontos");

  /* 2) por fundamento */
  var fundamentos = {};
  CORES_FUND.forEach(function (ak) {
    var abc = CORES_FUND_ABC.indexOf(ak) >= 0;
    var lista = [];
    todos.forEach(function (L) {
      var f = L.porFund[ak];
      if (!f || !f.n) return;
      var item = { jid: L.jid, nm: L.nm, nu: L.nu, equipe: L.equipe, cor: L.cor, tid: L.tid,
                   n: f.n, acoes: f.n, erros: f.Erro };
      if (abc) {
        item.A = f.A; item.B = f.B; item.C = f.C;
        item.pct = Math.round(f.A * 100 / f.n);          /* % de A sobre o total */
        item.rotulo = "% A";
      } else if (ak === "saque") {
        item.acertos = f.Ace; item.emJogo = f.Cont;
        item.pct = Math.round(f.Ace * 100 / f.n);
        item.rotulo = "% ace";
      } else if (ak === "ataque") {
        item.acertos = f.Ponto; item.bloqueados = f.Bloq;
        item.pct = Math.round(f.Ponto * 100 / f.n);
        item.rotulo = "% ponto";
      } else if (ak === "bloqueio") {
        item.acertos = f.Ponto;
        item.pct = Math.round(f.Ponto * 100 / f.n);
        item.rotulo = "% ponto";
      }
      lista.push(item);
    });
    fundamentos[ak] = {
      label: CORES_ACT[ak].l, icone: CORES_ACT[ak].i, abc: abc,
      rotulo: lista.length ? lista[0].rotulo : (abc ? "% A" : "%"),
      /* o ranking de % exige um minimo de acoes; quem tem menos aparece a parte */
      ranking: ordena(lista.filter(function (x) { return x.n >= minAcoes; }), "pct"),
      poucos: lista.filter(function (x) { return x.n < minAcoes; })
    };
  });

  /* 3) tabela geral */
  var geral = todos.slice().sort(function (a, b) {
    if (b.pontos !== a.pontos) return b.pontos - a.pontos;
    if (b.acoes !== a.acoes) return b.acoes - a.acoes;
    return String(a.nm).localeCompare(String(b.nm));
  });

  return { pontuadores: pontuadores, fundamentos: fundamentos, geral: geral,
           minAcoes: minAcoes, temDado: todos.length > 0 };
}

/* Ordem do mural: AO VIVO no topo, depois agendados por data/hora crescente,
   finalizados por ultimo (mesmo criterio do RS-SCOUT). */
function coresOrderGames(games) {
  var g = (games || []).slice();
  function rank(x) {
    if (x.st === "ao_vivo") return 0;
    if (x.st === "finalizada") return 2;
    return 1;
  }
  function fase(x) { return CORES_FASES[coresFase(x)].ordem; }
  function when(x) { return (x.dt || "9999-12-31") + "T" + (x.tm || "23:59"); }
  g.sort(function (a, b) {
    var ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (fase(a) !== fase(b)) return fase(a) - fase(b);   /* mata-mata depois da classificatoria */
    if (ra === 2) return when(b) < when(a) ? -1 : (when(b) > when(a) ? 1 : 0);  // finalizados: mais recente primeiro
    return when(a) < when(b) ? -1 : (when(a) > when(b) ? 1 : 0);
  });
  return g;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    CORES_ACT: CORES_ACT, CORES_OC: CORES_OC, CORES_FCOL: CORES_FCOL,
    CORES_CFG_PADRAO: CORES_CFG_PADRAO,
    coresCfg: coresCfg, coresTerminal: coresTerminal, coresEventList: coresEventList,
    coresOnCourt: coresOnCourt, coresNextServer: coresNextServer,
    CORES_FUND: CORES_FUND, CORES_FASES: CORES_FASES,
    coresFase: coresFase, coresOutcome: coresOutcome, coresResolveGames: coresResolveGames,
    coresLadoLabel: coresLadoLabel, coresBracket: coresBracket, coresCampeao: coresCampeao,
    CORES_FUND_ABC: CORES_FUND_ABC, coresEhPonto: coresEhPonto, coresRankings: coresRankings,
    coresComputeGame: coresComputeGame, coresPlayerLine: coresPlayerLine,
    coresStandings: coresStandings, coresOrderGames: coresOrderGames
  };
}

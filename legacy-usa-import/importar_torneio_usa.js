// ============================================================
// IMPORTAÇÃO TORNEIO USA — RS-SCOUT
// ============================================================
// Adiciona ao banco: torneio "2026 Adult Open Championship",
// 3 jogos e 15 atletas do RS Adulto Masculino.
// NÃO apaga nem altera nada que já existe.
//
// Como rodar:
// 1. Abra master.associacaoscoladevoleibol.com.br
// 2. Faça login como admin (Rodrigo)
// 3. Aperte F12 > aba Console
// 4. Cole TODO este arquivo e aperte Enter
// 5. Confirme quando perguntar
// ============================================================

(async function importarTorneioUSA(){
  if(typeof db === "undefined"){
    console.error("ERRO: abra o app e faça login antes.");
    return;
  }

  var USA_TOURNAMENT = {"id": "t_usa_open", "n": "2026 Adult Open Championship", "cat": "Adulto Masculino", "tid": "trs_adulto", "season": "2026", "tot": 0, "st": "active", "color": "#1d6b3a", "special": true, "usaEvent": true};
  var USA_GAMES = [{"id": "g_usa_1", "torId": "t_usa_open", "tid": "trs_adulto", "cat": "Adulto Masculino", "phase": "Fase de Classificação", "dt": "2026-05-22", "tm": "10:00", "opp": "Arlington Empire", "loc": "Orange County Convention Center", "st": "pending", "tor": "2026 Adult Open Championship", "lineup": [{"aid": "usa_01", "nu": 1}, {"aid": "usa_02", "nu": 2}, {"aid": "usa_03", "nu": 3}, {"aid": "usa_04", "nu": 4}, {"aid": "usa_05", "nu": 5}, {"aid": "usa_06", "nu": 6}, {"aid": "usa_07", "nu": 7}, {"aid": "usa_08", "nu": 8}, {"aid": "usa_09", "nu": 9}, {"aid": "usa_10", "nu": 10}, {"aid": "usa_11", "nu": 11}, {"aid": "usa_12", "nu": 12}, {"aid": "usa_13", "nu": 13}, {"aid": "usa_14", "nu": 14}, {"aid": "usa_15", "nu": 15}], "act": [], "ss": [], "result": {"type": null, "sets": null, "title": null}, "usaGame": true, "oppLogo": "ae"}, {"id": "g_usa_2", "torId": "t_usa_open", "tid": "trs_adulto", "cat": "Adulto Masculino", "phase": "Fase de Classificação", "dt": "2026-05-22", "tm": "11:00", "opp": "The Tall Ones", "loc": "Orange County Convention Center", "st": "pending", "tor": "2026 Adult Open Championship", "lineup": [{"aid": "usa_01", "nu": 1}, {"aid": "usa_02", "nu": 2}, {"aid": "usa_03", "nu": 3}, {"aid": "usa_04", "nu": 4}, {"aid": "usa_05", "nu": 5}, {"aid": "usa_06", "nu": 6}, {"aid": "usa_07", "nu": 7}, {"aid": "usa_08", "nu": 8}, {"aid": "usa_09", "nu": 9}, {"aid": "usa_10", "nu": 10}, {"aid": "usa_11", "nu": 11}, {"aid": "usa_12", "nu": 12}, {"aid": "usa_13", "nu": 13}, {"aid": "usa_14", "nu": 14}, {"aid": "usa_15", "nu": 15}], "act": [], "ss": [], "result": {"type": null, "sets": null, "title": null}, "usaGame": true, "oppLogo": "tallones"}, {"id": "g_usa_3", "torId": "t_usa_open", "tid": "trs_adulto", "cat": "Adulto Masculino", "phase": "Fase de Classificação", "dt": "2026-05-22", "tm": "13:00", "opp": "VBA Highline", "loc": "Orange County Convention Center", "st": "pending", "tor": "2026 Adult Open Championship", "lineup": [{"aid": "usa_01", "nu": 1}, {"aid": "usa_02", "nu": 2}, {"aid": "usa_03", "nu": 3}, {"aid": "usa_04", "nu": 4}, {"aid": "usa_05", "nu": 5}, {"aid": "usa_06", "nu": 6}, {"aid": "usa_07", "nu": 7}, {"aid": "usa_08", "nu": 8}, {"aid": "usa_09", "nu": 9}, {"aid": "usa_10", "nu": 10}, {"aid": "usa_11", "nu": 11}, {"aid": "usa_12", "nu": 12}, {"aid": "usa_13", "nu": 13}, {"aid": "usa_14", "nu": 14}, {"aid": "usa_15", "nu": 15}], "act": [], "ss": [], "result": {"type": null, "sets": null, "title": null}, "usaGame": true, "oppLogo": "vla"}];
  var USA_ATHLETES = [{"aid": "usa_01", "nm": "Mateus Passaro Queiroz", "po": "", "gender": "M", "legacy_ids": [], "tags": ["usa2026"], "last_nu_by_team": {"trs_adulto": 1}, "usaRoster": true}, {"aid": "usa_02", "nm": "Walisson Vinicius Alves dos Santos", "po": "", "gender": "M", "legacy_ids": [], "tags": ["usa2026"], "last_nu_by_team": {"trs_adulto": 2}, "usaRoster": true}, {"aid": "usa_03", "nm": "Hugo Satoshi Imaizumi", "po": "", "gender": "M", "legacy_ids": [], "tags": ["usa2026"], "last_nu_by_team": {"trs_adulto": 3}, "usaRoster": true}, {"aid": "usa_04", "nm": "Yuri Ohtani Spolle", "po": "", "gender": "M", "legacy_ids": [], "tags": ["usa2026"], "last_nu_by_team": {"trs_adulto": 4}, "usaRoster": true}, {"aid": "usa_05", "nm": "Alan Vitor Souza", "po": "", "gender": "M", "legacy_ids": [], "tags": ["usa2026"], "last_nu_by_team": {"trs_adulto": 5}, "usaRoster": true}, {"aid": "usa_06", "nm": "Bono Reggiani Martins Arruda", "po": "", "gender": "M", "legacy_ids": [], "tags": ["usa2026"], "last_nu_by_team": {"trs_adulto": 6}, "usaRoster": true}, {"aid": "usa_07", "nm": "Rodolfo Vicente de Paula Soares", "po": "", "gender": "M", "legacy_ids": [], "tags": ["usa2026"], "last_nu_by_team": {"trs_adulto": 7}, "usaRoster": true}, {"aid": "usa_08", "nm": "Marcos Vinicius Ferreira dos Santos", "po": "", "gender": "M", "legacy_ids": [], "tags": ["usa2026"], "last_nu_by_team": {"trs_adulto": 8}, "usaRoster": true}, {"aid": "usa_09", "nm": "Kauan Vitor da Silva Jaques", "po": "", "gender": "M", "legacy_ids": [], "tags": ["usa2026"], "last_nu_by_team": {"trs_adulto": 9}, "usaRoster": true}, {"aid": "usa_10", "nm": "Carlos Renato Martins Arruda", "po": "", "gender": "M", "legacy_ids": [], "tags": ["usa2026"], "last_nu_by_team": {"trs_adulto": 10}, "usaRoster": true}, {"aid": "usa_11", "nm": "Maiko Prudencio Costa", "po": "", "gender": "M", "legacy_ids": [], "tags": ["usa2026"], "last_nu_by_team": {"trs_adulto": 11}, "usaRoster": true}, {"aid": "usa_12", "nm": "Mikael Cerqueira Lopes", "po": "", "gender": "M", "legacy_ids": [], "tags": ["usa2026"], "last_nu_by_team": {"trs_adulto": 12}, "usaRoster": true}, {"aid": "usa_13", "nm": "Theo Fabricio Nery Lopes", "po": "", "gender": "M", "legacy_ids": [], "tags": ["usa2026"], "last_nu_by_team": {"trs_adulto": 13}, "usaRoster": true}, {"aid": "usa_14", "nm": "Daniel Peneres Lima", "po": "", "gender": "M", "legacy_ids": [], "tags": ["usa2026"], "last_nu_by_team": {"trs_adulto": 14}, "usaRoster": true}, {"aid": "usa_15", "nm": "Fabiano Marques Santos", "po": "", "gender": "M", "legacy_ids": [], "tags": ["usa2026"], "last_nu_by_team": {"trs_adulto": 15}, "usaRoster": true}];

  console.log("=== Importação Torneio USA ===");

  // Ler estado atual
  var snap = await db.ref("torneio-master-santos").once("value");
  var cur = snap.val();
  if(!cur){ console.error("Banco vazio. Aborte."); return; }

  var tournaments = cur.tournaments || [];
  var games = cur.games || [];
  var athletes = cur.athletes || [];

  // Converter para array se vier como objeto
  if(!Array.isArray(tournaments)) tournaments = Object.values(tournaments);
  if(!Array.isArray(games)) games = Object.values(games);
  if(!Array.isArray(athletes)) athletes = Object.values(athletes);

  console.log("Estado atual: " + tournaments.length + " torneios, " + games.length + " jogos, " + athletes.length + " atletas");

  // Detectar duplicatas (idempotente — pode rodar 2x sem estragar)
  var tourExists = tournaments.some(function(t){ return t.id === USA_TOURNAMENT.id; });
  var existingGameIds = {};
  games.forEach(function(g){ existingGameIds[g.id] = true; });
  var existingAthIds = {};
  athletes.forEach(function(a){ existingAthIds[a.aid] = true; });

  var novoTour = tourExists ? 0 : 1;
  var novosGames = USA_GAMES.filter(function(g){ return !existingGameIds[g.id]; });
  var novosAths = USA_ATHLETES.filter(function(a){ return !existingAthIds[a.aid]; });

  console.log("A adicionar: " + novoTour + " torneio, " + novosGames.length + " jogos, " + novosAths.length + " atletas");

  if(novoTour === 0 && novosGames.length === 0 && novosAths.length === 0){
    console.log("Tudo já está no banco. Nada a fazer.");
    return;
  }

  var confirma = confirm(
    "IMPORTAR TORNEIO USA\n\n" +
    "Vou ADICIONAR (sem apagar nada):\n" +
    "- " + novoTour + " torneio (2026 Adult Open Championship)\n" +
    "- " + novosGames.length + " jogos\n" +
    "- " + novosAths.length + " atletas do RS Adulto Masculino\n\n" +
    "Confirma?"
  );
  if(!confirma){ console.log("Cancelado."); return; }

  // Montar novos arrays
  if(!tourExists) tournaments.push(USA_TOURNAMENT);
  novosGames.forEach(function(g){ games.push(g); });
  novosAths.forEach(function(a){ athletes.push(a); });

  // Escrever cada filho separadamente (granular, seguro)
  console.log("Gravando...");
  await db.ref("torneio-master-santos/tournaments").set(tournaments);
  await db.ref("torneio-master-santos/games").set(games);
  await db.ref("torneio-master-santos/athletes").set(athletes);

  console.log("PRONTO! Torneio USA importado.");
  console.log("Acesse: master.associacaoscoladevoleibol.com.br/?torneio=usa");
  console.log("Senha: usa2026");
  console.log("Recarregando em 3s...");
  setTimeout(function(){ location.reload(); }, 3000);
})();

# RS-SCOUT — Contexto do projeto (handoff)

> Cole este documento no início de qualquer sessão futura, junto com o
> `index.html` mais recente e o `rs-scout-kit.zip`.
> Última atualização: fim da sessão "editar jogo + plano de adequação".

## O que é

App de scout de vôlei. Arquivo único `index.html` (~410KB, HTML+CSS+JS inline).
Firebase Realtime Database (projeto `scola-volei`, ref `torneio-master-santos`).
Deploy: GitHub (`rodrigosvolei-creator/scout-master-santos`, branch main) → Coolify.
Usado AO VIVO em quadra, inclusive no fuso dos EUA. Admin: rodrigosvolei@gmail.com.

O app tem duas faces:
1. **App geral** — landing, login, abas (Scout, Torneios, Agenda, Stats,
   Perfil, Config). Ainda no visual claro antigo.
2. **Torneio isolado USA** — acessível por `?torneio=usa`, protegido por senha.
   Tem o visual escuro de transmissão e está completo e testado.

## PRÓXIMO GRANDE TRABALHO: adequação do app completo

Está fechado um plano para fazer o visual e o fluxo do torneio virarem o
padrão de TODO o app. Ver o documento `PLANO_ADEQUACAO_RS-SCOUT.md`.
Resumo das decisões fechadas com o cliente:
- Após login, a tela inicial vira os CARDS DE TORNEIOS. As abas continuam
  acessíveis como menu secundário.
- O torneio USA vira HISTÓRICO: card cinza/selado "ENCERRADO", só leitura.
- Sem senha por torneio — o login geral do app basta. O fluxo
  `?torneio=usa` + `TOURNEY_ACCESS` será removido.

**A EXECUÇÃO dessa adequação deve ser feita no Claude Code**, não nesta
interface de chat: o arquivo é grande, o trabalho é amplo e multi-sessão,
e o Claude Code edita o arquivo no disco e roda os testes localmente, sem
o vaivém de zip. Levar para lá: este contexto, o PLANO_ADEQUACAO, o
index.html e o rs-scout-kit.zip.

## Senhas do torneio USA (enquanto o fluxo antigo existir)

- Senha de **acesso** (ver cards + fazer scout): `usa2026`
- Senha de **admin** (criar/excluir/editar jogo): `rsadmin2026`
- Ficam em `TOURNEY_ACCESS` no código. SERÃO REMOVIDAS na adequação.

## Estado atual — pronto e testado (torneio USA)

- Placar `+`/`−` funcionando.
- Ponto automático parcial: Ace / Ataque-Ponto / Bloqueio-Ponto sobem o RS;
  Saque/Ataque/Bloqueio com Erro sobem o adversário; `undo` reverte ação e
  ponto juntos.
- Telas do torneio no tema escuro de transmissão (senha, cards GAME DAY,
  scout) com marca d'água do logo RS.
- Logo do adversário: detecção automática por nome + upload de imagem.
- Criar jogo no torneio (`➕ Novo Jogo`) — protegido por senha de admin.
- **Editar jogo pendente** (`✏️ Editar jogo` no card) — protegido por senha
  de admin, formulário pré-preenchido, atualiza o jogo sem duplicar. Só
  jogos pendentes; live/finalizado não têm o botão. (`openTorneioEditarJogo`,
  `_tnjEditId`, `cancelTorneioModal`.)
- Excluir jogo (`🗑 Excluir jogo`) — protegido por senha de admin.
- Formato da partida por jogo (`maxSets` 3 ou 5).
- Escalação default: 15 atletas fixos (`USA_ROSTER`).
- PDF da partida (`exGamePDF`) — relatório estruturado.
- **Cards de jogo ordenados** do mais recente para o mais antigo (data+hora).
- **Selo "PRÓXIMO JOGO"** dourado no próximo jogo pendente.
- **Painel AO VIVO** (`📊 AO VIVO` no card do scout) — overlay escuro com
  marca d'água RS, lê só `gm.act`. Dois blocos: Termômetro do time (3 KPIs
  com semáforo e tendência) e Por atleta (cards com veredito, barras e
  contagens). Toggle Set atual / Jogo todo. (`openLivePanel`,
  `livePanelStats`, `renderLivePanel`.)
- Tela de scout compacta no celular (`@media(max-width:480px)`).

Blocos do painel que ficaram para depois (propostos, não feitos):
Alertas automáticos (frases tipo "4 erros seguidos") e Ritmo do set.

## O que NÃO foi mexido (de propósito)

- App geral (landing, abas) — visual antigo. Será o alvo da adequação.
- PDFs antigos (`exAthPDF`, `exMyAthPDF`, `exAllAthPDF`, `buildPDFhtml`) —
  decisão do cliente: deixar como estão.

## Pendências de infra (de sessões antigas, ainda abertas)

- Webhook de auto-deploy no Coolify.
- DNS `rs.associacaoscoladevoleibol.com.br` na Locaweb apontando pro Coolify.
- Firebase Security Rules (arquivo de regras já preparado antes).

## Como continuar numa sessão nova

A "skill rs-scout" NÃO é skill instalada do sistema — é um conjunto de
arquivos (SKILL.md + test_*.js) dentro do `rs-scout-kit.zip`. Dizer só
"leia a skill rs-scout" sem anexar o zip NÃO funciona.

Anexe TODOS estes arquivos:
1. `index.html` — o app (versão mais recente)
2. `CONTEXTO_RS-SCOUT.md` — este documento
3. `PLANO_ADEQUACAO_RS-SCOUT.md` — o plano da adequação (se for trabalhar nela)
4. `rs-scout-kit.zip` — contém SKILL.md (método + linguagem visual) e os
   8 arquivos de teste: test_scout.js, test_autoscore.js,
   test_render_scout.js, test_torneio.js, test_fase3.js, test_excluir.js,
   test_painel.js, test_editar.js

E diga: "continua o RS-SCOUT — descompacte o rs-scout-kit.zip, leia o
SKILL.md e o CONTEXTO, e use os test_*.js antes de entregar qualquer mudança".

Os arquivos de teste são copiados para a pasta de trabalho e rodados com
`node`. Precisam do pacote `jsdom` instalado.

## Regras inegociáveis

- NUNCA entregar mudança sem rodar os testes de runtime (jsdom). São 8
  arquivos de teste — rodar TODOS antes de entregar. Mudança nova precisa
  de teste novo (ou asserções novas num teste existente).
- NUNCA remover o guard `_dataLoaded` do `save()` (protege contra perda de
  dados; houve incidente real de 249 ações perdidas).
- Os dados reais de jogos do torneio USA não podem ser perdidos nem
  alterados na adequação.
- `/mnt/user-data/uploads` é read-only — copiar para a pasta de trabalho.
- Preview com moldura de celular NÃO testa media query — aplicar o CSS
  mobile forçado, ou testar em celular real.

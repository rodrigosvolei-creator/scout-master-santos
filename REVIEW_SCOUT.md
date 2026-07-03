# REVIEW COMPLETO — RS-SCOUT (rumo a "app de scout de verdade" / SaaS)

> Auditoria feita em 2026-07-03 por camadas (dados, sincronização, lógica de jogo, mobile,
> UX/produto). Cada achado foi **verificado no código** — vários "críticos" apontados pelos
> agentes eram falsos alarmes (marcados abaixo). Prioridade: o que produz dado errado ou perde
> dado vem primeiro.

---

## 0. Resumo em 30 segundos

- **O código atual sincroniza corretamente entre dispositivos** — provei com teste de 2 aparelhos
  reais (`tests/test_multidevice.js`, 15/15). O bug que você viu ("2º celular pede pra reescalar")
  **não se reproduz no código de hoje**. Causa mais provável: **o app no ar está builds atrás**
  (Coolify é redeploy manual). Segunda hipótese: fragilidade de escrita concorrente (item C1).
- **Já corrigi nesta sessão:** (1) mobile — logo solta no meio da tela; (2) persistência do modo
  quadra agora é **granular** (não sobrescreve outro jogo); (3) aviso quando falha ao salvar.
- **A lógica de scout está sólida** — os 2 "críticos" de regra de vôlei apontados eram enganos.
- **O que falta pra ser SaaS é arquitetural** (itens C1–C3) e precisa de **decisão sua + backup**
  (mexe no banco de produção). Não faço sozinho.

---

## 1. O que JÁ corrigi nesta sessão (no código, testado)

| # | Correção | Onde | Verificação |
|---|----------|------|-------------|
| A | **Mobile: logo (marca d'água) solta no meio da tela** — 5 marcas `position:fixed` centralizadas sem proteção mobile. Agora escondidas em ≤640px. | `index.html` CSS (media query novo) | Verificado no navegador: mobile 375px → `display:none`; desktop → `block`. |
| B | **Persistência granular do modo quadra** — escalar/rodar/trocar líbero usava `save()` (reescreve o array de jogos inteiro → podia apagar o jogo que OUTRO scout editava). Agora usa `saveGame` (só o jogo). | `_persistGame()` + 5 funções de quadra | `test_multidevice.js`: 2 aparelhos em 2 jogos diferentes, um não apaga o outro (15/15). |
| C | **Aviso de falha ao salvar** — o `.catch` era silencioso; se a rede cai, o usuário não sabia. Agora mostra "⚠ Falha ao salvar — verifique a conexão". | `_persistGame()` | Silencia só erro de permissão (papel sem acesso); erro de rede aparece. |

---

## 2. O bug multi-dispositivo — o que realmente é

**Investiguei a fundo e o código de hoje sincroniza:** quando A escala e marca, B (outro
aparelho) recebe o posicionamento, as ações e o placar — em tempo real — e **não** pede pra
reescalar. Testado nos caminhos reais (abrir pelo card, modo tablet ligado/desligado, escalar
tocando as células).

**Então por que você viu o bug?** Duas explicações, em ordem de probabilidade:

1. **App no ar desatualizado (mais provável).** O Coolify é redeploy manual; o app publicado
   costuma ficar builds atrás do GitHub. Se você testou com 2 celulares numa versão antiga, o
   comportamento pode ter sido corrigido depois. **Ação:** dar Redeploy no build atual e re-testar.
2. **Escrita concorrente (item C1 abaixo).** Se dois aparelhos gravam **ao mesmo tempo**, o modelo
   atual pode fazer um sobrescrever o outro. A correção **B** (persistência granular) já reduz
   muito isso; a solução definitiva é a migração keyed-by-id (C1).

Se, **após o Redeploy**, o bug ainda aparecer, me mande: quantos jogos existem, como o 2º
aparelho abre (card/torneio), e em que set estava. Com isso reproduzo o caso exato.

---

## 3. Falsos alarmes (verifiquei — NÃO são bugs, não mexer)

- **"Rotação não acontece quando o adversário pontua"** (`courtApplyPoint`) — **correto como está.**
  Em vôlei, só o time que **ganha** o side-out rotaciona. Quando o adversário pontua, a nossa
  quadra não roda (a dele roda, e não trackeamos a dele). A "correção" sugerida introduziria bug.
- **"Eficiência do bloqueio ignora bloqueios bons"** (`_pdfGood`) — **correto como está.** O
  fundamento bloqueio só tem resultados `Ponto / Erro / Cont` (não existe "Bloq" no bloqueio —
  isso é do ataque). O cálculo `Ponto/total` está certo.
- **Bugs do modo minis 2-lados** — **é legado, não mexer** (decisão sua).

---

## 4. Problemas REAIS, priorizados

### 🔴 Arquitetura — precisam de decisão sua + backup (mexem no banco de produção)

**C1. Jogos indexados por posição, não por id (`games/{índice}`).**
`saveGame` grava em `games/{índice}` calculado da lista local; se a ordem diverge entre aparelhos
(ex: alguém cria/exclui um jogo), a escrita pode cair no jogo errado. É a causa-raiz da fragilidade
multi-dispositivo. **Correção:** migrar para `games/{id}` (chave = id do jogo). Elimina a classe
inteira de bugs de índice. Precisa de: backup do RTDB + script de migração + janela fora de jogo.
*(`saveGame` index.html:1966; leitura `gF` index.html:1198.)*

**C2. Escrita concorrente no mesmo jogo (2 scouts na mesma partida).**
Hoje cada ponto reescreve o **objeto do jogo inteiro** → "o último a salvar vence"; se dois marcam
quase juntos, um perde. **Correção:** gravar **por ação** (`games/{id}/act` com `push`) — um log de
eventos, cada ponto é um item imutável. Reconstrói o placar a partir das ações. É a base pra
colaboração real (2 pessoas na mesa, telão interativo).

**C3. Multi-tenant (pré-requisito de SaaS).**
Tudo grava em `torneio-master-santos` fixo — zero isolamento entre clientes. Pra SaaS: schema
`tenants/{id}/...`, papéis por tenant, e planos. É o maior bloco de trabalho.

### 🟠 Confiabilidade — correções médias (posso fazer sem tocar produção)

**R1. Undo some ao recarregar a página.** O histórico (`S.us`) vive só na memória. Recarregou no
meio do jogo → não dá mais pra desfazer. **Correção:** persistir por jogo (localStorage/RTDB).

**R2. Cronômetro zera ao recarregar.** `S.tm` é volátil. **Correção:** guardar `{início, elapsed}`
no jogo.

**R3. Indicador de "salvo / online / offline".** Hoje não há sinal de que a ação foi gravada. A
correção **C** (aviso de falha) é o começo; falta o "✓ salvo" e o modo offline com fila de reenvio.

**R4. Editar uma ação lá atrás sem desfazer tudo.** Errou o atleta na ação 30 de 50 → hoje só
desfazendo 20. **Correção:** tocar na ação no feed e editar no lugar.

### 🟢 Produto — pra competir com Data Volley / VolleyStation

- **Marcação em 1–2 toques** (hoje 3): botões combinados por fundamento, atleta pré-selecionado.
- **Escalação por jogo, não por set** (set 2/3 herda o set 1; hoje reescala tudo).
- **Export CSV** das ações brutas (treinador analisar no Excel) + **stats por rotação** + heatmap.
- **Import de elenco em massa** (colar lista "1 João / 2 Maria…").

---

## 5. Roadmap sugerido

1. **Agora (feito):** mobile + persistência granular + aviso de falha. **→ Redeploy e re-testar o multi-device.**
2. **Confiabilidade (sem tocar produção):** undo/cronômetro persistentes, "✓ salvo", editar ação no feed.
3. **Arquitetura (com seu ok + backup):** C1 keyed-by-id → C2 escrita por-ação → colaboração real.
4. **SaaS:** C3 multi-tenant, planos, onboarding self-service, export/API.

---

## 6. O que precisa de VOCÊ

1. **Redeploy no Coolify** (build atual) e re-teste com 2 celulares — pra confirmar o multi-device.
2. **Decidir sobre C1 (keyed-by-id):** é a correção de raiz do "grava no jogo errado". Faço quando
   você autorizar + eu tirar backup do banco. Não mexo em produção sem o seu ok.
3. **Definir a ambição:** se é pra virar SaaS de verdade, C2+C3 são o coração — é um projeto, não
   um ajuste. Posso montar um plano de fases com esforço estimado quando você quiser.

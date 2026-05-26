# Importar Torneio USA — passo a passo

## O que este pacote faz

Adiciona ao sistema o **2026 Adult Open Championship** (torneio nos EUA):
- 1 torneio
- 3 jogos do RS Adulto Masculino (vs Arlington Empire, The Tall Ones, VBA Highline)
- 15 atletas com número de camisa
- Tela isolada acessível por senha

**Não apaga nem altera nada** que já existe no banco.

---

## Ordem de execução

### 1. Subir o HTML novo

1. Renomeia `torneio-master.html` -> `index.html`
2. GitHub -> repo `scout-master-santos` -> Upload files -> substitui
3. Commit -> Coolify deploya (~2 min)

Este HTML tem: a tela isolada do torneio, os cards GAME DAY com logos reais,
e o fix de seguranca do save().

### 2. Importar os dados (script no console)

1. Abre master.associacaoscoladevoleibol.com.br
2. Faz login como admin (Google, rodrigosvolei@gmail.com)
3. Aperta F12 -> aba Console
4. Se aparecer aviso de seguranca, digita "allow pasting" e Enter
5. Abre o arquivo importar_torneio_usa.js, copia tudo
6. Cola no console e aperta Enter
7. Confirma no popup
8. App recarrega sozinho

O script e idempotente -- se rodar duas vezes por engano, nao duplica nada.

---

## Como acessar a tela do torneio

Depois de importado:

URL: master.associacaoscoladevoleibol.com.br/?torneio=usa
Senha: usa2026

Quem tem a senha entra direto na tela isolada, ve os 3 cards GAME DAY,
e pode fazer scout em qualquer um dos 3 jogos. Nao precisa de conta Google.

---

## Fluxo de uso (quem vai fazer scout nos EUA)

1. Abre o link ?torneio=usa
2. Digita a senha usa2026
3. Ve os 3 cards GAME DAY
4. Clica num card -> abre o scout daquele jogo
5. Faz o scout normalmente
6. Volta -> o card agora mostra placar + "Ver estatisticas"

---

## Os 3 jogos (22/05/2026, horario BR)

Jogo 1 - Arlington Empire - 10h00
Jogo 2 - The Tall Ones - 11h00
Jogo 3 - VBA Highline - 13h00

Se o time passar de fase, e so cadastrar os jogos novos pelo app normal
(Config -> Jogos, vinculando ao torneio "2026 Adult Open Championship").

---

## Os 15 atletas

Mateus Passaro Queiroz (1), Walisson Vinicius Alves dos Santos (2),
Hugo Satoshi Imaizumi (3), Yuri Ohtani Spolle (4), Alan Vitor Souza (5),
Bono Reggiani Martins Arruda (6), Rodolfo Vicente de Paula Soares (7),
Marcos Vinicius Ferreira dos Santos (8), Kauan Vitor da Silva Jaques (9),
Carlos Renato Martins Arruda (10), Maiko Prudencio Costa (11),
Mikael Cerqueira Lopes (12), Theo Fabricio Nery Lopes (13),
Daniel Peneres Lima (14), Fabiano Marques Santos (15)

Todos escalados nos 3 jogos.

---

## Se algo der errado

O script so ADICIONA -- nao tem como apagar dados. Se der erro no meio:
- Confere se voce esta logado como admin
- Confere se o console mostrou alguma mensagem de erro
- Pode rodar de novo (ele detecta o que ja foi importado)

Qualquer problema, manda o print do console.

# Subir as regras do Firebase — passo a passo

Objetivo: liberar o nó `torneio-cores` (o módulo novo) **sem mexer** no que já está
no ar para o RS-Scout. Leva 2 minutos.

## 1. Abrir o console

1. Vá em **https://console.firebase.google.com**
2. Entre com a conta Google que administra o projeto (rodrigosvolei@gmail.com).
3. Clique no projeto **scola-volei**.

## 2. Chegar nas regras

1. No menu da esquerda: **Criação (Build)** → **Realtime Database**.
   - Se o menu estiver recolhido, o ícone é um cilindro de banco de dados.
2. No topo da tela, clique na aba **Regras** (Rules).

Você vai ver um editor de texto com o JSON das regras atuais.

## 3. FAZER BACKUP (não pule)

Antes de mudar qualquer coisa: **selecione tudo** no editor (Ctrl+A), **copie**
(Ctrl+C) e cole num arquivo de texto qualquer, ou no Bloco de Notas. Se algo der
errado, é só colar de volta e publicar.

## 4. Colar as regras novas

1. Com tudo ainda selecionado (Ctrl+A), **cole** o conteúdo abaixo por cima —
   é o mesmo do arquivo `firebase-rules-cores.json` do repositório:

```json
{
  "rules": {
    ".read": false,
    ".write": false,

    "torneio-master-santos": {
      "teams":       { ".read": true, ".write": "auth != null" },
      "games":       { ".read": true, ".write": "auth != null" },
      "athletes":    { ".read": true, ".write": "auth != null" },
      "tournaments": { ".read": true, ".write": "auth != null" },
      "invites":     { ".read": true, ".write": "auth != null" },
      "users":       { ".read": "auth != null", ".write": "auth != null" }
    },

    "torneio-cores": {
      ".read": true,
      ".write": true
    }
  }
}
```

2. Clique em **Publicar** (Publish), no canto superior direito.
3. Se aparecer um aviso amarelo sobre "regras não seguras", é esperado — vem do
   `torneio-cores` estar aberto (decisão nossa, ver abaixo). Pode publicar.

## 5. Conferir

- Abra `cores.html` (o módulo por cores). Se a faixa vermelha
  "Sem permissão de escrita no Firebase" **não** aparecer, deu certo.
- Crie uma equipe de teste no Admin e apague depois.
- O RS-Scout normal continua igual: marque um ponto num jogo de teste para
  confirmar que nada quebrou (o bloco `torneio-master-santos` não mudou).

---

## O que foi mudado, em português

- O bloco **`torneio-master-santos`** (o RS-Scout de sempre) está **idêntico** ao
  que já estava no ar: qualquer um lê, só quem está logado escreve.
- Foi **acrescentado** o bloco **`torneio-cores`**, com leitura e escrita abertas.

**Por que aberto:** o evento pede que os dois operadores marquem sem senha. Quem
tiver o link consegue marcar. É aceitável para um evento de um dia com o link não
divulgado — e é isolado: esse nó não tem nada do RS-Scout.

**Depois do evento**, para fechar, troque só essa linha:

```json
    "torneio-cores": {
      ".read": true,
      ".write": "auth != null"
    }
```

E publique de novo. Para apagar tudo do módulo: Realtime Database → aba **Dados**
→ localize `torneio-cores` → menu (⋮) → **Remover**. Isso não afeta o RS-Scout.

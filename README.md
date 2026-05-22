# Biblioteca Thaci — versão completa

Esta versão adiciona:

- Nota pessoal, resenha e frase favorita do livro.
- Botão **Carregar mais** para não renderizar centenas de cards de uma vez.
- Alternância entre visualização em **Galeria** e **Lista**.
- Mais opções de ordenação.
- Dashboard com não lidos, preço médio, nota média, editora mais frequente, autor mais frequente e percentual lido.
- PWA básico com `manifest.json`, ícones e `sw.js`.

## 1. Banco de dados

Rode no Supabase SQL Editor:

```sql
-- arquivo migration_features.sql
```

Ele adiciona as colunas novas sem apagar seus livros.

## 2. PWA

O PWA só funciona quando o site está em `http://localhost`, GitHub Pages, Vercel, Netlify ou outro host HTTP/HTTPS.

Abrindo direto pelo arquivo `file:///.../index.html`, o navegador não registra Service Worker. Isso é normal.

Para testar localmente:

```bash
python -m http.server 5500
```

Depois acesse:

```txt
http://localhost:5500
```

## 3. Arquivos

- `index.html` — site completo.
- `migration_features.sql` — atualização da tabela.
- `manifest.json` — configuração PWA.
- `sw.js` — cache básico.
- `icons/` — ícones do app.

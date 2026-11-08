# Autoria PWA

PWA (React + Vite + TypeScript + `vite-plugin-pwa`) para editar e revisar capítulos com cache offline (IndexedDB/Dexie), comentários de autor por linha e sincronização com GitHub via Pull Requests.

## Integrações de repositório
- **Livro** (fonte de verdade dos capítulos): configurável em **Sync**. Padrão `neogedom/Livro`, branch `main`, pasta `Livro 1`. Pull baixa `.md`; edições locais são enviadas como **PR por edição** (merge manual).
- **Story Bible** (canon/STC): configurável em **Sync**. Padrão `neogedom/storybible` (`temas/arco-stc.md`, `temas/esquema-l1.md`, extras opcionais). As referências são carregadas via GitHub API e injetadas nos prompts de revisão/capítulo e na **Revisão geral STC + História B**. O token OAuth deve ter acesso aos repositórios configurados quando privados.

## MVP
- **Revisar Capítulo**: prompts portados de `.github/skills/` + `.github/prompts/` (densidade/STC, coerência, linguística, anti-slop, fechos) com `{{storybible}}` e comentários abertos do autor.
- **Comentários de autor por linha**: clique em uma linha do editor → salva nota local (IndexedDB) com trecho/linha; pode resolver/reabrir/excluir. Comentários abertos são enviados aos prompts de revisão.
- **Escrever/editar capítulos**: editor Markdown com preview e salvamento local offline.
- **Revisão geral do livro**: concatena capítulos locais e envia para `/api/run` com template STC + História B + referências Story Bible.
- **Marketing**: templates de `.github/marketing/` (Spotify/Substack, roteiro de Reel).

## Setup
```bash
npm install
npm run dev -- --host
```
O `vite.config.ts` inclui middleware dev para `/api/github/device/*` e `/api/run` (evita CORS/502 no Device Flow em desenvolvimento).

## Backend (Vercel/serverless)
Handlers em `api/`:
- `POST /api/run` `{ templateId?, prompt }` → `{ text }` (usa `OPENAI_API_KEY`/`LLM_API_KEY`, opcional `LLM_MODEL`; sem chave retorna prévia do prompt).
- `POST /api/github/device/code|token` — proxy OAuth Device Flow.

Deploy: importe o repositório no Vercel. Se este diretório for a raiz do repo, **Root Directory = /**; se estiver dentro de `neogedom/Livro`, use **Root Directory = `app`**. `vercel.json` preserva `/api/*` e reescreve SPA para `index.html`.

## GitHub OAuth
1. Crie um OAuth App (Developer settings → OAuth Apps) com **Device Flow** habilitado.
2. Homepage/Callback: URL do Vercel (produção) ou URL do Codespace/localhost (dev).
3. Em **Sync**, informe `owner/repo/branch/pasta` do livro e do Story Bible + **Client ID** → conectar → autorizar em `github.com/login/device` → Pull capítulos.

## Extração para repositório separado
Script preparado: `/tmp/extract-autoria-pwa.sh /workspaces/autoria-pwa`. Copia `app/` como raiz do novo repo (sem `node_modules`/`dist`) e cria commit inicial.

## Observações
- Comentários de autor são locais (IndexedDB), não sincronizados como PR ainda.
- Prompts em `src/data/prompts.ts` são snapshot de `.github/skills/prompts/marketing`; mantenha alinhados com o repo do livro.
- PR-per-edition evita push direto em `main`; conflitos no merge manual.

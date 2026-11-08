import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  db,
  deleteSetting,
  getRepoConfig,
  getStoryBibleConfig,
  getToken,
  saveRepoConfig,
  saveStoryBibleConfig,
  setToken,
  startDeviceFlow,
  pollDeviceToken,
  type RepoConfig,
  type StoryBibleConfig,
} from './lib/store'
import { pullChapters, pushDirtyChapters, saveChapterLocal } from './lib/sync'
import { promptTemplates } from './data/prompts'
import { runPrompt } from './lib/llm'
import { addAuthorComment, deleteComment, formatAuthorComments, setCommentResolved } from './lib/comments'
import { fetchStoryBibleContext } from './lib/storybible'

type Tab = 'editar' | 'revisar' | 'marketing' | 'sync'

export default function App() {
  const chapters = useLiveQuery(() => db.chapters.orderBy('name').toArray(), [], [])
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('editar')
  const [status, setStatus] = useState('Pronto.')
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(false)
  const [output, setOutput] = useState('')
  const [templateChoice, setTemplateChoice] = useState(promptTemplates[0].id)
  const [cfg, setCfg] = useState<RepoConfig | null>(null)
  const [sbCfg, setSbCfg] = useState<StoryBibleConfig | null>(null)
  const [token, setTokenState] = useState<string | null>(null)
  const [device, setDevice] = useState<{ user_code: string; verification_uri: string; device_code: string; interval: number } | null>(null)
  const [commentLine, setCommentLine] = useState<number | null>(null)
  const [commentText, setCommentText] = useState('')
  const editorRef = useRef<HTMLTextAreaElement | null>(null)

  const selected = useMemo(
    () => chapters.find((c) => c.path === selectedPath) || chapters[0] || null,
    [chapters, selectedPath],
  )
  const effectiveSelectedPath = selected?.path ?? null
  const comments = useLiveQuery(
    () => (selected ? db.comments.where('path').equals(selected.path).sortBy('line') : []),
    [selected?.path],
    [],
  )

  useEffect(() => {
    void (async () => {
      setCfg(await getRepoConfig())
      setSbCfg(await getStoryBibleConfig())
      setTokenState(await getToken())
    })()
  }, [])

  const templates = useMemo(
    () => promptTemplates.filter((t) => (tab === 'marketing' ? t.marketing : !t.marketing && t.scope !== 'book')),
    [tab],
  )
  const templateId = templates.some((t) => t.id === templateChoice) ? templateChoice : (templates[0]?.id ?? templateChoice)
  const activeTemplate = templates.find((t) => t.id === templateId) || templates[0]

  const act = useCallback(async (label: string, fn: () => Promise<void>) => {
    setBusy(true)
    setStatus(label)
    try {
      await fn()
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [])

  async function onSaveConfig() {
    if (!cfg || !sbCfg) return
    await saveRepoConfig(cfg)
    await saveStoryBibleConfig(sbCfg)
    setStatus('Configuração salva localmente (Livro + Story Bible).')
  }

  async function onConnectGitHub() {
    if (!cfg?.clientId) return setStatus('Informe o GitHub OAuth Client ID (Device Flow) na aba Sync.')
    await act('Iniciando OAuth Device Flow...', async () => {
      const d = await startDeviceFlow(cfg.clientId)
      setDevice(d)
      setStatus(`Abra ${d.verification_uri} e informe o código: ${d.user_code}`)
    })
  }

  async function onPollToken() {
    if (!cfg?.clientId || !device) return
    await act('Aguardando autorização no GitHub...', async () => {
      const r = await pollDeviceToken(cfg.clientId, device.device_code)
      if (r === 'pending' || r === 'slow_down') {
        setStatus(r === 'slow_down' ? 'GitHub pediu para aguardar; tente novamente em alguns segundos.' : 'Autorização pendente no GitHub...')
        return
      }
      await setToken(r)
      setTokenState(r)
      setDevice(null)
      setStatus('GitHub conectado. O token deve ter acesso ao repo do livro e ao Story Bible, se forem privados.')
    })
  }

  async function onDisconnect() {
    await deleteSetting('github_token')
    setTokenState(null)
    setStatus('Token GitHub removido deste dispositivo.')
  }

  async function onPull() {
    await act('Baixando capítulos do GitHub...', async () => {
      const n = await pullChapters()
      setStatus(`Sincronizado: ${n} capítulo(s) atualizados localmente (arquivos com edição local foram preservados).`)
    })
  }

  async function onPush() {
    await act('Enviando edições como PRs...', async () => {
      const urls = await pushDirtyChapters(setStatus)
      setOutput(urls.length ? urls.join('\n') : 'Nenhuma edição local para enviar.')
      setStatus(urls.length ? `Criado(s) ${urls.length} PR(s).` : 'Nada para enviar.')
    })
  }

  async function onRunPrompt() {
    if (!selected || !activeTemplate) return
    await act(`Executando "${activeTemplate.title}"...`, async () => {
      const sb = await fetchStoryBibleContext(setStatus).catch(() => ({ text: '(Story Bible indisponível)', loaded: [], missing: ['erro ao carregar'] }))
      const res = await runPrompt(activeTemplate, {
        chapter: selected.name,
        text: selected.content,
        comments: formatAuthorComments(comments.filter((c) => !c.resolved)) || '(sem comentários abertos)',
        storybible: sb.text,
      })
      const note = sb.missing.length ? `\n\n[Aviso Story Bible] Não carregados: ${sb.missing.join('; ')}` : ''
      setOutput(res.text + note)
      setStatus(sb.loaded.length ? `Execução concluída. Story Bible: ${sb.loaded.join(', ')}.` : 'Execução concluída (sem referências Story Bible carregadas).')
      setTab(tab === 'marketing' ? 'marketing' : 'revisar')
    })
  }

  async function onWholeBookReview() {
    const template = promptTemplates.find((t) => t.id === 'revisar-livro-stc')
    if (!template) return
    await act('Executando revisão geral do livro (STC + História B)...', async () => {
      const all = await db.chapters.orderBy('name').toArray()
      const numbered = all.filter((c) => c.number != null).sort((a, b) => (a.number! - b.number!))
      const rest = all.filter((c) => c.number == null)
      const ordered = [...rest, ...numbered]
      if (!ordered.length) throw new Error('Sem capítulos locais. Faça Pull na aba Sync.')
      const sb = await fetchStoryBibleContext(setStatus)
      const material = ordered
        .map((c) => `# ${c.name}\n${c.content}`)
        .join('\n\n---\n\n')
      const res = await runPrompt(template, {
        chapter: 'Livro 1 (todos os capítulos locais)',
        text: material,
        comments: '(revisão geral do livro)',
        storybible: sb.text,
      })
      const note = sb.missing.length ? `\n\n[Aviso Story Bible] Não carregados: ${sb.missing.join('; ')}` : ''
      setOutput(res.text + note)
      setStatus(`Revisão geral concluída (${ordered.length} capítulos). Story Bible: ${sb.loaded.length ? sb.loaded.join(', ') : 'nenhum arquivo carregado'}.`)
      setTab('revisar')
    })
  }

  function onEditorClick(e: MouseEvent<HTMLTextAreaElement>) {
    if (!selected) return
    const ta = e.currentTarget
    const pos = ta.selectionStart ?? 0
    const line = selected.content.slice(0, pos).split('\n').length
    setCommentLine(line)
    setCommentText('')
  }

  async function onSaveComment() {
    if (!selected || !commentLine || !commentText.trim()) return
    const lineText = selected.content.split('\n')[commentLine - 1] || ''
    await addAuthorComment(selected.path, commentLine, commentText, lineText)
    setCommentText('')
    setCommentLine(null)
    setStatus(`Comentário salvo na linha ${commentLine}.`)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>Autoria do Livro</h1>
        <div className="muted">PWA • offline • Livro + Story Bible</div>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="secondary" onClick={() => setTab('sync')} disabled={busy}>Sync</button>
          <button className="secondary" onClick={() => setTab('revisar')} disabled={busy}>Revisão</button>
          <button className="secondary" onClick={() => setTab('marketing')} disabled={busy}>Marketing</button>
        </div>
        <ul className="chapter-list">
          {chapters.map((c) => (
            <li key={c.path}>
              <button className={c.path === effectiveSelectedPath ? 'active' : ''} onClick={() => { setSelectedPath(c.path); if (tab === 'sync' || tab === 'marketing') setTab('editar') }}>
                {c.name}
                {c.dirty ? <span className="badge">local</span> : null}
              </button>
            </li>
          ))}
          {!chapters.length ? <li className="muted" style={{ padding: 8 }}>Sem capítulos locais. Abra Sync e faça Pull.</li> : null}
        </ul>
      </aside>

      <main className="main">
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong>{selected ? selected.name : 'Capítulo'}</strong>
            <div className="row">
              <button className="secondary" onClick={() => setTab('editar')} disabled={busy}>Editar</button>
              <button className="secondary" onClick={() => setTab('revisar')} disabled={busy}>Revisar</button>
              <button className="secondary" onClick={() => setTab('marketing')} disabled={busy}>Marketing</button>
              <button className="secondary" onClick={() => setTab('sync')} disabled={busy}>Sync</button>
            </div>
          </div>
          <div className="status">{status}</div>
        </div>

        {tab === 'sync' && (
          <div className="card stack">
            <h2 style={{ margin: 0, fontSize: '1rem' }}>GitHub / Sincronização</h2>
            <p className="status">O token OAuth (scope repo) deve ter acesso ao repositório do livro e ao Story Bible quando privados. Edições do livro são enviadas como PR; merge manual.</p>
            <strong>Repositório do Livro</strong>
            <div className="row">
              <label className="stack" style={{ flex: 1, minWidth: 140 }}><span>Owner</span><input value={cfg?.owner || ''} onChange={(e) => setCfg((c) => c && ({ ...c, owner: e.target.value }))} /></label>
              <label className="stack" style={{ flex: 1, minWidth: 140 }}><span>Repo</span><input value={cfg?.repo || ''} onChange={(e) => setCfg((c) => c && ({ ...c, repo: e.target.value }))} /></label>
              <label className="stack" style={{ flex: 1, minWidth: 140 }}><span>Branch</span><input value={cfg?.branch || ''} onChange={(e) => setCfg((c) => c && ({ ...c, branch: e.target.value }))} /></label>
            </div>
            <label className="stack"><span>Pasta de capítulos</span><input value={cfg?.chaptersDir || ''} onChange={(e) => setCfg((c) => c && ({ ...c, chaptersDir: e.target.value }))} /></label>
            <label className="stack"><span>OAuth Client ID (Device Flow)</span><input value={cfg?.clientId || ''} onChange={(e) => setCfg((c) => c && ({ ...c, clientId: e.target.value }))} placeholder="Ov23..." /></label>

            <strong>Repositório Story Bible</strong>
            <div className="row">
              <label className="stack" style={{ flex: 1, minWidth: 140 }}><span>Owner</span><input value={sbCfg?.owner || ''} onChange={(e) => setSbCfg((c) => c && ({ ...c, owner: e.target.value }))} /></label>
              <label className="stack" style={{ flex: 1, minWidth: 140 }}><span>Repo</span><input value={sbCfg?.repo || ''} onChange={(e) => setSbCfg((c) => c && ({ ...c, repo: e.target.value }))} /></label>
              <label className="stack" style={{ flex: 1, minWidth: 140 }}><span>Branch</span><input value={sbCfg?.branch || ''} onChange={(e) => setSbCfg((c) => c && ({ ...c, branch: e.target.value }))} /></label>
            </div>
            <label className="stack"><span>Arquivo STC (arco)</span><input value={sbCfg?.stcPath || ''} onChange={(e) => setSbCfg((c) => c && ({ ...c, stcPath: e.target.value }))} placeholder="temas/arco-stc.md" /></label>
            <label className="stack"><span>Arquivo esquema L1</span><input value={sbCfg?.schemePath || ''} onChange={(e) => setSbCfg((c) => c && ({ ...c, schemePath: e.target.value }))} placeholder="temas/esquema-l1.md" /></label>
            <label className="stack"><span>Arquivos extras (opcional, 1 por linha ou vírgula)</span><textarea value={sbCfg?.extraPaths || ''} onChange={(e) => setSbCfg((c) => c && ({ ...c, extraPaths: e.target.value }))} placeholder="personagens/mario.md&#10;conceitos/rampillas.md" /></label>

            <div className="row">
              <button className="secondary" onClick={onSaveConfig} disabled={busy || !cfg || !sbCfg}>Salvar config</button>
              {!token ? <button className="primary" onClick={onConnectGitHub} disabled={busy}>Conectar GitHub</button> : <button className="danger" onClick={onDisconnect} disabled={busy}>Desconectar</button>}
              {device ? <button className="secondary" onClick={onPollToken} disabled={busy}>Já autorizei</button> : null}
            </div>
            {device ? <div className="status">Código: <strong>{device.user_code}</strong> — {device.verification_uri}</div> : null}
            <div className="row">
              <button className="primary" onClick={onPull} disabled={busy || !token}>Pull capítulos</button>
              <button className="secondary" onClick={onPush} disabled={busy || !token}>Enviar edições (PR)</button>
            </div>
          </div>
        )}

        {(tab === 'editar' || tab === 'revisar' || tab === 'marketing') && selected && (
          <>
            <div className="card stack">
              {tab === 'editar' && (
                <>
                  <div className="row">
                    <button className="secondary" onClick={() => setPreview((v) => !v)}>{preview ? 'Editor' : 'Preview'}</button>
                    <span className="muted" style={{ color: '#6b7280' }}>Clique em uma linha para criar comentário de autor. Edições são salvas localmente (offline).</span>
                  </div>
                  {preview ? (
                    <div className="card"><ReactMarkdown remarkPlugins={[remarkGfm]}>{selected.content}</ReactMarkdown></div>
                  ) : (
                    <textarea ref={editorRef} className="editor" value={selected.content} onClick={onEditorClick} onChange={(e) => void saveChapterLocal(selected.path, e.target.value)} />
                  )}
                  {commentLine != null && (
                    <div className="card stack" style={{ borderColor: '#f59e0b' }}>
                      <strong>Novo comentário de autor — linha {commentLine}</strong>
                      <div className="status">Trecho: {(selected.content.split('\n')[commentLine - 1] || '').slice(0, 160) || '(linha vazia)'}</div>
                      <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Escreva a nota do autor para esta linha..." />
                      <div className="row">
                        <button className="primary" onClick={() => void onSaveComment()} disabled={!commentText.trim()}>Salvar comentário</button>
                        <button className="secondary" onClick={() => { setCommentLine(null); setCommentText('') }}>Cancelar</button>
                      </div>
                    </div>
                  )}
                  <div className="stack">
                    <strong>Comentários de autor ({comments.filter((c) => !c.resolved).length} abertos)</strong>
                    {!comments.length ? <div className="status">Nenhum comentário nesta capítulo.</div> : null}
                    {comments.map((c) => (
                      <div key={c.id} className="card" style={{ margin: 0, opacity: c.resolved ? 0.65 : 1 }}>
                        <div className="row" style={{ justifyContent: 'space-between' }}>
                          <strong>L{c.line}{c.resolved ? ' (resolvido)' : ''}</strong>
                          <div className="row">
                            <button className="secondary" onClick={() => c.id != null && void setCommentResolved(c.id, !c.resolved)}>{c.resolved ? 'Reabrir' : 'Resolver'}</button>
                            <button className="danger" onClick={() => c.id != null && void deleteComment(c.id)}>Excluir</button>
                          </div>
                        </div>
                        {c.quote ? <div className="status">“{c.quote.slice(0, 140)}”</div> : null}
                        <div>{c.text}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {tab === 'revisar' && (
                <>
                  <div className="card stack" style={{ borderColor: '#2563eb' }}>
                    <strong>Revisão geral do livro</strong>
                    <div className="status">Usa Save The Cat para avaliar estrutura geral e evolução dos protagonistas pela História B, do capítulo inicial ao final, com base nos capítulos locais + referências do Story Bible (arco STC/esquema L1 configurados na aba Sync).</div>
                    <button className="primary" onClick={() => void onWholeBookReview()} disabled={busy || !chapters.length}>Executar revisão geral (STC + História B + Story Bible)</button>
                  </div>
                  <label className="stack">
                    <span>Agente / prompt do capítulo</span>
                    <select value={templateId} onChange={(e) => setTemplateChoice(e.target.value)}>
                      {templates.map((t) => <option key={t.id} value={t.id}>{t.title} — {t.description}</option>)}
                    </select>
                  </label>
                  {activeTemplate ? <div className="status">Fonte: {activeTemplate.source}</div> : null}
                  <div className="row">
                    <button className="primary" onClick={onRunPrompt} disabled={busy}>Executar no capítulo atual</button>
                    <button className="secondary" onClick={() => setTab('editar')} disabled={busy}>Voltar ao editor</button>
                  </div>
                </>
              )}
              {tab === 'marketing' && (
                <>
                  <label className="stack">
                    <span>Template de marketing</span>
                    <select value={templateId} onChange={(e) => setTemplateChoice(e.target.value)}>
                      {templates.map((t) => <option key={t.id} value={t.id}>{t.title} — {t.description}</option>)}
                    </select>
                  </label>
                  {activeTemplate ? <div className="status">Fonte: {activeTemplate.source}</div> : null}
                  <div className="row">
                    <button className="primary" onClick={onRunPrompt} disabled={busy}>Executar</button>
                    <button className="secondary" onClick={() => setTab('editar')} disabled={busy}>Voltar ao editor</button>
                  </div>
                </>
              )}
            </div>
            {output ? <div className="card"><strong>Resultado</strong><pre className="output">{output}</pre></div> : null}
          </>
        )}
      </main>
    </div>
  )
}

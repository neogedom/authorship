import { getStoryBibleConfig, readRepoTextFile } from './github'

function splitPaths(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export async function fetchStoryBibleContext(
  onProgress?: (msg: string) => void,
): Promise<{ text: string; loaded: string[]; missing: string[] }> {
  const cfg = await getStoryBibleConfig()
  const paths = [cfg.stcPath, cfg.schemePath, ...splitPaths(cfg.extraPaths)].filter(Boolean)
  const loaded: string[] = []
  const missing: string[] = []
  const parts: string[] = []

  for (const path of paths) {
    try {
      onProgress?.(`Carregando Story Bible: ${path}...`)
      const text = await readRepoTextFile(cfg.owner, cfg.repo, cfg.branch, path)
      parts.push(`## ${cfg.owner}/${cfg.repo}:${cfg.branch} — ${path}\n\n${text}`)
      loaded.push(path)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      missing.push(`${path} (${msg})`)
    }
  }

  return {
    text: parts.length
      ? `# Referências Story Bible\n\n${parts.join('\n\n---\n\n')}`
      : 'Referências Story Bible indisponíveis. Verifique configuração/acesso ao repositório Story Bible.',
    loaded,
    missing,
  }
}

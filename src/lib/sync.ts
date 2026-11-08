import { db, type Chapter } from './db'
import { getRepoConfig, listChapterFiles, readFile, syncChapterAsPR } from './github'
import { chapterNumberFromName, sortChapterName } from './chapters'

export async function pullChapters(): Promise<number> {
  const cfg = await getRepoConfig()
  const files = (await listChapterFiles(cfg)).sort((a, b) => sortChapterName(a.name, b.name))
  let count = 0
  for (const f of files) {
    const local = await db.chapters.get(f.path)
    if (local?.dirty) continue
    const remote = await readFile(cfg, f.path)
    const chapter: Chapter = {
      path: f.path,
      name: f.name,
      number: chapterNumberFromName(f.name),
      sha: remote.sha,
      content: remote.content,
      remoteContent: remote.content,
      updatedAt: Date.now(),
      dirty: false,
    }
    await db.chapters.put(chapter)
    count++
  }
  return count
}

export async function saveChapterLocal(path: string, content: string): Promise<void> {
  await db.chapters.update(path, { content, updatedAt: Date.now(), dirty: true })
  await db.syncQueue.add({ path, kind: 'upsert', createdAt: Date.now() })
}

export async function pushDirtyChapters(onProgress?: (msg: string) => void): Promise<string[]> {
  const cfg = await getRepoConfig()
  const dirty = (await db.chapters.toArray()).filter((c) => c.dirty)
  const urls: string[] = []
  for (const ch of dirty) {
    onProgress?.(`Criando PR para ${ch.name}...`)
    const url = await syncChapterAsPR(cfg, ch.path, ch.content, ch.sha)
    await db.chapters.update(ch.path, { dirty: false, remoteContent: ch.content, sha: ch.sha })
    urls.push(url)
  }
  return urls
}

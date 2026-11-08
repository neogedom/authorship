import Dexie, { type Table } from 'dexie'

export type Chapter = {
  path: string
  name: string
  number: number | null
  sha?: string
  content: string
  remoteContent?: string
  updatedAt: number
  dirty: boolean
}

export type SyncOp = {
  id?: number
  path: string
  kind: 'upsert'
  createdAt: number
}

export type Setting = {
  key: string
  value: string
}

export type AuthorComment = {
  id?: number
  path: string
  line: number
  text: string
  quote?: string
  resolved: boolean
  createdAt: number
}

class AppDB extends Dexie {
  chapters!: Table<Chapter, string>
  syncQueue!: Table<SyncOp, number>
  settings!: Table<Setting, string>
  comments!: Table<AuthorComment, number>

  constructor() {
    super('autoria-livro')
    this.version(1).stores({
      chapters: 'path, name, number, updatedAt, dirty',
      syncQueue: '++id, path, kind, createdAt',
      settings: 'key',
    })
    this.version(2).stores({
      chapters: 'path, name, number, updatedAt, dirty',
      syncQueue: '++id, path, kind, createdAt',
      settings: 'key',
      comments: '++id, path, line, resolved, createdAt',
    })
  }
}

export const db = new AppDB()

export async function getSetting(key: string): Promise<string | null> {
  return (await db.settings.get(key))?.value ?? null
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.settings.put({ key, value })
}

export async function deleteSetting(key: string): Promise<void> {
  await db.settings.delete(key)
}

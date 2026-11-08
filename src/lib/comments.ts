import { db, type AuthorComment } from './db'

export async function addAuthorComment(
  path: string,
  line: number,
  text: string,
  quote?: string,
): Promise<void> {
  await db.comments.add({
    path,
    line,
    text: text.trim(),
    quote,
    resolved: false,
    createdAt: Date.now(),
  })
}

export async function setCommentResolved(id: number, resolved: boolean): Promise<void> {
  await db.comments.update(id, { resolved })
}

export async function deleteComment(id: number): Promise<void> {
  await db.comments.delete(id)
}

export function formatAuthorComments(comments: AuthorComment[]): string {
  if (!comments.length) return ''
  return comments
    .map((c) => {
      const q = c.quote ? ` | trecho: "${c.quote.slice(0, 120)}"` : ''
      return `- L${c.line}${q}: ${c.text}`
    })
    .join('\n')
}

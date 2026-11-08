export function chapterNumberFromName(name: string): number | null {
  const m = name.match(/^cap[íi]tulo(\d+)\.md$/i)
  return m ? Number(m[1]) : null
}

export function sortChapterName(a: string, b: string): number {
  const na = chapterNumberFromName(a)
  const nb = chapterNumberFromName(b)
  if (na != null && nb != null) return na - nb
  if (na != null) return -1
  if (nb != null) return 1
  return a.localeCompare(b, 'pt-BR')
}

import { fillPrompt, type PromptTemplate } from '../data/prompts'

export type LLMResult = { text: string }

export async function runPrompt(template: PromptTemplate, vars: Record<string, string>): Promise<LLMResult> {
  const prompt = fillPrompt(template.body, vars)
  const res = await fetch('/api/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templateId: template.id, prompt, vars }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Backend ${res.status}`)
  }
  return res.json() as Promise<LLMResult>
}

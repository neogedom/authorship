import { IncomingMessage, ServerResponse } from 'node:http'

type Req = { prompt?: string; templateId?: string; apiKey?: string; model?: string }

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'text/plain' })
    res.end('Method Not Allowed')
    return
  }
  let body: Req
  try {
    body = (await readJsonBody(req)) as Req
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain' })
    res.end('Invalid JSON')
    return
  }
  if (!body.prompt) {
    res.writeHead(400, { 'Content-Type': 'text/plain' })
    res.end('Missing prompt')
    return
  }

  const key = body.apiKey || process.env.OPENROUTER_API_KEY
  const model = body.model || process.env.LLM_MODEL || 'openai/gpt-4o-mini'
  if (!key) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        text:
          `Backend não configurado (defina OPENROUTER_API_KEY na aba Sync ou envie apiKey na requisição).\n\n` +
          `Template: ${body.templateId || 'desconhecido'}\n` +
          `Prévia do prompt:\n${body.prompt.slice(0, 1200)}`,
      }),
    )
    return
  }

  const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://authorship.app',
      'X-Title': 'Authorship',
    },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: body.prompt }] }),
  })
  if (!upstream.ok) {
    const text = await upstream.text()
    res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'application/json' })
    res.end(text)
    return
  }
  const data = (await upstream.json()) as { choices?: Array<{ message?: { content?: string } }> }
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ text: data.choices?.[0]?.message?.content || JSON.stringify(data, null, 2) }))
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const text = await readBody(req)
  return JSON.parse(text)
}

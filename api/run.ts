// Serverless skeleton for LLM agent orchestration.
// Deploy target examples: Vercel/Netlify/Cloudflare edge functions.
// Configure an API key in environment variables (e.g. OPENAI_API_KEY) and
// adapt the provider call below. This file intentionally avoids bundling a
// specific SDK so the repo stays provider-agnostic.

type Req = { prompt?: string; templateId?: string }

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  let body: Req
  try {
    body = (await request.json()) as Req
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }
  if (!body.prompt) return new Response('Missing prompt', { status: 400 })

  const key = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY
  const model = process.env.LLM_MODEL || 'gpt-4.1-mini'
  if (!key) {
    return Response.json(
      {
        text:
          `Backend não configurado (defina OPENAI_API_KEY/LLM_API_KEY).\n\n` +
          `Template: ${body.templateId || 'desconhecido'}\n` +
          `Prévia do prompt:\n${body.prompt.slice(0, 1200)}`,
      },
      { status: 200 },
    )
  }

  const upstream = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: body.prompt,
    }),
  })
  if (!upstream.ok) {
    return new Response(await upstream.text(), { status: upstream.status })
  }
  const data = (await upstream.json()) as { output_text?: string }
  return Response.json({ text: data.output_text || JSON.stringify(data, null, 2) })
}

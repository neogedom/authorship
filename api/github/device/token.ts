export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  const body = await readBody(request)
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body,
  })
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function readBody(request: Request): Promise<string> {
  if (typeof request.text === 'function') {
    return await request.text()
  }
  if (typeof request.arrayBuffer === 'function') {
    const buf = await request.arrayBuffer()
    return new TextDecoder().decode(buf)
  }
  if (typeof request.json === 'function') {
    return JSON.stringify(await request.json())
  }
  throw new Error('Unable to read request body')
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  const body = await readBody(request)
  const res = await fetch('https://github.com/login/device/code', {
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
  const anyReq = request as any
  const body = anyReq.body
  if (body && typeof body.getReader === 'function') {
    const reader = body.getReader()
    const chunks: Uint8Array[] = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) chunks.push(value)
    }
    reader.releaseLock()
    let total = 0
    for (const chunk of chunks) total += chunk.length
    const result = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }
    return new TextDecoder().decode(result)
  }
  if (body && typeof body.text === 'function') {
    return await body.text()
  }
  if (body !== undefined && body !== null) {
    return String(body)
  }
  throw new Error('Unable to read request body')
}

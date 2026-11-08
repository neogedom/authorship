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
  const diag: Record<string, unknown> = {
    error: 'Unable to read request body',
    keys: Object.keys(request),
    ownNames: Object.getOwnPropertyNames(request),
    bodyType: typeof (request as any).body,
    hasBody: !!(request as any).body,
    protoKeys: Object.getOwnPropertyNames(Object.getPrototypeOf(request)),
  }
  try {
    const proto = Object.getPrototypeOf(request)
    const protoProto = Object.getPrototypeOf(proto)
    diag['protoProtoKeys'] = protoProto ? Object.getOwnPropertyNames(protoProto) : null
  } catch {}
  throw new Error(JSON.stringify(diag))
}

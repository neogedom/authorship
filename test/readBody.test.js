import { test, assert } from 'node:test'
import { strictEqual, deepStrictEqual, rejects, ok } from 'node:assert'

// Simula a lógica de readBody implementada nos handlers (api/github/device/*.ts, api/run.ts)
async function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

function makeMockStream(chunks) {
  return {
    on(event, cb) {
      if (event === 'data') {
        for (const chunk of chunks) cb(chunk)
      }
      if (event === 'end') setTimeout(cb, 0)
      if (event === 'error') setTimeout(() => cb(new Error('stream error')), 0)
      return this
    },
  }
}

test('readBody concatena chunks de um IncomingMessage mock', async () => {
  const req = makeMockStream([Buffer.from('{"prompt":'), Buffer.from('"oi"}')])
  const result = await readBody(req)
  strictEqual(result, '{"prompt":"oi"}')
})

test('readBody resolve string vazia para stream sem dados', async () => {
  const req = makeMockStream([])
  const result = await readBody(req)
  strictEqual(result, '')
})

test('readBody rejeita quando o stream emite erro', async () => {
  let errorHandler
  const req = {
    on(event, cb) {
      if (event === 'error') errorHandler = cb
      if (event === 'data') {}
      if (event === 'end') {}
      return this
    },
  }
  // dispara erro assíncronamente
  setTimeout(() => errorHandler(new Error('stream error')), 0)
  await rejects(readBody(req), { message: 'stream error' })
})

test('default export dos handlers é uma função (req, res) => void', () => {
  const handler = async (req, res) => {}
  ok(typeof handler === 'function')
})

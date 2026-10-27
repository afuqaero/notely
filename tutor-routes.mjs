import fs from 'node:fs'
let server=fs.readFileSync('preview-server.mjs','utf8')
server=server.replace("import os from 'node:os'", "import os from 'node:os'\nimport { answerTutor } from './server/tutor.js'")
const handler=`async function tutor(req, res) {
  const chunks = []
  let size = 0
  try {
    for await (const chunk of req) {
      size += chunk.length
      if (size > 50_000) return send(res, 413, { error: 'That message is too long.' })
      chunks.push(chunk)
    }
    const input = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    let key = process.env.ROOTSYS_API_KEY
    if (!key) key = (await readFile(keyPath, 'utf8').catch(() => '')).trim()
    const result = await answerTutor(input, key)
    send(res, result.status, result.body)
  } catch (error) {
    console.error('Tutor request error:', error.message)
    send(res, 400, { error: 'Could not read that question.' })
  }
}

`
server=server.replace('const files = new Map([',handler+'const files = new Map([')
server=server.replace("  if (req.url === '/api/quiz' && req.method === 'POST') return quiz(req, res)", "  if (req.url === '/api/quiz' && req.method === 'POST') return quiz(req, res)\n  if (req.url === '/api/tutor' && req.method === 'POST') return tutor(req, res)")
fs.writeFileSync('preview-server.mjs',server)
let express=fs.readFileSync('server/index.js','utf8')
express=express.replace("import { fileURLToPath } from 'node:url'", "import { fileURLToPath } from 'node:url'\nimport { answerTutor } from './tutor.js'")
express=express.replace("const root = path.join(", `app.post('/api/tutor', async (req, res) => {
  const result = await answerTutor(req.body, process.env.ROOTSYS_API_KEY)
  res.status(result.status).json(result.body)
})

const root = path.join(`)
fs.writeFileSync('server/index.js',express)


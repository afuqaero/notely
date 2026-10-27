import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { answerNotesChat, answerTutor } from './tutor.js'
import { generateQuiz } from './quiz.js'

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '1mb' }))
const clean = value => typeof value === 'string' ? value.trim() : ''

app.post('/api/quiz', async (req, res) => {
  const result = await generateQuiz(req.body, process.env.ROOTSYS_API_KEY)
  res.status(result.status).json(result.body)
})

app.post('/api/tutor', async (req, res) => {
  const result = await answerTutor(req.body, process.env.ROOTSYS_API_KEY)
  res.status(result.status).json(result.body)
})
app.post('/api/notes-chat', async (req, res) => {
  const result = await answerNotesChat(req.body, process.env.ROOTSYS_API_KEY)
  res.status(result.status).json(result.body)
})

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
app.use(express.static(root))
app.get('/{*path}', (_req, res) => res.sendFile(path.join(root, 'index.html')))
app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.status === 413 ? 'Notes are too large for this request.' : 'Request could not be processed.' }))
app.listen(Number(process.env.PORT) || 3001, '0.0.0.0', () => console.log('Notely listening on ' + (process.env.PORT || 3001)))




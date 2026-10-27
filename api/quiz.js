import { generateQuiz } from '../server/quiz.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })
  const result = await generateQuiz(req.body, process.env.ROOTSYS_API_KEY)
  return res.status(result.status).json(result.body)
}
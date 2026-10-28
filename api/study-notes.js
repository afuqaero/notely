import { generateStudyNotes } from '../server/study-notes.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })
  const result = await generateStudyNotes(req.body, process.env.ROOTSYS_API_KEY)
  return res.status(result.status).json(result.body)
}

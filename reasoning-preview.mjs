import fs from 'node:fs'
let app=fs.readFileSync('preview-app.js','utf8')
const start=app.indexOf("  const feedback = document.createElement('div')", app.indexOf('function select(index)'))
const end=app.indexOf("  if (index === q.correctAnswer) {\n    const cheer",start)
if(start<0||end<0)throw Error('Feedback block not found')
const block=`  const feedback = document.createElement('div')
  feedback.className = 'feedback ' + (index === q.correctAnswer ? 'good' : 'learn')
  const title = document.createElement('div')
  title.className = 'feedback-title'
  title.textContent = index === q.correctAnswer ? 'Yes! Here is why that works' : 'Let us unpack this'
  feedback.append(title)
  const reasons = Array.isArray(q.optionExplanations) && q.optionExplanations.length === 4 ? q.optionExplanations : null
  const addReason = (label, reason) => {
    const block = document.createElement('div')
    block.className = 'reason-block'
    const heading = document.createElement('strong')
    heading.className = 'reason-label'
    heading.textContent = label
    const detail = document.createElement('p')
    detail.textContent = reason
    block.append(heading, detail)
    feedback.append(block)
  }
  if (reasons) {
    addReason('Why ' + 'ABCD'[q.correctAnswer] + ' is right', reasons[q.correctAnswer])
    if (index !== q.correctAnswer) addReason('Why your choice does not fit', reasons[index])
    const takeaway = document.createElement('p')
    takeaway.className = 'feedback-takeaway'
    takeaway.textContent = q.explanation
    feedback.append(takeaway)
  } else {
    const explanation = document.createElement('p')
    explanation.textContent = q.explanation
    feedback.append(explanation)
  }
`
app=app.slice(0,start)+block+app.slice(end)
app=app.replace("const data = await response.json()\n    if (token !== state.tutorToken) return", "const data = await response.json().catch(() => ({ error: response.status === 404 ? 'Restart the Notely server to enable the study bot.' : 'The study bot returned an unreadable response.' }))\n    if (token !== state.tutorToken) return")
fs.writeFileSync('preview-app.js',app)


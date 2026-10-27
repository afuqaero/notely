import fs from 'node:fs'
let app=fs.readFileSync('preview-app.js','utf8')
app=app.replace("  if (!q) return\n  $('.quiz-meta", "  if (!q) return\n  resetTutorForQuestion()\n  $('.quiz-meta")
app=app.replace("  $('#feedback').append(feedback)", "  $('#feedback').append(feedback)\n  $('.tutor-prompts button').textContent = 'Explain answer'\n  $('.tutor-prompts button').dataset.prompt = 'Why is the correct answer right?'")
fs.writeFileSync('preview-app.js',app)


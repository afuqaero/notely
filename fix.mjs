import fs from 'node:fs'
let app=fs.readFileSync('preview-app.js','utf8')
app=app.replaceAll("$(' .count-options button')", "$$(' .count-options button')")
app=app.replaceAll("$ ('.count-options button')", "$$(' .count-options button')")
app=app.replaceAll("$ (", "$ (")
app=app.replace(/\$\('\.count-options button'\)/g, () => "$$('.count-options button')")
app=app.replace(/title\.textContent = index === q\.correctAnswer \?[^\n]*/, "title.textContent = index === q.correctAnswer ? 'Yes! You got it! +1' : 'Let us understand this'")
fs.writeFileSync('preview-app.js',app)
let html=fs.readFileSync('preview.html','utf8')
html=html.replace('<p>Reading the ideas and turning them into questions that help things click.</p><div class="generating-dots">', '<p id="generating-status">Reading your notes and writing clear questions.</p><div class="generating-dots">')
fs.writeFileSync('preview.html',html)


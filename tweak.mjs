import fs from 'node:fs'
const htmlPath = 'preview.html'
let html = fs.readFileSync(htmlPath, 'utf8')
const replacement = '<div class="setting count-setting"><label>Questions per round</label><p>Pick the pace that feels right.</p><div class="count-options" role="group" aria-label="Questions per round"><button type="button" class="selected" data-count="10" aria-pressed="true"><strong>10</strong><span>Quick</span></button><button type="button" data-count="20" aria-pressed="false"><strong>20</strong><span>Focus</span></button><button type="button" data-count="30" aria-pressed="false"><strong>30</strong><span>Deep</span></button><button type="button" data-count="60" aria-pressed="false"><strong>60</strong><span>Marathon</span></button><button type="button" data-count="80" aria-pressed="false"><strong>80</strong><span>Mastery</span></button></div><small class="count-hint">Long rounds take more time and AI credits. Notes-only may return fewer if the material is too short.</small></div>'
html = html.replace(/<div class="setting setting-row">[\s\S]*?(?=<div class="setting"><label>How challenging)/, replacement)
fs.writeFileSync(htmlPath, html)
const appPath = 'preview-app.js'
let app = fs.readFileSync(appPath, 'utf8')
app = app.replace("difficulty: 'balanced' }", "difficulty: 'balanced', count: 10 }")
app = app.replace("function docs() {", `$$('.count-options button').forEach(button => button.onclick = () => {
  $$('.count-options button').forEach(x => {
    const selected = x === button
    x.classList.toggle('selected', selected)
    x.setAttribute('aria-pressed', String(selected))
  })
  state.count = Number(button.dataset.count)
})
function docs() {`)
const begin = app.indexOf('async function generate(more = false)')
const end = app.indexOf('function renderQuestion()', begin)
app = app.slice(0, begin) + `async function generate(more = false) {
  const notes = docs()
  if (!notes.length) return report('Add a file or paste at least 80 characters first.')
  if (notes.reduce((n, d) => n + d.text.length, 0) > 100000) return report('Notes exceed 100,000 characters. Please shorten them.')
  setBusy(true)
  let generated = false
  try {
    const target = state.count
    const batchTotal = Math.ceil(target / 10)
    const prior = more ? [...state.history, ...state.questions.map(q => q.question)] : [...state.history]
    const collected = []
    let attempts = 0
    while (collected.length < target && attempts < batchTotal + 3) {
      attempts++
      $('#generating-title').textContent = 'Making your quiz...'
      $('#generating-status').textContent = 'Writing questions ' + (collected.length + 1) + '-' + Math.min(target, collected.length + 10) + ' of ' + target
      const response = await fetch('/api/quiz', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes, mode: state.mode, count: Math.min(10, target - collected.length),
          difficulty: state.difficulty, previousQuestions: [...prior, ...collected.map(q => q.question)],
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        if (collected.length && response.status === 422) break
        throw Error(result.error || 'Quiz generation failed.')
      }
      const seen = new Set([...prior, ...collected.map(q => q.question)].map(q => q.toLowerCase().trim()))
      const fresh = result.questions.filter(q => !seen.has(q.question.toLowerCase().trim()))
      if (!fresh.length) break
      collected.push(...fresh.slice(0, target - collected.length))
    }
    if (!collected.length) throw Error('No verifiable questions could be generated from these notes.')
    state.history.push(...state.questions.map(q => q.question))
    state.history = state.history.slice(-80)
    state.questions = collected
    state.answers = []
    state.index = 0
    $('#sample').hidden = false
    $('#results').hidden = true
    renderQuestion()
    generated = true
    if (collected.length < target) report('Made ' + collected.length + ' supported questions from these notes. Add more material for a longer round.')
  } catch (e) { report(e.message) }
  finally { setBusy(false); $('#generating-status').textContent = 'Reading your notes and writing clear questions.' }
  if (generated) requestAnimationFrame(() => $('.quiz-card').scrollIntoView({ behavior: 'smooth', block: 'start' }))
}
` + app.slice(end)
app = app.replace("button.classList.add(i === q.correctAnswer ? 'correct' : i === index ? 'incorrect' : 'muted')", "button.classList.add(i === q.correctAnswer ? 'correct' : i === index ? 'incorrect' : 'muted')\n    if (i === index && i === q.correctAnswer) button.classList.add('celebrate')")
app = app.replace("title.textContent = index === q.correctAnswer ? 'V You got it!' : '\x0f Let's understand this'", "title.textContent = index === q.correctAnswer ? 'Yes! You got it! +1' : 'Let us understand this'")
app = app.replace("  $('#feedback').append(feedback)", `  if (index === q.correctAnswer) {
    const cheer = document.createElement('span')
    cheer.className = 'cheer'
    cheer.setAttribute('aria-hidden', 'true')
    cheer.textContent = 'Great thinking!'
    feedback.append(cheer)
  }
  $('#feedback').append(feedback)`)
app = app.replace("state.index++; renderQuestion(); $('#sample').scrollIntoView({ behavior: 'smooth' })", "state.index++; renderQuestion(); requestAnimationFrame(() => $('.quiz-card').scrollIntoView({ behavior: 'smooth', block: 'start' }))")
fs.writeFileSync(appPath, app)


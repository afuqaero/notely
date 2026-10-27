import fs from 'node:fs'
let app=fs.readFileSync('src/main.jsx','utf8')
app=app.replace("count: 8", "count: 10")
const countStart=app.indexOf('<div className="setting setting-row">')
const countEnd=app.indexOf('<div className="setting"><label htmlFor="difficulty">',countStart)
if(countStart<0||countEnd<0)throw Error('Count setting not found')
const countMarkup=`<div className="setting count-setting"><label>Questions per round</label><p>Pick the pace that feels right.</p><div className="count-options" role="group" aria-label="Questions per round">{[[10,'Quick'],[20,'Focus'],[30,'Deep'],[60,'Marathon'],[80,'Mastery']].map(([n,label]) => <button type="button" key={n} className={settings.count === n ? 'selected' : ''} aria-pressed={settings.count === n} onClick={() => setSettings(s => ({...s,count:n}))}><strong>{n}</strong><span>{label}</span></button>)}</div><small className="count-hint">Long rounds take more time and AI credits. Notes-only may return fewer if the material is too short.</small></div>`
app=app.slice(0,countStart)+countMarkup+app.slice(countEnd)
const start=app.indexOf('  async function generate(more = false)')
const end=app.indexOf('  function answer(choice)',start)
if(start<0||end<0)throw Error('Generate function not found')
const gen=`  async function generate(more = false) {
    if (!available.length) return setError('Add a note with at least 80 characters first.')
    setError('')
    setBusy('Making your quiz...')
    let generated = false
    try {
      const total = available.reduce((n, doc) => n + doc.text.length, 0)
      if (total > 100000) throw new Error('These notes contain over 100,000 characters. Remove a file or shorten pasted notes for now.')
      const target = Number(settings.count)
      const prior = more ? [...history, ...questions.map(q => q.question)] : [...history]
      const collected = []
      let attempts = 0
      while (collected.length < target && attempts < Math.ceil(target / 10) + 3) {
        attempts++
        setBusy('Making your quiz... ' + (collected.length + 1) + '-' + Math.min(target, collected.length + 10) + ' of ' + target)
        const response = await fetch('/api/quiz', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notes: available.map(({ name, text }) => ({ name, text })),
            mode: settings.mode, count: Math.min(10, target - collected.length), difficulty: settings.difficulty,
            previousQuestions: [...prior, ...collected.map(q => q.question)],
          }),
        })
        const data = await response.json()
        if (!response.ok) {
          if (collected.length && response.status === 422) break
          throw new Error(data.error || 'Could not make your quiz.')
        }
        const seen = new Set([...prior, ...collected.map(q => q.question)].map(q => q.toLowerCase().trim()))
        const fresh = data.questions.filter(q => !seen.has(q.question.toLowerCase().trim()))
        if (!fresh.length) break
        collected.push(...fresh.slice(0, target - collected.length))
      }
      if (!collected.length) throw new Error('No verifiable questions could be generated from these notes.')
      setHistory(h => [...h, ...questions.map(q => q.question)].slice(-80))
      setQuestions(collected)
      setAnswers([])
      setIndex(0)
      setScreen('quiz')
      generated = true
      if (collected.length < target) setError('Made ' + collected.length + ' supported questions. Add more material for a longer round.')
    } catch (e) { setError(e.message) }
    finally { setBusy('') }
    if (generated) requestAnimationFrame(() => document.querySelector('.quiz-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
`
app=app.slice(0,start)+gen+app.slice(end)
app=app.replace("    window.scrollTo({ top: 0, behavior: 'smooth' })\n  }\n  function reset()", "    requestAnimationFrame(() => index < questions.length - 1 ? document.querySelector('.quiz-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) : window.scrollTo({ top: 0, behavior: 'smooth' }))\n  }\n  function reset()")
app=app.replace("i === current.correctAnswer ? ' correct' : i === selected ? ' incorrect' : ' muted'", "i === current.correctAnswer ? (i === selected ? ' correct celebrate' : ' correct') : i === selected ? ' incorrect' : ' muted'")
app=app.replace("You got it!</> : <><Lightbulb", "Yes! You got it! +1</> : <><Lightbulb")
app=app.replace("<p>{current.explanation}</p>{current.origin", "<p>{current.explanation}</p>{selected === current.correctAnswer && <span className=\"cheer\" aria-hidden=\"true\">Great thinking!</span>}{current.origin")
app=app.replace("busy === 'Making your quiz...' &&", "busy.startsWith('Making your quiz') &&")
app=app.replace("Reading the ideas and turning them into questions that help things click.</p>", "{busy}</p>")
fs.writeFileSync('src/main.jsx',app)


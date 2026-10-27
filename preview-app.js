const inlinePattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g

function appendInline(parent, line) {
  let cursor = 0
  for (const match of line.matchAll(inlinePattern)) {
    if (match.index > cursor) parent.append(document.createTextNode(line.slice(cursor, match.index)))
    const token = match[0]
    const element = document.createElement(token.startsWith('`') ? 'code' : token.startsWith('**') ? 'strong' : 'em')
    element.textContent = token.startsWith('**') ? token.slice(2, -2) : token.slice(1, -1)
    parent.append(element)
    cursor = match.index + token.length
  }
  if (cursor < line.length) parent.append(document.createTextNode(line.slice(cursor)))
}

function applyMath(element) {
  if (typeof window.renderMathInElement !== 'function') return
  try {
    window.renderMathInElement(element, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false },
        { left: '$', right: '$', display: false },
      ],
      throwOnError: false,
      trust: false,
      ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
    })
  } catch (error) { console.warn('Math could not be rendered:', error.message) }
}

function renderRichText(element, raw, { inline = false } = {}) {
  if (!element) return
  const value = String(raw ?? '')
  element.__notelyRich = { value, inline }
  element.dataset.rich = 'true'
  element.replaceChildren()
  if (inline) {
    value.split('\n').forEach((line, index) => {
      if (index) element.append(document.createElement('br'))
      appendInline(element, line)
    })
  } else {
    for (const paragraph of value.split(/\n\s*\n/)) {
      const block = document.createElement('p')
      paragraph.split('\n').forEach((line, index) => {
        if (index) block.append(document.createElement('br'))
        appendInline(block, line)
      })
      element.append(block)
    }
  }
  applyMath(element)
}

window.addEventListener('notely-math-ready', () => {
  document.querySelectorAll('[data-rich]').forEach(element => {
    if (element.__notelyRich) renderRichText(element, element.__notelyRich.value, { inline: element.__notelyRich.inline })
  })
})


const notesChatWelcome = 'Hey! I can help you understand anything in your uploaded notes. Ask me to explain a topic, compare ideas, or give you an example.'
const state = { docs: [], questions: [], answers: [], index: 0, history: [], mode: 'notes', difficulty: 'balanced', count: 10, notesChatMessages: [], notesChatSignature: '', notesChatBusy: false }
const $ = selector => document.querySelector(selector)
const $$ = selector => [...document.querySelectorAll(selector)]
const normalize = value => value.replace(/\s+/g, ' ').trim()
const report = message => {
  let box = $('#message')
  if (!box) {
    box = document.createElement('div')
    box.id = 'message'
    box.className = 'error-toast'
    box.setAttribute('role', 'alert')
    document.body.append(box)
  }
  box.textContent = message
  setTimeout(() => { if (box.textContent === message) box.remove() }, 8500)
}
const setBusy = on => {
  $('#generating').hidden = !on
  document.body.classList.toggle('generating-open', on)
  $('#demo').disabled = on
  $('#demo').textContent = on ? 'Making your quiz...' : 'Make my quiz'
}
async function extract(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  if (file.size > 15 * 1024 * 1024) throw Error(file.name + ' exceeds 15 MB.')
  if (ext === 'txt' || ext === 'md') return file.text()
  if (ext === 'pdf') {
    const pdfjs = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.149/build/pdf.min.mjs')
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.149/build/pdf.worker.min.mjs'
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
    if (pdf.numPages > 150) throw Error('PDFs over 150 pages are not supported.')
    const pages = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      pages.push((await page.getTextContent()).items.map(x => x.str || '').join(' '))
    }
    return pages.join('\n')
  }
  if (ext === 'docx') {
    if (!window.mammoth) await new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/mammoth@1.10.0/mammoth.browser.min.js'
      script.onload = resolve
      script.onerror = () => reject(Error('Could not load the DOCX reader. Check your internet connection.'))
      document.head.append(script)
    })
    return (await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value
  }
  throw Error('Use PDF, DOCX, TXT or MD files.')
}
function renderFiles() {
  const holder = $('#files')
  holder.replaceChildren()
  const signature = state.docs.map(doc => doc.name + ':' + doc.text.length).join('|')
  if (signature !== state.notesChatSignature) {
    state.notesChatSignature = signature
    state.notesChatMessages = [{ role: 'assistant', text: notesChatWelcome }]
  }
  $('#notes-chat-entry').hidden = !state.docs.length
  $('#notes-chat-entry-title').textContent = state.notesChatMessages.length > 1 ? 'Continue your notes chat' : 'Chat with your notes'
  if (!state.docs.length) return
  const heading = document.createElement('div')
  heading.className = 'files-heading'
  heading.textContent = 'ADDED FILES  ' + state.docs.length
  holder.append(heading)
  for (const doc of state.docs) {
    const row = document.createElement('div')
    row.className = 'file'
    const icon = document.createElement('div')
    icon.className = 'file-icon'
    icon.textContent = '▤'
    const name = document.createElement('div')
    name.className = 'file-name'
    const strong = document.createElement('strong')
    strong.textContent = doc.name
    const small = document.createElement('small')
    small.textContent = Math.round(doc.size / 1024) + ' KB · Ready to study'
    name.append(strong, small)
    const remove = document.createElement('button')
    remove.textContent = '×'
    remove.setAttribute('aria-label', 'Remove ' + doc.name)
    remove.onclick = () => { state.docs = state.docs.filter(x => x !== doc); renderFiles() }
    row.append(icon, name, remove)
    holder.append(row)
  }
}
async function addFiles(files) {
  for (const file of [...files].slice(0, 12)) {
    if (state.docs.some(d => d.name === file.name)) continue
    try {
      const text = normalize(await extract(file))
      if (text.length < 80) throw Error(file.name + ' has too little readable text. Scanned PDFs need OCR first.')
      state.docs.push({ name: file.name, text, size: file.size })
      state.docs = state.docs.slice(0, 12)
      renderFiles()
    } catch (e) { report(e.message) }
  }
  $('#file').value = ''
}
const input = $('#file'), drop = $('#drop')
drop.onclick = () => input.click()
drop.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') input.click() }
input.onchange = () => addFiles(input.files)
drop.ondragover = e => { e.preventDefault(); drop.classList.add('dragging') }
drop.ondragleave = () => drop.classList.remove('dragging')
drop.ondrop = e => { e.preventDefault(); drop.classList.remove('dragging'); addFiles(e.dataTransfer.files) }
$$('.mode').forEach(button => button.onclick = () => {
  $$('.mode').forEach(x => x.classList.remove('active'))
  button.classList.add('active')
  state.mode = button.dataset.mode
})
$$('.difficulty button').forEach(button => button.onclick = () => {
  $$('.difficulty button').forEach(x => x.classList.remove('chosen'))
  button.classList.add('chosen')
  state.difficulty = button.textContent.trim().toLowerCase()
})
$$('.count-options button').forEach(button => button.onclick = () => {
  $$('.count-options button').forEach(x => {
    const selected = x === button
    x.classList.toggle('selected', selected)
    x.setAttribute('aria-pressed', String(selected))
  })
  state.count = Number(button.dataset.count)
})
function docs() {
  return state.docs.map(({ name, text }) => ({ name, text }))
}
function renderNotesChat() {
  const holder = $('#notes-chat-messages')
  holder.replaceChildren()
  for (const message of state.notesChatMessages) {
    const bubble = document.createElement('div')
    bubble.className = 'notes-chat-message ' + message.role
    renderRichText(bubble, message.text, { inline: false })
    holder.append(bubble)
  }
  if (state.notesChatBusy) {
    const thinking = document.createElement('div')
    thinking.className = 'notes-chat-message assistant notes-chat-thinking'
    thinking.textContent = 'Thinking through your notes…'
    holder.append(thinking)
  }
  holder.scrollTop = holder.scrollHeight
  $('#notes-chat-count').textContent = state.docs.length + (state.docs.length === 1 ? ' file in this chat' : ' files in this chat')
  $('#notes-chat-sources').textContent = 'Using: ' + state.docs.map(doc => doc.name).join(' · ')
  $('#notes-chat-submit').disabled = state.notesChatBusy || !$('#notes-chat-input').value.trim()
  $('#notes-chat-input').disabled = state.notesChatBusy
}
function openNotesChat() {
  $('.hero').hidden = true
  $('.workspace').hidden = true
  $('.bottom-strip').hidden = true
  $('#sample').hidden = true
  $('#results').hidden = true
  $('#notes-chat-screen').hidden = false
  renderNotesChat()
  window.scrollTo({ top: 0, behavior: 'smooth' })
  $('#notes-chat-input').focus()
}
function closeNotesChat() {
  $('#notes-chat-screen').hidden = true
  $('.hero').hidden = false
  $('.workspace').hidden = false
  $('.bottom-strip').hidden = false
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
async function sendNotesChat(message = $('#notes-chat-input').value) {
  const value = message.trim()
  if (!value || state.notesChatBusy || !state.docs.length) return
  const history = state.notesChatMessages.slice(1).filter(item => ['user', 'assistant'].includes(item.role)).slice(-8)
    .map(item => ({ role: item.role, content: item.text }))
  $('#notes-chat-input').value = ''
  state.notesChatMessages.push({ role: 'user', text: value })
  state.notesChatBusy = true
  renderNotesChat()
  try {
    const response = await fetch('/api/notes-chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: value, notes: docs(), history }),
    })
    const data = await response.json().catch(() => ({ error: response.status === 404 ? 'Restart the Notely server to enable notes chat.' : 'The notes chat returned an unreadable response.' }))
    if (!response.ok) throw new Error(data.error || 'Notes chat could not reply. Please try again.')
    state.notesChatMessages.push({ role: 'assistant', text: data.reply })
  } catch (error) {
    state.notesChatMessages.push({ role: 'assistant', text: error.message || 'I could not connect right now. Please try again.' })
  } finally {
    state.notesChatBusy = false
    renderNotesChat()
  }
}
$('#notes-chat-entry').addEventListener('click', openNotesChat)
$('#notes-chat-back').addEventListener('click', closeNotesChat)
$('#notes-chat-new').addEventListener('click', () => { state.notesChatMessages = [{ role: 'assistant', text: notesChatWelcome }]; renderNotesChat(); $('#notes-chat-input').focus() })
$('#notes-chat-form').addEventListener('submit', event => { event.preventDefault(); sendNotesChat() })
$('#notes-chat-input').addEventListener('input', () => { $('#notes-chat-submit').disabled = state.notesChatBusy || !$('#notes-chat-input').value.trim() })
$('#notes-chat-input').addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendNotesChat() }
})
async function generate(more = false) {
  const notes = docs()
  if (!notes.length) return report('Add a file first.')
  if (notes.reduce((n, d) => n + d.text.length, 0) > 100000) return report('Notes exceed 100,000 characters. Please shorten them.')
  setBusy(true)
  let generated = false
  try {
    const target = state.count
    const batchTotal = Math.ceil(target / 10)
    const prior = more ? [...state.history, ...state.questions.map(q => q.question)] : [...state.history]
    const collected = []
    let attempts = 0
    let batchSize = 10
      let providerRetryCount = 0
    while (collected.length < target && attempts < batchTotal + 3) {
      attempts++
      const requestCount = Math.max(3, Math.min(batchSize, target - collected.length))
      $('#generating-title').textContent = 'Making your quiz...'
      $('#generating-status').textContent = 'Writing questions ' + (collected.length + 1) + '-' + Math.min(target, collected.length + requestCount) + ' of ' + target
      const response = await fetch('/api/quiz', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes, mode: state.mode, count: requestCount,
          difficulty: state.difficulty, previousQuestions: [...prior, ...collected.map(q => q.question)],
        }),
      })
      const result = await response.json().catch(() => ({ error: 'The quiz service returned an empty or unreadable response. Please try again.' }))
      if (!response.ok && /cut off|empty answer|incomplete response|incomplete JSON/i.test(result.error || '') && providerRetryCount < 2) {
        providerRetryCount++
        if (requestCount > 3) batchSize = Math.max(3, Math.floor(requestCount / 2))
        attempts--
        continue
      }
      if (!response.ok || !Array.isArray(result.questions)) {
        if (collected.length && response.status === 422) break
        throw Error(result.error || 'The quiz service returned an incomplete response. Please try again.')
      }
      providerRetryCount = 0
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
const selectionAsk = $('#ask-selection')
let selectedQuestionText = ''
function hideSelectionAsk() { selectionAsk.hidden = true; selectedQuestionText = '' }
function positionSelectionAsk(selection) {
  if (!selection || selection.isCollapsed || !selection.toString().trim()) return hideSelectionAsk()
  const anchor = selection.anchorNode?.parentElement?.closest('.quiz-card h2, .quiz-card .option')
  const focus = selection.focusNode?.parentElement?.closest('.quiz-card h2, .quiz-card .option')
  if (!anchor || anchor !== focus) return hideSelectionAsk()
  selectedQuestionText = selection.toString().trim().slice(0, 500)
  const rect = selection.getRangeAt(0).getBoundingClientRect(), width = selectionAsk.offsetWidth || 170
  selectionAsk.hidden = false
  selectionAsk.style.left = Math.max(12, Math.min(innerWidth-width-12, rect.left+rect.width/2-width/2))+'px'
  selectionAsk.style.top = Math.max(12,rect.top-48)+'px'
}
document.addEventListener('selectionchange',()=>requestAnimationFrame(()=>positionSelectionAsk(getSelection())))
selectionAsk.addEventListener('mousedown',e=>e.preventDefault())
selectionAsk.onclick=()=>{if(!selectedQuestionText)return hideSelectionAsk();const quote=selectedQuestionText;selectedQuestionText='';selectionAsk.hidden=true;$('#tutor-panel').hidden=false;$('#tutor-launcher').setAttribute('aria-expanded','true');$('#tutor-input').value='Can you explain this part: "'+quote+'"?';$('#tutor-input').focus()}
document.addEventListener('pointerdown',e=>{if(e.target!==selectionAsk&&!selectionAsk.contains(e.target))hideSelectionAsk()})
document.addEventListener('keydown',e=>{if(e.key==='Escape')hideSelectionAsk()})

function renderQuestion() {
  hideSelectionAsk()
  const q = state.questions[state.index]
  if (!q) return
  resetTutorForQuestion()
  $('.quiz-meta span:first-child').textContent = 'QUESTION ' + (state.index + 1) + ' OF ' + state.questions.length
  const origin = $('.quiz-meta .origin')
  origin.textContent = q.origin === 'notes' ? '▤ From your notes' : '✦ Beyond your notes'
  origin.classList.toggle('outside', q.origin === 'beyond')
  $('.progress span').style.width = Math.round(state.index / state.questions.length * 100) + '%'
  renderRichText($('.quiz-card h2'), q.question, { inline: true })
  const list = $('.options')
  list.replaceChildren()
  q.options.forEach((answer, index) => {
    const button = document.createElement('button')
    button.className = 'option'
    const letter = document.createElement('span')
    letter.className = 'option-letter'
    letter.textContent = 'ABCD'[index]
    const label = document.createElement('span')
    renderRichText(label, answer, { inline: true })
    button.append(letter, label)
    button.onclick = () => select(index)
    list.append(button)
  })
  $('#feedback').replaceChildren()
  $('.quiz-actions>span').textContent = 'Pick an answer to see why it works.'
  $('.quiz-actions .primary').disabled = true
  $('.quiz-actions .primary').textContent = state.index === state.questions.length - 1 ? 'See results →' : 'Next question →'
  $('.stats strong').innerHTML = (state.index + 1) + '<small> / ' + state.questions.length + '</small>'
  $('.stats p').textContent = state.answers.filter((a, i) => a === state.questions[i].correctAnswer).length + ' correct so far'
  $('.tiny-bar span').style.width = Math.round(state.index / state.questions.length * 100) + '%'
}
function select(index) {
  if (state.answers[state.index] !== undefined) return
  const q = state.questions[state.index]
  state.answers[state.index] = index
  $$('.option').forEach((button, i) => {
    button.disabled = true
    button.classList.add(i === q.correctAnswer ? 'correct' : i === index ? 'incorrect' : 'muted')
    if (i === index && i === q.correctAnswer) button.classList.add('celebrate')
  })
  const feedback = document.createElement('div')
  feedback.className = 'feedback ' + (index === q.correctAnswer ? 'good' : 'learn')
  const title = document.createElement('div')
  title.className = 'feedback-title'
  title.textContent = index === q.correctAnswer ? 'Yes! Here is why that works' : 'Let us unpack this'
  feedback.append(title)
  const reasons = Array.isArray(q.optionExplanations) && q.optionExplanations.length === 4 ? q.optionExplanations : null
  const addReason = (label, reason, status) => {
    const block = document.createElement('div')
    block.className = 'reason-block ' + status
    const heading = document.createElement('strong')
    heading.className = 'reason-label'
    heading.textContent = label
    const detail = document.createElement('p')
    renderRichText(detail, reason)
    block.append(heading, detail)
    feedback.append(block)
  }
  if (reasons) {
    addReason('Why ' + 'ABCD'[q.correctAnswer] + ' is right', reasons[q.correctAnswer], 'correct-reason')
    if (index !== q.correctAnswer) addReason('Why your choice does not fit', reasons[index], 'wrong-reason')
    const takeaway = document.createElement('p')
    takeaway.className = 'feedback-takeaway'
    renderRichText(takeaway, q.explanation)
    feedback.append(takeaway)
  } else {
    const explanation = document.createElement('p')
    renderRichText(explanation, q.explanation)
    feedback.append(explanation)
  }
  if (index === q.correctAnswer) {
    const cheer = document.createElement('span')
    cheer.className = 'cheer'
    cheer.setAttribute('aria-hidden', 'true')
    cheer.textContent = 'Great thinking!'
    feedback.append(cheer)
  }
  $('#feedback').append(feedback)
  $('.tutor-prompts button').textContent = 'Explain answer'
  $('.tutor-prompts button').dataset.prompt = 'Why is the correct answer right?'
  $('.quiz-actions .primary').disabled = false
  $('.quiz-actions>span').textContent = 'Nice work. Keep the momentum going!'
  $('.progress span').style.width = Math.round((state.index + 1) / state.questions.length * 100) + '%'
  $('.tiny-bar span').style.width = Math.round((state.index + 1) / state.questions.length * 100) + '%'
}
$('.quiz-actions .primary').onclick = () => {
  if (state.answers[state.index] === undefined) return
  if (state.index < state.questions.length - 1) { state.index++; renderQuestion(); requestAnimationFrame(() => $('.quiz-card').scrollIntoView({ behavior: 'smooth', block: 'start' })) }
  else showResults()
}
function showResults() {
  $('#sample').hidden = true
  const score = state.answers.filter((a, i) => a === state.questions[i].correctAnswer).length
  $('#result-score').textContent = score + ' / ' + state.questions.length
  const review = $('#review-list')
  review.replaceChildren()
  state.questions.forEach((q, i) => {
    const item = document.createElement('details')
    const summary = document.createElement('summary')
    summary.textContent = (state.answers[i] === q.correctAnswer ? '✓ ' : '✕ ') + q.question
    const body = document.createElement('div')
    body.className = 'review-body'
    body.textContent = 'Correct: ' + q.options[q.correctAnswer] + ' — ' + q.explanation
    item.append(summary, body)
    review.append(item)
  })
  $('#results').hidden = false
  $('#results').scrollIntoView({ behavior: 'smooth' })
}
$('#demo').onclick = () => generate()
$('#another').onclick = () => generate(true)
$('#adjust').onclick = () => { $('#results').hidden = true; window.scrollTo({ top: 0, behavior: 'smooth' }) }







function tutorBubble(role, message) {
  const item = document.createElement('div')
  item.className = 'tutor-bubble ' + role
  item.textContent = message
  $('#tutor-messages').append(item)
  $('#tutor-messages').scrollTop = $('#tutor-messages').scrollHeight
  return item
}
function resetTutorForQuestion() {
  state.tutorRequest?.abort()
  stopTutorAnimation()
  state.tutorToken = (state.tutorToken || 0) + 1
  state.tutorHistory = []
  $('#tutor-messages').replaceChildren()
  $('#tutor-context').textContent = 'Question ' + (state.index + 1) + ' of ' + state.questions.length
  $('#tutor-input').value = ''
  $('#tutor-input').disabled = false
  $('#tutor-form button').disabled = false
  $$('.tutor-prompts button').forEach(x => x.disabled = false)
  const first = $('.tutor-prompts button')
  first.textContent = 'Give me a hint'
  first.dataset.prompt = 'Give me a hint without revealing the answer'
  tutorBubble('bot', 'Hey! I can help with this question. Ask for a hint or tell me what part feels confusing.')
}
function tutorNoteContext(q) {
  if (q.origin !== 'notes') return ''
  const source = docs().find(d => d.name === q.sourceName)
  if (!source) return q.evidence || ''
  const at = source.text.toLowerCase().indexOf((q.evidence || '').toLowerCase())
  return at >= 0 ? source.text.slice(Math.max(0, at - 900), at + 1600) : source.text.slice(0, 1800)
}
const tutorPhrases = ['Thinking it through', 'Connecting the dots', 'Putting it simply']
const reduceTutorMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
function stopTutorAnimation() {
  clearInterval(state.tutorThinking)
  clearInterval(state.tutorTyping)
  state.tutorThinking = null
  state.tutorTyping = null
}
function typeTutorReply(element, reply, token, signal) {
  if (reduceTutorMotion()) { renderRichText(element, reply); return Promise.resolve() }
  return new Promise(resolve => {
    let position = 0
    const step = Math.max(2, Math.ceil(reply.length / 75))
    element.textContent = ''
    element.classList.add('typing')
    const finish = () => {
      clearInterval(state.tutorTyping)
      state.tutorTyping = null
      element.classList.remove('typing')
      signal.removeEventListener('abort', finish)
      if (token === state.tutorToken && !signal.aborted) renderRichText(element, reply)
      resolve()
    }
    signal.addEventListener('abort', finish, { once: true })
    state.tutorTyping = setInterval(() => {
      if (token !== state.tutorToken || signal.aborted) return finish()
      position = Math.min(reply.length, position + step)
      renderRichText(element, reply.slice(0, position))
      $('#tutor-messages').scrollTop = $('#tutor-messages').scrollHeight
      if (position === reply.length) finish()
    }, 24)
  })
}
async function sendTutor(message) {
  const question = state.questions[state.index]
  if (!question || !message.trim() || $('#tutor-input').disabled) return
  const token = state.tutorToken
  const answered = state.answers[state.index] !== undefined
  const prior = [...state.tutorHistory]
  tutorBubble('user', message.trim())
  $('#tutor-input').value = ''
  $('#tutor-input').disabled = true
  $('#tutor-form button').disabled = true
  $$('.tutor-prompts button').forEach(x => x.disabled = true)
  const waiting = tutorBubble('bot thinking', tutorPhrases[0])
  let phrase = 0
  if (!reduceTutorMotion()) state.tutorThinking = setInterval(() => {
    if (token !== state.tutorToken) return
    phrase = (phrase + 1) % tutorPhrases.length
    waiting.textContent = tutorPhrases[phrase]
  }, 1450)
  const controller = new AbortController()
  state.tutorRequest = controller
  const started = performance.now()
  try {
    const response = await fetch('/api/tutor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        message: message.trim(), question, answered, selectedAnswer: answered ? state.answers[state.index] : null,
        contextText: tutorNoteContext(question), history: prior,
      }),
    })
    const data = await response.json().catch(() => ({ error: response.status === 404 ? 'Restart the Notely server to enable the study bot.' : 'The study bot returned an unreadable response.' }))
    if (token !== state.tutorToken) return
    if (!reduceTutorMotion()) await new Promise(resolve => setTimeout(resolve, Math.max(0, 650 - (performance.now() - started))))
    if (token !== state.tutorToken) return
    clearInterval(state.tutorThinking)
    state.tutorThinking = null
    waiting.classList.remove('thinking')
    if (response.ok) await typeTutorReply(waiting, data.reply, token, controller.signal)
    else waiting.textContent = data.error || 'I could not answer right now.'
    if (token !== state.tutorToken) return
    state.tutorHistory.push({ role: 'user', content: message.trim() })
    if (response.ok) state.tutorHistory.push({ role: 'assistant', content: data.reply })
    state.tutorHistory = state.tutorHistory.slice(-8)
  } catch (error) {
    if (token !== state.tutorToken || error.name === 'AbortError') return
    waiting.classList.remove('thinking')
    waiting.textContent = 'I could not connect right now. Please try again.'
  } finally {
    clearInterval(state.tutorThinking)
    state.tutorThinking = null
    if (token === state.tutorToken) {
      $('#tutor-input').disabled = false
      $('#tutor-form button').disabled = false
      $$('.tutor-prompts button').forEach(x => x.disabled = false)
      $('#tutor-input').focus()
    }
  }
}

$('#tutor-launcher').onclick = () => {
  const open = $('#tutor-panel').hidden
  $('#tutor-panel').hidden = !open
  $('#tutor-launcher').setAttribute('aria-expanded', String(open))
  if (open) $('#tutor-input').focus()
}
$('#tutor-close').onclick = () => {
  $('#tutor-panel').hidden = true
  $('#tutor-launcher').setAttribute('aria-expanded', 'false')
  $('#tutor-launcher').focus()
}
$('#tutor-input').onkeydown = event => {
  if (event.key === 'Tab') { event.preventDefault(); const el=event.currentTarget, a=el.selectionStart, b=el.selectionEnd; el.setRangeText('  ',a,b,'end') }
  else if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendTutor(event.currentTarget.value) }
}
$('#tutor-form').onsubmit = event => { event.preventDefault(); sendTutor($('#tutor-input').value) }
$$('.tutor-prompts button').forEach(button => button.onclick = () => sendTutor(button.dataset.prompt))


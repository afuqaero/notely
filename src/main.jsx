import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import * as pdfjs from 'pdfjs-dist'
import mammoth from 'mammoth'
import { ArrowRight, ArrowLeft, BookOpen, Check, CheckCircle2, ChevronDown, CircleHelp, CloudOff, FileText, Lightbulb, LoaderCircle, MessagesSquare, Plus, RotateCcw, ShieldCheck, Sparkles, Trash2, UploadCloud, X } from 'lucide-react'
import './style.css'
import { renderRichText } from './format.js'

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
const letter = ['A', 'B', 'C', 'D']
const formatSize = bytes => bytes < 1024 ? bytes + ' B' : bytes < 1048576 ? (bytes / 1024).toFixed(0) + ' KB' : (bytes / 1048576).toFixed(1) + ' MB'
const normalize = text => text.replace(/\s+/g, ' ').trim()
async function extract(file) {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (file.size > 15 * 1024 * 1024) throw new Error(file.name + ' is over 15 MB.')
  if (['txt', 'md'].includes(ext)) return file.text()
  if (ext === 'docx') return (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value
  if (ext === 'pdf') {
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
    if (pdf.numPages > 150) throw new Error(file.name + ' has more than 150 pages.')
    const pages = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      pages.push(content.items.map(item => item.str || '').join(' '))
    }
    return pages.join('\n')
  }
  throw new Error('Use PDF, DOCX, TXT, or MD files.')
}

function RichText({ text, as = 'span', inline = true }) {
  const ref = useRef(null)
  useEffect(() => { renderRichText(ref.current, text, { inline }) }, [text, inline])
  return React.createElement(as, { ref, className: 'rich-text' })
}

function StudyBot({ question, index, total, answer, notes }) {
  const [selectionAsk, setSelectionAsk] = useState(null)
  const inputRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([{ role: 'bot', text: 'Hey! I can help with this question. Ask for a hint or tell me what part feels confusing.' }])
  const [history, setHistory] = useState([])
const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [phase, setPhase] = useState(null)
  const [thinkingText, setThinkingText] = useState('Thinking it through')
  const thinkingRef = useRef(null)
  const typingRef = useRef(null)
  const requestRef = useRef(null)
  const messagesRef = useRef(null)
  useEffect(() => {
    requestRef.current?.abort()
    clearInterval(thinkingRef.current)
    clearInterval(typingRef.current)
    setPhase(null)
    setMessages([{ role: 'bot', text: 'New question! Ask me for a hint or an explanation of the concept.' }])
    setHistory([])
    setInputText('')
    setSending(false)
    return () => { requestRef.current?.abort(); clearInterval(thinkingRef.current); clearInterval(typingRef.current) }
  }, [index])
  useEffect(() => { if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight }, [messages, sending, open])
  useEffect(() => {
    setSelectionAsk(null)
    const update = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.toString().trim()) { setSelectionAsk(null); return }
      const a = sel.anchorNode?.parentElement?.closest('.quiz-card h2, .quiz-card .option')
      const f = sel.focusNode?.parentElement?.closest('.quiz-card h2, .quiz-card .option')
      if (!a || a !== f) { setSelectionAsk(null); return }
      const quote = sel.toString().trim().slice(0, 500), r = sel.getRangeAt(0).getBoundingClientRect()
      setSelectionAsk({ quote, x: Math.max(12, Math.min(innerWidth - 190, r.left + r.width / 2 - 85)), y: Math.max(12, r.top - 48) })
    }
    const key = e => { if (e.key === 'Escape') setSelectionAsk(null) }
    const outside = e => { if (!e.target.closest('.ask-selection') && !e.target.closest('.quiz-card')) setSelectionAsk(null) }
    document.addEventListener('selectionchange', update); document.addEventListener('keydown', key); document.addEventListener('pointerdown', outside); window.addEventListener('resize', update)
    return () => { document.removeEventListener('selectionchange', update); document.removeEventListener('keydown', key); document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', update) }
  }, [index])
  const noteContext = () => {
    if (question.origin !== 'notes') return ''
    const source = notes.find(n => n.name === question.sourceName)
    if (!source) return question.evidence || ''
    const at = source.text.toLowerCase().indexOf((question.evidence || '').toLowerCase())
    return at >= 0 ? source.text.slice(Math.max(0, at - 900), at + 1600) : source.text.slice(0, 1800)
  }
  async function send(message) {
    const value = message.trim()
    if (!value || sending) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setInputText('')
    setMessages(m => [...m, { role: 'user', text: value }])
    setSending(true)
    setPhase('thinking')
    setThinkingText('Thinking it through')
    const phrases = ['Thinking it through', 'Connecting the dots', 'Putting it simply']
    let phrase = 0
    if (!reduceMotion) thinkingRef.current = setInterval(() => {
      phrase = (phrase + 1) % phrases.length
      setThinkingText(phrases[phrase])
    }, 1450)
    const controller = new AbortController()
    requestRef.current = controller
    const started = performance.now()
    try {
      const response = await fetch('/api/tutor', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({
          message: value, question, answered: answer !== undefined,
          selectedAnswer: answer === undefined ? null : answer, contextText: noteContext(), history,
        }),
      })
      const data = await response.json().catch(() => ({ error: response.status === 404 ? 'Restart the Notely server to enable the study bot.' : 'The study bot returned an unreadable response.' }))
      if (controller.signal.aborted) return
      if (!reduceMotion) await new Promise(resolve => setTimeout(resolve, Math.max(0, 650 - (performance.now() - started))))
      if (controller.signal.aborted) return
      clearInterval(thinkingRef.current)
      setPhase(null)
      const reply = response.ok ? data.reply : data.error || 'I could not answer right now.'
      if (response.ok && !reduceMotion) {
        setPhase('typing')
        setMessages(m => [...m, { role: 'bot', text: '' }])
        await new Promise(resolve => {
          let position = 0
          const step = Math.max(2, Math.ceil(reply.length / 75))
          const finish = () => {
            clearInterval(typingRef.current)
            controller.signal.removeEventListener('abort', finish)
            if (!controller.signal.aborted) setMessages(m => [...m.slice(0, -1), { role: 'bot', text: reply }])
            resolve()
          }
          controller.signal.addEventListener('abort', finish, { once: true })
          typingRef.current = setInterval(() => {
            if (controller.signal.aborted) return finish()
            position = Math.min(reply.length, position + step)
            const visible = reply.slice(0, position)
            setMessages(m => [...m.slice(0, -1), { role: 'bot', text: visible }])
            if (position === reply.length) finish()
          }, 24)
        })
      } else setMessages(m => [...m, { role: 'bot', text: reply }])
      if (controller.signal.aborted) return
      setHistory(h => [...h, { role: 'user', content: value }, ...(response.ok ? [{ role: 'assistant', content: reply }] : [])].slice(-8))
    } catch (error) {
      if (!controller.signal.aborted) setMessages(m => [...m, { role: 'bot', text: 'I could not connect right now. Please try again.' }])
    } finally {
      clearInterval(thinkingRef.current)
      clearInterval(typingRef.current)
      if (!controller.signal.aborted) { setSending(false); setPhase(null) }
    }
  }
  return <>
    {selectionAsk && <button className="ask-selection" style={{ left: selectionAsk.x, top: selectionAsk.y }} onMouseDown={e => e.preventDefault()} onClick={() => { setOpen(true); setInputText('Can you explain this part: "' + selectionAsk.quote + '"?'); setSelectionAsk(null); requestAnimationFrame(() => inputRef.current?.focus()) }}>Ask Notely about this</button>}
    <div className="tutor-widget">
    <button type="button" className="tutor-launcher" aria-label="Ask Notely about this question" aria-expanded={open} onClick={() => setOpen(v => !v)}><span className="bot-face"><i/><b/><b/><em/></span><span>Ask Notely</span><span className="tutor-ping"/></button>
    {open && <div className="tutor-panel" role="dialog" aria-label="Notely study bot">
      <div className="tutor-head"><span className="bot-face small"><i/><b/><b/><em/></span><div><strong>Notely study bot</strong><small>Question {index + 1} of {total}</small></div><button type="button" aria-label="Close study bot" onClick={() => setOpen(false)}><X size={17}/></button></div>
      <div className="tutor-messages" role="log" aria-live="polite" ref={messagesRef}>{messages.map((m,i) => <div key={i} className={'tutor-bubble ' + m.role + (phase === 'typing' && i === messages.length - 1 && m.role === 'bot' ? ' typing' : '')} ><RichText text={m.text} as="div" inline={false}/></div>)}{phase === 'thinking' && <div className="tutor-bubble bot thinking">{thinkingText}</div>}</div>
      <div className="tutor-prompts"><button type="button" disabled={sending} onClick={() => send(answer === undefined ? 'Give me a hint without revealing the answer' : 'Why is the correct answer right?')}>{answer === undefined ? 'Give me a hint' : 'Explain answer'}</button><button type="button" disabled={sending} onClick={() => send('Explain the concept simply')}>Explain simply</button></div>
      <form className="tutor-form" onSubmit={e => { e.preventDefault(); send(inputText) }}><textarea ref={inputRef} rows={1} value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => { if (e.key === 'Tab') { e.preventDefault(); const el=e.currentTarget, a=el.selectionStart, b=el.selectionEnd; setInputText(v => v.slice(0,a)+'  '+v.slice(b)); requestAnimationFrame(() => el.setSelectionRange(a+2,a+2)) } else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(inputText) } }} maxLength={600} disabled={sending} placeholder="Ask about this question..." aria-label="Ask about this question"/><button type="submit" disabled={sending || !inputText.trim()} aria-label="Send message"><ArrowRight size={16}/></button></form>
      <div className="tutor-foot">About this question | AI can make mistakes</div>
    </div>}
  </div>
  </>
}

const notesChatWelcome = { role: 'assistant', content: 'Hey! I can help you understand anything in your uploaded notes. Ask me to explain a topic, compare ideas, or give you an example.' }

function NotesChatScreen({ notes, messages, setMessages, onBack, onNewChat, backLabel = 'Back to study setup' }) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const logRef = useRef(null)
  const inputRef = useRef(null)
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, [messages, sending])
  async function send(value = draft) {
    const message = value.trim()
    if (!message || sending) return
    const history = messages.slice(1).filter(m => ['user', 'assistant'].includes(m.role)).slice(-8)
      .map(m => ({ role: m.role, content: m.content }))
    setDraft('')
    setMessages(current => [...current, { role: 'user', content: message }])
    setSending(true)
    try {
      const response = await fetch('/api/notes-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, notes: notes.map(({ name, text }) => ({ name, text })), history }),
      })
      const data = await response.json().catch(() => ({ error: response.status === 404 ? 'Restart the Notely server to enable notes chat.' : 'The notes chat returned an unreadable response.' }))
      if (!response.ok) throw new Error(data.error || 'Notes chat could not reply. Please try again.')
      setMessages(current => [...current, { role: 'assistant', content: data.reply }])
    } catch (error) {
      setMessages(current => [...current, { role: 'assistant', content: error.message || 'I could not connect right now. Please try again.' }])
    } finally { setSending(false) }
  }
  return <section className="notes-chat-screen">
    <div className="notes-chat-heading">
      <button className="ghost" onClick={onBack}><ArrowLeft size={16}/> {backLabel}</button>
      <div className="eyebrow">YOUR NOTES CHAT</div>
      <h1>Ask <em>anything</em> about your notes.</h1>
      <p>A separate chat for exploring the material. It remembers this conversation while you switch between study modes.</p>
    </div>
    <div className="notes-chat-panel">
      <div className="notes-chat-toolbar"><div><strong><MessagesSquare size={17}/> Notes chat session</strong><small>{notes.length} {notes.length === 1 ? 'file' : 'files'} in this chat</small></div><button className="secondary" type="button" onClick={() => { setDraft(""); onNewChat() }}>New chat</button></div>
      <div className="notes-chat-sources">Using: {notes.map(n => n.name).join(' · ')}</div>
      <div className="notes-chat-messages" role="log" aria-live="polite" ref={logRef}>
        {messages.map((message, index) => <div key={index} className={'notes-chat-message ' + message.role}><RichText text={message.content} as="div" inline={false}/></div>)}
        {sending && <div className="notes-chat-message assistant notes-chat-thinking"><span className="spin"><LoaderCircle size={15}/></span> Thinking through your notes…</div>}
      </div>
      <form className="notes-chat-form" onSubmit={event => { event.preventDefault(); send() }}>
        <textarea ref={inputRef} rows={2} maxLength={1200} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => {
          if (event.key === 'Tab') { event.preventDefault(); const field = event.currentTarget, start = field.selectionStart, end = field.selectionEnd; setDraft(value => value.slice(0, start) + '  ' + value.slice(end)); requestAnimationFrame(() => field.setSelectionRange(start + 2, start + 2)) }
          else if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send() }
        }} placeholder="Ask a question about your notes…" aria-label="Message about your notes" disabled={sending}/>
        <button className="primary" type="submit" aria-label="Send message" disabled={sending || !draft.trim()}><ArrowRight size={18}/></button>
      </form>
      <p className="notes-chat-privacy"><CloudOff size={14}/> Your chat stays in this tab and clears on refresh. Original files stay on your device; extracted text is sent to the AI for each reply.</p>
    </div>
  </section>
}
function App() {
  const [notes, setNotes] = useState([])
  const [settings, setSettings] = useState({ mode: 'notes', count: 10, difficulty: 'balanced' })
  const [screen, setScreen] = useState('setup')
  const [notesChatReturnScreen, setNotesChatReturnScreen] = useState('setup')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [questions, setQuestions] = useState([])
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState([])
  const [history, setHistory] = useState([])
  const [notesChatMessages, setNotesChatMessages] = useState([notesChatWelcome])
  const notesSignature = notes.map(note => note.name + ':' + note.text.length).join('|')
  const notesSignatureRef = useRef(notesSignature)
  useEffect(() => {
    if (notesSignatureRef.current !== notesSignature) {
      notesSignatureRef.current = notesSignature
      setNotesChatMessages([notesChatWelcome])
    }
  }, [notesSignature])
  const [dragging, setDragging] = useState(false)
  const input = useRef(null)
  const available = notes
  const selected = answers[index]
  const current = questions[index]
  const score = answers.reduce((n, a, i) => n + (a === questions[i]?.correctAnswer ? 1 : 0), 0)
  const progress = questions.length ? Math.round(((index + (selected !== undefined ? 1 : 0)) / questions.length) * 100) : 0

  async function addFiles(files) {
    setError('')
    setBusy('Reading your notes...')
    const existing = new Set(notes.map(n => n.name))
    const added = []
    try {
      for (const file of Array.from(files).slice(0, 12)) {
        if (existing.has(file.name)) continue
        const text = normalize(await extract(file))
        if (text.length < 80) throw new Error(file.name + ' has too little readable text. Scanned PDFs need OCR first.')
        added.push({ name: file.name, text, size: file.size })
        existing.add(file.name)
      }
      setNotes(n => [...n, ...added].slice(0, 12))
    } catch (e) { setError(e.message) }
    finally { setBusy(''); if (input.current) input.current.value = '' }
  }
  async function generate(more = false) {
    if (!available.length) return setError('Add a note with at least 80 characters first.')
    setError('')
    setBusy('Making your quiz...')
    let generated = false
    try {
      const total = available.reduce((n, doc) => n + doc.text.length, 0)
      if (total > 100000) throw new Error('These notes contain over 100,000 characters. Remove a file to shorten the notes for now.')
      const target = Number(settings.count)
      const prior = more ? [...history, ...questions.map(q => q.question)] : [...history]
      const collected = []
      let attempts = 0
      let batchSize = total > 50000 ? 3 : 5
      let providerRetryCount = 0
      let generationNotice = ''
      while (collected.length < target && attempts < Math.ceil(target / 3) + 3) {
        attempts++
        const requestCount = Math.max(3, Math.min(batchSize, target - collected.length))
        setBusy('Making your quiz... ' + (collected.length + 1) + '-' + Math.min(target, collected.length + requestCount) + ' of ' + target)
        const response = await fetch('/api/quiz', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notes: available.map(({ name, text }) => ({ name, text })),
            mode: settings.mode, count: requestCount, difficulty: settings.difficulty,
            previousQuestions: [...prior, ...collected.map(q => q.question)],
          }),
        })
        const data = await response.json().catch(() => ({ error: 'The quiz service returned an empty or unreadable response. Please try again.' }))
        const providerError = data.error || ''
        const requestTimedOut = response.status === 504 || /timed out|timeout/i.test(providerError)
        const incompleteResult = /cut off|empty answer|incomplete response|incomplete JSON/i.test(providerError)
        if (!response.ok && ((incompleteResult && providerRetryCount < 2) || (requestTimedOut && providerRetryCount < 1))) {
          providerRetryCount++
          if (requestCount > 3) batchSize = Math.max(3, Math.floor(requestCount / 2))
          attempts--
          continue
        }
        if (!response.ok || !Array.isArray(data.questions)) {
          if (collected.length && response.status === 422) break
          if (collected.length && requestTimedOut) {
            generationNotice = 'RootsSys timed out on the next batch. Keeping the ' + collected.length + ' questions already generated.'
            break
          }
          throw new Error(data.error || 'The quiz service returned an incomplete response. Please try again.')
        }
        providerRetryCount = 0
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
      if (generationNotice) setError(generationNotice)
      else if (collected.length < target) setError('Made ' + collected.length + ' supported questions. Add more material for a longer round.')
    } catch (e) { setError(e.message) }
    finally { setBusy('') }
    if (generated) requestAnimationFrame(() => document.querySelector('.quiz-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  function answer(choice) {
    if (selected !== undefined) return
    setAnswers(a => { const next = [...a]; next[index] = choice; return next })
  }
  function next() {
    if (index < questions.length - 1) setIndex(i => i + 1)
    else setScreen('results')
    requestAnimationFrame(() => index < questions.length - 1 ? document.querySelector('.quiz-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) : window.scrollTo({ top: 0, behavior: 'smooth' }))
  }
  function reset() {
    setScreen('setup'); setQuestions([]); setAnswers([]); setHistory([]); setNotes([]); setNotesChatMessages([notesChatWelcome]); setError('')
  }
  return <div className="app">
    <header className="header"><div className="shell header-inner"><button className="brand" onClick={() => setScreen('setup')} aria-label="Notely home"><span className="brand-mark"><BookOpen size={20} strokeWidth={2.4}/><span className="brand-spark">✦</span></span><span>notely<span className="brand-dot">.</span></span></button><nav><span className="nav-label">Your personal study space</span><span className="privacy-pill"><ShieldCheck size={14}/> Files stay on your device</span></nav></div></header>
    <main className="shell">
      {screen === 'setup' && <>
        <section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="eyebrow-star">✳</span> STUDY SMARTER, REMEMBER MORE</div><h1>Your notes, <em>but make them</em> stick<span className="period">.</span></h1><p>Drop in your notes and turn them into little “aha!” moments. Simple quizzes, helpful explanations, and zero pressure.</p><div className="hero-checks"><span><CheckCircle2 size={17}/> Learn at your own pace</span><span><CheckCircle2 size={17}/> Understand, don’t just memorise</span></div></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"></div><div className="orbit orbit-two"></div><div className="art-card art-back"><div className="art-lines"><i/><i/><i/></div><span>✳</span></div><div className="art-card art-front"><div className="art-icon"><Lightbulb size={30}/></div><div className="art-question">Ohhh, I get it now!</div><div className="art-answer"><Check size={15}/> That’s the idea</div></div><span className="art-star star-one">✦</span><span className="art-star star-two">✳</span><span className="art-doodle">~</span></div></section>
        <div className="workspace"><section className="panel upload-panel"><div className="section-top"><span className="step-number">01</span><div><h2>Add your study material</h2><p>Give us something to work with.</p></div></div><div className={'dropzone ' + (dragging ? 'dragging' : '')} onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }} onClick={() => input.current?.click()} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') input.current?.click() }}><div className="upload-icon"><UploadCloud size={27}/></div><strong>Drop your notes here</strong><span>or <u>browse files</u> from your device</span><small>PDF, DOCX, TXT, MD · up to 15 MB per file</small><input ref={input} type="file" accept=".pdf,.docx,.txt,.md" multiple hidden onChange={e => addFiles(e.target.files)}/></div>
          {notes.length > 0 && <div className="files"><div className="files-heading">ADDED FILES <span>{notes.length}</span></div>{notes.map(n => <div className="file" key={n.name}><div className="file-icon"><FileText size={18}/></div><div className="file-name"><strong title={n.name}>{n.name}</strong><small>{formatSize(n.size)} · Ready to study</small></div><button aria-label={'Remove ' + n.name} onClick={() => setNotes(s => s.filter(x => x.name !== n.name))}><X size={17}/></button></div>)}</div>}

        </section><aside className="panel settings-panel"><div className="section-top"><span className="step-number purple">02</span><div><h2>Make it yours</h2><p>Set the vibe for this round.</p></div></div><div className="setting"><label>Question source</label><div className="mode-options"><button className={settings.mode === 'notes' ? 'mode active' : 'mode'} onClick={() => setSettings(s => ({ ...s, mode: 'notes' }))}><span className="mode-symbol peach"><BookOpen size={19}/></span><strong>My notes only</strong><small>Everything comes from what you shared</small><span className="radio"/></button><button className={settings.mode === 'explore' ? 'mode active' : 'mode'} onClick={() => setSettings(s => ({ ...s, mode: 'explore' }))}><span className="mode-symbol lavender"><Sparkles size={19}/></span><strong>Explore more</strong><small>Includes extra ideas to deepen understanding</small><span className="radio"/></button></div></div><div className="setting count-setting"><label>Questions per round</label><p>Pick the pace that feels right.</p><div className="count-options" role="group" aria-label="Questions per round">{[[10,'Quick'],[20,'Focus'],[30,'Deep'],[60,'Marathon'],[80,'Mastery']].map(([n,label]) => <button type="button" key={n} className={settings.count === n ? 'selected' : ''} aria-pressed={settings.count === n} onClick={() => setSettings(s => ({...s,count:n}))}><strong>{n}</strong><span>{label}</span></button>)}</div><small className="count-hint">Long rounds take more time and AI credits. Notes-only may return fewer if the material is too short.</small></div><div className="setting"><label htmlFor="difficulty">How challenging?</label><div className="difficulty" role="group" aria-label="Difficulty">{[['easy', 'Easy'], ['balanced', 'Balanced'], ['challenge', 'Challenge']].map(([value, label]) => <button key={value} className={settings.difficulty === value ? 'chosen' : ''} onClick={() => setSettings(s => ({ ...s, difficulty: value }))}>{label}</button>)}</div></div><div className="settings-bottom"><div className="tip"><Lightbulb size={18}/><span>Wrong answers are part of learning. You’ll get a simple explanation after every question.</span></div><button className="primary" disabled={!!busy || !available.length} onClick={() => generate()}>{busy ? <><LoaderCircle className="spin" size={19}/>{busy}</> : <>Make my quiz <ArrowRight size={19}/></>}</button>{notes.length > 0 && <button className="notes-chat-entry" type="button" onClick={() => { setNotesChatReturnScreen('setup'); setScreen('notes-chat') }}><span className="notes-chat-entry-icon"><MessagesSquare size={19}/></span><span className="notes-chat-entry-copy"><strong>{notesChatMessages.length > 1 ? 'Continue your notes chat' : 'Chat with your notes'}</strong><small>Explore the material in a separate conversation.</small></span><ArrowRight size={17}/></button>}<p className="privacy-note"><CloudOff size={14}/> Original files stay on your device. Extracted text is sent to the quiz AI when you generate.</p></div></aside></div>
        <section className="bottom-strip"><span>✦</span> Made for curious minds, messy notes, and last-minute study sessions. <span>✦</span></section>
      </>}
      {screen === 'notes-chat' && <NotesChatScreen notes={available} messages={notesChatMessages} setMessages={setNotesChatMessages} onBack={() => setScreen(notesChatReturnScreen)} backLabel={notesChatReturnScreen === 'quiz' ? 'Back to quiz' : notesChatReturnScreen === 'results' ? 'Back to results' : 'Back to study setup'} onNewChat={() => setNotesChatMessages([notesChatWelcome])}/>}
      {screen === 'quiz' && current && <section className="study"><div className="study-head"><div><div className="eyebrow"><span className="eyebrow-star">✳</span> YOUR STUDY SESSION</div><h1>One question <em>at a time.</em></h1><p>Take your time. You’re here to learn, not to be perfect.</p></div><button className="ghost" onClick={() => setScreen('setup')}><ArrowLeft size={16}/> Edit notes</button></div><div className="quiz-layout"><div className="quiz-card"><div className="quiz-meta"><span>QUESTION {index + 1} OF {questions.length}</span><span className={'origin ' + (current.origin === 'beyond' ? 'outside' : '')}>{current.origin === 'beyond' ? <><Sparkles size={14}/> Beyond your notes</> : <><BookOpen size={14}/> From your notes</>}</span></div><div className="progress"><span style={{ width: progress + '%' }}/></div><h2><RichText text={current.question}/></h2><div className="options">{current.options.map((option, i) => { let cls = 'option'; if (selected !== undefined) cls += i === current.correctAnswer ? (i === selected ? ' correct celebrate' : ' correct') : i === selected ? ' incorrect' : ' muted'; return <button key={i} className={cls} disabled={selected !== undefined} onClick={() => answer(i)}><span className="option-letter">{letter[i]}</span><RichText text={option}/>{selected !== undefined && i === current.correctAnswer && <CheckCircle2 className="option-result" size={21}/ >}{selected === i && i !== current.correctAnswer && <X className="option-result" size={19}/>}</button> })}</div>{selected !== undefined && <div className={'feedback ' + (selected === current.correctAnswer ? 'good' : 'learn')}>
  <div className="feedback-title">{selected === current.correctAnswer ? <><CheckCircle2 size={21}/> Yes! Here is why that works</> : <><Lightbulb size={21}/> Let us unpack this</>}</div>
  {current.optionExplanations?.length === 4 ? <>
    <div className="reason-block correct-reason"><strong className="reason-label">Why {letter[current.correctAnswer]} is right</strong><p><RichText text={current.optionExplanations[current.correctAnswer]}/></p></div>
    {selected !== current.correctAnswer && <div className="reason-block wrong-reason"><strong className="reason-label">Why your choice does not fit</strong><p><RichText text={current.optionExplanations[selected]}/></p></div>}
    <p className="feedback-takeaway"><RichText text={current.explanation}/></p>
  </> : <p><RichText text={current.explanation}/></p>}
  {selected === current.correctAnswer && <span className="cheer" aria-hidden="true">Great thinking!</span>}
</div>}<div className="quiz-actions"><span>{selected === undefined ? 'Pick an answer to see why it works.' : 'Nice work. Keep the momentum going!'}</span><button className="primary next-button" disabled={selected === undefined} onClick={next}>{index === questions.length - 1 ? 'See results' : 'Next question'} <ArrowRight size={18}/></button></div></div><aside className="study-aside"><div className="mini-card"><div className="mini-icon"><Lightbulb size={20}/></div><h3>Little reminder</h3><p>Pause and think it through. Even when you guess wrong, the explanation helps it stick.</p></div><div className="mini-card stats"><span>YOUR PROGRESS</span><strong>{index + 1}<small> / {questions.length}</small></strong><div className="tiny-bar"><span style={{ width: progress + '%' }}/></div><p>{score} correct so far</p></div></aside></div><StudyBot question={current} index={index} total={questions.length} answer={selected} notes={available}/></section>}
      {screen === 'results' && <section className="results"><div className="result-graphic"><span>✦</span><div><Sparkles size={36}/></div><span>✳</span></div><div className="eyebrow">ROUND COMPLETE</div><h1>Look at you, <em>learning!</em></h1><p className="result-intro">Every answer helped make the topic a little clearer.</p><div className="score-card"><strong>{score}<span> / {questions.length}</span></strong><div><b>{score === questions.length ? 'Perfect round!' : score >= questions.length * .7 ? 'Nice work!' : 'Keep going, you’ve got this.'}</b><p>Questions answered correctly</p></div></div><div className="results-actions"><button className="primary" onClick={() => generate(true)} disabled={!!busy}>{busy ? <><LoaderCircle className="spin" size={18}/> Making more...</> : <>Another round <RotateCcw size={18}/></>}</button><button className="secondary" onClick={() => { setScreen('setup'); setError('') }}>Adjust settings</button></div><div className="review"><h2>Review this round</h2>{questions.map((q, i) => <details key={i}><summary><span className={'review-icon ' + (answers[i] === q.correctAnswer ? 'yes' : 'no')}>{answers[i] === q.correctAnswer ? <Check size={16}/> : <X size={16}/>}</span><RichText text={q.question}/><ChevronDown size={17}/></summary><div className="review-body"><p><b>Correct answer:</b> <RichText text={q.options[q.correctAnswer]}/></p><p><RichText text={q.explanation}/></p></div></details>)}</div><button className="reset" onClick={reset}><Trash2 size={15}/> Clear notes and start fresh</button></section>}
      {error && <div className="error-toast" role="alert"><CircleHelp size={19}/><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error"><X size={17}/></button></div>}
    </main>      {notes.length > 0 && screen !== 'notes-chat' && <button className={'mobile-notes-chat-launcher ' + (screen === 'quiz' ? 'during-quiz' : '')} type="button" aria-label="Open chat with your notes" onClick={() => { setNotesChatReturnScreen(screen); setScreen('notes-chat') }}><MessagesSquare size={19}/> Notes chat</button>}{busy.startsWith('Making your quiz') && <div className="generating-overlay" role="dialog" aria-modal="true" aria-labelledby="generating-title"><div className="generating-card"><div className="generating-orb"><Sparkles size={25}/></div><div className="generating-spinner"/><div className="eyebrow">YOUR NOTES ARE IN GOOD HANDS</div><h2 id="generating-title">Making your quiz...</h2><p>{busy}</p><div className="generating-dots"><i/><i/><i/></div></div></div>}<footer><div className="shell footer-inner"><span className="brand footer-brand"><span className="brand-mark"><BookOpen size={17}/></span>notely<span className="brand-dot">.</span></span><span>Make sense of it, one question at a time.</span><span>Built for better learning ✳</span></div></footer>
  </div>
}
createRoot(document.getElementById('root')).render(<App />)





import fs from 'node:fs'
let app=fs.readFileSync('src/main.jsx','utf8')
app=app.replace("  const [sending, setSending] = useState(false)\n  const requestRef", "  const [sending, setSending] = useState(false)\n  const [phase, setPhase] = useState(null)\n  const [thinkingText, setThinkingText] = useState('Thinking it through')\n  const thinkingRef = useRef(null)\n  const typingRef = useRef(null)\n  const requestRef")
app=app.replace("    requestRef.current?.abort()\n    setMessages", "    requestRef.current?.abort()\n    clearInterval(thinkingRef.current)\n    clearInterval(typingRef.current)\n    setPhase(null)\n    setMessages")
app=app.replace("    return () => requestRef.current?.abort()", "    return () => { requestRef.current?.abort(); clearInterval(thinkingRef.current); clearInterval(typingRef.current) }")
const start=app.indexOf('  async function send(message) {')
const end=app.indexOf('  return <div className="tutor-widget">',start)
if(start<0||end<0)throw Error('React tutor handler not found')
const handler=`  async function send(message) {
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
      const data = await response.json()
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
`
app=app.slice(0,start)+handler+app.slice(end)
app=app.replace("className={'tutor-bubble ' + m.role}>{m.text}</div>)}{sending && <div className=\"tutor-bubble bot thinking\">Thinking about this question...</div>}", "className={'tutor-bubble ' + m.role + (phase === 'typing' && i === messages.length - 1 && m.role === 'bot' ? ' typing' : '')}>{m.text}</div>)}{phase === 'thinking' && <div className=\"tutor-bubble bot thinking\">{thinkingText}</div>}")
fs.writeFileSync('src/main.jsx',app)


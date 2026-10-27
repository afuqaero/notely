import fs from 'node:fs'
let app=fs.readFileSync('src/main.jsx','utf8')
const start=app.indexOf("{selected !== undefined && <div className={'feedback '")
const end=app.indexOf('<div className="quiz-actions">',start)
if(start<0||end<0)throw Error('React feedback block not found')
const block=`{selected !== undefined && <div className={'feedback ' + (selected === current.correctAnswer ? 'good' : 'learn')}>
  <div className="feedback-title">{selected === current.correctAnswer ? <><CheckCircle2 size={21}/> Yes! Here is why that works</> : <><Lightbulb size={21}/> Let us unpack this</>}</div>
  {current.optionExplanations?.length === 4 ? <>
    <div className="reason-block"><strong className="reason-label">Why {letter[current.correctAnswer]} is right</strong><p>{current.optionExplanations[current.correctAnswer]}</p></div>
    {selected !== current.correctAnswer && <div className="reason-block"><strong className="reason-label">Why your choice does not fit</strong><p>{current.optionExplanations[selected]}</p></div>}
    <p className="feedback-takeaway">{current.explanation}</p>
  </> : <p>{current.explanation}</p>}
  {selected === current.correctAnswer && <span className="cheer" aria-hidden="true">Great thinking!</span>}
</div>}`
app=app.slice(0,start)+block+app.slice(end)
app=app.replace("const data = await response.json()\n      if (controller.signal.aborted) return", "const data = await response.json().catch(() => ({ error: response.status === 404 ? 'Restart the Notely server to enable the study bot.' : 'The study bot returned an unreadable response.' }))\n      if (controller.signal.aborted) return")
fs.writeFileSync('src/main.jsx',app)


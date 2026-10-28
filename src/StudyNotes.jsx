import React, { useEffect, useRef } from 'react'
import { ArrowLeft, BookOpen, Download, LoaderCircle, Sparkles } from 'lucide-react'
import { renderRichText } from './format.js'

function splitSource(text) {
  const chunks = []
  let remaining = text.trim()
  while (remaining.length > 8500) {
    const window = remaining.slice(6000, 8500)
    const end = Math.max(window.lastIndexOf('. '), window.lastIndexOf(' '))
    const cut = end < 0 ? 8500 : 6000 + end + 1
    chunks.push(remaining.slice(0, cut).trim())
    remaining = remaining.slice(cut).trim()
  }
  if (remaining.length < 80 && chunks.length) chunks[chunks.length - 1] += ' ' + remaining
  else if (remaining) chunks.push(remaining)
  return chunks
}

async function requestNotes(body) {
  const response = await fetch('/api/study-notes', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Could not generate study notes. Please try again.')
  return data
}

export async function createStudyNotes(notes, onProgress, onDocument) {
  const totalLength = notes.reduce((sum, note) => sum + note.text.length, 0)
  if (totalLength > 100000) throw new Error('These notes contain over 100,000 characters. Remove a file to shorten them for now.')
  for (let documentIndex = 0; documentIndex < notes.length; documentIndex++) {
    const note = notes[documentIndex]
    const chunks = splitSource(note.text)
    const sections = []
    for (let index = 0; index < chunks.length; index++) {
      onProgress(`Reading ${note.name}: section ${index + 1} of ${chunks.length}`)
      const result = await requestNotes({ stage: 'section', name: note.name, text: chunks[index], index, total: chunks.length })
      if (!result.content?.trim()) throw new Error('The AI returned an empty section. Please try again.')
      sections.push(result.content.trim())
    }
    onProgress(`Finishing ${note.name}: chapter overview and recap`)
    const summary = await requestNotes({ stage: 'summary', name: note.name, text: sections.join('\n\n').slice(0, 65000), index: 0, total: 1 })
    if (!summary.opening || !summary.closing) throw new Error('The AI returned an incomplete recap. Please try again.')
    onDocument({ name: note.name, content: [summary.opening, '## 2. Concepts Explained Simply', ...sections, summary.closing].join('\n\n') })
  }
}

function RichLine({ text, as = 'p', className }) {
  const ref = useRef(null)
  useEffect(() => { renderRichText(ref.current, text, { inline: true }) }, [text])
  return React.createElement(as, { ref, className })
}

function NotesContent({ content }) {
  return <div className="study-notes-content">{content.split(/\r?\n/).filter(line => line.trim()).map((line, index) => {
    const heading = line.match(/^(#{1,4})\s+(.+)/)
    if (heading) return <RichLine key={index} as={'h' + Math.min(heading[1].length + 1, 5)} text={heading[2]}/>
    const bullet = line.match(/^[-*]\s+(.+)/)
    if (bullet) return <RichLine key={index} className="study-notes-bullet" text={bullet[1]}/>
    return <RichLine key={index} text={line}/>
  })}</div>
}

export default function StudyNotesScreen({ notes, results, busy, error, onGenerate, onBack }) {
  function download(result) {
    const blob = new Blob([result.content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = result.name.replace(/\.[^.]+$/, '') + '-simple-study-notes.md'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <section className="notes-chat-screen study-notes-screen">
    <div className="notes-chat-heading">
      <button className="ghost" onClick={onBack}><ArrowLeft size={16}/> Back to study setup</button>
      <div className="eyebrow">SIMPLIFIED STUDY NOTES</div>
      <h1>Understand it, <em>then remember it.</em></h1>
      <p>Turn your uploaded material into clear explanations, examples, quick brain checks, and exam takeaways.</p>
    </div>
    <div className="study-notes-toolbar">
      <div><BookOpen size={19}/><span>{notes.length} {notes.length === 1 ? 'document' : 'documents'} ready</span></div>
      <button className="primary" type="button" onClick={onGenerate} disabled={!!busy || !notes.length}>{busy ? <><LoaderCircle className="spin" size={17}/> {busy}</> : <><Sparkles size={17}/> {results.length ? 'Regenerate notes' : 'Make simplified notes'}</>}</button>
    </div>
    {error && <p className="study-notes-error" role="alert">{error}</p>}
    {!results.length && !busy && <div className="study-notes-empty"><BookOpen size={27}/><p>Your chapter notes will appear here after generation. Longer documents are written section by section, so they may take a few minutes.</p></div>}
    {results.map(result => <article className="study-notes-document" key={result.name}>
      <div className="study-notes-document-head"><strong>{result.name}</strong><button className="secondary" type="button" onClick={() => download(result)}><Download size={15}/> Download .md</button></div>
      <NotesContent content={result.content}/>
    </article>)}
    <p className="study-notes-privacy">Original files stay on your device. Extracted text is sent to the AI to make these notes. Generated notes stay in this tab until refresh; download a copy to keep them.</p>
  </section>
}

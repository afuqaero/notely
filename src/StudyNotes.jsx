import React, { useEffect, useRef } from 'react'
import { ArrowLeft, BookOpen, Download, LoaderCircle, Sparkles } from 'lucide-react'
import { renderRichText } from './format.js'

function splitSource(text) {
  const chunks = []
  let remaining = text.trim()
  while (remaining.length > 1400) {
    const window = remaining.slice(1000, 1400)
    const end = Math.max(window.lastIndexOf('. '), window.lastIndexOf(' '))
    const cut = end < 0 ? 1400 : 1000 + end + 1
    chunks.push(remaining.slice(0, cut).trim())
    remaining = remaining.slice(cut).trim()
  }
  if (remaining.length < 80 && chunks.length) chunks[chunks.length - 1] += ' ' + remaining
  else if (remaining) chunks.push(remaining)
  return chunks
}

function sourceForStudy(note) {
  const raw = note.studyText || note.text
  if (!note.name.toLowerCase().endsWith('.pdf')) return raw.trim()
  const pages = raw.split(/\n+/).map(page => page.trim()).filter(Boolean)
  const outcomes = pages.findIndex((page, index) => index < 3 && page.length < 1500 && /after this lecture|learning outcomes|learning objectives|by the end of this (chapter|lecture)/i.test(page))
  return (outcomes >= 0 && outcomes < pages.length - 1 ? pages.slice(outcomes + 1) : pages).join('\n\n').trim()
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
  const sources = notes.map(sourceForStudy)
  const totalLength = sources.reduce((sum, text) => sum + text.length, 0)
  if (totalLength > 100000) throw new Error('These notes contain over 100,000 characters. Remove a file to shorten them for now.')
  for (let documentIndex = 0; documentIndex < notes.length; documentIndex++) {
    const note = notes[documentIndex]
    const chunks = splitSource(sources[documentIndex])
    const sections = []
    for (let index = 0; index < chunks.length; index++) {
      onProgress(`Reading ${note.name}: section ${index + 1} of ${chunks.length}`)
      let result
      try { result = await requestNotes({ stage: 'section', name: note.name, text: chunks[index], index, total: chunks.length }) }
      catch (error) {
        if (chunks[index].length < 800) throw error
        const midpoint = Math.floor(chunks[index].length / 2)
        const cut = chunks[index].lastIndexOf(' ', midpoint)
        if (cut < 80 || chunks[index].length - cut < 80) throw error
        chunks.splice(index, 1, chunks[index].slice(0, cut).trim(), chunks[index].slice(cut).trim())
        index--
        continue
      }
      if (!result.content?.trim()) throw new Error('The AI returned an empty section. Please try again.')
      sections.push(result.content.trim())
    }
    const concepts = sections.join('\n\n').slice(0, 65000)
    onProgress(`Finishing ${note.name}: chapter overview`)
    const opening = await requestNotes({ stage: 'opening', name: note.name, text: concepts, index: 0, total: 1 })
    onProgress(`Finishing ${note.name}: exam recap`)
    const closing = await requestNotes({ stage: 'closing', name: note.name, text: concepts, index: 0, total: 1 })
    if (!opening.content || !closing.content) throw new Error('The AI returned an incomplete recap. Please try again.')
    onDocument({ name: note.name, content: [opening.content, '## 2. Concepts Explained Simply', ...sections, closing.content].join('\n\n') })
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

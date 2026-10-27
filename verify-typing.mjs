import fs from 'node:fs'
import vm from 'node:vm'
const source = fs.readFileSync('preview-app.js', 'utf8')
const section = source.slice(source.indexOf('const tutorPhrases ='), source.indexOf('async function sendTutor(message)'))
const messages = { scrollTop: 0, scrollHeight: 100 }
const state = { tutorToken: 1 }
const context = { state, window: { matchMedia: () => ({ matches: false }) }, $: () => messages, setInterval, clearInterval, Promise, Math }
vm.createContext(context)
vm.runInContext(section + '\nthis.animate = typeTutorReply;', context)
const element = { textContent: '', classList: { add() {}, remove() {} } }
const controller = new AbortController()
await context.animate(element, 'A useful explanation that appears gradually.', 1, controller.signal)
if (element.textContent !== 'A useful explanation that appears gradually.') throw Error('Typing did not finish')
const another = { textContent: '', classList: { add() {}, remove() {} } }
const cancel = new AbortController()
const pending = context.animate(another, 'This response should be cancelled when the question changes.', 1, cancel.signal)
setTimeout(() => cancel.abort(), 45)
await pending
console.log('Typing completion and cancellation checks passed.')


import test from 'node:test'
import assert from 'node:assert/strict'
import { generateQuiz } from '../server/quiz.js'

const notes = [{ name: 'testing.txt', text: 'Regression testing checks existing behavior after a change. Unit testing checks individual components. Integration testing checks components working together. Verification checks requirements. Validation checks user needs.' }]
const makeQuestion = question => ({ question, options: ['Existing behavior', 'Individual units', 'Interactions', 'User needs'], correctAnswer: 0, explanation: 'It checks existing behavior after a change.', optionExplanations: ['Correct because it checks existing behavior.', 'This checks a single unit instead.', 'This checks interactions instead.', 'This checks user needs instead.'], origin: 'beyond', sourceName: '', evidence: '' })

test('quiz batches request direct question types and reject previous and in-batch paraphrases', async () => {
  const originalFetch = globalThis.fetch
  let prompt
  globalThis.fetch = async (_url, options) => {
    prompt = JSON.parse(options.body).messages[1].content
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ questions: [
      makeQuestion('Which benefit does regression testing provide?'),
      makeQuestion('What is an advantage of regression testing?'),
      makeQuestion('What is unit testing?'),
      makeQuestion('What does unit testing mean?'),
      makeQuestion('How does integration testing differ from unit testing?'),
    ] }) } }] }) }
  }
  try {
    const result = await generateQuiz({ notes, mode: 'explore', count: 5, previousQuestions: ['What is an advantage of regression testing?'] }, 'test-key')
    assert.equal(result.status, 200)
    assert.deepEqual(result.body.questions.map(q => q.question), ['What is unit testing?', 'How does integration testing differ from unit testing?'])
    assert.match(prompt, /Write questions in this type order/)
    assert.match(prompt, /definition|comparison/)
  } finally { globalThis.fetch = originalFetch }
})

test('scenario-heavy prior batches request direct questions and limit new scenarios', async () => {
  const originalFetch = globalThis.fetch
  let prompt
  globalThis.fetch = async (_url, options) => {
    prompt = JSON.parse(options.body).messages[1].content
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ questions: [
      makeQuestion('A developer changes the login page. What should be checked?'),
      makeQuestion('A team updates checkout. What should be tested?'),
      makeQuestion('What is verification?'),
    ] }) } }] }) }
  }
  try {
    const previousQuestions = ['A developer fixes login. What test helps?', 'A team changes checkout. What test helps?', 'A company changes payment. What test helps?']
    const result = await generateQuiz({ notes, mode: 'explore', count: 3, previousQuestions }, 'test-key')
    assert.equal(result.status, 200)
    assert.deepEqual(result.body.questions.map(q => q.question), ['What is verification?'])
    assert.match(prompt, /Write questions in this type order, one per type: definition, concept, comparison\./)
  } finally { globalThis.fetch = originalFetch }
})


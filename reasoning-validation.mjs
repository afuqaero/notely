import fs from 'node:fs'
for(const file of ['preview-server.mjs','server/index.js']){
 let s=fs.readFileSync(file,'utf8')
 if(file==='preview-server.mjs') s=s.replace("q.correctAnswer < 0 || q.correctAnswer > 3 || typeof q.explanation !== 'string') return false", "q.correctAnswer < 0 || q.correctAnswer > 3 || typeof q.explanation !== 'string' || !Array.isArray(q.optionExplanations) || q.optionExplanations.length !== 4 || !q.optionExplanations.every(x => typeof x === 'string' && x.trim().length >= 20)) return false")
 else s=s.replace("q.correctAnswer < 0 || q.correctAnswer > 3 || typeof q.explanation !== 'string') return false", "q.correctAnswer < 0 || q.correctAnswer > 3 || typeof q.explanation !== 'string' || !Array.isArray(q.optionExplanations) || q.optionExplanations.length !== 4 || !q.optionExplanations.every(x => typeof x === 'string' && x.trim().length >= 20)) return false")
 fs.writeFileSync(file,s)
}
let tutor=fs.readFileSync('server/tutor.js','utf8')
tutor=tutor.replace("    answered && correct !== null ? 'LEARNER ALREADY ANSWERED: chose '", "    answered && Array.isArray(question.optionExplanations) && question.optionExplanations.length === 4 ? 'ANSWER REASONS: ' + question.optionExplanations.map((x,i) => 'ABCD'[i] + ': ' + clean(x).slice(0, 450)).join(' | ') : '',\n    answered && correct !== null ? 'LEARNER ALREADY ANSWERED: chose '")
fs.writeFileSync('server/tutor.js',tutor)


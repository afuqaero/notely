import fs from 'node:fs'
for(const file of ['preview-server.mjs','server/index.js']){
 let s=fs.readFileSync(file,'utf8')
 if(file==='preview-server.mjs'){
  s=s.replace("Use plain, short language. Focus on understanding and application. Four plausible, non-overlapping options, exactly one correct. Spread correct answers across positions. Explain each answer simply in 1-3 sentences.", "Use plain, short language. Focus on understanding and application. Four plausible, non-overlapping options, exactly one correct. Spread correct answers across positions. explanation must teach the core idea in 2-3 clear sentences. optionExplanations must contain four 1-2 sentence reasons, one per option, saying specifically why that choice fits or fails. Avoid merely repeating the option.")
  s=s.replace('"explanation":"...","origin"', '"explanation":"...","optionExplanations":["why A fits or fails","why B fits or fails","why C fits or fails","why D fits or fails"],"origin"')
  s=s.replace('max_tokens: Math.min(7000, count * 500 + 500)', 'max_tokens: Math.min(10000, count * 900 + 500)')
  s=s.replace('correctAnswer: q.correctAnswer, explanation: q.explanation.slice(0, 600), origin: q.origin,', "correctAnswer: q.correctAnswer, explanation: q.explanation.slice(0, 900),\n        optionExplanations: Array.isArray(q.optionExplanations) && q.optionExplanations.length === 4 && q.optionExplanations.every(x => typeof x === 'string') ? q.optionExplanations.map(x => x.slice(0, 450)) : [], origin: q.origin,")
 } else {
  s=s.replace('Explanations should teach the idea simply in 1-3 sentences.', 'The main explanation should teach the idea in 2-3 clear sentences. Also provide optionExplanations: four 1-2 sentence reasons, one for each option, saying specifically why that choice fits or fails. Avoid merely restating options.')
  s=s.replace('"explanation":string,"origin"', '"explanation":string,"optionExplanations":[string,string,string,string],"origin"')
  s=s.replace('max_tokens: Math.min(7000, count * 470 + 500)', 'max_tokens: Math.min(10000, count * 900 + 500)')
  s=s.replace('correctAnswer: q.correctAnswer, explanation: q.explanation.slice(0, 600),', "correctAnswer: q.correctAnswer, explanation: q.explanation.slice(0, 900),\n      optionExplanations: Array.isArray(q.optionExplanations) && q.optionExplanations.length === 4 && q.optionExplanations.every(x => typeof x === 'string') ? q.optionExplanations.map(x => x.slice(0, 450)) : [],")
 }
 fs.writeFileSync(file,s)
}


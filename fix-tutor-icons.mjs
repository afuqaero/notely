import fs from 'node:fs'
let s=fs.readFileSync('src/main.jsx','utf8')
s=s.replace(/(<button type="button" aria-label="Close study bot" onClick=\{\(\) => setOpen\(false\)\}>).*?(<\/button>)/, '$1<X size={17}/>$2')
s=s.replace(/(<button type="submit" disabled=\{sending \|\| !inputText\.trim\(\)\} aria-label="Send message">).*?(<\/button>)/, '$1<ArrowRight size={16}/>$2')
s=s.replace(/About this question .*? AI can make mistakes/, 'About this question | AI can make mistakes')
fs.writeFileSync('src/main.jsx',s)
let html=fs.readFileSync('preview.html','utf8')
html=html.replace(/(<button type="button" id="tutor-close" aria-label="Close study bot">).*?(<\/button>)/, '$1&times;$2')
html=html.replace(/(<button type="submit" aria-label="Send message">).*?(<\/button>)/, '$1&#10148;$2')
html=html.replace(/About this question .*? AI can make mistakes/, 'About this question | AI can make mistakes')
fs.writeFileSync('preview.html',html)


import fs from 'node:fs'
let html=fs.readFileSync('preview.html','utf8')
const widget=`<div class="tutor-widget" id="tutor-widget">
  <button type="button" class="tutor-launcher" id="tutor-launcher" aria-label="Ask Notely about this question" aria-expanded="false" aria-controls="tutor-panel"><span class="bot-face"><i></i><b></b><b></b><em></em></span><span>Ask Notely</span><span class="tutor-ping"></span></button>
  <div class="tutor-panel" id="tutor-panel" hidden role="dialog" aria-label="Notely study bot">
    <div class="tutor-head"><span class="bot-face small"><i></i><b></b><b></b><em></em></span><div><strong>Notely study bot</strong><small id="tutor-context">Question 1</small></div><button type="button" id="tutor-close" aria-label="Close study bot">×</button></div>
    <div class="tutor-messages" id="tutor-messages" role="log" aria-live="polite"></div>
    <div class="tutor-prompts"><button type="button" data-prompt="Give me a hint without the answer">Give me a hint</button><button type="button" data-prompt="Explain the concept simply">Explain simply</button></div>
    <form id="tutor-form" class="tutor-form"><input id="tutor-input" type="text" maxlength="600" autocomplete="off" placeholder="Ask about this question..." aria-label="Ask about this question"><button type="submit" aria-label="Send message">➤</button></form>
    <div class="tutor-foot">About this question · AI can make mistakes</div>
  </div>
</div>`
const start=html.indexOf('<section class="study" id="sample"')
const end=html.indexOf('</section>',start)
if(start<0||end<0)throw Error('Study section not found')
html=html.slice(0,end)+widget+html.slice(end)
fs.writeFileSync('preview.html',html)


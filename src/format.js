const inlinePattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g

function appendInline(parent, line) {
  let cursor = 0
  for (const match of line.matchAll(inlinePattern)) {
    if (match.index > cursor) parent.append(document.createTextNode(line.slice(cursor, match.index)))
    const token = match[0]
    const element = document.createElement(token.startsWith('`') ? 'code' : token.startsWith('**') ? 'strong' : 'em')
    element.textContent = token.startsWith('**') ? token.slice(2, -2) : token.slice(1, -1)
    parent.append(element)
    cursor = match.index + token.length
  }
  if (cursor < line.length) parent.append(document.createTextNode(line.slice(cursor)))
}

function applyMath(element) {
  if (typeof window.renderMathInElement !== 'function') return
  try {
    window.renderMathInElement(element, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false },
        { left: '$', right: '$', display: false },
      ],
      throwOnError: false,
      trust: false,
      ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
    })
  } catch (error) { console.warn('Math could not be rendered:', error.message) }
}

export function renderRichText(element, raw, { inline = false } = {}) {
  if (!element) return
  const value = String(raw ?? '')
  element.__notelyRich = { value, inline }
  element.dataset.rich = 'true'
  element.replaceChildren()
  if (inline) {
    value.split('\n').forEach((line, index) => {
      if (index) element.append(document.createElement('br'))
      appendInline(element, line)
    })
  } else {
    for (const paragraph of value.split(/\n\s*\n/)) {
      const block = document.createElement('p')
      paragraph.split('\n').forEach((line, index) => {
        if (index) block.append(document.createElement('br'))
        appendInline(block, line)
      })
      element.append(block)
    }
  }
  applyMath(element)
}

window.addEventListener('notely-math-ready', () => {
  document.querySelectorAll('[data-rich]').forEach(element => {
    if (element.__notelyRich) renderRichText(element, element.__notelyRich.value, { inline: element.__notelyRich.inline })
  })
})


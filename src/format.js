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

function tableCells(line) {
  if (!line?.includes('|')) return null
  const source = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  const cells = []
  let cell = ''
  for (let index = 0; index < source.length; index++) {
    if (source[index] === '\\' && source[index + 1] === '|') { cell += '|'; index++ }
    else if (source[index] === '|') { cells.push(cell.trim()); cell = '' }
    else cell += source[index]
  }
  cells.push(cell.trim())
  return cells
}

function appendTable(parent, header, rows) {
  const wrapper = document.createElement('div')
  wrapper.className = 'rich-table-wrap'
  wrapper.tabIndex = 0
  wrapper.setAttribute('role', 'region')
  wrapper.setAttribute('aria-label', 'Study table')
  const table = document.createElement('table')
  table.className = 'rich-table'
  const head = table.createTHead().insertRow()
  header.forEach(value => {
    const cell = document.createElement('th')
    cell.scope = 'col'
    appendInline(cell, value)
    head.append(cell)
  })
  const body = table.createTBody()
  rows.forEach(row => {
    const line = body.insertRow()
    row.forEach(value => appendInline(line.insertCell(), value))
  })
  wrapper.append(table)
  parent.append(wrapper)
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
    const lines = value.split(/\r?\n/)
    let paragraph = []
    const flush = () => {
      if (!paragraph.length) return
      const block = document.createElement('p')
      paragraph.forEach((line, index) => {
        if (index) block.append(document.createElement('br'))
        appendInline(block, line)
      })
      element.append(block)
      paragraph = []
    }
    for (let index = 0; index < lines.length; index++) {
      if (!lines[index].trim()) { flush(); continue }
      const heading = lines[index].match(/^#{1,4}\s+(.+)/)
      if (heading) {
        flush()
        const title = document.createElement('h3')
        appendInline(title, heading[1])
        element.append(title)
        continue
      }
      const header = tableCells(lines[index])
      const separator = tableCells(lines[index + 1])
      if (header?.length >= 2 && separator?.length === header.length && separator.every(cell => /^:?-{3,}:?$/.test(cell))) {
        flush()
        const rows = []
        index++
        while (index + 1 < lines.length) {
          const row = tableCells(lines[index + 1])
          if (row?.length !== header.length || !lines[index + 1].trim()) break
          rows.push(row)
          index++
        }
        appendTable(element, header, rows)
      } else paragraph.push(lines[index])
    }
    flush()
  }
  applyMath(element)
}

window.addEventListener('notely-math-ready', () => {
  document.querySelectorAll('[data-rich]').forEach(element => {
    if (element.__notelyRich) renderRichText(element, element.__notelyRich.value, { inline: element.__notelyRich.inline })
  })
})
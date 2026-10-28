// The PDF is assembled in the browser; uploaded source files stay on the device.
const purple = [105, 70, 179]
const ink = [49, 39, 67]
const muted = [101, 90, 117]
const pale = [246, 242, 252]
const pageWidth = 210
const margin = 18
const bodyWidth = pageWidth - margin * 2

function printable(value) {
  return value.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[`_]/g, '')
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-').replace(/\u2022/g, '-')
    .replace(/[\u2192\u2794]/g, ' -> ')
    .replace(/[^\x20-\x7e\u00a0-\u00ff\n]/g, '')
}

export async function buildStudyPdf(result) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  let y = 0
  let page = 0

  function newPage() {
    if (page) pdf.addPage()
    page++
    pdf.setFillColor(255, 255, 255)
    pdf.rect(0, 0, pageWidth, 297, 'F')
    pdf.setFillColor(...purple)
    pdf.rect(0, 0, pageWidth, 3.5, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.setTextColor(...purple)
    pdf.text('notely.', margin, 16)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7.5)
    pdf.setTextColor(...muted)
    pdf.text('STUDY NOTES', pageWidth - margin, 16, { align: 'right' })
    pdf.setDrawColor(231, 222, 244)
    pdf.line(margin, 20, pageWidth - margin, 20)
    y = 29
  }

  function ensure(height) {
    if (y + height > 277) newPage()
  }

  // Draw each word separately so Markdown bold stays bold inside a wrapped paragraph.
  function rich(text, { size = 10, color = ink, indent = 0, maxWidth = bodyWidth - indent, lineHeight = 5, gap = 2.5, bold = false } = {}) {
    const tokens = printable(text).split(/(\*\*[^*]+\*\*)/g).flatMap(part => {
      const strong = part.startsWith('**') && part.endsWith('**')
      return (strong ? part.slice(2, -2) : part).split(/\s+/).filter(Boolean).map(word => ({ word, strong: bold || strong }))
    })
    const lines = [[]]
    let lineWidth = 0
    for (const token of tokens) {
      pdf.setFont('helvetica', token.strong ? 'bold' : 'normal')
      pdf.setFontSize(size)
      const wordWidth = pdf.getTextWidth(token.word)
      const space = lines.at(-1).length && !/^[,.;:!?)]/.test(token.word) ? pdf.getTextWidth(' ') : 0
      if (lineWidth + space + wordWidth > maxWidth && lines.at(-1).length) {
        lines.push([])
        lineWidth = 0
      }
      lines.at(-1).push(token)
      lineWidth += (lines.at(-1).length > 1 ? space : 0) + wordWidth
    }
    ensure(Math.min(lines.length, 2) * lineHeight + gap)
    for (const line of lines) {
      ensure(lineHeight)
      let x = margin + indent
      for (const token of line) {
        pdf.setFont('helvetica', token.strong ? 'bold' : 'normal')
        pdf.setFontSize(size)
        pdf.setTextColor(...color)
        if (x > margin + indent && !/^[,.;:!?)]/.test(token.word)) x += pdf.getTextWidth(' ')
        pdf.text(token.word, x, y)
        x += pdf.getTextWidth(token.word)
      }
      y += lineHeight
    }
    y += gap
  }

  function heading(label, level) {
    ensure(level <= 2 ? 18 : 13)
    y += level <= 2 ? 5 : 2.5
    const size = level <= 2 ? 14 : level === 3 ? 11.5 : 10.5
    if (level <= 2) {
      pdf.setDrawColor(...purple)
      pdf.setLineWidth(0.35)
      pdf.line(margin, y + 3, pageWidth - margin, y + 3)
      rich(label, { size, bold: true, color: purple, lineHeight: 7, gap: 5 })
    } else rich(label, { size, bold: true, color: ink, lineHeight: 6, gap: 3 })
  }

  function callout(raw) {
    const match = raw.match(/^>\s*(?:\*\*)?([^:*]+):(?:\*\*)?\s*(.*)$/)
    const label = match?.[1]?.trim() || 'Remember'
    const body = match?.[2] || raw.replace(/^>\s*/, '')
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9.5)
    const lines = pdf.splitTextToSize(printable((label + ': ' + body).replace(/\*\*/g, '')), bodyWidth - 15)
    const height = Math.max(10, lines.length * 5 + 5)
    ensure(height + 4)
    const top = y - 3
    pdf.setFillColor(...pale)
    pdf.roundedRect(margin, top, bodyWidth, height, 2, 2, 'F')
    pdf.setFillColor(...purple)
    pdf.rect(margin, top, 1.2, height, 'F')
    rich('**' + label.toUpperCase() + ':** ' + body, { size: 9.5, indent: 6, maxWidth: bodyWidth - 13, lineHeight: 5, gap: 0 })
    y = Math.max(y, top + height + 4)
  }

  function table(rows) {
    if (rows.length < 2) return
    const columns = rows[0].length
    if (columns < 2 || columns > 4 || rows.some(row => row.length !== columns)) {
      rows.forEach(row => rich(row.join('  |  ')))
      return
    }
    const widths = columns === 2 ? [bodyWidth * 0.34, bodyWidth * 0.66] : columns === 3
      ? [bodyWidth * 0.25, bodyWidth * 0.3, bodyWidth * 0.45] : Array(columns).fill(bodyWidth / columns)
    const cellLines = (row) => row.map((cell, i) => {
      pdf.setFont('helvetica', i === 0 ? 'bold' : 'normal')
      pdf.setFontSize(9)
      return pdf.splitTextToSize(printable(cell.replace(/\*\*/g, '')), widths[i] - 5)
    })
    function drawRow(row, header, index) {
      const lines = cellLines(row)
      const height = Math.max(9, Math.max(...lines.map(item => item.length)) * 4.6 + 5)
      ensure(height + (header ? 2 : 0))
      if (header) pdf.setFillColor(...purple)
      else pdf.setFillColor(...(index % 2 ? [255, 255, 255] : pale))
      pdf.rect(margin, y - 3, bodyWidth, height, 'F')
      pdf.setDrawColor(227, 220, 238)
      pdf.rect(margin, y - 3, bodyWidth, height)
      let x = margin
      for (let i = 0; i < columns; i++) {
        if (i) pdf.line(x, y - 3, x, y - 3 + height)
        pdf.setFont('helvetica', header || i === 0 ? 'bold' : 'normal')
        pdf.setFontSize(9)
        pdf.setTextColor(...(header ? [255, 255, 255] : ink))
        lines[i].forEach((line, lineIndex) => pdf.text(line, x + 2.5, y + lineIndex * 4.6 + 1))
        x += widths[i]
      }
      y += height
    }
    ensure(20)
    drawRow(rows[0], true, 0)
    rows.slice(1).forEach((row, index) => {
      const lines = cellLines(row)
      if (y + Math.max(...lines.map(item => item.length)) * 4.6 + 7 > 277) {
        newPage()
        drawRow(rows[0], true, 0)
      }
      drawRow(row, false, index)
    })
    y += 4
  }

  const blocks = result.content.split(/\r?\n/).map(line => line.trim())
  const chapterTitle = blocks.find(line => /^#\s+/.test(line))?.replace(/^#\s+/, '')
  newPage()
  pdf.setFillColor(...pale)
  pdf.roundedRect(margin, y, 43, 7, 3, 3, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7.5)
  pdf.setTextColor(...purple)
  pdf.text('THE EASY-TO-GET-IT GUIDE', margin + 3, y + 4.7)
  y += 17
  rich(chapterTitle || result.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '),
    { size: 19, bold: true, color: ink, lineHeight: 9, gap: 2 })
  rich('Clear ideas. Real examples. Exam-ready takeaways.', { size: 9, color: muted, gap: 6 })

  for (let i = 0; i < blocks.length; i++) {
    const raw = blocks[i]
    if (!raw || /^[-*_]{3,}$/.test(raw) || (chapterTitle && raw === '# ' + chapterTitle)) continue
    if (/^\|/.test(raw)) {
      const rows = []
      while (i < blocks.length && /^\|/.test(blocks[i])) {
        const cells = blocks[i].replace(/^\||\|$/g, '').split('|').map(cell => cell.trim())
        if (!cells.every(cell => /^:?-{3,}:?$/.test(cell))) rows.push(cells)
        i++
      }
      i--
      table(rows)
      continue
    }
    const headingMatch = raw.match(/^(#{1,4})\s+(.+)/)
    if (headingMatch) { heading(headingMatch[2], headingMatch[1].length); continue }
    if (/^>\s*/.test(raw)) { callout(raw); continue }
    const bullet = raw.match(/^[-*]\s+(.+)/) || raw.match(/^\d+[.)]\s+(.+)/)
    if (bullet) {
      ensure(6)
      pdf.setFillColor(...purple)
      pdf.circle(margin + 2, y - 1.1, 0.6, 'F')
      rich(bullet[1], { indent: 5, lineHeight: 5, gap: 1.5 })
      continue
    }
    const label = raw.match(/^\*\*(.+?)\*\*:?\s*(.*)$/)
    if (label) {
      rich('**' + label[1].replace(/:$/, '') + ':**' + (label[2] ? ' ' + label[2] : ''),
        { gap: label[2] ? 2.5 : 0.5 })
      continue
    }
    rich(raw)
  }

  for (let i = 1; i <= page; i++) {
    pdf.setPage(i)
    pdf.setDrawColor(231, 222, 244)
    pdf.line(margin, 282, pageWidth - margin, 282)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7.5)
    pdf.setTextColor(...muted)
    pdf.text('Made to make it click - notely.', margin, 288)
    pdf.text(`${i} / ${page}`, pageWidth - margin, 288, { align: 'right' })
  }
  return pdf
}

export async function downloadStudyPdf(result) {
  const pdf = await buildStudyPdf(result)
  const name = result.name.replace(/\.[^.]+$/, '').replace(/[<>:"/\\|?*]/g, '_')
  pdf.save(`${name}-notely-study-notes.pdf`)
}

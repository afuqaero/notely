// Keep PDF creation in the browser so the original study files stay on the device.
const purple = [105, 70, 179]
const ink = [49, 39, 67]
const muted = [101, 90, 117]

function printable(value) {
  return value.replace(/\*\*|__|`/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-').replace(/\u2022/g, '')
    .replace(/[^\x20-\x7e\u00a0-\u00ff\n]/g, '')
}

export async function buildStudyPdf(result) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const width = 210
  const margin = 19
  const bodyWidth = width - margin * 2
  let y = 0
  let page = 0

  function newPage() {
    if (page) pdf.addPage()
    page++
    pdf.setFillColor(250, 248, 254)
    pdf.rect(0, 0, width, 297, 'F')
    pdf.setFillColor(...purple)
    pdf.rect(0, 0, width, 5, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(...purple)
    pdf.text('notely.', margin, 18)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(...muted)
    pdf.text('YOUR STUDY EDITION', width - margin, 18, { align: 'right' })
    pdf.setDrawColor(231, 222, 244)
    pdf.line(margin, 22, width - margin, 22)
    y = 31
  }

  function ensure(height) {
    if (y + height > 273) newPage()
  }

  function write(text, { size = 10.5, color = ink, bold = false, indent = 0, gap = 4, lineHeight = 5.8 } = {}) {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal')
    pdf.setFontSize(size)
    pdf.setTextColor(...color)
    const lines = pdf.splitTextToSize(printable(text), bodyWidth - indent)
    ensure(Math.min(lines.length, 2) * lineHeight + gap)
    for (const line of lines) {
      ensure(lineHeight)
      pdf.text(line, margin + indent, y)
      y += lineHeight
    }
    y += gap
  }

  const blocks = result.content.split(/\n\s*\n/).flatMap(block => {
    const lines = block.split(/\r?\n/)
    return lines.map(line => line.trim()).filter(Boolean)
  })
  const chapterTitle = blocks[0]?.match(/^#\s+(.+)/)?.[1]

  newPage()
  pdf.setFillColor(237, 229, 250)
  pdf.roundedRect(margin, y, 50, 8, 4, 4, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor(...purple)
  pdf.text('THE EASY-TO-GET-IT GUIDE', margin + 4, y + 5.3)
  y += 18
  write(chapterTitle || result.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '), { size: 22, bold: true, color: ink, lineHeight: 10, gap: 3 })
  write('Simple explanations. Real examples. Exam-ready ideas.', { size: 10, color: muted, gap: 10 })

  for (const raw of chapterTitle ? blocks.slice(1) : blocks) {
    if (/^[-*_]{3,}$/.test(raw)) continue
    const heading = raw.match(/^(#{1,4})\s+(.+)/)
    if (heading) {
      const level = heading[1].length
      const size = level <= 2 ? 15 : level === 3 ? 12.5 : 11
      ensure(19)
      y += level <= 2 ? 8 : 2
      if (level <= 2) {
        pdf.setDrawColor(...purple)
        pdf.setLineWidth(0.7)
        pdf.line(margin, y - 6, margin + 13, y - 6)
      }
      write(heading[2], { size, bold: true, color: purple, lineHeight: size * 0.5, gap: 5 })
      continue
    }
    const bullet = raw.match(/^[-*]\s+(.+)/)
    if (bullet) {
      ensure(7)
      pdf.setFillColor(...purple)
      pdf.circle(margin + 2, y - 1, 0.8, 'F')
      write(bullet[1], { indent: 6, gap: 2 })
      continue
    }
    const label = raw.match(/^\*\*(.+?)\*\*:?\s*(.*)$/)
    if (label) {
      write(label[1].replace(/:$/, ''), { size: 10, bold: true, color: purple, gap: 1, lineHeight: 5 })
      if (label[2]) write(label[2])
      continue
    }
    write(raw)
  }

  for (let i = 1; i <= page; i++) {
    pdf.setPage(i)
    pdf.setDrawColor(231, 222, 244)
    pdf.line(margin, 280, width - margin, 280)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(...muted)
    pdf.text('made to make it click    notely.', margin, 286)
    pdf.text(`${i} / ${page}`, width - margin, 286, { align: 'right' })
  }
  return pdf
}

export async function downloadStudyPdf(result) {
  const pdf = await buildStudyPdf(result)
  const name = result.name.replace(/\.[^.]+$/, '').replace(/[<>:"/\\|?*]/g, '_')
  pdf.save(`${name}-notely-study-notes.pdf`)
}

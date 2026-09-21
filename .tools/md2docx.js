/**
 * 산출물 마크다운 → Word(.docx) 변환기
 *
 * pandoc / LibreOffice 가 없는 환경이라 docx(npm) 으로 직접 생성한다.
 * 지원: 제목(#~####), 문단, 표, 코드블록, 목록, 인용, 구분선,
 *       **굵게**, `코드`, [링크](url)
 */
const fs = require('fs')
const path = require('path')
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  TableOfContents, PageBreak, PageOrientation, Header, Footer,
  PageNumber, LevelFormat, convertInchesToTwip,
} = require('docx')

const FONT = '맑은 고딕'
const MONO = 'D2Coding'
const BODY_W = 9360 // 본문 폭(DXA) — A4 세로, 좌우 여백 1인치 기준

/* ---------------- 인라인 파서 ---------------- */
function inline(text, opts = {}) {
  const runs = []
  // **굵게** · `코드` · [텍스트](링크)
  const re = /(\*\*[^*]+\*\*)|(`[^`]+`)|(\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) runs.push(plain(text.slice(last, m.index), opts))
    const tok = m[0]
    if (tok.startsWith('**')) {
      runs.push(new TextRun({ ...opts, text: tok.slice(2, -2), bold: true, font: FONT }))
    } else if (tok.startsWith('`')) {
      runs.push(new TextRun({ ...opts, text: tok.slice(1, -1), font: MONO, color: '1B64DA' }))
    } else {
      const label = tok.slice(1, tok.indexOf(']'))
      runs.push(new TextRun({ ...opts, text: label, color: '1B64DA', underline: {} , font: FONT }))
    }
    last = m.index + tok.length
  }
  if (last < text.length) runs.push(plain(text.slice(last), opts))
  return runs.length ? runs : [plain('', opts)]
}
const plain = (t, opts = {}) => new TextRun({ ...opts, text: t, font: FONT })

/* ---------------- 표 ---------------- */
function buildTable(rows) {
  const cols = Math.max(...rows.map((r) => r.length))
  const w = Math.floor(BODY_W / cols)
  const widths = Array(cols).fill(w)
  widths[cols - 1] = BODY_W - w * (cols - 1)

  const border = { style: BorderStyle.SINGLE, size: 2, color: 'D1D6DB' }
  const borders = { top: border, bottom: border, left: border, right: border }

  return new Table({
    columnWidths: widths,
    width: { size: BODY_W, type: WidthType.DXA },
    rows: rows.map((cells, ri) =>
      new TableRow({
        tableHeader: ri === 0,
        children: Array.from({ length: cols }, (_, ci) =>
          new TableCell({
            width: { size: widths[ci], type: WidthType.DXA },
            borders,
            shading: ri === 0 ? { type: ShadingType.CLEAR, fill: 'F2F4F6' } : undefined,
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 0 },
                children: inline(cells[ci] ?? '', { size: 18, bold: ri === 0 }),
              }),
            ],
          }),
        ),
      }),
    ),
  })
}

/* ---------------- 마크다운 → docx 요소 ---------------- */
function convert(md, { topLevelOffset = 0 } = {}) {
  const out = []
  const lines = md.split(/\r?\n/)
  let i = 0

  const HEADINGS = [
    HeadingLevel.HEADING_1, HeadingLevel.HEADING_2,
    HeadingLevel.HEADING_3, HeadingLevel.HEADING_4,
    HeadingLevel.HEADING_5, HeadingLevel.HEADING_6,
  ]

  while (i < lines.length) {
    const line = lines[i]

    // 코드블록
    if (/^```/.test(line)) {
      i++
      const buf = []
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++])
      i++
      buf.forEach((t, k) =>
        out.push(new Paragraph({
          spacing: { before: k === 0 ? 100 : 0, after: k === buf.length - 1 ? 140 : 0 },
          shading: { type: ShadingType.CLEAR, fill: 'F7F8FA' },
          children: [new TextRun({ text: t || ' ', font: MONO, size: 17, color: '333D4B' })],
        })),
      )
      continue
    }

    // 표
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const rows = []
      const cut = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
      rows.push(cut(lines[i])); i += 2
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(cut(lines[i++]))
      out.push(buildTable(rows))
      out.push(new Paragraph({ spacing: { after: 160 }, children: [] }))
      continue
    }

    // 제목
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      const lvl = Math.min(6, h[1].length + topLevelOffset)
      out.push(new Paragraph({
        heading: HEADINGS[lvl - 1],
        spacing: { before: lvl <= 2 ? 300 : 220, after: 120 },
        children: inline(h[2]),
      }))
      i++
      continue
    }

    // 구분선
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      out.push(new Paragraph({
        spacing: { before: 120, after: 120 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E5E8EB' } },
        children: [],
      }))
      i++
      continue
    }

    // 인용
    if (/^\s*>\s?/.test(line)) {
      const buf = []
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''))
      out.push(new Paragraph({
        spacing: { before: 100, after: 140 },
        indent: { left: 300 },
        border: { left: { style: BorderStyle.SINGLE, size: 12, color: '3182F6', space: 12 } },
        children: inline(buf.join(' '), { color: '4E5968', size: 19 }),
      }))
      continue
    }

    // 목록
    const li = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/)
    if (li) {
      const depth = Math.min(2, Math.floor(li[1].length / 2))
      const ordered = /\d/.test(li[2])
      out.push(new Paragraph({
        numbering: { reference: ordered ? 'num-ol' : 'num-ul', level: depth },
        spacing: { before: 20, after: 20 },
        children: inline(li[3], { size: 20 }),
      }))
      i++
      continue
    }

    // 빈 줄
    if (!line.trim()) { i++; continue }

    // 문단
    out.push(new Paragraph({
      spacing: { before: 60, after: 120, line: 300 },
      children: inline(line, { size: 20 }),
    }))
    i++
  }
  return out
}

/* ---------------- 문서 공통 설정 ---------------- */
const numbering = {
  config: [
    {
      reference: 'num-ul',
      levels: [0, 1, 2].map((l) => ({
        level: l, format: LevelFormat.BULLET, text: ['•', '–', '·'][l],
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: convertInchesToTwip(0.25 * (l + 1)), hanging: 200 } } },
      })),
    },
    {
      reference: 'num-ol',
      levels: [0, 1, 2].map((l) => ({
        level: l, format: LevelFormat.DECIMAL, text: `%${l + 1}.`,
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: convertInchesToTwip(0.25 * (l + 1)), hanging: 220 } } },
      })),
    },
  ],
}

const styles = {
  default: {
    document: { run: { font: FONT, size: 20 }, paragraph: { spacing: { line: 300 } } },
    heading1: { run: { font: FONT, size: 32, bold: true, color: '191F28' }, paragraph: { spacing: { before: 320, after: 140 } } },
    heading2: { run: { font: FONT, size: 26, bold: true, color: '191F28' }, paragraph: { spacing: { before: 280, after: 120 } } },
    heading3: { run: { font: FONT, size: 22, bold: true, color: '333D4B' }, paragraph: { spacing: { before: 220, after: 100 } } },
    heading4: { run: { font: FONT, size: 20, bold: true, color: '4E5968' }, paragraph: { spacing: { before: 180, after: 80 } } },
    heading5: { run: { font: FONT, size: 19, bold: true, color: '4E5968' } },
    heading6: { run: { font: FONT, size: 19, bold: true, color: '6B7684' } },
  },
}

const sectionProps = (title) => ({
  page: {
    size: { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT }, // A4
    margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
  },
  headers: {
    default: new Header({
      children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after: 0 },
        children: [new TextRun({ text: title, font: FONT, size: 16, color: '8B95A1' })],
      })],
    }),
  },
  footers: {
    default: new Footer({
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: '8B95A1' })],
      })],
    }),
  },
})

/* ---------------- 실행 ---------------- */
const SRC = process.argv[2]
const OUT = process.argv[3]
const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.md')).sort()

const TITLE = '미세먼지 현황·통계·이력 분석 앱'
const SUBTITLE = '공공데이터 Open API 활용 과제 산출물'

/* --- 1) 통합본 --- */
const children = [
  new Paragraph({ spacing: { before: 2400, after: 0 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: SUBTITLE, font: FONT, size: 22, color: '6B7684' })] }),
  new Paragraph({ spacing: { before: 200, after: 200 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: TITLE, font: FONT, size: 44, bold: true, color: '191F28' })] }),
  new Paragraph({ spacing: { after: 1200 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'React 19 · TypeScript · 에어코리아 오픈 API', font: FONT, size: 20, color: '8B95A1' })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
    children: [new TextRun({ text: '작성일  2026-09-21', font: FONT, size: 20 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
    children: [new TextRun({ text: `문서 ${files.length}종`, font: FONT, size: 20 })] }),
  new Paragraph({ children: [new PageBreak()] }),

  new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { after: 200 },
    children: [new TextRun({ text: '목차', font: FONT, size: 32, bold: true })] }),
  new TableOfContents('목차', { hyperlink: true, headingStyleRange: '1-3' }),
  new Paragraph({ children: [new PageBreak()] }),
]

files.forEach((f, idx) => {
  const md = fs.readFileSync(path.join(SRC, f), 'utf8')
  children.push(...convert(md))
  if (idx < files.length - 1) children.push(new Paragraph({ children: [new PageBreak()] }))
})

const doc = new Document({
  creator: '미세먼지 인사이트 개발',
  title: TITLE,
  description: SUBTITLE,
  styles,
  numbering,
  features: { updateFields: true }, // 열 때 목차 갱신
  sections: [{ properties: sectionProps(TITLE), children }],
})

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf)
  console.log(`통합본 생성: ${path.basename(OUT)}  (${(buf.length / 1024).toFixed(0)} KB, ${files.length}개 문서)`)
})

/* --- 2) 개별 문서 --- */
const singleDir = path.join(path.dirname(OUT), '개별문서')
fs.mkdirSync(singleDir, { recursive: true })

files.forEach((f) => {
  const md = fs.readFileSync(path.join(SRC, f), 'utf8')
  const name = f.replace(/\.md$/, '')
  const d = new Document({
    creator: '미세먼지 인사이트 개발',
    title: name,
    styles,
    numbering,
    sections: [{ properties: sectionProps(name), children: convert(md) }],
  })
  Packer.toBuffer(d).then((buf) => {
    fs.writeFileSync(path.join(singleDir, `${name}.docx`), buf)
    console.log(`  개별: ${name}.docx (${(buf.length / 1024).toFixed(0)} KB)`)
  })
})

/** 조회 결과 내보내기 — CSV / JSON */

/**
 * Excel 은 UTF-8 CSV 를 BOM 없이 열면 한글이 깨진다.
 * 국내 실무에서 바로 쓰이도록 BOM(﻿)을 항상 붙인다.
 */
export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const esc = (v: string | number | null) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const body = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n')
  return `﻿${body}`
}

export function download(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // 즉시 해제하면 일부 브라우저에서 다운로드가 취소되므로 한 틱 뒤에 정리한다.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number | null)[][]): void {
  download(filename, toCsv(headers, rows), 'text/csv')
}

export function downloadJson(filename: string, data: unknown): void {
  download(filename, JSON.stringify(data, null, 2), 'application/json')
}

/** 파일명에 쓸 수 없는 문자를 제거 */
export function safeFilename(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '_')
}

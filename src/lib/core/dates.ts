/** YYYY-MM-DD 형식의 로컬 날짜 문자열 */
export type DateStr = string

const PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function parts(s: DateStr): [number, number, number] {
  const m = PATTERN.exec(s)
  if (!m) throw new Error(`잘못된 날짜 형식: ${s}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

export function toDateStr(d: Date): DateStr {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseDateStr(s: DateStr): Date {
  const [y, m, d] = parts(s)
  return new Date(y, m - 1, d)
}

export function monthKey(date: DateStr): string {
  return date.slice(0, 7)
}

export function addDays(date: DateStr, n: number): DateStr {
  const [y, m, d] = parts(date)
  return toDateStr(new Date(y, m - 1, d + n))
}

export function daysBetween(from: DateStr, to: DateStr): number {
  const [y1, m1, d1] = parts(from)
  const [y2, m2, d2] = parts(to)
  // UTC로 계산해 서머타임 전환의 영향을 받지 않게 한다
  const a = Date.UTC(y1, m1 - 1, d1)
  const b = Date.UTC(y2, m2 - 1, d2)
  return Math.round((b - a) / 86_400_000)
}

export function isValidDateStr(s: string): boolean {
  const m = PATTERN.exec(s)
  if (!m) return false
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const dt = new Date(y, mo - 1, d)
  // 2026-02-30 같은 값은 Date가 조용히 넘겨버리므로 되돌려 확인한다
  return (
    dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d
  )
}

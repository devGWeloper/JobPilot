import { describe, it, expect } from 'vitest'
import {
  toDateStr,
  parseDateStr,
  monthKey,
  addDays,
  daysBetween,
  isValidDateStr,
} from './dates'

describe('toDateStr', () => {
  it('로컬 날짜를 YYYY-MM-DD로 만든다', () => {
    expect(toDateStr(new Date(2026, 7, 3))).toBe('2026-08-03')
  })

  it('한 자리 월과 일을 0으로 채운다', () => {
    expect(toDateStr(new Date(2026, 0, 9))).toBe('2026-01-09')
  })
})

describe('parseDateStr', () => {
  it('로컬 자정 Date로 되돌린다', () => {
    const d = parseDateStr('2026-08-03')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(7)
    expect(d.getDate()).toBe(3)
    expect(d.getHours()).toBe(0)
  })

  it('toDateStr와 왕복해도 값이 유지된다', () => {
    expect(toDateStr(parseDateStr('2026-12-31'))).toBe('2026-12-31')
  })
})

describe('monthKey', () => {
  it('연-월만 남긴다', () => {
    expect(monthKey('2026-08-03')).toBe('2026-08')
  })
})

describe('addDays', () => {
  it('며칠 뒤를 구한다', () => {
    expect(addDays('2026-08-03', 1)).toBe('2026-08-04')
  })

  it('월 경계를 넘는다', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
  })

  it('연 경계를 넘는다', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('음수로 과거를 구한다', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('윤년 2월 29일을 처리한다', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })
})

describe('daysBetween', () => {
  it('같은 날은 0이다', () => {
    expect(daysBetween('2026-08-03', '2026-08-03')).toBe(0)
  })

  it('뒤 날짜가 크면 양수다', () => {
    expect(daysBetween('2026-08-01', '2026-08-04')).toBe(3)
  })

  it('뒤 날짜가 작으면 음수다', () => {
    expect(daysBetween('2026-08-04', '2026-08-01')).toBe(-3)
  })

  it('월을 넘어도 정확하다', () => {
    expect(daysBetween('2026-07-30', '2026-08-02')).toBe(3)
  })

  it('서머타임 전환 구간에서도 정수 일수를 준다', () => {
    // UTC 기준 계산이므로 지역 서머타임에 영향받지 않는다
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2)
  })
})

describe('isValidDateStr', () => {
  it('올바른 형식을 받아들인다', () => {
    expect(isValidDateStr('2026-08-03')).toBe(true)
  })

  it('형식이 틀리면 거부한다', () => {
    expect(isValidDateStr('2026-8-3')).toBe(false)
    expect(isValidDateStr('20260803')).toBe(false)
    expect(isValidDateStr('')).toBe(false)
  })

  it('존재하지 않는 날짜를 거부한다', () => {
    expect(isValidDateStr('2026-02-30')).toBe(false)
    expect(isValidDateStr('2026-13-01')).toBe(false)
  })
})

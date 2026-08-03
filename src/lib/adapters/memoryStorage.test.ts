import { describe, it, expect } from 'vitest'
import { MemoryStorage } from './memoryStorage'
import { FixedClock } from './fixedClock'
import { DEFAULT_CONFIG, DEFAULT_WORK_SETTINGS } from '../types'

describe('MemoryStorage', () => {
  it('없는 키는 null을 준다', async () => {
    const s = new MemoryStorage()
    expect(await s.load('config')).toBeNull()
  })

  it('저장한 값을 되읽는다', async () => {
    const s = new MemoryStorage()
    await s.save('config', { a: 1 })
    expect(await s.load('config')).toEqual({ a: 1 })
  })

  it('저장된 값을 복사해 보관한다', async () => {
    const s = new MemoryStorage()
    const value = { list: [1, 2] }
    await s.save('k', value)
    value.list.push(3)
    expect(await s.load<{ list: number[] }>('k')).toEqual({ list: [1, 2] })
  })

  it('읽어온 값을 바꿔도 내부 상태가 안 바뀐다', async () => {
    const s = new MemoryStorage()
    await s.save('k', { list: [1] })
    const first = await s.load<{ list: number[] }>('k')
    first!.list.push(9)
    expect(await s.load<{ list: number[] }>('k')).toEqual({ list: [1] })
  })

  it('초기 데이터를 주입할 수 있다', async () => {
    const s = new MemoryStorage({ config: { hello: 'world' } })
    expect(await s.load('config')).toEqual({ hello: 'world' })
  })

  it('snapshot으로 전체 내용을 확인할 수 있다', async () => {
    const s = new MemoryStorage()
    await s.save('a', 1)
    await s.save('b', 2)
    expect(s.snapshot()).toEqual({ a: 1, b: 2 })
  })
})

describe('FixedClock', () => {
  it('지정한 시각을 반환한다', () => {
    const c = new FixedClock(new Date(2026, 7, 3, 10, 0))
    expect(c.now().getDate()).toBe(3)
  })

  it('시각을 바꿀 수 있다', () => {
    const c = new FixedClock(new Date(2026, 7, 3))
    c.set(new Date(2026, 7, 5))
    expect(c.now().getDate()).toBe(5)
  })

  it('반환한 Date를 바꿔도 내부 시각이 안 바뀐다', () => {
    const c = new FixedClock(new Date(2026, 7, 3))
    c.now().setDate(20)
    expect(c.now().getDate()).toBe(3)
  })

  it('생성자에 넘긴 Date를 바깥에서 바꿔도 내부 시각이 안 바뀐다', () => {
    const d = new Date(2026, 7, 3)
    const c = new FixedClock(d)
    d.setDate(20)
    expect(c.now().getDate()).toBe(3)
  })

  it('set에 넘긴 Date를 바깥에서 바꿔도 내부 시각이 안 바뀐다', () => {
    const c = new FixedClock(new Date(2026, 7, 3))
    const d = new Date(2026, 7, 5)
    c.set(d)
    d.setDate(20)
    expect(c.now().getDate()).toBe(5)
  })
})

describe('기본 설정 상수', () => {
  it('DEFAULT_CONFIG.work가 DEFAULT_WORK_SETTINGS와 객체를 공유하지 않는다', () => {
    expect(DEFAULT_CONFIG.work).not.toBe(DEFAULT_WORK_SETTINGS)
  })

  it('DEFAULT_CONFIG.work의 배열을 바꿔도 DEFAULT_WORK_SETTINGS가 안 바뀐다', () => {
    DEFAULT_CONFIG.work.workdays.push(6)
    try {
      expect(DEFAULT_WORK_SETTINGS.workdays).toEqual([1, 2, 3, 4, 5])
    } finally {
      DEFAULT_CONFIG.work.workdays = [1, 2, 3, 4, 5]
    }
  })
})

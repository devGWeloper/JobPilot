import { describe, it, expect } from 'vitest'
import type { Task } from '../types'
import {
  createTask,
  startTask,
  completeTask,
  dropTask,
  reopenTask,
  carryTask,
  isOpen,
  isOverdue,
  overdueDays,
  sortForToday,
} from './task'

const AT = new Date(2026, 7, 3, 10, 0, 0)

function make(overrides: Partial<Task> = {}): Task {
  return {
    ...createTask({ title: '테스트', plannedDate: '2026-08-03' }, AT),
    ...overrides,
  }
}

describe('createTask', () => {
  it('planned 상태로 시작한다', () => {
    const t = createTask({ title: '보고서 작성', plannedDate: '2026-08-03' }, AT)
    expect(t.status).toBe('planned')
  })

  it('carryCount는 0에서 시작한다', () => {
    expect(createTask({ title: 'x', plannedDate: '2026-08-03' }, AT).carryCount).toBe(0)
  })

  it('originalDate는 아직 비어 있다', () => {
    expect(
      createTask({ title: 'x', plannedDate: '2026-08-03' }, AT).originalDate,
    ).toBeUndefined()
  })

  it('우선순위 기본값은 2다', () => {
    expect(createTask({ title: 'x', plannedDate: '2026-08-03' }, AT).priority).toBe(2)
  })

  it('createdAt과 updatedAt에 주어진 시각을 쓴다', () => {
    const t = createTask({ title: 'x', plannedDate: '2026-08-03' }, AT)
    expect(t.createdAt).toBe(AT.toISOString())
    expect(t.updatedAt).toBe(AT.toISOString())
  })

  it('고유한 id를 만든다', () => {
    const a = createTask({ title: 'x', plannedDate: '2026-08-03' }, AT)
    const b = createTask({ title: 'x', plannedDate: '2026-08-03' }, AT)
    expect(a.id).not.toBe(b.id)
  })

  it('제목이 비면 거부한다', () => {
    expect(() => createTask({ title: '   ', plannedDate: '2026-08-03' }, AT)).toThrow()
  })

  it('제목의 앞뒤 공백을 없앤다', () => {
    expect(createTask({ title: '  청소  ', plannedDate: '2026-08-03' }, AT).title).toBe('청소')
  })

  it('잘못된 날짜를 거부한다', () => {
    expect(() => createTask({ title: 'x', plannedDate: '2026-8-3' }, AT)).toThrow()
  })
})

describe('startTask', () => {
  it('planned를 doing으로 바꾼다', () => {
    expect(startTask(make(), AT).status).toBe('doing')
  })

  it('done인 업무는 시작할 수 없다', () => {
    const done = completeTask(make(), AT)
    expect(() => startTask(done, AT)).toThrow()
  })
})

describe('completeTask', () => {
  it('done으로 바꾸고 completedAt을 남긴다', () => {
    const t = completeTask(make(), AT)
    expect(t.status).toBe('done')
    expect(t.completedAt).toBe(AT.toISOString())
  })

  it('실적 메모를 남긴다', () => {
    expect(completeTask(make(), AT, '초안까지 완료').actualNote).toBe('초안까지 완료')
  })

  it('실제 소요 시간을 남긴다', () => {
    expect(completeTask(make(), AT, undefined, 90).actualMin).toBe(90)
  })

  it('doing 상태에서도 완료할 수 있다', () => {
    expect(completeTask(startTask(make(), AT), AT).status).toBe('done')
  })

  it('이미 done이면 거부한다', () => {
    const done = completeTask(make(), AT)
    expect(() => completeTask(done, AT)).toThrow()
  })

  it('원본 객체를 바꾸지 않는다', () => {
    const t = make()
    completeTask(t, AT)
    expect(t.status).toBe('planned')
  })
})

describe('dropTask', () => {
  it('dropped로 바꾼다', () => {
    expect(dropTask(make(), AT).status).toBe('dropped')
  })

  it('포기 사유를 실적 메모에 남긴다', () => {
    expect(dropTask(make(), AT, '요구사항 취소됨').actualNote).toBe('요구사항 취소됨')
  })

  it('이미 dropped면 거부한다', () => {
    expect(() => dropTask(dropTask(make(), AT), AT)).toThrow()
  })
})

describe('reopenTask', () => {
  it('done을 planned로 되돌린다', () => {
    const t = reopenTask(completeTask(make(), AT), AT)
    expect(t.status).toBe('planned')
  })

  it('completedAt을 지운다', () => {
    expect(reopenTask(completeTask(make(), AT), AT).completedAt).toBeUndefined()
  })

  it('실적 메모는 남겨둔다', () => {
    const done = completeTask(make(), AT, '절반 진행')
    expect(reopenTask(done, AT).actualNote).toBe('절반 진행')
  })

  it('이미 열려 있으면 거부한다', () => {
    expect(() => reopenTask(make(), AT)).toThrow()
  })
})

describe('carryTask', () => {
  it('계획 날짜를 옮긴다', () => {
    expect(carryTask(make(), '2026-08-04', AT).plannedDate).toBe('2026-08-04')
  })

  it('carryCount를 1 올린다', () => {
    expect(carryTask(make(), '2026-08-04', AT).carryCount).toBe(1)
  })

  it('첫 이월에서 originalDate를 원래 날짜로 채운다', () => {
    expect(carryTask(make(), '2026-08-04', AT).originalDate).toBe('2026-08-03')
  })

  it('두 번째 이월에서도 originalDate는 최초 날짜를 유지한다', () => {
    const once = carryTask(make(), '2026-08-04', AT)
    const twice = carryTask(once, '2026-08-05', AT)
    expect(twice.originalDate).toBe('2026-08-03')
    expect(twice.carryCount).toBe(2)
  })

  it('doing 상태였으면 planned로 되돌린다', () => {
    expect(carryTask(startTask(make(), AT), '2026-08-04', AT).status).toBe('planned')
  })

  it('done인 업무는 이월할 수 없다', () => {
    expect(() => carryTask(completeTask(make(), AT), '2026-08-04', AT)).toThrow()
  })

  it('dropped인 업무는 이월할 수 없다', () => {
    expect(() => carryTask(dropTask(make(), AT), '2026-08-04', AT)).toThrow()
  })

  it('과거로는 이월할 수 없다', () => {
    expect(() => carryTask(make(), '2026-08-02', AT)).toThrow()
  })

  it('같은 날짜로는 이월할 수 없다', () => {
    expect(() => carryTask(make(), '2026-08-03', AT)).toThrow()
  })
})

describe('isOpen', () => {
  it('planned와 doing은 열려 있다', () => {
    expect(isOpen(make())).toBe(true)
    expect(isOpen(startTask(make(), AT))).toBe(true)
  })

  it('done과 dropped는 닫혀 있다', () => {
    expect(isOpen(completeTask(make(), AT))).toBe(false)
    expect(isOpen(dropTask(make(), AT))).toBe(false)
  })
})

describe('isOverdue', () => {
  it('계획일이 오늘보다 과거면 밀린 것이다', () => {
    expect(isOverdue(make({ plannedDate: '2026-08-01' }), '2026-08-03')).toBe(true)
  })

  it('오늘 계획된 것은 아직 안 밀렸다', () => {
    expect(isOverdue(make({ plannedDate: '2026-08-03' }), '2026-08-03')).toBe(false)
  })

  it('완료된 업무는 밀린 것이 아니다', () => {
    const done = completeTask(make({ plannedDate: '2026-08-01' }), AT)
    expect(isOverdue(done, '2026-08-03')).toBe(false)
  })
})

describe('overdueDays', () => {
  it('한 번도 이월 안 된 업무는 계획일 기준으로 센다', () => {
    expect(overdueDays(make({ plannedDate: '2026-08-01' }), '2026-08-03')).toBe(2)
  })

  it('이월된 업무는 최초 계획일 기준으로 센다', () => {
    const carried = carryTask(make({ plannedDate: '2026-08-01' }), '2026-08-03', AT)
    expect(overdueDays(carried, '2026-08-04')).toBe(3)
  })

  it('아직 안 밀렸으면 0이다', () => {
    expect(overdueDays(make({ plannedDate: '2026-08-05' }), '2026-08-03')).toBe(0)
  })
})

describe('sortForToday', () => {
  it('밀린 업무를 맨 앞에 둔다', () => {
    const today = make({ id: 'a', plannedDate: '2026-08-03' })
    const late = make({ id: 'b', plannedDate: '2026-08-01' })
    expect(sortForToday([today, late], '2026-08-03').map((t) => t.id)).toEqual(['b', 'a'])
  })

  it('밀린 것끼리는 오래된 순이다', () => {
    const a = make({ id: 'a', plannedDate: '2026-08-02' })
    const b = make({ id: 'b', plannedDate: '2026-07-30' })
    expect(sortForToday([a, b], '2026-08-03').map((t) => t.id)).toEqual(['b', 'a'])
  })

  it('완료된 업무를 맨 뒤로 보낸다', () => {
    const open = make({ id: 'a' })
    const done = completeTask(make({ id: 'b' }), AT)
    expect(sortForToday([done, open], '2026-08-03').map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('같은 조건이면 우선순위가 높은 것이 앞이다', () => {
    const low = make({ id: 'a', priority: 3 })
    const high = make({ id: 'b', priority: 1 })
    expect(sortForToday([low, high], '2026-08-03').map((t) => t.id)).toEqual(['b', 'a'])
  })

  it('원본 배열을 바꾸지 않는다', () => {
    const list = [make({ id: 'a', priority: 3 }), make({ id: 'b', priority: 1 })]
    sortForToday(list, '2026-08-03')
    expect(list.map((t) => t.id)).toEqual(['a', 'b'])
  })
})

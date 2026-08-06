import { describe, it, expect } from 'vitest'
import type { Task } from '../types'
import { createTask, completeTask } from './task'
import { pendingForWrapUp, defaultDecisions, applyWrapUp } from './daily'

const AT = new Date(2026, 7, 3, 18, 0, 0)

function make(id: string, plannedDate: string, overrides: Partial<Task> = {}): Task {
  return {
    ...createTask({ title: id, plannedDate }, AT),
    id,
    ...overrides,
  }
}

describe('pendingForWrapUp', () => {
  it('오늘 계획된 열린 업무를 포함한다', () => {
    const t = make('a', '2026-08-03')
    expect(pendingForWrapUp([t], '2026-08-03').map((x) => x.id)).toEqual(['a'])
  })

  it('과거에 계획된 열린 업무도 포함한다', () => {
    const t = make('a', '2026-08-01')
    expect(pendingForWrapUp([t], '2026-08-03').map((x) => x.id)).toEqual(['a'])
  })

  it('완료된 업무는 제외한다', () => {
    const t = completeTask(make('a', '2026-08-03'), AT)
    expect(pendingForWrapUp([t], '2026-08-03')).toEqual([])
  })

  it('미래에 계획된 업무는 제외한다', () => {
    const t = make('a', '2026-08-05')
    expect(pendingForWrapUp([t], '2026-08-03')).toEqual([])
  })
})

describe('defaultDecisions', () => {
  it('모든 대상을 내일로 이월하는 안을 준다', () => {
    const tasks = [make('a', '2026-08-03'), make('b', '2026-08-01')]
    const decisions = defaultDecisions(tasks, '2026-08-03')
    expect(decisions).toEqual([
      { taskId: 'a', kind: 'carry', toDate: '2026-08-04' },
      { taskId: 'b', kind: 'carry', toDate: '2026-08-04' },
    ])
  })

  it('마감 대상이 없으면 빈 배열이다', () => {
    expect(defaultDecisions([], '2026-08-03')).toEqual([])
  })
})

describe('applyWrapUp', () => {
  it('complete 결정을 적용한다', () => {
    const tasks = [make('a', '2026-08-03')]
    const out = applyWrapUp(tasks, [{ taskId: 'a', kind: 'complete', actualNote: '끝냄' }], AT)
    expect(out[0]!.status).toBe('done')
    expect(out[0]!.actualNote).toBe('끝냄')
  })

  it('carry 결정을 적용한다', () => {
    const tasks = [make('a', '2026-08-03')]
    const out = applyWrapUp(tasks, [{ taskId: 'a', kind: 'carry', toDate: '2026-08-04' }], AT)
    expect(out[0]!.plannedDate).toBe('2026-08-04')
    expect(out[0]!.carryCount).toBe(1)
  })

  it('drop 결정을 적용한다', () => {
    const tasks = [make('a', '2026-08-03')]
    const out = applyWrapUp(tasks, [{ taskId: 'a', kind: 'drop', reason: '취소됨' }], AT)
    expect(out[0]!.status).toBe('dropped')
    expect(out[0]!.actualNote).toBe('취소됨')
  })

  it('keep 결정은 아무것도 바꾸지 않는다', () => {
    // toBe여야 한다: TaskStore.wrapUp이 next !== prev 참조 비교로 "바뀐 달"을
    // 계산한다(applyWrapUp 문서 주석 참고). 값만 같은 복사본을 돌려줘도 이
    // toEqual은 통과해 그 회귀를 잡지 못한다.
    const tasks = [make('a', '2026-08-03')]
    const out = applyWrapUp(tasks, [{ taskId: 'a', kind: 'keep' }], AT)
    expect(out[0]).toBe(tasks[0])
  })

  it('결정이 없는 업무는 그대로 둔다', () => {
    // toBe인 이유는 위 'keep' 테스트와 같다.
    const tasks = [make('a', '2026-08-03'), make('b', '2026-08-03')]
    const out = applyWrapUp(tasks, [{ taskId: 'a', kind: 'complete' }], AT)
    expect(out[1]).toBe(tasks[1])
  })

  it('여러 결정을 한 번에 적용한다', () => {
    const tasks = [make('a', '2026-08-03'), make('b', '2026-08-03'), make('c', '2026-08-03')]
    const out = applyWrapUp(
      tasks,
      [
        { taskId: 'a', kind: 'complete' },
        { taskId: 'b', kind: 'carry', toDate: '2026-08-04' },
        { taskId: 'c', kind: 'drop' },
      ],
      AT,
    )
    expect(out.map((t) => t.status)).toEqual(['done', 'planned', 'dropped'])
  })

  it('원본 배열과 항목을 바꾸지 않는다', () => {
    const tasks = [make('a', '2026-08-03')]
    applyWrapUp(tasks, [{ taskId: 'a', kind: 'complete' }], AT)
    expect(tasks[0]!.status).toBe('planned')
  })

  it('없는 업무 id를 가리키면 거부한다', () => {
    expect(() => applyWrapUp([], [{ taskId: 'ghost', kind: 'keep' }], AT)).toThrow()
  })

  it('같은 업무에 결정이 두 번 오면 거부한다', () => {
    const tasks = [make('a', '2026-08-03')]
    expect(() =>
      applyWrapUp(
        tasks,
        [
          { taskId: 'a', kind: 'complete' },
          { taskId: 'a', kind: 'drop' },
        ],
        AT,
      ),
    ).toThrow()
  })
})

import type { Task } from '../types'
import type { DateStr } from './dates'
import { addDays } from './dates'
import { carryTask, completeTask, dropTask, isOpen } from './task'

export type WrapUpDecision =
  | { taskId: string; kind: 'complete'; actualNote?: string; actualMin?: number }
  | { taskId: string; kind: 'carry'; toDate: DateStr }
  | { taskId: string; kind: 'drop'; reason?: string }
  | { taskId: string; kind: 'keep' }

/** 하루 마감에서 정리해야 할 업무: 오늘까지 계획됐는데 아직 열려 있는 것 */
export function pendingForWrapUp(tasks: Task[], today: DateStr): Task[] {
  return tasks.filter((t) => isOpen(t) && t.plannedDate <= today)
}

/** 기본 제안: 전부 내일로 이월 */
export function defaultDecisions(tasks: Task[], today: DateStr): WrapUpDecision[] {
  const tomorrow = addDays(today, 1)
  return pendingForWrapUp(tasks, today).map((t) => ({
    taskId: t.id,
    kind: 'carry' as const,
    toDate: tomorrow,
  }))
}

/**
 * 결정에 따라 업무 목록을 새로 만든다. 원본 배열과 그 안의 항목은 바꾸지 않는다.
 *
 * 참조 동일성 계약: 'keep' 결정을 받은 업무와 아예 결정이 없는 업무는 입력과
 * "같은 객체 참조"로 돌려준다(값만 같은 복사본이 아니다). 이는 문서화되지
 * 않으면 깨지기 쉬운 계약이지만 실제로 소비되고 있다 — `TaskStore.wrapUp`이
 * `next !== prev` 참조 비교만으로 "이번 마감에서 실제로 바뀐 달이 어디인가"를
 * 계산해 그 달만 저장한다. 이 함수가 keep/무결정 분기에서 `{ ...task }`처럼
 * 얕은 복사본을 돌려주도록 바뀌면, 그 비교가 항상 참이 되어 매번 로드된
 * 모든 달을 다시 쓰게 된다 — 테스트는 `toEqual`로는 통과하고 `toBe`로만 잡힌다.
 */
export function applyWrapUp(
  tasks: Task[],
  decisions: WrapUpDecision[],
  at: Date,
): Task[] {
  const byId = new Map<string, WrapUpDecision>()
  for (const d of decisions) {
    if (byId.has(d.taskId)) {
      throw new Error(`한 업무에 결정이 두 번 지정되었습니다: ${d.taskId}`)
    }
    byId.set(d.taskId, d)
  }

  const known = new Set(tasks.map((t) => t.id))
  for (const id of byId.keys()) {
    if (!known.has(id)) {
      throw new Error(`존재하지 않는 업무입니다: ${id}`)
    }
  }

  return tasks.map((task) => {
    const d = byId.get(task.id)
    if (!d) return task
    switch (d.kind) {
      case 'complete':
        return completeTask(task, at, d.actualNote, d.actualMin)
      case 'carry':
        return carryTask(task, d.toDate, at)
      case 'drop':
        return dropTask(task, at, d.reason)
      case 'keep':
        return task
    }
  })
}

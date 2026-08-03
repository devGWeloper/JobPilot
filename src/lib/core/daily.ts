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

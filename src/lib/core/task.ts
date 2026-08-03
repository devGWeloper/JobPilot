import type { Task } from '../types'
import type { DateStr } from './dates'
import { daysBetween, isValidDateStr } from './dates'
import { newId } from './ids'

export type NewTaskInput = {
  title: string
  plannedDate: DateStr
  priority?: 1 | 2 | 3
  projectId?: string
  note?: string
  dueDate?: DateStr
  estimateMin?: number
}

export function createTask(input: NewTaskInput, at: Date): Task {
  const title = input.title.trim()
  if (title.length === 0) throw new Error('업무 제목이 비어 있습니다')
  if (!isValidDateStr(input.plannedDate)) {
    throw new Error(`잘못된 계획 날짜: ${input.plannedDate}`)
  }
  if (input.dueDate !== undefined && !isValidDateStr(input.dueDate)) {
    throw new Error(`잘못된 마감 날짜: ${input.dueDate}`)
  }

  const ts = at.toISOString()
  return {
    id: newId('task'),
    title,
    note: input.note,
    projectId: input.projectId,
    status: 'planned',
    priority: input.priority ?? 2,
    plannedDate: input.plannedDate,
    carryCount: 0,
    dueDate: input.dueDate,
    estimateMin: input.estimateMin,
    createdAt: ts,
    updatedAt: ts,
  }
}

export function isOpen(task: Task): boolean {
  return task.status === 'planned' || task.status === 'doing'
}

export function startTask(task: Task, at: Date): Task {
  if (!isOpen(task)) {
    throw new Error(`${task.status} 상태인 업무는 시작할 수 없습니다`)
  }
  return { ...task, status: 'doing', updatedAt: at.toISOString() }
}

export function completeTask(
  task: Task,
  at: Date,
  actualNote?: string,
  actualMin?: number,
): Task {
  if (!isOpen(task)) {
    throw new Error(`${task.status} 상태인 업무는 완료할 수 없습니다`)
  }
  return {
    ...task,
    status: 'done',
    completedAt: at.toISOString(),
    actualNote: actualNote ?? task.actualNote,
    actualMin: actualMin ?? task.actualMin,
    updatedAt: at.toISOString(),
  }
}

export function dropTask(task: Task, at: Date, reason?: string): Task {
  if (!isOpen(task)) {
    throw new Error(`${task.status} 상태인 업무는 포기할 수 없습니다`)
  }
  return {
    ...task,
    status: 'dropped',
    actualNote: reason ?? task.actualNote,
    updatedAt: at.toISOString(),
  }
}

export function reopenTask(task: Task, at: Date): Task {
  if (isOpen(task)) {
    throw new Error('이미 열려 있는 업무입니다')
  }
  const next = { ...task, status: 'planned' as const, updatedAt: at.toISOString() }
  delete next.completedAt
  return next
}

export function carryTask(task: Task, toDate: DateStr, at: Date): Task {
  if (!isOpen(task)) {
    throw new Error(`${task.status} 상태인 업무는 이월할 수 없습니다`)
  }
  if (!isValidDateStr(toDate)) {
    throw new Error(`잘못된 이월 날짜: ${toDate}`)
  }
  if (toDate <= task.plannedDate) {
    throw new Error('이월 대상 날짜는 현재 계획일보다 뒤여야 합니다')
  }
  return {
    ...task,
    status: 'planned',
    plannedDate: toDate,
    originalDate: task.originalDate ?? task.plannedDate,
    carryCount: task.carryCount + 1,
    updatedAt: at.toISOString(),
  }
}

export function isOverdue(task: Task, today: DateStr): boolean {
  return isOpen(task) && task.plannedDate < today
}

/**
 * 며칠째 밀리고 있는가.
 * 이월된 적이 있으면 최초 계획일을, 없으면 현재 계획일을 기준으로 센다.
 */
export function overdueDays(task: Task, today: DateStr): number {
  const base = task.originalDate ?? task.plannedDate
  const d = daysBetween(base, today)
  return d > 0 ? d : 0
}

/**
 * Today 화면 정렬 순서:
 * 1) 밀린 업무가 앞. 오래 밀린 것이 더 앞
 * 2) 열린 업무가 닫힌 업무보다 앞
 * 3) 우선순위가 높은(숫자가 작은) 것이 앞
 * 4) 생성이 이른 것이 앞
 */
export function sortForToday(tasks: Task[], today: DateStr): Task[] {
  return [...tasks].sort((a, b) => {
    const aOpen = isOpen(a)
    const bOpen = isOpen(b)
    if (aOpen !== bOpen) return aOpen ? -1 : 1

    if (aOpen && bOpen) {
      const aLate = isOverdue(a, today)
      const bLate = isOverdue(b, today)
      if (aLate !== bLate) return aLate ? -1 : 1
      if (aLate && bLate) {
        const diff = overdueDays(b, today) - overdueDays(a, today)
        if (diff !== 0) return diff
      }
    }

    if (a.priority !== b.priority) return a.priority - b.priority
    return a.createdAt.localeCompare(b.createdAt)
  })
}

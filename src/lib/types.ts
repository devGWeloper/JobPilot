import type { DateStr } from './core/dates'

export type TaskStatus = 'planned' | 'doing' | 'done' | 'dropped'

export type Task = {
  id: string
  title: string
  note?: string
  projectId?: string
  status: TaskStatus
  priority: 1 | 2 | 3
  /** 현재 계획된 날짜 */
  plannedDate: DateStr
  /** 최초로 계획했던 날짜. 한 번이라도 이월되면 채워진다 */
  originalDate?: DateStr
  /** 이월된 횟수 */
  carryCount: number
  dueDate?: DateStr
  estimateMin?: number
  /** 실적: 실제로 무엇을 했는가 */
  actualNote?: string
  actualMin?: number
  completedAt?: string
  templateId?: string
  createdAt: string
  updatedAt: string
}

export type Project = {
  id: string
  name: string
  /** hex 색상. 예: "#4f7cff" */
  color: string
  active: boolean
}

export type WorkSettings = {
  /** 0=일 … 6=토 */
  workdays: number[]
  dayStart: string
  dayEnd: string
  weekStartsOn: 0 | 1
  defaultReminders: number[]
  /** 이 일수 이상 밀리면 강조한다 */
  carryWarningDays: number
}

export type Config = {
  projects: Project[]
  work: WorkSettings
}

export const SCHEMA_VERSION = 1 as const

export type TaskFile = {
  schemaVersion: typeof SCHEMA_VERSION
  tasks: Task[]
}

export type ConfigFile = {
  schemaVersion: typeof SCHEMA_VERSION
  config: Config
}

export const DEFAULT_WORK_SETTINGS: WorkSettings = {
  workdays: [1, 2, 3, 4, 5],
  dayStart: '09:00',
  dayEnd: '18:00',
  weekStartsOn: 1,
  defaultReminders: [10],
  carryWarningDays: 3,
}

export const DEFAULT_CONFIG: Config = {
  projects: [],
  work: DEFAULT_WORK_SETTINGS,
}

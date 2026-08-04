import type { Storage } from '../ports/storage'
import type { Clock } from '../ports/clock'
import { SCHEMA_VERSION, type Task, type TaskFile } from '../types'
import { addDays, monthKey, type DateStr } from '../core/dates'
import { createTask, isOpen, sortForToday, type NewTaskInput } from '../core/task'
import { applyWrapUp, type WrapUpDecision } from '../core/daily'

export function taskKey(month: string): string {
  return `tasks/${month}`
}

export class TaskStore {
  /** 월 키 → 그 달의 업무들. 로드된 달만 들어 있다 */
  #months = $state<Record<string, Task[]>>({})
  #error = $state<string | null>(null)

  constructor(
    private storage: Storage,
    private clock: Clock,
  ) {}

  get all(): Task[] {
    return Object.values(this.#months).flat()
  }

  get error(): string | null {
    return this.#error
  }

  /**
   * 지난달·이번달·다음달을 읽는다.
   * 지난달까지 읽는 이유: 아직 이월 처리되지 않은 잔업이 그 파일에 남아 있다.
   * 다음달까지 읽는 이유: 말일에 이월하면 다음달 파일을 쓰게 되는데,
   * 읽지 않은 채 쓰면 그 파일을 통째로 덮어써 기존 업무가 사라진다.
   *
   * 날짜 ±N일이 아니라 달 단위로 계산한다.
   * 8월 31일 +35일은 10월이 되어 9월을 건너뛰기 때문이다.
   */
  async loadAround(today: DateStr): Promise<void> {
    const cur = monthKey(today)
    const firstOfCur = `${cur}-01`
    const prev = monthKey(addDays(firstOfCur, -1))
    // 어떤 달도 31일을 넘지 않으므로 1일 + 31일은 항상 다음 달에 떨어진다
    const next = monthKey(addDays(firstOfCur, 31))

    for (const m of [prev, cur, next]) {
      const file = await this.storage.load<TaskFile>(taskKey(m))
      this.#months[m] = file?.tasks ?? []
    }
  }

  async add(input: NewTaskInput): Promise<Task> {
    const task = createTask(input, this.clock.now())
    const m = monthKey(task.plannedDate)
    await this.#ensureLoaded(m)
    this.#months[m]!.push(task)
    await this.#persist([m])
    return task
  }

  async update(id: string, fn: (t: Task) => Task): Promise<void> {
    const found = this.#locate(id)
    const next = fn(found.task)
    const fromMonth = found.month
    const toMonth = monthKey(next.plannedDate)

    if (fromMonth === toMonth) {
      this.#months[fromMonth]![found.index] = next
      await this.#persist([fromMonth])
      return
    }

    // 계획일이 다른 달로 옮겨졌다. 원래 파일에서 빼고 새 파일에 넣는다.
    await this.#ensureLoaded(toMonth)
    this.#months[fromMonth] = this.#months[fromMonth]!.filter((t) => t.id !== id)
    this.#months[toMonth]!.push(next)
    await this.#persist([fromMonth, toMonth])
  }

  async remove(id: string): Promise<void> {
    const found = this.#locate(id)
    this.#months[found.month] = this.#months[found.month]!.filter((t) => t.id !== id)
    await this.#persist([found.month])
  }

  /** 그날 볼 목록: 그날 계획된 것 + 그날까지 밀린 열린 것 */
  forDay(date: DateStr): Task[] {
    const visible = this.all.filter(
      (t) => t.plannedDate === date || (isOpen(t) && t.plannedDate < date),
    )
    return sortForToday(visible, date)
  }

  async wrapUp(decisions: WrapUpDecision[]): Promise<void> {
    // 이월 대상 달을 먼저 읽어둔다. 안 읽은 달에 쓰면 그 파일을 덮어써버린다.
    // applyWrapUp 호출 전에 해야 한다. 뒤에 읽으면 새로 들어온 업무가
    // 아래 재구성 과정에서 빠진다.
    for (const d of decisions) {
      if (d.kind === 'carry') await this.#ensureLoaded(monthKey(d.toDate))
    }

    const before = this.all
    const after = applyWrapUp(before, decisions, this.clock.now())

    const touched = new Set<string>()
    const byMonth: Record<string, Task[]> = {}

    // 기존에 로드된 달은 일단 비워두고 다시 채운다
    for (const m of Object.keys(this.#months)) byMonth[m] = []

    for (let i = 0; i < after.length; i++) {
      const next = after[i]!
      const prev = before[i]!
      const m = monthKey(next.plannedDate)
      if (!byMonth[m]) byMonth[m] = []
      byMonth[m]!.push(next)

      if (next !== prev) {
        touched.add(m)
        touched.add(monthKey(prev.plannedDate))
      }
    }

    this.#months = byMonth
    await this.#persist([...touched])
  }

  /** 아직 안 읽은 달이면 파일에서 읽어온다. 없으면 빈 목록으로 시작한다. */
  async #ensureLoaded(month: string): Promise<void> {
    if (this.#months[month]) return
    const file = await this.storage.load<TaskFile>(taskKey(month))
    this.#months[month] = file?.tasks ?? []
  }

  #locate(id: string): { month: string; index: number; task: Task } {
    for (const [month, tasks] of Object.entries(this.#months)) {
      const index = tasks.findIndex((t) => t.id === id)
      if (index >= 0) return { month, index, task: tasks[index]! }
    }
    throw new Error(`존재하지 않는 업무입니다: ${id}`)
  }

  async #persist(months: string[]): Promise<void> {
    try {
      for (const m of new Set(months)) {
        const file: TaskFile = {
          schemaVersion: SCHEMA_VERSION,
          tasks: ($state.snapshot(this.#months[m] ?? []) as Task[]),
        }
        await this.storage.save(taskKey(m), file)
      }
      this.#error = null
    } catch (e) {
      this.#error = e instanceof Error ? e.message : String(e)
      throw e
    }
  }
}

export function createTaskStore(storage: Storage, clock: Clock): TaskStore {
  return new TaskStore(storage, clock)
}

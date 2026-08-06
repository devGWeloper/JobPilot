import type { Storage } from '../ports/storage'
import type { Clock } from '../ports/clock'
import { SCHEMA_VERSION, type Task, type TaskFile } from '../types'
import { addDays, monthKey, type DateStr } from '../core/dates'
import { createTask, isOpen, sortForToday, type NewTaskInput } from '../core/task'
import { applyWrapUp, type WrapUpDecision } from '../core/daily'

export function taskKey(month: string): string {
  return `tasks/${month}`
}

/**
 * 읽어온 파일의 봉투를 검증한다. 실패하면 조용히 빈 배열로 대체하지 않고 던진다.
 *
 * schemaVersion을 확인하지 않으면, 미래 버전이 쓴 파일을 이 버전이 빈 것으로
 * 읽어버리고 다음 저장에서 통째로 덮어써 v2 전용 필드가 영구히 사라진다.
 * `tasks`가 배열인지도 확인한다 — JSON 파싱은 되지만 구조가 잘못된 파일(예:
 * 수동 편집으로 `tasks: {}`가 된 경우)은 파싱 실패 격리 경로를 타지 않아
 * 지금까지는 빈 달로 읽혀 그대로 덮어써졌다.
 *
 * `file`이 `null`인 경우(아직 한 번도 저장한 적 없음)는 정상적인 첫 실행
 * 경로이므로 검증 대상이 아니다.
 */
function assertValidTaskFile(key: string, file: TaskFile | null): void {
  if (file === null) return
  if (file.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `${key}의 스키마 버전이 맞지 않습니다 (파일: ${String(file.schemaVersion)}, ` +
        `이 앱이 지원하는 버전: ${SCHEMA_VERSION}). 다른 버전의 JobPilot이 저장한 ` +
        `파일로 보입니다. 데이터 손실을 막기 위해 읽기를 중단합니다.`,
    )
  }
  if (!Array.isArray(file.tasks)) {
    throw new Error(`${key} 파일의 구조가 올바르지 않습니다: tasks가 배열이 아닙니다`)
  }
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
      assertValidTaskFile(taskKey(m), file)
      this.#months[m] = file?.tasks ?? []
    }
  }

  async add(input: NewTaskInput): Promise<Task> {
    const task = createTask(input, this.clock.now())
    const m = monthKey(task.plannedDate)
    await this.#ensureLoaded(m)
    await this.#commit(() => {
      this.#months[m]!.push(task)
      return [m]
    })
    return task
  }

  async update(id: string, fn: (t: Task) => Task): Promise<void> {
    const found = this.#locate(id)
    const next = fn(found.task)
    const fromMonth = found.month
    const toMonth = monthKey(next.plannedDate)

    if (fromMonth === toMonth) {
      await this.#commit(() => {
        this.#months[fromMonth]![found.index] = next
        return [fromMonth]
      })
      return
    }

    // 계획일이 다른 달로 옮겨졌다. 원래 파일에서 빼고 새 파일에 넣는다.
    // ensureLoaded는 #commit의 스냅샷보다 먼저 실행해야 한다. 그래야 이
    // 과정에서 새로 로드된 달이 롤백 이후에도 "로드됨" 상태로 남는다.
    await this.#ensureLoaded(toMonth)
    await this.#commit(() => {
      this.#months[fromMonth] = this.#months[fromMonth]!.filter((t) => t.id !== id)
      this.#months[toMonth]!.push(next)
      // toMonth(추가)를 fromMonth(제거)보다 먼저 쓴다. #persist는 넘겨받은
      // 순서대로 저장하므로, 제거를 먼저 쓴 뒤 추가 쓰기가 실패하면 업무가
      // 두 파일 어디에도 없는 상태가 된다. 추가를 먼저 쓰면 실패 시 업무가
      // 양쪽에 중복되는데, 중복은 사람이 알아채고 정리할 수 있지만 소실은
      // 되돌릴 방법이 없다.
      return [toMonth, fromMonth]
    })
  }

  async remove(id: string): Promise<void> {
    const found = this.#locate(id)
    await this.#commit(() => {
      this.#months[found.month] = this.#months[found.month]!.filter((t) => t.id !== id)
      return [found.month]
    })
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
    // #commit의 스냅샷보다, 그리고 applyWrapUp 호출보다 먼저 해야 한다.
    // 스냅샷보다 늦으면 롤백 시 이번에 로드한 달이 "로드 안 됨"으로 되돌아가고,
    // applyWrapUp보다 늦으면 새로 들어온 업무가 아래 재구성 과정에서 빠진다.
    for (const d of decisions) {
      if (d.kind === 'carry') await this.#ensureLoaded(monthKey(d.toDate))
    }

    await this.#commit(() => {
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

        // applyWrapUp은 바뀌지 않은 업무를 원본과 같은 참조로 돌려준다(그 함수의
        // 문서 주석 참고). 그 계약 덕에 여기서 값 비교 없이 참조 비교만으로
        // "이 달에 실제로 변경이 있었는가"를 판단할 수 있다.
        if (next !== prev) {
          touched.add(m)
          touched.add(monthKey(prev.plannedDate))
        }
      }

      this.#months = byMonth
      return [...touched]
    })
  }

  /** 아직 안 읽은 달이면 파일에서 읽어온다. 없으면 빈 목록으로 시작한다. */
  async #ensureLoaded(month: string): Promise<void> {
    if (this.#months[month]) return
    const file = await this.storage.load<TaskFile>(taskKey(month))
    assertValidTaskFile(taskKey(month), file)
    this.#months[month] = file?.tasks ?? []
  }

  #locate(id: string): { month: string; index: number; task: Task } {
    for (const [month, tasks] of Object.entries(this.#months)) {
      const index = tasks.findIndex((t) => t.id === id)
      if (index >= 0) return { month, index, task: tasks[index]! }
    }
    throw new Error(`존재하지 않는 업무입니다: ${id}`)
  }

  /**
   * 변경을 적용하고 저장한다. 저장이 실패하면 메모리 상태를 되돌린다.
   *
   * 되돌리지 않으면 디스크에 없는 상태(예: 이월된 업무)가 화면에만 남는다.
   * 이때 하루 마감 시트의 "정리할 업무"는 최신 메모리 상태로 다시 계산되므로
   * 빈 목록이 되어 재시도할 대상 자체가 사라진다 — 사용자가 빠져나갈 방법이
   * 없어진다. `apply`가 반환하는 월 목록을 그대로 `#persist`에 넘긴다.
   */
  async #commit(apply: () => string[]): Promise<void> {
    const rollback = $state.snapshot(this.#months) as Record<string, Task[]>
    const touched = apply()
    try {
      await this.#persist(touched)
    } catch (e) {
      this.#months = rollback
      throw e
    }
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

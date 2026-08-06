import { describe, it, expect } from 'vitest'
import { MemoryStorage } from '../adapters/memoryStorage'
import { FixedClock } from '../adapters/fixedClock'
import { createTaskStore, taskKey } from './tasks.svelte'
import { SCHEMA_VERSION, type TaskFile } from '../types'
import { pendingForWrapUp } from '../core/daily'

const TODAY = '2026-08-03'
const NOW = new Date(2026, 7, 3, 9, 0, 0)

function setup(initial: Record<string, unknown> = {}) {
  const storage = new MemoryStorage(initial)
  const store = createTaskStore(storage, new FixedClock(NOW))
  return { storage, store }
}

describe('taskKey', () => {
  it('월 키를 저장소 키로 만든다', () => {
    expect(taskKey('2026-08')).toBe('tasks/2026-08')
  })
})

describe('TaskStore.loadAround', () => {
  it('비어 있으면 목록이 빈 채로 시작한다', async () => {
    const { store } = setup()
    await store.loadAround(TODAY)
    expect(store.all).toEqual([])
  })

  it('이번 달 파일을 읽는다', async () => {
    const file: TaskFile = {
      schemaVersion: SCHEMA_VERSION,
      tasks: [
        {
          id: 'a', title: '기존 업무', status: 'planned', priority: 2,
          plannedDate: '2026-08-03', carryCount: 0,
          createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(),
        },
      ],
    }
    const { store } = setup({ [taskKey('2026-08')]: file })
    await store.loadAround(TODAY)
    expect(store.all.map((t) => t.id)).toEqual(['a'])
  })

  it('지난달에 남은 업무도 읽는다', async () => {
    const file: TaskFile = {
      schemaVersion: SCHEMA_VERSION,
      tasks: [
        {
          id: 'old', title: '지난달 잔업', status: 'planned', priority: 2,
          plannedDate: '2026-07-30', carryCount: 0,
          createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(),
        },
      ],
    }
    const { store } = setup({ [taskKey('2026-07')]: file })
    await store.loadAround(TODAY)
    expect(store.all.map((t) => t.id)).toEqual(['old'])
  })

  it('말일 기준으로도 다음 달을 읽는다', async () => {
    // 오늘±35일로 계산하면 9월을 건너뛰어 9월 파일을 덮어쓸 위험이 있다
    const file: TaskFile = {
      schemaVersion: SCHEMA_VERSION,
      tasks: [
        {
          id: 'sep', title: '9월 업무', status: 'planned', priority: 2,
          plannedDate: '2026-09-10', carryCount: 0,
          createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(),
        },
      ],
    }
    const { store } = setup({ [taskKey('2026-09')]: file })
    await store.loadAround('2026-08-31')
    expect(store.all.map((t) => t.id)).toEqual(['sep'])
  })

  it('2월처럼 짧은 달에서도 앞뒤 달을 읽는다', async () => {
    // 1일 + 31일로 다음 달을 구하는 계산이 28일짜리 달에서도 맞는지 본다
    const seed = (id: string, plannedDate: string): TaskFile => ({
      schemaVersion: SCHEMA_VERSION,
      tasks: [
        {
          id, title: id, status: 'planned', priority: 2,
          plannedDate, carryCount: 0,
          createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(),
        },
      ],
    })
    const { store } = setup({
      [taskKey('2026-01')]: seed('jan', '2026-01-20'),
      [taskKey('2026-03')]: seed('mar', '2026-03-05'),
    })

    await store.loadAround('2026-02-28')

    expect(store.all.map((t) => t.id).sort()).toEqual(['jan', 'mar'])
  })
})

describe('TaskStore 미로드 월 보호', () => {
  /**
   * 읽지 않은 달에 그냥 쓰면 그 파일을 메모리 내용으로 통째로 덮어써
   * 이미 저장돼 있던 업무가 사라진다. 쓰기 경로마다 #ensureLoaded가
   * 걸려 있어야 하고, 각 경로에 그 보호를 검증하는 테스트가 있어야 한다.
   */
  function seedDecember() {
    const existing: TaskFile = {
      schemaVersion: SCHEMA_VERSION,
      tasks: [
        {
          id: 'dec', title: '12월 업무', status: 'planned', priority: 2,
          plannedDate: '2026-12-10', carryCount: 0,
          createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(),
        },
      ],
    }
    return setup({ [taskKey('2026-12')]: existing })
  }

  it('update로 안 읽은 달에 옮겨도 그 달의 기존 업무를 지우지 않는다', async () => {
    const { store, storage } = seedDecember()
    await store.loadAround(TODAY)
    const t = await store.add({ title: '옮길 것', plannedDate: TODAY })

    await store.update(t.id, (task) => ({ ...task, plannedDate: '2026-12-01' }))

    const saved = (await storage.load<TaskFile>(taskKey('2026-12')))!
    expect(saved.tasks.map((x) => x.id).sort()).toEqual(['dec', t.id].sort())
  })

  it('wrapUp으로 안 읽은 달에 이월해도 그 달의 기존 업무를 지우지 않는다', async () => {
    // wrapUp이 carry 대상 달을 미리 읽지 않으면 이 테스트가 깨진다.
    // 12월은 loadAround(2026-08-03)의 앞뒤 달 범위 밖이라 로드되지 않는다.
    const { store, storage } = seedDecember()
    await store.loadAround(TODAY)
    const t = await store.add({ title: '옮길 것', plannedDate: TODAY })

    await store.wrapUp([{ taskId: t.id, kind: 'carry', toDate: '2026-12-01' }])

    const saved = (await storage.load<TaskFile>(taskKey('2026-12')))!
    expect(saved.tasks.map((x) => x.id).sort()).toEqual(['dec', t.id].sort())
  })

  it('wrapUp 이월 후에도 12월 기존 업무가 메모리에 남아 있다', async () => {
    const { store } = seedDecember()
    await store.loadAround(TODAY)
    const t = await store.add({ title: '옮길 것', plannedDate: TODAY })

    await store.wrapUp([{ taskId: t.id, kind: 'carry', toDate: '2026-12-01' }])

    expect(store.all.map((x) => x.id).sort()).toEqual(['dec', t.id].sort())
  })
})

describe('TaskStore.add', () => {
  it('업무를 추가한다', async () => {
    const { store } = setup()
    await store.loadAround(TODAY)
    const t = await store.add({ title: '보고서 초안', plannedDate: TODAY })
    expect(store.all).toHaveLength(1)
    expect(t.title).toBe('보고서 초안')
  })

  it('해당 월 파일에 저장한다', async () => {
    const { store, storage } = setup()
    await store.loadAround(TODAY)
    await store.add({ title: 'x', plannedDate: TODAY })
    const saved = (await storage.load<TaskFile>(taskKey('2026-08')))!
    expect(saved.tasks).toHaveLength(1)
    expect(saved.schemaVersion).toBe(SCHEMA_VERSION)
  })

  it('다른 달에 계획하면 그 달 파일에 저장한다', async () => {
    const { store, storage } = setup()
    await store.loadAround(TODAY)
    await store.add({ title: 'x', plannedDate: '2026-09-01' })
    expect((await storage.load<TaskFile>(taskKey('2026-09')))!.tasks).toHaveLength(1)
    expect(await storage.load<TaskFile>(taskKey('2026-08'))).toBeNull()
  })
})

describe('TaskStore.update', () => {
  it('업무를 바꾼다', async () => {
    const { store } = setup()
    await store.loadAround(TODAY)
    const t = await store.add({ title: 'x', plannedDate: TODAY })
    await store.update(t.id, (task) => ({ ...task, title: '바뀐 제목' }))
    expect(store.all[0]!.title).toBe('바뀐 제목')
  })

  it('없는 id면 거부한다', async () => {
    const { store } = setup()
    await store.loadAround(TODAY)
    await expect(store.update('ghost', (t) => t)).rejects.toThrow()
  })

  it('계획일이 다른 달로 옮겨지면 파일도 옮긴다', async () => {
    const { store, storage } = setup()
    await store.loadAround(TODAY)
    const t = await store.add({ title: 'x', plannedDate: '2026-08-31' })

    await store.update(t.id, (task) => ({ ...task, plannedDate: '2026-09-01' }))

    expect((await storage.load<TaskFile>(taskKey('2026-08')))!.tasks).toHaveLength(0)
    expect((await storage.load<TaskFile>(taskKey('2026-09')))!.tasks).toHaveLength(1)
  })
})

describe('TaskStore.remove', () => {
  it('업무를 지운다', async () => {
    const { store, storage } = setup()
    await store.loadAround(TODAY)
    const t = await store.add({ title: 'x', plannedDate: TODAY })
    await store.remove(t.id)
    expect(store.all).toEqual([])
    expect((await storage.load<TaskFile>(taskKey('2026-08')))!.tasks).toEqual([])
  })

  it('없는 id면 거부한다', async () => {
    const { store } = setup()
    await store.loadAround(TODAY)
    await expect(store.remove('ghost')).rejects.toThrow()
  })
})

describe('TaskStore.forDay', () => {
  it('그날 계획된 업무를 준다', async () => {
    const { store } = setup()
    await store.loadAround(TODAY)
    await store.add({ title: '오늘 것', plannedDate: TODAY })
    expect(store.forDay(TODAY).map((t) => t.title)).toEqual(['오늘 것'])
  })

  it('밀린 열린 업무를 함께 준다', async () => {
    const { store } = setup()
    await store.loadAround(TODAY)
    await store.add({ title: '밀린 것', plannedDate: '2026-08-01' })
    await store.add({ title: '오늘 것', plannedDate: TODAY })
    expect(store.forDay(TODAY).map((t) => t.title)).toEqual(['밀린 것', '오늘 것'])
  })

  it('과거에 완료된 업무는 빼고 준다', async () => {
    const { store } = setup()
    await store.loadAround(TODAY)
    const t = await store.add({ title: '어제 끝냄', plannedDate: '2026-08-02' })
    await store.update(t.id, (task) => ({ ...task, status: 'done' as const }))
    expect(store.forDay(TODAY)).toEqual([])
  })

  it('미래 업무는 빼고 준다', async () => {
    const { store } = setup()
    await store.loadAround(TODAY)
    await store.add({ title: '내일 것', plannedDate: '2026-08-04' })
    expect(store.forDay(TODAY)).toEqual([])
  })
})

describe('TaskStore.wrapUp', () => {
  it('결정을 한꺼번에 적용한다', async () => {
    const { store } = setup()
    await store.loadAround(TODAY)
    const a = await store.add({ title: 'a', plannedDate: TODAY })
    const b = await store.add({ title: 'b', plannedDate: TODAY })

    await store.wrapUp([
      { taskId: a.id, kind: 'complete', actualNote: '끝' },
      { taskId: b.id, kind: 'carry', toDate: '2026-08-04' },
    ])

    expect(store.all.find((t) => t.id === a.id)!.status).toBe('done')
    expect(store.all.find((t) => t.id === b.id)!.plannedDate).toBe('2026-08-04')
  })

  it('월을 넘겨 이월하면 파일을 옮긴다', async () => {
    const { store, storage } = setup()
    await store.loadAround('2026-08-31')
    const t = await store.add({ title: 'x', plannedDate: '2026-08-31' })

    await store.wrapUp([{ taskId: t.id, kind: 'carry', toDate: '2026-09-01' }])

    expect((await storage.load<TaskFile>(taskKey('2026-08')))!.tasks).toHaveLength(0)
    expect((await storage.load<TaskFile>(taskKey('2026-09')))!.tasks).toHaveLength(1)
  })
})

describe('TaskStore 스키마 검증', () => {
  it('스키마 버전이 다르면 loadAround를 거부한다', async () => {
    const bad = { schemaVersion: 999, tasks: [] }
    const { store } = setup({ [taskKey('2026-08')]: bad })
    await expect(store.loadAround(TODAY)).rejects.toThrow()
  })

  it('tasks가 배열이 아닌 구조적으로 잘못된 파일을 거부한다', async () => {
    const bad = { schemaVersion: SCHEMA_VERSION, tasks: {} }
    const { store } = setup({ [taskKey('2026-08')]: bad })
    await expect(store.loadAround(TODAY)).rejects.toThrow()
  })

  it('파일이 아예 없으면 (첫 실행) 여전히 빈 상태로 시작한다', async () => {
    const { store } = setup()
    await store.loadAround(TODAY)
    expect(store.all).toEqual([])
  })

  it('loadAround 범위 밖 달을 #ensureLoaded로 읽을 때도 스키마를 검증한다', async () => {
    const bad = { schemaVersion: 999, tasks: [] }
    const { store } = setup({ [taskKey('2026-12')]: bad })
    await store.loadAround(TODAY)
    await expect(store.add({ title: 'x', plannedDate: '2026-12-10' })).rejects.toThrow()
  })
})

/** 저장이 실패하는 상황을 만들기 위한 저장소 (config.test.ts의 FailingStorage와 동형) */
class FailingStorage extends MemoryStorage {
  failNextSave = false
  /** 특정 키로의 저장만 실패시킨다. update의 두 파일 쓰기 순서를 검증할 때 쓴다. */
  failSaveKey: string | null = null

  override async save<T>(key: string, value: T): Promise<void> {
    if (this.failNextSave) {
      this.failNextSave = false
      throw new Error('디스크에 쓸 수 없습니다')
    }
    if (this.failSaveKey !== null && key === this.failSaveKey) {
      throw new Error('디스크에 쓸 수 없습니다')
    }
    await super.save(key, value)
  }
}

describe('TaskStore 저장 실패 처리', () => {
  function readySetup(initial: Record<string, unknown> = {}) {
    const storage = new FailingStorage(initial)
    const store = createTaskStore(storage, new FixedClock(NOW))
    return { store, storage }
  }

  it('add가 저장에 실패하면 메모리 상태를 되돌린다', async () => {
    const { store, storage } = readySetup()
    await store.loadAround(TODAY)
    storage.failNextSave = true
    await expect(store.add({ title: 'x', plannedDate: TODAY })).rejects.toThrow()
    expect(store.all).toEqual([])
  })

  it('add 실패 후 저장소 파일도 쓰이지 않는다', async () => {
    const { store, storage } = readySetup()
    await store.loadAround(TODAY)
    storage.failNextSave = true
    await expect(store.add({ title: 'x', plannedDate: TODAY })).rejects.toThrow()
    expect(await storage.load<TaskFile>(taskKey('2026-08'))).toBeNull()
  })

  it('update가 달 경계를 넘다 실패하면 두 달 모두 되돌린다', async () => {
    // toMonth(추가)를 먼저 쓰고 fromMonth(제거)를 나중에 쓰므로, fromMonth 쓰기만
    // 실패시키면 "디스크에는 일시적으로 중복, 메모리는 온전히 롤백"을 관찰할 수 있다.
    const { store, storage } = readySetup()
    await store.loadAround(TODAY)
    const t = await store.add({ title: 'x', plannedDate: '2026-08-31' })

    storage.failSaveKey = taskKey('2026-08')
    await expect(
      store.update(t.id, (task) => ({ ...task, plannedDate: '2026-09-01' })),
    ).rejects.toThrow()

    // 메모리는 원래 상태로 완전히 되돌아간다: 업무가 8월에 하나만 있다
    expect(store.all).toHaveLength(1)
    expect(store.all[0]!.plannedDate).toBe('2026-08-31')

    // toMonth(9월) 쓰기는 실패 전에 이미 성공했으므로 디스크에는 남아 있다.
    // 소실이 아니라 중복이라 재시도로 정리할 수 있다는 것이 이 순서의 요점이다.
    expect((await storage.load<TaskFile>(taskKey('2026-09')))!.tasks).toHaveLength(1)
    // fromMonth(8월) 쓰기가 실패했으므로 원래 내용(add 시점에 저장된 것)이 남는다.
    expect((await storage.load<TaskFile>(taskKey('2026-08')))!.tasks).toHaveLength(1)
  })

  it('wrapUp이 저장에 실패하면 되돌리고, 재시도 대상이 그대로 남는다', async () => {
    const { store, storage } = readySetup()
    await store.loadAround(TODAY)
    const t = await store.add({ title: 'x', plannedDate: TODAY })

    storage.failNextSave = true
    await expect(
      store.wrapUp([{ taskId: t.id, kind: 'carry', toDate: '2026-08-04' }]),
    ).rejects.toThrow()

    // 메모리가 되돌아가지 않으면 이 업무는 이미 내일 날짜라 pendingForWrapUp이
    // 빈 배열을 주고, 하루 마감 시트의 "마감하기" 버튼이 disabled가 되어
    // 사용자가 재시도할 방법이 없어진다. 이 assert가 그 버그의 핵심이다.
    expect(store.all[0]!.plannedDate).toBe(TODAY)
    expect(pendingForWrapUp(store.all, TODAY)).toHaveLength(1)
  })

  it('저장 실패를 error에 남긴다', async () => {
    const { store, storage } = readySetup()
    await store.loadAround(TODAY)
    storage.failNextSave = true
    await expect(store.add({ title: 'x', plannedDate: TODAY })).rejects.toThrow()
    expect(store.error).toContain('디스크에 쓸 수 없습니다')
  })

  it('되돌린 뒤 다시 시도하면 성공한다', async () => {
    const { store, storage } = readySetup()
    await store.loadAround(TODAY)
    storage.failNextSave = true
    await expect(store.add({ title: 'x', plannedDate: TODAY })).rejects.toThrow()
    await store.add({ title: 'y', plannedDate: TODAY })
    expect(store.all).toHaveLength(1)
    expect(store.error).toBeNull()
  })
})

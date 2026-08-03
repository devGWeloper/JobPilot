import { describe, it, expect } from 'vitest'
import { MemoryStorage } from '../adapters/memoryStorage'
import { createConfigStore, CONFIG_KEY } from './config.svelte'
import { SCHEMA_VERSION, type ConfigFile } from '../types'

describe('ConfigStore.load', () => {
  it('저장된 설정이 없으면 기본값을 쓴다', async () => {
    const store = createConfigStore(new MemoryStorage())
    await store.load()
    expect(store.config.projects).toEqual([])
    expect(store.config.work.carryWarningDays).toBe(3)
    expect(store.loaded).toBe(true)
  })

  it('저장된 설정을 읽어온다', async () => {
    const file: ConfigFile = {
      schemaVersion: SCHEMA_VERSION,
      config: {
        projects: [{ id: 'p1', name: 'A사 유지보수', color: '#ff0000', active: true }],
        work: {
          workdays: [1, 2, 3, 4, 5],
          dayStart: '10:00',
          dayEnd: '19:00',
          weekStartsOn: 1,
          defaultReminders: [15],
          carryWarningDays: 5,
        },
      },
    }
    const store = createConfigStore(new MemoryStorage({ [CONFIG_KEY]: file }))
    await store.load()
    expect(store.config.projects[0]!.name).toBe('A사 유지보수')
    expect(store.config.work.dayStart).toBe('10:00')
  })

  it('일부 필드가 빠진 설정에 기본값을 채운다', async () => {
    const partial = { schemaVersion: SCHEMA_VERSION, config: { projects: [] } }
    const store = createConfigStore(new MemoryStorage({ [CONFIG_KEY]: partial }))
    await store.load()
    expect(store.config.work.carryWarningDays).toBe(3)
  })
})

describe('ConfigStore 프로젝트 관리', () => {
  async function ready() {
    const storage = new MemoryStorage()
    const store = createConfigStore(storage)
    await store.load()
    return { store, storage }
  }

  it('프로젝트를 추가한다', async () => {
    const { store } = await ready()
    const p = await store.addProject('사내 플랫폼', '#4f7cff')
    expect(store.config.projects).toHaveLength(1)
    expect(p.name).toBe('사내 플랫폼')
    expect(p.active).toBe(true)
  })

  it('추가 후 저장소에 기록한다', async () => {
    const { store, storage } = await ready()
    await store.addProject('사내 플랫폼', '#4f7cff')
    const saved = (await storage.load<ConfigFile>(CONFIG_KEY))!
    expect(saved.config.projects).toHaveLength(1)
    expect(saved.schemaVersion).toBe(SCHEMA_VERSION)
  })

  it('빈 이름을 거부한다', async () => {
    const { store } = await ready()
    await expect(store.addProject('   ', '#000000')).rejects.toThrow()
  })

  it('이름 앞뒤 공백을 없앤다', async () => {
    const { store } = await ready()
    const p = await store.addProject('  청소  ', '#000000')
    expect(p.name).toBe('청소')
  })

  it('중복된 이름을 거부한다', async () => {
    const { store } = await ready()
    await store.addProject('A사', '#000000')
    await expect(store.addProject('A사', '#111111')).rejects.toThrow()
  })

  it('이름을 바꾼다', async () => {
    const { store } = await ready()
    const p = await store.addProject('A사', '#000000')
    await store.renameProject(p.id, 'A사 유지보수')
    expect(store.config.projects[0]!.name).toBe('A사 유지보수')
  })

  it('없는 프로젝트 이름 변경을 거부한다', async () => {
    const { store } = await ready()
    await expect(store.renameProject('ghost', 'x')).rejects.toThrow()
  })

  it('색상을 바꾼다', async () => {
    const { store } = await ready()
    const p = await store.addProject('A사', '#000000')
    await store.setProjectColor(p.id, '#22aa66')
    expect(store.config.projects[0]!.color).toBe('#22aa66')
  })

  it('비활성으로 바꾼다', async () => {
    const { store } = await ready()
    const p = await store.addProject('A사', '#000000')
    await store.setProjectActive(p.id, false)
    expect(store.config.projects[0]!.active).toBe(false)
  })

  it('activeProjects는 활성만 준다', async () => {
    const { store } = await ready()
    const a = await store.addProject('A사', '#000000')
    await store.addProject('B사', '#111111')
    await store.setProjectActive(a.id, false)
    expect(store.activeProjects().map((p) => p.name)).toEqual(['B사'])
  })

  it('프로젝트를 삭제한다', async () => {
    const { store } = await ready()
    const p = await store.addProject('A사', '#000000')
    await store.deleteProject(p.id)
    expect(store.config.projects).toEqual([])
  })

  it('projectById로 찾는다', async () => {
    const { store } = await ready()
    const p = await store.addProject('A사', '#000000')
    expect(store.projectById(p.id)!.name).toBe('A사')
    expect(store.projectById('ghost')).toBeUndefined()
    expect(store.projectById(undefined)).toBeUndefined()
  })
})

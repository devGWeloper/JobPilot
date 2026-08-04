import type { Storage } from '../ports/storage'
import {
  DEFAULT_CONFIG,
  DEFAULT_WORK_SETTINGS,
  SCHEMA_VERSION,
  type Config,
  type ConfigFile,
  type Project,
} from '../types'
import { newId } from '../core/ids'

export const CONFIG_KEY = 'config'

export class ConfigStore {
  #config = $state<Config>(structuredClone(DEFAULT_CONFIG))
  #loaded = $state(false)
  #error = $state<string | null>(null)

  constructor(private storage: Storage) {}

  get config(): Config {
    return this.#config
  }

  get loaded(): boolean {
    return this.#loaded
  }

  get error(): string | null {
    return this.#error
  }

  async load(): Promise<void> {
    const file = await this.storage.load<ConfigFile>(CONFIG_KEY)
    this.#config = file ? normalize(file.config) : structuredClone(DEFAULT_CONFIG)
    this.#loaded = true
  }

  async addProject(name: string, color: string): Promise<Project> {
    const trimmed = name.trim()
    if (trimmed.length === 0) throw new Error('프로젝트 이름이 비어 있습니다')
    if (this.#config.projects.some((p) => p.name === trimmed)) {
      throw new Error(`이미 있는 프로젝트입니다: ${trimmed}`)
    }
    const project: Project = { id: newId('proj'), name: trimmed, color, active: true }
    await this.#commit(() => {
      this.#config.projects.push(project)
    })
    return project
  }

  async renameProject(id: string, name: string): Promise<void> {
    const trimmed = name.trim()
    if (trimmed.length === 0) throw new Error('프로젝트 이름이 비어 있습니다')
    this.#require(id)
    if (this.#config.projects.some((o) => o.id !== id && o.name === trimmed)) {
      throw new Error(`이미 있는 프로젝트입니다: ${trimmed}`)
    }
    await this.#commit(() => {
      this.#require(id).name = trimmed
    })
  }

  async setProjectColor(id: string, color: string): Promise<void> {
    this.#require(id)
    await this.#commit(() => {
      this.#require(id).color = color
    })
  }

  async setProjectActive(id: string, active: boolean): Promise<void> {
    this.#require(id)
    await this.#commit(() => {
      this.#require(id).active = active
    })
  }

  async deleteProject(id: string): Promise<void> {
    this.#require(id)
    await this.#commit(() => {
      this.#config.projects = this.#config.projects.filter((p) => p.id !== id)
    })
  }

  activeProjects(): Project[] {
    return this.#config.projects.filter((p) => p.active)
  }

  projectById(id: string | undefined): Project | undefined {
    if (!id) return undefined
    return this.#config.projects.find((p) => p.id === id)
  }

  #require(id: string): Project {
    const p = this.#config.projects.find((x) => x.id === id)
    if (!p) throw new Error(`존재하지 않는 프로젝트입니다: ${id}`)
    return p
  }

  /**
   * 변경을 적용하고 저장한다. 저장이 실패하면 화면 상태를 저장 이전으로 되돌린다.
   *
   * 되돌리지 않으면 디스크에는 없는 값이 화면에만 남아, 사용자가 저장됐다고
   * 믿는 상태와 실제 파일이 어긋난다. 스펙의 "조용한 실패를 만들지 않는다"가
   * 요구하는 것은 오류를 띄우는 것뿐 아니라 거짓 성공을 보여주지 않는 것이다.
   */
  async #commit(apply: () => void): Promise<void> {
    const rollback = $state.snapshot(this.#config) as Config
    apply()
    try {
      await this.#persist()
    } catch (e) {
      this.#config = rollback
      throw e
    }
  }

  async #persist(): Promise<void> {
    const file: ConfigFile = {
      schemaVersion: SCHEMA_VERSION,
      // $state 프록시를 그대로 직렬화하지 않도록 평범한 객체로 되돌린다
      config: $state.snapshot(this.#config) as Config,
    }
    try {
      await this.storage.save(CONFIG_KEY, file)
      this.#error = null
    } catch (e) {
      this.#error = e instanceof Error ? e.message : String(e)
      throw e
    }
  }
}

/**
 * 저장 당시 없던 필드가 있어도 기본값으로 채워 넣는다.
 * DEFAULT_WORK_SETTINGS를 얕게 펼치면 workdays 같은 배열이 전역 기본값과
 * 같은 참조가 되므로, 기본값 쪽은 깊은 복사로 가져온다.
 */
function normalize(raw: Partial<Config> | undefined): Config {
  return {
    projects: raw?.projects ?? [],
    work: { ...structuredClone(DEFAULT_WORK_SETTINGS), ...(raw?.work ?? {}) },
  }
}

export function createConfigStore(storage: Storage): ConfigStore {
  return new ConfigStore(storage)
}

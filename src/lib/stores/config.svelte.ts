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

/**
 * 읽어온 파일의 봉투를 검증한다. 실패하면 조용히 기본값으로 대체하지 않고 던진다.
 *
 * schemaVersion을 확인하지 않으면, 미래 버전이 쓴 파일(예: 7단계의 profile/ai
 * 필드를 담은 v2)을 이 버전이 읽을 수 있는 것만 골라 읽고 첫 저장에서
 * `schemaVersion: 1`로 통째로 덮어써 나머지 필드를 영구히 없앤다.
 * `config`가 객체인지도 확인한다 — JSON 파싱은 되지만 봉투 구조가 잘못된
 * 파일(예: `config` 필드 자체가 없거나 배열인 경우)은 지금까지 빈 설정으로
 * 읽혀 그대로 덮어써졌다.
 *
 * `file`이 `null`인 경우(아직 한 번도 저장한 적 없음)는 정상적인 첫 실행
 * 경로이므로 검증 대상이 아니다.
 */
function assertValidConfigFile(key: string, file: ConfigFile | null): void {
  if (file === null) return
  if (file.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `${key}의 스키마 버전이 맞지 않습니다 (파일: ${String(file.schemaVersion)}, ` +
        `이 앱이 지원하는 버전: ${SCHEMA_VERSION}). 다른 버전의 JobPilot이 저장한 ` +
        `파일로 보입니다. 데이터 손실을 막기 위해 읽기를 중단합니다.`,
    )
  }
  if (typeof file.config !== 'object' || file.config === null || Array.isArray(file.config)) {
    throw new Error(`${key} 파일의 구조가 올바르지 않습니다: config가 비어 있거나 객체가 아닙니다`)
  }
}

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
    assertValidConfigFile(CONFIG_KEY, file)
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

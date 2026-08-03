import type { Storage } from '../ports/storage'

/**
 * 테스트와 브라우저 개발용 저장소.
 * 값을 넣고 뺄 때 깊은 복사를 해서, 파일 저장소와 같은 격리 특성을 갖게 한다.
 */
export class MemoryStorage implements Storage {
  private data: Record<string, unknown>

  constructor(initial: Record<string, unknown> = {}) {
    this.data = structuredClone(initial)
  }

  async load<T>(key: string): Promise<T | null> {
    if (!(key in this.data)) return null
    return structuredClone(this.data[key]) as T
  }

  async save<T>(key: string, value: T): Promise<void> {
    this.data[key] = structuredClone(value)
  }

  snapshot(): Record<string, unknown> {
    return structuredClone(this.data)
  }
}

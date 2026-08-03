import { invoke } from '@tauri-apps/api/core'
import type { Storage } from '../ports/storage'
import { StorageCorruptError } from '../ports/storage'

/**
 * Rust 쪽 storage_* 커맨드에 얹는 어댑터.
 * JSON 직렬화/파싱은 여기서 하고, Rust는 문자열만 다룬다.
 */
export class TauriStorage implements Storage {
  async load<T>(key: string): Promise<T | null> {
    const raw = await invoke<string | null>('storage_load', { key })
    if (raw === null) return null
    try {
      return JSON.parse(raw) as T
    } catch {
      // 손상된 파일은 절대 덮어쓰지 않는다. 옆으로 치우고 호출자에게 알린다.
      const movedTo = await invoke<string>('storage_quarantine', { key })
      throw new StorageCorruptError(key, movedTo)
    }
  }

  async save<T>(key: string, value: T): Promise<void> {
    await invoke('storage_save', {
      key,
      contents: JSON.stringify(value, null, 2),
    })
  }
}

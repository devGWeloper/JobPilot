/**
 * key는 확장자 없는 논리 경로다. 예: "config", "tasks/2026-08"
 * 어댑터가 실제 위치와 형식으로 옮긴다.
 */
export interface Storage {
  load<T>(key: string): Promise<T | null>
  save<T>(key: string, value: T): Promise<void>
}

/** 저장된 파일이 JSON으로 파싱되지 않을 때 던진다. 원본은 격리 보관된다. */
export class StorageCorruptError extends Error {
  constructor(
    readonly key: string,
    readonly quarantinedTo: string,
  ) {
    super(`저장된 데이터가 손상되었습니다: ${key} (원본 보관: ${quarantinedTo})`)
    this.name = 'StorageCorruptError'
  }
}

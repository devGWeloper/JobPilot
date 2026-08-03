import type { Storage } from '../ports/storage'
import type { Clock } from '../ports/clock'
import { MemoryStorage } from '../adapters/memoryStorage'
import { SystemClock } from '../adapters/systemClock'
import { TauriStorage } from '../adapters/tauriStorage'

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

type Ports = { storage: Storage; clock: Clock }

let ports: Ports | null = null

/** 테스트나 브라우저 개발에서 포트를 갈아끼운다 */
export function setPorts(p: Ports): void {
  ports = p
}

function resolve(): Ports {
  if (ports) return ports
  ports = {
    // 브라우저에서 npm run dev로 띄우면 메모리 저장소로 UI만 확인한다
    storage: isTauri() ? new TauriStorage() : new MemoryStorage(),
    clock: new SystemClock(),
  }
  return ports
}

export function getStorage(): Storage {
  return resolve().storage
}

export function getClock(): Clock {
  return resolve().clock
}

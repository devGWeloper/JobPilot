export type Theme = 'light' | 'dark'

/**
 * 이 문자열은 index.html의 인라인 스크립트에도 하드코딩되어 있다.
 * 그 스크립트가 첫 페인트 전에 다크 클래스를 붙여 흰 화면 번쩍임을 막는다.
 * 값을 바꾸면 양쪽을 함께 고쳐야 한다.
 */
export const THEME_KEY = 'jobpilot.theme'

/**
 * 테마 값을 읽고 쓰는 통로.
 * 인터페이스로 두는 이유는 테스트에서 localStorage 없이 검증하기 위해서다.
 */
export interface ThemeStorage {
  read(): string | null
  write(value: string): void
}

/** 브라우저와 WebView에서 쓰는 실제 구현 */
export const browserThemeStorage: ThemeStorage = {
  read() {
    try {
      return localStorage.getItem(THEME_KEY)
    } catch {
      // 저장소가 막힌 환경에서도 앱은 떠야 한다
      return null
    }
  },
  write(value: string) {
    try {
      localStorage.setItem(THEME_KEY, value)
    } catch {
      // 저장에 실패해도 이번 세션의 테마는 유지된다
    }
  },
}

function parse(raw: string | null): Theme {
  return raw === 'dark' ? 'dark' : 'light'
}

export class ThemeStore {
  #theme = $state<Theme>('light')

  constructor(private storage: ThemeStorage) {
    this.#theme = parse(storage.read())
  }

  get theme(): Theme {
    return this.#theme
  }

  toggle(): void {
    this.#theme = this.#theme === 'light' ? 'dark' : 'light'
    this.storage.write(this.#theme)
    this.apply()
  }

  /** 현재 테마를 문서 루트 클래스에 반영한다 */
  apply(): void {
    if (typeof document === 'undefined') return
    document.documentElement.classList.toggle('dark', this.#theme === 'dark')
  }
}

export function createThemeStore(storage: ThemeStorage): ThemeStore {
  return new ThemeStore(storage)
}

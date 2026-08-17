import { describe, it, expect } from 'vitest'
import { createThemeStore, THEME_KEY, type ThemeStorage } from './theme.svelte'

function fakeStorage(initial: string | null = null): ThemeStorage & { value: string | null } {
  return {
    value: initial,
    read() {
      return this.value
    },
    write(v: string) {
      this.value = v
    },
  }
}

describe('THEME_KEY', () => {
  it('앱 이름으로 네임스페이스를 둔다', () => {
    expect(THEME_KEY).toBe('jobpilot.theme')
  })
})

describe('createThemeStore', () => {
  it('저장된 값이 없으면 light로 시작한다', () => {
    expect(createThemeStore(fakeStorage()).theme).toBe('light')
  })

  it('저장된 dark를 읽어온다', () => {
    expect(createThemeStore(fakeStorage('dark')).theme).toBe('dark')
  })

  it('저장된 값이 이상하면 light로 떨어진다', () => {
    expect(createThemeStore(fakeStorage('purple')).theme).toBe('light')
  })

  it('빈 문자열도 light로 떨어진다', () => {
    expect(createThemeStore(fakeStorage('')).theme).toBe('light')
  })
})

describe('ThemeStore.toggle', () => {
  it('light에서 dark로 바꾼다', () => {
    const store = createThemeStore(fakeStorage())
    store.toggle()
    expect(store.theme).toBe('dark')
  })

  it('dark에서 light로 되돌린다', () => {
    const store = createThemeStore(fakeStorage('dark'))
    store.toggle()
    expect(store.theme).toBe('light')
  })

  it('바뀐 값을 저장한다', () => {
    const storage = fakeStorage()
    const store = createThemeStore(storage)
    store.toggle()
    expect(storage.value).toBe('dark')
  })

  it('두 번 토글하면 제자리로 온다', () => {
    const storage = fakeStorage()
    const store = createThemeStore(storage)
    store.toggle()
    store.toggle()
    expect(store.theme).toBe('light')
    expect(storage.value).toBe('light')
  })
})

describe('ThemeStore.apply', () => {
  it('dark일 때 문서 루트에 dark 클래스를 붙인다', () => {
    const store = createThemeStore(fakeStorage('dark'))
    store.apply()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('light일 때 dark 클래스를 뗀다', () => {
    document.documentElement.classList.add('dark')
    const store = createThemeStore(fakeStorage('light'))
    store.apply()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('토글 후 apply하면 클래스가 따라간다', () => {
    const store = createThemeStore(fakeStorage('light'))
    store.toggle()
    store.apply()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    store.toggle()
    store.apply()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})

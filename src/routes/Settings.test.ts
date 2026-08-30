import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/svelte'
import Settings from './Settings.svelte'
import { createConfigStore } from '../lib/stores/config.svelte'
import { MemoryStorage } from '../lib/adapters/memoryStorage'

afterEach(cleanup)

/** 원할 때 한 번 저장을 실패시키는 저장소 */
class FailingStorage extends MemoryStorage {
  failNextSave = false

  override async save<T>(key: string, value: T): Promise<void> {
    if (this.failNextSave) {
      this.failNextSave = false
      throw new Error('디스크에 쓸 수 없습니다')
    }
    await super.save(key, value)
  }
}

async function setup() {
  const storage = new FailingStorage()
  const config = createConfigStore(storage)
  await config.load()
  await config.addProject('A사', '#4f7cff')
  render(Settings, { config })
  return { storage, config }
}

describe('설정 화면 — 저장이 실패했을 때', () => {
  it('사용 체크박스가 원래 상태로 되돌아온다', async () => {
    const { storage, config } = await setup()
    const box = screen.getByRole('checkbox')
    expect(box.getAttribute('aria-checked')).toBe('true')

    storage.failNextSave = true
    await fireEvent.click(box)

    await waitFor(() => expect(config.config.projects[0]!.active).toBe(true))
    await waitFor(() => expect(box.getAttribute('aria-checked')).toBe('true'))
  })

  it('실패 사유를 화면에 띄운다', async () => {
    const { storage } = await setup()
    storage.failNextSave = true
    await fireEvent.click(screen.getByRole('checkbox'))

    await waitFor(() =>
      expect(screen.getByText(/디스크에 쓸 수 없습니다/)).toBeTruthy(),
    )
  })
})

describe('설정 화면 — 저장이 성공했을 때', () => {
  it('사용 체크박스가 꺼진 상태로 남는다', async () => {
    const { config } = await setup()
    const box = screen.getByRole('checkbox')

    await fireEvent.click(box)

    await waitFor(() => expect(config.config.projects[0]!.active).toBe(false))
    await waitFor(() => expect(box.getAttribute('aria-checked')).toBe('false'))
  })
})

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

    // 스토어는 롤백된다
    await waitFor(() => expect(config.config.projects[0]!.active).toBe(true))
    // 화면도 데이터와 일치해야 한다.
    //
    // 이 단언이 "무엇을" 지키는지 정확히 해둔다. Phase 2a 리뷰는 checked를
    // 평범한 prop으로 넘기면 롤백이 화면에 닿지 않는다고 봤지만, 실제로
    // 되돌려 돌려보면 옛 코드도 통과한다 — 스토어가 p.active를 false로
    // 바꿨다가 true로 되돌리므로 Svelte가 마지막 값을 내려보내기 때문이다.
    // 따라서 이 테스트는 그 특정 구현 차이를 구별하지 못한다.
    //
    // 그래도 남길 값이 있다. 지키는 것은 "저장이 실패하면 화면과 데이터가
    // 결국 일치한다"는 불변식이고, 그 성질을 깨뜨리는 변경(예: 스토어가
    // 낙관적 변경을 그만두고 저장 성공 후에만 반영하도록 바뀌는 경우)은
    // 이 단언에 걸린다.
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

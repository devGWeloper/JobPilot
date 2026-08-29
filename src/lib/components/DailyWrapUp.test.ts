import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/svelte'
import DailyWrapUp from './DailyWrapUp.svelte'
import { createTaskStore } from '../stores/tasks.svelte'
import { createConfigStore } from '../stores/config.svelte'
import { MemoryStorage } from '../adapters/memoryStorage'
import { FixedClock } from '../adapters/fixedClock'

afterEach(cleanup)

const TODAY = '2026-08-03'
const NOW = new Date(2026, 7, 3, 18, 0, 0)

async function setup(titles: string[]) {
  const storage = new MemoryStorage()
  const clock = new FixedClock(NOW)
  const tasks = createTaskStore(storage, clock)
  const config = createConfigStore(storage)
  await config.load()
  await tasks.loadAround(TODAY)
  for (const t of titles) await tasks.add({ title: t, plannedDate: TODAY })

  const onClose = vi.fn()
  render(DailyWrapUp, { tasks, config, today: TODAY, onClose })
  return { tasks, config, onClose }
}

describe('DailyWrapUp', () => {
  it('정리할 업무를 모두 보여준다', async () => {
    await setup(['보고서', '리뷰'])
    await waitFor(() => expect(screen.getByText('보고서')).toBeTruthy())
    expect(screen.getByText('리뷰')).toBeTruthy()
  })

  it('기본 선택은 내일로 이월이다', async () => {
    await setup(['보고서'])
    const carry = await waitFor(
      () => screen.getAllByRole('radio', { name: '내일로' })[0] as HTMLInputElement,
    )
    expect(carry.checked).toBe(true)
  })

  it('마감하면 이월된 업무가 내일 날짜로 옮겨진다', async () => {
    const { tasks, onClose } = await setup(['보고서'])
    await fireEvent.click(await waitFor(() => screen.getByRole('button', { name: '마감하기' })))

    // onClose가 이 흐름의 마지막 사건이다. tasks.all 변경은 #commit 안에서
    // 동기적으로 일어나 몇 마이크로태스크 먼저 관측되므로, 그쪽을 먼저
    // 기다리면 onClose가 아직 안 불린 채로 단언이 실행된다.
    // 마지막 사건을 기다리면 나머지는 이미 확정돼 있다.
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(tasks.all[0]!.plannedDate).toBe('2026-08-04')
    expect(tasks.all[0]!.carryCount).toBe(1)
  })

  it('완료를 고르면 메모 입력칸이 나타난다', async () => {
    await setup(['보고서'])
    const done = await waitFor(
      () => screen.getAllByRole('radio', { name: '완료' })[0] as HTMLInputElement,
    )
    expect(screen.queryByLabelText('메모')).toBeNull()

    await fireEvent.click(done)

    await waitFor(() => expect(screen.getByLabelText('메모')).toBeTruthy())
  })

  it('완료로 마감하면 실적 메모가 저장된다', async () => {
    const { tasks } = await setup(['보고서'])
    await fireEvent.click(
      await waitFor(() => screen.getAllByRole('radio', { name: '완료' })[0]!),
    )
    await fireEvent.input(await waitFor(() => screen.getByLabelText('메모')), {
      target: { value: '초안까지 완료' },
    })
    await fireEvent.click(screen.getByRole('button', { name: '마감하기' }))

    await waitFor(() => expect(tasks.all[0]!.status).toBe('done'))
    expect(tasks.all[0]!.actualNote).toBe('초안까지 완료')
  })

  it('정리할 업무가 없으면 안내를 보여주고 마감 버튼을 잠근다', async () => {
    await setup([])
    await waitFor(() => expect(screen.getByText(/정리할 업무가 없습니다/)).toBeTruthy())
    expect((screen.getByRole('button', { name: '마감하기' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
  })
})

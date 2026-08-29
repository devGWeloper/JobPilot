import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/svelte'
import QuickAdd from './QuickAdd.svelte'
import { createConfigStore } from '../stores/config.svelte'
import { MemoryStorage } from '../adapters/memoryStorage'

afterEach(cleanup)

async function setup(onAdd: (input: {
  title: string
  projectId?: string
  priority: 1 | 2 | 3
}) => Promise<boolean>) {
  const config = createConfigStore(new MemoryStorage())
  await config.load()
  await config.addProject('A사', '#4f7cff')
  render(QuickAdd, { config, onAdd })
  return { config }
}

describe('QuickAdd', () => {
  it('제목을 입력하고 제출하면 onAdd를 부른다', async () => {
    const onAdd = vi.fn().mockResolvedValue(true)
    await setup(onAdd)

    await fireEvent.input(screen.getByLabelText('업무 제목'), {
      target: { value: '보고서 초안' },
    })
    await fireEvent.click(screen.getByRole('button', { name: '추가' }))

    await waitFor(() =>
      expect(onAdd).toHaveBeenCalledWith({
        title: '보고서 초안',
        projectId: undefined,
        priority: 2,
      }),
    )
  })

  it('성공하면 입력칸을 비운다', async () => {
    const onAdd = vi.fn().mockResolvedValue(true)
    await setup(onAdd)
    const input = screen.getByLabelText('업무 제목') as HTMLInputElement

    await fireEvent.input(input, { target: { value: '보고서 초안' } })
    await fireEvent.click(screen.getByRole('button', { name: '추가' }))

    await waitFor(() => expect(input.value).toBe(''))
  })

  it('실패하면 입력칸을 비우지 않는다', async () => {
    // 이것이 이 태스크가 고치는 버그다. 실패했는데 제목을 지우면
    // 사용자는 오류를 보면서 방금 쓴 내용까지 잃는다.
    const onAdd = vi.fn().mockResolvedValue(false)
    await setup(onAdd)
    const input = screen.getByLabelText('업무 제목') as HTMLInputElement

    await fireEvent.input(input, { target: { value: '보고서 초안' } })
    await fireEvent.click(screen.getByRole('button', { name: '추가' }))

    await waitFor(() => expect(onAdd).toHaveBeenCalled())
    expect(input.value).toBe('보고서 초안')
  })

  it('제목이 비어 있으면 onAdd를 부르지 않는다', async () => {
    const onAdd = vi.fn().mockResolvedValue(true)
    await setup(onAdd)
    await fireEvent.click(screen.getByRole('button', { name: '추가' }))
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('공백만 있어도 onAdd를 부르지 않는다', async () => {
    const onAdd = vi.fn().mockResolvedValue(true)
    await setup(onAdd)
    await fireEvent.input(screen.getByLabelText('업무 제목'), {
      target: { value: '   ' },
    })
    await fireEvent.click(screen.getByRole('button', { name: '추가' }))
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('활성 프로젝트를 선택지로 보여준다', async () => {
    await setup(vi.fn().mockResolvedValue(true))
    const select = screen.getByLabelText('프로젝트') as HTMLSelectElement
    const labels = [...select.options].map((o) => o.textContent?.trim())
    expect(labels).toContain('프로젝트 없음')
    expect(labels).toContain('A사')
  })
})

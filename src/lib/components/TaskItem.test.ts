import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte'
import TaskItem from './TaskItem.svelte'
import { createTask, completeTask } from '../core/task'
import type { Task } from '../types'

afterEach(cleanup)

const AT = new Date(2026, 7, 3, 10, 0, 0)

function make(overrides: Partial<Task> = {}): Task {
  return { ...createTask({ title: '보고서 초안', plannedDate: '2026-08-03' }, AT), ...overrides }
}

function mount(task: Task, today = '2026-08-03') {
  const onToggle = vi.fn()
  const onStart = vi.fn()
  const onDelete = vi.fn()
  render(TaskItem, { task, today, warnDays: 3, onToggle, onStart, onDelete })
  return { onToggle, onStart, onDelete }
}

describe('TaskItem 체크박스', () => {
  it('열린 업무는 체크되지 않은 상태로 보인다', () => {
    mount(make())
    expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe('false')
  })

  it('완료된 업무는 체크된 상태로 보인다', () => {
    mount(completeTask(make(), AT))
    expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe('true')
  })

  it('클릭하면 onToggle을 부른다', async () => {
    const { onToggle } = mount(make())
    await fireEvent.click(screen.getByRole('checkbox'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('onToggle이 상태를 바꾸지 않으면 체크박스도 원래대로 남는다', async () => {
    // 저장 실패로 스토어가 롤백한 상황을 흉내낸다. task는 그대로다.
    const { onToggle } = mount(make())
    const box = screen.getByRole('checkbox')
    await fireEvent.click(box)
    expect(onToggle).toHaveBeenCalled()
    expect(box.getAttribute('aria-checked')).toBe('false')
  })
})

describe('TaskItem 배지', () => {
  it('밀린 업무에 일수를 보여준다', () => {
    mount(make({ plannedDate: '2026-08-01' }), '2026-08-03')
    expect(screen.getByText('2일 밀림')).toBeTruthy()
  })

  it('밀리지 않았으면 일수 배지가 없다', () => {
    mount(make())
    expect(screen.queryByText(/일 밀림/)).toBeNull()
  })

  it('우선순위가 높으면 표시한다', () => {
    mount(make({ priority: 1 }))
    expect(screen.getByText('높음')).toBeTruthy()
  })

  it('진행 중이면 배지를 보여주고 시작 버튼을 감춘다', () => {
    mount(make({ status: 'doing' }))
    expect(screen.getByText('진행 중')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '시작' })).toBeNull()
  })

  it('열린 업무에는 시작 버튼이 있다', async () => {
    const { onStart } = mount(make())
    await fireEvent.click(screen.getByRole('button', { name: '시작' }))
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('삭제 버튼이 onDelete를 부른다', async () => {
    const task = make()
    const { onDelete } = mount(task)
    await fireEvent.click(screen.getByRole('button', { name: `${task.title} 삭제` }))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})

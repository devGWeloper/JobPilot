<script lang="ts">
  import type { Task, Project } from '../types'
  import type { DateStr } from '../core/dates'
  import { isOpen, isOverdue, overdueDays } from '../core/task'

  let {
    task,
    today,
    project,
    warnDays,
    onToggle,
    onStart,
    onDelete,
  }: {
    task: Task
    today: DateStr
    project?: Project
    warnDays: number
    onToggle: (task: Task) => void
    onStart: (task: Task) => void
    onDelete: (task: Task) => void
  } = $props()

  const late = $derived(isOverdue(task, today))
  const lateDays = $derived(overdueDays(task, today))
  const severe = $derived(late && lateDays >= warnDays)
</script>

<li class:done={task.status === 'done'} class:dropped={task.status === 'dropped'}>
  <input
    type="checkbox"
    checked={task.status === 'done'}
    onchange={() => onToggle(task)}
    aria-label="{task.title} 완료"
  />

  <span class="title">{task.title}</span>

  {#if project}
    <span class="project" style="background:{project.color}22; color:{project.color}">
      {project.name}
    </span>
  {/if}

  {#if task.priority === 1}
    <span class="prio">높음</span>
  {/if}

  {#if late}
    <span class="late" class:severe>{lateDays}일 밀림</span>
  {/if}

  {#if task.status === 'doing'}
    <span class="doing">진행 중</span>
  {:else if isOpen(task)}
    <button class="ghost" onclick={() => onStart(task)}>시작</button>
  {/if}

  <button class="ghost" onclick={() => onDelete(task)} aria-label="{task.title} 삭제">×</button>
</li>

<style>
  li {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.5rem 0.6rem; border-radius: 6px;
    background: rgba(128, 128, 128, 0.07);
  }
  .title { flex: 1; }
  li.done .title { text-decoration: line-through; opacity: 0.55; }
  li.dropped .title { text-decoration: line-through; opacity: 0.4; font-style: italic; }
  .project, .prio, .late, .doing {
    font-size: 0.75rem; padding: 0.1rem 0.45rem; border-radius: 999px; white-space: nowrap;
  }
  .prio { background: #ffe6e6; color: #c0392b; }
  .late { background: #fff2d6; color: #a86400; }
  .late.severe { background: #ffd9d9; color: #b02020; font-weight: 600; }
  .doing { background: #dcefff; color: #1f6fb2; }
  .ghost { border: none; background: none; cursor: pointer; opacity: 0.6; padding: 0.2rem 0.4rem; }
  .ghost:hover { opacity: 1; }
</style>

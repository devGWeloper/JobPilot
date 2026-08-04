<script lang="ts">
  import type { Task } from '../lib/types'
  import type { DateStr } from '../lib/core/dates'
  import type { TaskStore } from '../lib/stores/tasks.svelte'
  import type { ConfigStore } from '../lib/stores/config.svelte'
  import { completeTask, reopenTask, startTask, isOpen, isOverdue } from '../lib/core/task'
  import { getClock } from '../lib/stores/context'
  import QuickAdd from '../lib/components/QuickAdd.svelte'
  import TaskList from '../lib/components/TaskList.svelte'

  let {
    tasks,
    config,
    today,
  }: { tasks: TaskStore; config: ConfigStore; today: DateStr } = $props()

  const visible = $derived(tasks.forDay(today))
  const late = $derived(visible.filter((t) => isOverdue(t, today)))
  const open = $derived(visible.filter((t) => isOpen(t) && !isOverdue(t, today)))
  const closed = $derived(visible.filter((t) => !isOpen(t)))

  async function add(input: { title: string; projectId?: string; priority: 1 | 2 | 3 }) {
    await tasks.add({ ...input, plannedDate: today })
  }

  async function toggle(task: Task) {
    const now = getClock().now()
    await tasks.update(task.id, (t) =>
      isOpen(t) ? completeTask(t, now) : reopenTask(t, now),
    )
  }

  async function start(task: Task) {
    const now = getClock().now()
    await tasks.update(task.id, (t) => startTask(t, now))
  }

  async function remove(task: Task) {
    if (!confirm(`'${task.title}'을(를) 삭제할까요?`)) return
    await tasks.remove(task.id)
  }
</script>

<div class="page">
  <header>
    <h2>{today}</h2>
    <p class="summary">
      남은 일 {late.length + open.length}건
      {#if late.length > 0}<span class="warn">· 밀린 일 {late.length}건</span>{/if}
    </p>
  </header>

  <QuickAdd {config} onAdd={add} />

  {#if tasks.error}
    <p class="error">저장에 실패했습니다: {tasks.error}</p>
  {/if}

  {#if late.length > 0}
    <TaskList
      title="밀린 업무"
      tasks={late}
      {today}
      {config}
      emptyText=""
      onToggle={toggle}
      onStart={start}
      onDelete={remove}
    />
  {/if}

  <TaskList
    title="오늘 할 일"
    tasks={open}
    {today}
    {config}
    emptyText="오늘 계획된 업무가 없습니다."
    onToggle={toggle}
    onStart={start}
    onDelete={remove}
  />

  {#if closed.length > 0}
    <TaskList
      title="마무리됨"
      tasks={closed}
      {today}
      {config}
      emptyText=""
      onToggle={toggle}
      onStart={start}
      onDelete={remove}
    />
  {/if}
</div>

<style>
  .page { padding: 1.5rem; max-width: 760px; }
  header { margin-bottom: 1rem; }
  h2 { margin: 0; font-size: 1.2rem; }
  .summary { margin: 0.2rem 0 0; opacity: 0.7; font-size: 0.85rem; }
  .warn { color: #a86400; }
  .error { color: #c0392b; }
</style>

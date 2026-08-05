<script lang="ts">
  import type { Task } from '../lib/types'
  import type { DateStr } from '../lib/core/dates'
  import type { TaskStore } from '../lib/stores/tasks.svelte'
  import type { ConfigStore } from '../lib/stores/config.svelte'
  import { completeTask, reopenTask, startTask, isOpen, isOverdue } from '../lib/core/task'
  import { getClock } from '../lib/stores/context'
  import QuickAdd from '../lib/components/QuickAdd.svelte'
  import TaskList from '../lib/components/TaskList.svelte'
  import DailyWrapUp from '../lib/components/DailyWrapUp.svelte'
  import { pendingForWrapUp } from '../lib/core/daily'

  let {
    tasks,
    config,
    today,
  }: { tasks: TaskStore; config: ConfigStore; today: DateStr } = $props()

  const visible = $derived(tasks.forDay(today))
  const late = $derived(visible.filter((t) => isOverdue(t, today)))
  const open = $derived(visible.filter((t) => isOpen(t) && !isOverdue(t, today)))
  const closed = $derived(visible.filter((t) => !isOpen(t)))

  let actionError = $state<string | null>(null)

  // 상태 전이는 잘못된 전환에서 throw하고, 저장은 디스크 사정으로 실패할 수
  // 있다. 모든 동작을 이 함수로 통과시켜, 실패가 unhandled rejection으로
  // 조용히 사라지지 않고 화면에 뜨게 한다.
  async function run(action: () => Promise<unknown>): Promise<void> {
    try {
      await action()
      actionError = null
    } catch (e) {
      actionError = e instanceof Error ? e.message : String(e)
    }
  }

  function add(input: { title: string; projectId?: string; priority: 1 | 2 | 3 }) {
    return run(() => tasks.add({ ...input, plannedDate: today }))
  }

  function toggle(task: Task) {
    const now = getClock().now()
    return run(() =>
      tasks.update(task.id, (t) =>
        isOpen(t) ? completeTask(t, now) : reopenTask(t, now),
      ),
    )
  }

  function start(task: Task) {
    const now = getClock().now()
    return run(() => tasks.update(task.id, (t) => startTask(t, now)))
  }

  function remove(task: Task) {
    if (!confirm(`'${task.title}'을(를) 삭제할까요?`)) return Promise.resolve()
    return run(() => tasks.remove(task.id))
  }

  let wrapUpOpen = $state(false)
  const pendingCount = $derived(pendingForWrapUp(tasks.all, today).length)
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

  {#if actionError}
    <p class="error">{actionError}</p>
  {:else if tasks.error}
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

  <div class="wrapup-bar">
    <button class="wrapup" onclick={() => (wrapUpOpen = true)}>
      하루 마감 {#if pendingCount > 0}({pendingCount}건){/if}
    </button>
  </div>

  {#if wrapUpOpen}
    <DailyWrapUp {tasks} {config} {today} onClose={() => (wrapUpOpen = false)} />
  {/if}
</div>

<style>
  .page { padding: 1.5rem; max-width: 760px; }
  header { margin-bottom: 1rem; }
  h2 { margin: 0; font-size: 1.2rem; }
  .summary { margin: 0.2rem 0 0; opacity: 0.7; font-size: 0.85rem; }
  .warn { color: #a86400; }
  .error { color: #c0392b; }
  .wrapup-bar { margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid rgba(128,128,128,0.25); }
  .wrapup { padding: 0.6rem 1.2rem; font-weight: 600; cursor: pointer; border-radius: 6px; }
</style>

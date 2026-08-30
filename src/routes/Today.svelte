<script lang="ts">
  import type { Task } from '../lib/types'
  import type { DateStr } from '../lib/core/dates'
  import type { TaskStore } from '../lib/stores/tasks.svelte'
  import type { ConfigStore } from '../lib/stores/config.svelte'
  import { completeTask, reopenTask, startTask, isOpen, isOverdue } from '../lib/core/task'
  import { getClock } from '../lib/stores/context'
  import { pendingForWrapUp } from '../lib/core/daily'
  import QuickAdd from '../lib/components/QuickAdd.svelte'
  import TaskList from '../lib/components/TaskList.svelte'
  import DailyWrapUp from '../lib/components/DailyWrapUp.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Alert from '$lib/components/ui/alert'

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

  // 모든 조작을 통과시켜 실패가 unhandled rejection이 되지 않게 한다.
  // boolean을 돌려주는 이유는 QuickAdd가 실패 시 입력칸을 남겨야 해서다.
  async function run(action: () => Promise<unknown>): Promise<boolean> {
    try {
      await action()
      actionError = null
      return true
    } catch (e) {
      actionError = e instanceof Error ? e.message : String(e)
      return false
    }
  }

  function add(input: { title: string; projectId?: string; priority: 1 | 2 | 3 }) {
    return run(() => tasks.add({ ...input, plannedDate: today }))
  }

  function toggle(task: Task) {
    const now = getClock().now()
    return run(() =>
      tasks.update(task.id, (t) => (isOpen(t) ? completeTask(t, now) : reopenTask(t, now))),
    )
  }

  function start(task: Task) {
    const now = getClock().now()
    return run(() => tasks.update(task.id, (t) => startTask(t, now)))
  }

  function remove(task: Task) {
    if (!confirm(`'${task.title}'을(를) 삭제할까요?`)) return Promise.resolve(false)
    return run(() => tasks.remove(task.id))
  }

  let wrapUpOpen = $state(false)
  const pendingCount = $derived(pendingForWrapUp(tasks.all, today).length)
</script>

<div class="mx-auto max-w-3xl p-6">
  <header class="mb-4">
    <h2 class="text-xl font-semibold tracking-tight">{today}</h2>
    <p class="mt-0.5 text-sm text-muted-foreground">
      남은 일 {late.length + open.length}건
      {#if late.length > 0}
        <span class="text-warning">· 밀린 일 {late.length}건</span>
      {/if}
    </p>
  </header>

  <QuickAdd {config} onAdd={add} />

  {#if actionError}
    <div class="mb-4">
      <Alert.Root variant="destructive">
        <Alert.Description>{actionError}</Alert.Description>
      </Alert.Root>
    </div>
  {:else if tasks.error}
    <div class="mb-4">
      <Alert.Root variant="destructive">
        <Alert.Description>저장에 실패했습니다: {tasks.error}</Alert.Description>
      </Alert.Root>
    </div>
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

  <div class="mt-6 border-t border-border pt-4">
    <Button onclick={() => (wrapUpOpen = true)}>
      하루 마감{#if pendingCount > 0}&nbsp;({pendingCount}건){/if}
    </Button>
  </div>

  {#if wrapUpOpen}
    <DailyWrapUp {tasks} {config} {today} onClose={() => (wrapUpOpen = false)} />
  {/if}
</div>

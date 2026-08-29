<script lang="ts">
  import type { Task } from '../types'
  import type { DateStr } from '../core/dates'
  import type { ConfigStore } from '../stores/config.svelte'
  import TaskItem from './TaskItem.svelte'

  let {
    title,
    tasks,
    today,
    config,
    emptyText,
    onToggle,
    onStart,
    onDelete,
  }: {
    title: string
    tasks: Task[]
    today: DateStr
    config: ConfigStore
    emptyText: string
    onToggle: (task: Task) => void
    onStart: (task: Task) => void
    onDelete: (task: Task) => void
  } = $props()
</script>

<section class="mb-6">
  <h3 class="mb-2 text-sm font-medium text-muted-foreground">
    {title}
    <span class="ml-1 font-normal opacity-70">{tasks.length}</span>
  </h3>

  {#if tasks.length === 0}
    <p class="text-sm text-muted-foreground/70">{emptyText}</p>
  {:else}
    <ul class="grid gap-1.5">
      {#each tasks as task (task.id)}
        <TaskItem
          {task}
          {today}
          project={config.projectById(task.projectId)}
          warnDays={config.config.work.carryWarningDays}
          {onToggle}
          {onStart}
          {onDelete}
        />
      {/each}
    </ul>
  {/if}
</section>

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

<section>
  <h3>{title} <span class="count">{tasks.length}</span></h3>
  {#if tasks.length === 0}
    <p class="empty">{emptyText}</p>
  {:else}
    <ul>
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

<style>
  section { margin-bottom: 1.5rem; }
  h3 { font-size: 0.9rem; margin: 0 0 0.5rem; opacity: 0.8; }
  .count { opacity: 0.5; font-weight: 400; }
  ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.35rem; }
  .empty { opacity: 0.5; font-size: 0.85rem; margin: 0; }
</style>

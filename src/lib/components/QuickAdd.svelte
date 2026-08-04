<script lang="ts">
  import type { ConfigStore } from '../stores/config.svelte'

  let {
    config,
    onAdd,
  }: {
    config: ConfigStore
    onAdd: (input: { title: string; projectId?: string; priority: 1 | 2 | 3 }) => Promise<void>
  } = $props()

  let title = $state('')
  let projectId = $state<string>('')
  let priority = $state<1 | 2 | 3>(2)
  let error = $state<string | null>(null)

  async function submit() {
    if (title.trim().length === 0) return
    try {
      await onAdd({
        title,
        projectId: projectId === '' ? undefined : projectId,
        priority,
      })
      title = ''
      error = null
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
  }
</script>

<form onsubmit={(e) => { e.preventDefault(); submit() }}>
  <input
    type="text"
    bind:value={title}
    placeholder="오늘 할 일을 적으세요"
    aria-label="업무 제목"
  />
  <select bind:value={projectId} aria-label="프로젝트">
    <option value="">프로젝트 없음</option>
    {#each config.activeProjects() as p (p.id)}
      <option value={p.id}>{p.name}</option>
    {/each}
  </select>
  <select bind:value={priority} aria-label="우선순위">
    <option value={1}>높음</option>
    <option value={2}>보통</option>
    <option value={3}>낮음</option>
  </select>
  <button type="submit">추가</button>
</form>

{#if error}
  <p class="error">{error}</p>
{/if}

<style>
  form { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
  input[type='text'] { flex: 1; padding: 0.55rem; }
  select, button { padding: 0.55rem; }
  .error { color: #c0392b; margin: 0 0 1rem; }
</style>

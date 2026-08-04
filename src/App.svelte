<script lang="ts">
  import { getStorage, getClock } from './lib/stores/context'
  import { createConfigStore } from './lib/stores/config.svelte'
  import { createTaskStore } from './lib/stores/tasks.svelte'
  import { toDateStr } from './lib/core/dates'
  import Today from './routes/Today.svelte'
  import Settings from './routes/Settings.svelte'

  const storage = getStorage()
  const clock = getClock()
  const config = createConfigStore(storage)
  const tasks = createTaskStore(storage, clock)

  const today = toDateStr(clock.now())

  let tab = $state<'today' | 'settings'>('today')
  let ready = $state(false)
  let loadError = $state<string | null>(null)

  $effect(() => {
    Promise.all([config.load(), tasks.loadAround(today)])
      .then(() => { ready = true })
      .catch((e) => { loadError = e instanceof Error ? e.message : String(e) })
  })
</script>

<nav>
  <button class:active={tab === 'today'} onclick={() => (tab = 'today')}>오늘</button>
  <button class:active={tab === 'settings'} onclick={() => (tab = 'settings')}>설정</button>
</nav>

{#if loadError}
  <p class="fatal">데이터를 불러오지 못했습니다: {loadError}</p>
{:else if !ready}
  <p class="loading">불러오는 중…</p>
{:else if tab === 'today'}
  <Today {tasks} {config} {today} />
{:else}
  <Settings {config} />
{/if}

<style>
  nav { display: flex; gap: 0.25rem; padding: 0.5rem; border-bottom: 1px solid rgba(128,128,128,0.3); }
  nav button { padding: 0.4rem 0.9rem; border: none; background: none; cursor: pointer; border-radius: 4px; }
  nav button.active { background: rgba(128,128,128,0.2); font-weight: 600; }
  .fatal { color: #c0392b; padding: 1.5rem; }
  .loading { padding: 1.5rem; opacity: 0.7; }
</style>

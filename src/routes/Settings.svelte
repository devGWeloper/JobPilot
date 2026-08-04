<script lang="ts">
  import type { Project } from '../lib/types'
  import type { ConfigStore } from '../lib/stores/config.svelte'

  let { config }: { config: ConfigStore } = $props()

  let newName = $state('')
  let newColor = $state('#4f7cff')
  let message = $state<string | null>(null)

  // 저장은 실패할 수 있다. 모든 변경을 이 함수로 통과시켜, 실패가
  // unhandled rejection으로 조용히 사라지지 않고 화면에 뜨게 한다.
  async function run(action: () => Promise<unknown>): Promise<boolean> {
    try {
      await action()
      message = null
      return true
    } catch (e) {
      message = e instanceof Error ? e.message : String(e)
      return false
    }
  }

  async function add() {
    const ok = await run(() => config.addProject(newName, newColor))
    if (ok) newName = ''
  }

  async function rename(p: Project, el: HTMLInputElement) {
    const ok = await run(() => config.renameProject(p.id, el.value))
    // 실패했으면 저장되지 않은 텍스트가 입력칸에 남지 않게 되돌린다
    if (!ok) el.value = p.name
  }

  async function remove(id: string, name: string) {
    if (!confirm(`'${name}' 프로젝트를 삭제할까요?\n이미 등록된 업무의 분류는 사라집니다.`)) {
      return
    }
    await run(() => config.deleteProject(id))
  }
</script>

<section>
  <h2>프로젝트</h2>
  <p class="hint">업무를 묶는 단위입니다. 주간보고도 이 단위로 정리됩니다.</p>

  <form onsubmit={(e) => { e.preventDefault(); add() }}>
    <input
      type="text"
      bind:value={newName}
      placeholder="프로젝트 이름"
      aria-label="새 프로젝트 이름"
    />
    <input type="color" bind:value={newColor} aria-label="색상" />
    <button type="submit">추가</button>
  </form>

  {#if message}
    <p class="error">{message}</p>
  {/if}

  {#if config.config.projects.length === 0}
    <p class="empty">아직 프로젝트가 없습니다.</p>
  {:else}
    <ul>
      {#each config.config.projects as p (p.id)}
        <li>
          <span class="dot" style="background:{p.color}"></span>
          <input
            class="name"
            value={p.name}
            onchange={(e) => rename(p, e.currentTarget)}
            aria-label="프로젝트 이름"
          />
          <label>
            <input
              type="checkbox"
              checked={p.active}
              onchange={(e) => run(() => config.setProjectActive(p.id, e.currentTarget.checked))}
            />
            사용
          </label>
          <button onclick={() => remove(p.id, p.name)}>삭제</button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  section { padding: 1.5rem; max-width: 640px; }
  h2 { margin: 0 0 0.25rem; font-size: 1.1rem; }
  .hint { margin: 0 0 1rem; opacity: 0.7; font-size: 0.85rem; }
  form { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
  form input[type='text'] { flex: 1; padding: 0.5rem; }
  ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.5rem; }
  li { display: flex; align-items: center; gap: 0.6rem; }
  .dot { width: 0.9rem; height: 0.9rem; border-radius: 50%; flex: none; }
  .name { flex: 1; padding: 0.4rem; }
  .error { color: #c0392b; }
  .empty { opacity: 0.6; }
</style>

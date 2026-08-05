<script lang="ts">
  import type { DateStr } from '../core/dates'
  import { addDays } from '../core/dates'
  import type { TaskStore } from '../stores/tasks.svelte'
  import type { ConfigStore } from '../stores/config.svelte'
  import { pendingForWrapUp, type WrapUpDecision } from '../core/daily'
  import { overdueDays } from '../core/task'

  let {
    tasks,
    config,
    today,
    onClose,
  }: {
    tasks: TaskStore
    config: ConfigStore
    today: DateStr
    onClose: () => void
  } = $props()

  type Choice = 'complete' | 'carry' | 'drop' | 'keep'

  const pending = $derived(pendingForWrapUp(tasks.all, today))

  // $derived여야 한다. today는 자정을 넘기면 실제로 바뀌는데(App.svelte 참고)
  // 이 시트는 열린 채로 살아 있을 수 있다. 평범한 const로 두면 tomorrow가
  // 굳어서, 이월 대상이 이미 지나간 날짜가 되고 carryTask가 계속 거부한다.
  // 컴포넌트가 리마운트되지 않으므로 다시 시도해도 빠져나오지 못한다.
  const tomorrow = $derived(addDays(today, 1))

  // 기본 제안은 전부 내일로 이월
  let choices = $state<Record<string, Choice>>({})
  let notes = $state<Record<string, string>>({})
  let saving = $state(false)
  let error = $state<string | null>(null)

  $effect(() => {
    for (const t of pending) {
      if (!(t.id in choices)) choices[t.id] = 'carry'
    }
  })

  // Escape로 닫히지 않으면 마우스 없이는 시트를 빠져나갈 수 없다
  $effect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function setAll(choice: Choice) {
    for (const t of pending) choices[t.id] = choice
  }

  async function submit() {
    saving = true
    error = null
    try {
      const decisions: WrapUpDecision[] = pending.map((t) => {
        const choice = choices[t.id] ?? 'carry'
        switch (choice) {
          case 'complete':
            return { taskId: t.id, kind: 'complete', actualNote: notes[t.id] || undefined }
          case 'carry':
            return { taskId: t.id, kind: 'carry', toDate: tomorrow }
          case 'drop':
            return { taskId: t.id, kind: 'drop', reason: notes[t.id] || undefined }
          case 'keep':
            return { taskId: t.id, kind: 'keep' }
        }
      })
      await tasks.wrapUp(decisions)
      onClose()
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    } finally {
      saving = false
    }
  }
</script>

<div class="backdrop" role="presentation" onclick={onClose}></div>

<div class="sheet" role="dialog" aria-modal="true" aria-label="하루 마감">
  <header>
    <h2>하루 마감</h2>
    <p>정리할 업무 {pending.length}건. 기본은 내일({tomorrow})로 이월입니다.</p>
  </header>

  {#if pending.length === 0}
    <p class="empty">정리할 업무가 없습니다. 오늘 할 일을 모두 마쳤습니다.</p>
  {:else}
    <div class="bulk">
      <span>전체:</span>
      <button onclick={() => setAll('complete')}>완료</button>
      <button onclick={() => setAll('carry')}>이월</button>
      <button onclick={() => setAll('drop')}>포기</button>
    </div>

    <ul>
      {#each pending as task (task.id)}
        <li>
          <div class="row">
            <span class="title">{task.title}</span>
            {#if config.projectById(task.projectId)}
              <span class="project">{config.projectById(task.projectId)!.name}</span>
            {/if}
            {#if overdueDays(task, today) > 0}
              <span class="late">{overdueDays(task, today)}일 밀림</span>
            {/if}
          </div>

          <div class="row">
            <label><input type="radio" bind:group={choices[task.id]} value="complete" /> 완료</label>
            <label><input type="radio" bind:group={choices[task.id]} value="carry" /> 내일로</label>
            <label><input type="radio" bind:group={choices[task.id]} value="drop" /> 포기</label>
            <label><input type="radio" bind:group={choices[task.id]} value="keep" /> 그대로</label>
          </div>

          {#if choices[task.id] === 'complete' || choices[task.id] === 'drop'}
            <input
              class="note"
              type="text"
              bind:value={notes[task.id]}
              placeholder={choices[task.id] === 'complete' ? '실제로 한 일 (선택)' : '포기 사유 (선택)'}
              aria-label="메모"
            />
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  {#if error}
    <p class="error">{error}</p>
  {/if}

  <footer>
    <button onclick={onClose}>닫기</button>
    <button class="primary" onclick={submit} disabled={saving || pending.length === 0}>
      {saving ? '저장 중…' : '마감하기'}
    </button>
  </footer>
</div>

<style>
  .backdrop {
    position: fixed; inset: 0; background: rgba(0, 0, 0, 0.35);
  }
  .sheet {
    position: fixed; inset: 5% 50% 5% 50%;
    transform: translateX(-50%); width: min(680px, 92vw);
    background: Canvas; color: CanvasText;
    border-radius: 10px; padding: 1.25rem;
    display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
  }
  header h2 { margin: 0; font-size: 1.1rem; }
  header p { margin: 0.25rem 0 1rem; opacity: 0.7; font-size: 0.85rem; }
  .bulk { display: flex; gap: 0.4rem; align-items: center; margin-bottom: 0.75rem; font-size: 0.85rem; }
  .bulk button { padding: 0.25rem 0.6rem; }
  ul { list-style: none; padding: 0; margin: 0; overflow-y: auto; display: grid; gap: 0.75rem; }
  li { padding: 0.6rem; border-radius: 6px; background: rgba(128, 128, 128, 0.08); display: grid; gap: 0.4rem; }
  .row { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
  .title { font-weight: 500; }
  .project, .late { font-size: 0.72rem; padding: 0.1rem 0.4rem; border-radius: 999px; }
  .project { background: rgba(128, 128, 128, 0.2); }
  .late { background: #fff2d6; color: #a86400; }
  label { font-size: 0.85rem; display: flex; align-items: center; gap: 0.2rem; }
  .note { padding: 0.4rem; width: 100%; }
  .empty { opacity: 0.6; padding: 1rem 0; }
  .error { color: #c0392b; }
  footer { display: flex; justify-content: flex-end; gap: 0.5rem; padding-top: 1rem; }
  footer button { padding: 0.5rem 1rem; }
  .primary { font-weight: 600; }
</style>

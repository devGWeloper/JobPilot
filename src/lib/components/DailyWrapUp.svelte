<script lang="ts">
  import type { DateStr } from '../core/dates'
  import { addDays } from '../core/dates'
  import type { TaskStore } from '../stores/tasks.svelte'
  import type { ConfigStore } from '../stores/config.svelte'
  import { pendingForWrapUp, type WrapUpDecision } from '../core/daily'
  import { overdueDays } from '../core/task'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import * as Dialog from '$lib/components/ui/dialog'

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

  // today가 자정에 바뀌는데 이 시트는 열린 채 살아 있을 수 있다
  const tomorrow = $derived(addDays(today, 1))

  let choices = $state<Record<string, Choice>>({})
  let notes = $state<Record<string, string>>({})
  let saving = $state(false)
  let error = $state<string | null>(null)

  // 기본 제안은 전부 내일로 이월
  $effect(() => {
    for (const t of pending) {
      if (!(t.id in choices)) choices[t.id] = 'carry'
    }
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

<!-- Today의 {#if}가 마운트를 소유하므로 게터는 늘 true다 -->
<Dialog.Root
  bind:open={
    () => true,
    (v) => {
      if (!v) onClose()
    }
  }
>
  <Dialog.Content class="flex max-h-[90vh] flex-col sm:max-w-2xl">
    <Dialog.Header>
      <Dialog.Title>하루 마감</Dialog.Title>
      <Dialog.Description>
        정리할 업무 {pending.length}건. 기본은 내일({tomorrow})로 이월입니다.
      </Dialog.Description>
    </Dialog.Header>

    {#if pending.length === 0}
      <p class="py-6 text-center text-sm text-muted-foreground">
        정리할 업무가 없습니다. 오늘 할 일을 모두 마쳤습니다.
      </p>
    {:else}
      <div class="flex items-center gap-1.5 text-sm">
        <span class="text-muted-foreground">전체:</span>
        <Button variant="outline" size="sm" onclick={() => setAll('complete')}>완료</Button>
        <Button variant="outline" size="sm" onclick={() => setAll('carry')}>이월</Button>
        <Button variant="outline" size="sm" onclick={() => setAll('drop')}>포기</Button>
      </div>

      <ul class="-mx-1 grid gap-3 overflow-y-auto px-1 py-1">
        {#each pending as task (task.id)}
          <li class="grid gap-2 rounded-md bg-muted/40 p-3">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-medium">{task.title}</span>

              {#if config.projectById(task.projectId)}
                <span class="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {config.projectById(task.projectId)!.name}
                </span>
              {/if}

              {#if overdueDays(task, today) > 0}
                <span class="late rounded-full px-2 py-0.5 text-xs text-warning">
                  {overdueDays(task, today)}일 밀림
                </span>
              {/if}
            </div>

            <div class="flex flex-wrap items-center gap-3 text-sm">
              {#each [['complete', '완료'], ['carry', '내일로'], ['drop', '포기'], ['keep', '그대로']] as [value, label] (value)}
                <label class="flex items-center gap-1.5">
                  <input
                    type="radio"
                    class="accent-primary"
                    bind:group={choices[task.id]}
                    {value}
                    aria-label={label}
                  />
                  {label}
                </label>
              {/each}
            </div>

            {#if choices[task.id] === 'complete' || choices[task.id] === 'drop'}
              <Input
                type="text"
                bind:value={notes[task.id]}
                placeholder={choices[task.id] === 'complete'
                  ? '실제로 한 일 (선택)'
                  : '포기 사유 (선택)'}
                aria-label="메모"
                class="h-8"
              />
            {/if}
          </li>
        {/each}
      </ul>
    {/if}

    {#if error}
      <p class="text-sm text-destructive">{error}</p>
    {/if}

    <Dialog.Footer>
      <Button variant="outline" onclick={onClose}>닫기</Button>
      <Button onclick={submit} disabled={saving || pending.length === 0}>
        {saving ? '저장 중…' : '마감하기'}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<style>
  /* Tailwind의 슬래시 표기는 여기서 쓸 수 없어 토큰을 직접 섞는다 */
  .late { background-color: color-mix(in srgb, var(--warning) 12%, transparent); }
</style>

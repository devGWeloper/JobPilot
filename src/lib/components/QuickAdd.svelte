<script lang="ts">
  import type { ConfigStore } from '../stores/config.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'

  let {
    config,
    onAdd,
  }: {
    config: ConfigStore
    // 성공 여부를 돌려준다. 실패했을 때 입력칸을 지우지 않기 위해 필요하다.
    // 오류 표시는 호출자(Today)가 맡는다.
    onAdd: (input: {
      title: string
      projectId?: string
      priority: 1 | 2 | 3
    }) => Promise<boolean>
  } = $props()

  let title = $state('')
  let projectId = $state<string>('')
  let priority = $state<1 | 2 | 3>(2)

  async function submit() {
    if (title.trim().length === 0) return
    const ok = await onAdd({
      title,
      projectId: projectId === '' ? undefined : projectId,
      priority,
    })
    // 실패하면 사용자가 방금 쓴 제목을 남겨둔다
    if (ok) title = ''
  }
</script>

<form
  class="mb-4 flex items-center gap-2"
  onsubmit={(e) => {
    e.preventDefault()
    submit()
  }}
>
  <Input
    type="text"
    bind:value={title}
    placeholder="오늘 할 일을 적으세요"
    aria-label="업무 제목"
    class="flex-1"
  />

  <!-- 네이티브 select를 유지한다. color-scheme 선언 덕에 다크에서도
       브라우저가 알아서 어둡게 그리고, 키보드 조작이 이미 옳다. -->
  <select
    bind:value={projectId}
    aria-label="프로젝트"
    class="h-9 shrink-0 rounded-md border border-input bg-background px-2 text-sm"
  >
    <option value="">프로젝트 없음</option>
    {#each config.activeProjects() as p (p.id)}
      <option value={p.id}>{p.name}</option>
    {/each}
  </select>

  <select
    bind:value={priority}
    aria-label="우선순위"
    class="h-9 shrink-0 rounded-md border border-input bg-background px-2 text-sm"
  >
    <option value={1}>높음</option>
    <option value={2}>보통</option>
    <option value={3}>낮음</option>
  </select>

  <Button type="submit" class="shrink-0">추가</Button>
</form>

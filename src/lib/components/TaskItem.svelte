<script lang="ts">
  import type { Task, Project } from '../types'
  import type { DateStr } from '../core/dates'
  import { isOpen, isOverdue, overdueDays } from '../core/task'
  import { Button } from '$lib/components/ui/button'
  import { Checkbox } from '$lib/components/ui/checkbox'

  let {
    task,
    today,
    project,
    warnDays,
    onToggle,
    onStart,
    onDelete,
  }: {
    task: Task
    today: DateStr
    project?: Project
    warnDays: number
    onToggle: (task: Task) => void
    onStart: (task: Task) => void
    onDelete: (task: Task) => void
  } = $props()

  const late = $derived(isOverdue(task, today))
  const lateDays = $derived(overdueDays(task, today))
  const severe = $derived(late && lateDays >= warnDays)
  const closed = $derived(!isOpen(task))
</script>

<li class="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-2">
  <!-- 게터로 넘겨야 저장 실패 후 스토어가 되돌린 status가 화면에 반영된다 -->
  <Checkbox
    bind:checked={() => task.status === 'done', () => onToggle(task)}
    aria-label="{task.title} 완료"
  />

  <span
    class="flex-1 truncate"
    class:line-through={closed}
    class:text-muted-foreground={closed}
    class:italic={task.status === 'dropped'}
  >
    {task.title}
  </span>

  {#if project}
    <!-- hex에 알파를 이어붙이면 #rrggbb가 아닌 값에서 투명해진다 -->
    <span
      class="project-pill inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs text-foreground"
      style="--pc:{project.color}"
    >
      <span class="dot size-1.5 rounded-full ring-1 ring-foreground/40"></span>
      {project.name}
    </span>
  {/if}

  {#if task.priority === 1}
    <span class="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
      높음
    </span>
  {/if}

  {#if late}
    <span
      class="shrink-0 rounded-full px-2 py-0.5 text-xs text-warning"
      class:late-soft={!severe}
      class:late-strong={severe}
      class:font-semibold={severe}
    >
      {lateDays}일 밀림
    </span>
  {/if}

  {#if task.status === 'doing'}
    <span class="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">진행 중</span>
  {:else if isOpen(task)}
    <Button variant="ghost" size="sm" class="shrink-0" onclick={() => onStart(task)}>시작</Button>
  {/if}

  <Button
    variant="ghost"
    size="sm"
    class="shrink-0 text-muted-foreground hover:text-destructive"
    onclick={() => onDelete(task)}
    aria-label="{task.title} 삭제"
  >
    ×
  </Button>
</li>

<style>
  /* Tailwind의 슬래시 표기(bg-warning/10)는 class: 지시어의 클래스 이름으로
     쓸 수 없어, 두 단계 강조와 사용자 색 혼합을 여기서 정의한다.
     값은 전부 토큰이나 --pc 변수에서 가져오므로 하드코딩된 색은 없다. */
  .project-pill { background-color: color-mix(in srgb, var(--pc) 22%, transparent); }
  .dot { background-color: var(--pc); }
  .late-soft { background-color: color-mix(in srgb, var(--warning) 10%, transparent); }
  .late-strong { background-color: color-mix(in srgb, var(--warning) 20%, transparent); }
</style>

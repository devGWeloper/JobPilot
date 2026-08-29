# JobPilot Phase 2b — 남은 화면 마이그레이션과 컴포넌트 테스트 도입

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 오늘 화면과 그에 딸린 네 컴포넌트를 Phase 2a가 깐 토큰·shadcn 기반 위로 옮기고, 라이브러리가 상태를 소유하는 지점을 잡아낼 컴포넌트 테스트를 도입한다.

**Architecture:** 각 컴포넌트의 scoped `<style>`을 걷어내고 토큰 클래스로 대체한다. 사용자가 고른 프로젝트 색은 CSS 변수로 넘겨 `color-mix()`로 옅은 배경을 만든다. 모달은 shadcn `Dialog`에 얹어 포커스 트랩과 Escape를 라이브러리에서 얻는다.

**Tech Stack:** Tailwind CSS v4, shadcn-svelte, bits-ui, Svelte 5, Vite 6, TypeScript 5, Vitest 3, @testing-library/svelte

**선행 상태:** Phase 2a가 `main`에 병합되어 있다 (커밋 `ee3dce2`, vitest 163 통과, `npm run check` 678 files 0 errors 0 warnings).

## Global Constraints

- 런타임에 외부 네트워크를 호출하는 코드를 넣지 않는다. CDN에서 CSS·폰트·스크립트를 불러오지 않는다.
- `src/lib/core/`는 한 줄도 바뀌지 않는다. `src/lib/stores/`의 공개 인터페이스도 바뀌지 않는다.
- **동작을 바꾸지 않는다.** 이 단계는 외형 이전이다. Phase 1 리뷰가 남긴 수정들이 전부 살아남아야 한다.
- 색상을 hex로 직접 쓰지 않는다. 예외는 사용자가 고른 프로젝트 색상뿐이며, 그때도 CSS 변수로 넘긴다.
- `src/lib/components/ui/*`(shadcn 생성물)를 직접 수정하지 않는다. 필요하면 감싼다.
- 기존 163개 테스트가 계속 통과해야 한다. `npm run check`는 0 errors, 0 warnings를 유지한다.
- `src-tauri/`를 건드리지 않는다. Rust 툴체인 부재로 보류된 작업물이 untracked로 있다.
- `npm run tauri dev`를 실행하지 않는다. 확인은 `npm run dev`로 한다.
- 커밋 메시지는 Conventional Commits를 쓴다.

## 이 계획의 범위

**포함**

- 컴포넌트 테스트 인프라(@testing-library/svelte)와 첫 회귀 테스트
- 색 점 대비 보강 (Phase 2a 최종 리뷰의 이월 항목)
- `TaskItem`, `TaskList`, `QuickAdd`, `Today.svelte` 마이그레이션
- `DailyWrapUp`을 shadcn `Dialog`로 이전

**제외**

| 항목 | 이유 |
|---|---|
| Week / Calendar / Report 화면 | 기능 추가이므로 별도 계획 |
| 본격 디자인 패스 | 모든 화면이 나온 뒤에 한다 |
| Rust 저장 계층 | 툴체인 부재로 보류 중 |
| `<select>`를 shadcn `Select`로 교체 | 아래 참조 |

**`<select>`를 그대로 두는 이유.** 네이티브 `<select>`는 `color-scheme: dark` 선언을 따라 브라우저가 알아서 어둡게 그리고, 키보드 조작도 이미 옳다. bits-ui `Select`는 팝오버 기반이며 값의 소유권이 라이브러리로 넘어가는 구조인데, 그 구조가 Phase 2a에서 체크박스 롤백 버그를 낳은 원인이었다. 지금은 토큰 클래스만 입히고, 교체는 디자인 패스에서 판단한다.

---

## File Structure

```
JobPilot/
├── package.json                          (수정) @testing-library/svelte 추가
├── src/
│   ├── routes/
│   │   ├── Settings.svelte               (수정) 색 점 ring 보강
│   │   ├── Settings.test.ts              (신규) 체크박스 롤백 회귀 테스트
│   │   └── Today.svelte                  (교체) 토큰 기반으로 재작성
│   └── lib/
│       └── components/
│           ├── TaskItem.svelte           (교체)
│           ├── TaskList.svelte           (교체)
│           ├── QuickAdd.svelte           (교체)
│           ├── DailyWrapUp.svelte        (교체) shadcn Dialog 기반
│           └── ui/dialog/                (신규) shadcn CLI 생성
```

**책임 분리는 그대로 둔다.** 이 계획은 파일을 새로 나누지 않는다. 각 컴포넌트의 prop 계약과 책임은 Phase 1에서 정해졌고 검증을 거쳤다.

---

## Task 1: 컴포넌트 테스트 인프라와 색 점 보강

**Files:**
- Modify: `package.json`, `vite.config.ts`, `src/routes/Settings.svelte`
- Create: `src/routes/Settings.test.ts`

**Interfaces:**
- Consumes: `ConfigStore`, `MemoryStorage` (기존)
- Produces: `@testing-library/svelte`의 `render`/`screen`/`fireEvent`/`waitFor`를 쓰는 테스트 패턴. 이후 태스크가 이 패턴을 따른다.

**왜 이 태스크가 먼저인가.** Phase 2a 최종 리뷰가 "정적 검토로 잡히지 않는 유일한 항목이 실제로 버그였다"고 지적했다. 그 버그(체크박스가 저장 실패 후 되돌아오지 않음)는 이미 고쳤지만 **회귀 테스트가 없다.** 남은 네 컴포넌트도 같은 종류의 상태 소유권 문제를 안고 있으므로, 그걸 잡을 도구부터 갖춘다.

- [ ] **Step 1: 테스트 라이브러리 설치**

Run: `npm install -D @testing-library/svelte @testing-library/dom`
Expected: 오류 없이 완료

이어서 `vite.config.ts`의 `plugins` 배열에 `svelteTesting()`을 추가한다:

```ts
import { svelteTesting } from '@testing-library/svelte/vite'

export default defineConfig({
  plugins: [tailwindcss(), svelte(), svelteTesting()],
  // 나머지는 그대로
})
```

> 이 플러그인이 없으면 컴포넌트 테스트가 전부
> `lifecycle_function_unavailable`로 죽는다. `@sveltejs/vite-plugin-svelte`가
> vitest 아래에서는 Svelte를 SSR 모드로 컴파일해 `mount()`를 내주지 않기
> 때문이다. 플러그인 내부가 `process.env.VITEST`로 스스로를 가드하므로
> `dev`/`build`/`tauri`에는 영향이 없다. `test.environment`(jsdom)와
> `test.include`는 건드리지 않는다 — 그쪽 주석에 적힌 이유가 따로 있다.

- [ ] **Step 2: 실패하는 회귀 테스트 작성**

`src/routes/Settings.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/svelte'
import Settings from './Settings.svelte'
import { createConfigStore } from '../lib/stores/config.svelte'
import { MemoryStorage } from '../lib/adapters/memoryStorage'

afterEach(cleanup)

/** 원할 때 한 번 저장을 실패시키는 저장소 */
class FailingStorage extends MemoryStorage {
  failNextSave = false

  override async save<T>(key: string, value: T): Promise<void> {
    if (this.failNextSave) {
      this.failNextSave = false
      throw new Error('디스크에 쓸 수 없습니다')
    }
    await super.save(key, value)
  }
}

async function setup() {
  const storage = new FailingStorage()
  const config = createConfigStore(storage)
  await config.load()
  await config.addProject('A사', '#4f7cff')
  render(Settings, { config })
  return { storage, config }
}

describe('설정 화면 — 저장이 실패했을 때', () => {
  it('사용 체크박스가 원래 상태로 되돌아온다', async () => {
    const { storage, config } = await setup()
    const box = screen.getByRole('checkbox')
    expect(box.getAttribute('aria-checked')).toBe('true')

    storage.failNextSave = true
    await fireEvent.click(box)

    // 스토어는 롤백된다
    await waitFor(() => expect(config.config.projects[0]!.active).toBe(true))
    // 화면도 따라와야 한다. 이 단언이 Phase 2a에서 고친 버그를 지킨다.
    await waitFor(() => expect(box.getAttribute('aria-checked')).toBe('true'))
  })

  it('실패 사유를 화면에 띄운다', async () => {
    const { storage } = await setup()
    storage.failNextSave = true
    await fireEvent.click(screen.getByRole('checkbox'))

    await waitFor(() =>
      expect(screen.getByText(/디스크에 쓸 수 없습니다/)).toBeTruthy(),
    )
  })
})

describe('설정 화면 — 저장이 성공했을 때', () => {
  it('사용 체크박스가 꺼진 상태로 남는다', async () => {
    const { config } = await setup()
    const box = screen.getByRole('checkbox')

    await fireEvent.click(box)

    await waitFor(() => expect(config.config.projects[0]!.active).toBe(false))
    await waitFor(() => expect(box.getAttribute('aria-checked')).toBe('false'))
  })
})
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npx vitest run src/routes/Settings.test.ts`
Expected: FAIL — `@testing-library/svelte`가 아직 없거나(설치 전이면) import 오류. 설치 후에도 실패한다면 그 출력을 그대로 리포트에 남긴다.

> 이 테스트는 **이미 고쳐진 버그**를 지키는 회귀 테스트다. 구현이 옳다면
> Step 4에서 바로 통과한다. 통과하지 않는다면 그것 자체가 발견이므로
> 임의로 고치지 말고 보고한다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/routes/Settings.test.ts`
Expected: PASS — 3개 통과

Run: `npm test`
Expected: 163 + 3 = 166 passed

- [ ] **Step 5: 색 점 대비 보강**

Phase 2a 최종 리뷰가 `ring-foreground/20`은 다크에서 1.83:1이라 WCAG 1.4.11의 3:1에 못 미친다고 지적했다. `/40`으로 올린다.

`src/routes/Settings.svelte`에서 색 점의 클래스를 바꾼다:

```
ring-1 ring-foreground/20   →   ring-1 ring-foreground/40
```

주석의 설명은 그대로 두되, 수치를 덧붙인다:

```
                   ring-foreground/20은 다크에서 1.83:1로 여전히 WCAG 1.4.11의
                   3:1에 못 미쳐 /40으로 올렸다(약 2.9:1). -->
```

- [ ] **Step 6: 확인과 커밋**

Run: `npm test && npm run check`
Expected: 166 passed, 0 errors 0 warnings

```bash
git add package.json package-lock.json src/routes/Settings.test.ts src/routes/Settings.svelte
git commit -m "test: add component tests and guard the checkbox rollback"
```

---

## Task 2: TaskItem과 TaskList 마이그레이션

**Files:**
- Replace: `src/lib/components/TaskItem.svelte`, `src/lib/components/TaskList.svelte`
- Create: `src/lib/components/TaskItem.test.ts`

**Interfaces:**
- Consumes: `Task`, `Project`, `DateStr`, `isOpen`/`isOverdue`/`overdueDays` (기존), `Button`/`Checkbox` (Phase 2a)
- Produces: prop 계약은 **바뀌지 않는다.** `TaskItem`은 `{ task, today, project?, warnDays, onToggle, onStart, onDelete }`, `TaskList`는 `{ title, tasks, today, config, emptyText, onToggle, onStart, onDelete }`를 그대로 받는다.

**여기서 반복되는 함정.** 완료 체크박스도 설정 화면의 "사용" 체크박스와 같은 구조다. `onToggle`이 스토어를 갱신하고, 저장이 실패하면 스토어가 `task.status`를 되돌린다. `checked`를 평범한 prop으로 넘기면 그 되돌림이 화면에 닿지 않는다. 반드시 함수 바인딩을 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/components/TaskItem.test.ts`:

```ts
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte'
import TaskItem from './TaskItem.svelte'
import { createTask, completeTask } from '../core/task'
import type { Task } from '../types'

afterEach(cleanup)

const AT = new Date(2026, 7, 3, 10, 0, 0)

function make(overrides: Partial<Task> = {}): Task {
  return { ...createTask({ title: '보고서 초안', plannedDate: '2026-08-03' }, AT), ...overrides }
}

function mount(task: Task, today = '2026-08-03') {
  const onToggle = vi.fn()
  const onStart = vi.fn()
  const onDelete = vi.fn()
  render(TaskItem, { task, today, warnDays: 3, onToggle, onStart, onDelete })
  return { onToggle, onStart, onDelete }
}

describe('TaskItem 체크박스', () => {
  it('열린 업무는 체크되지 않은 상태로 보인다', () => {
    mount(make())
    expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe('false')
  })

  it('완료된 업무는 체크된 상태로 보인다', () => {
    mount(completeTask(make(), AT))
    expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe('true')
  })

  it('클릭하면 onToggle을 부른다', async () => {
    const { onToggle } = mount(make())
    await fireEvent.click(screen.getByRole('checkbox'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('onToggle이 상태를 바꾸지 않으면 체크박스도 원래대로 남는다', async () => {
    // 저장 실패로 스토어가 롤백한 상황을 흉내낸다. task는 그대로다.
    const { onToggle } = mount(make())
    const box = screen.getByRole('checkbox')
    await fireEvent.click(box)
    expect(onToggle).toHaveBeenCalled()
    expect(box.getAttribute('aria-checked')).toBe('false')
  })
})

describe('TaskItem 배지', () => {
  it('밀린 업무에 일수를 보여준다', () => {
    mount(make({ plannedDate: '2026-08-01' }), '2026-08-03')
    expect(screen.getByText('2일 밀림')).toBeTruthy()
  })

  it('밀리지 않았으면 일수 배지가 없다', () => {
    mount(make())
    expect(screen.queryByText(/일 밀림/)).toBeNull()
  })

  it('우선순위가 높으면 표시한다', () => {
    mount(make({ priority: 1 }))
    expect(screen.getByText('높음')).toBeTruthy()
  })

  it('진행 중이면 배지를 보여주고 시작 버튼을 감춘다', () => {
    mount(make({ status: 'doing' }))
    expect(screen.getByText('진행 중')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '시작' })).toBeNull()
  })

  it('열린 업무에는 시작 버튼이 있다', async () => {
    const { onStart } = mount(make())
    await fireEvent.click(screen.getByRole('button', { name: '시작' }))
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('삭제 버튼이 onDelete를 부른다', async () => {
    const task = make()
    const { onDelete } = mount(task)
    await fireEvent.click(screen.getByRole('button', { name: `${task.title} 삭제` }))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run src/lib/components/TaskItem.test.ts`
Expected: FAIL — 현재 `TaskItem`은 네이티브 `<input type="checkbox">`를 쓰므로 `getByRole('checkbox')`가 `aria-checked` 속성을 갖지 않는다. `aria-checked`가 `null`이라는 실패가 나와야 정상이다. 관측한 출력을 리포트에 남긴다.

- [ ] **Step 3: TaskItem 재작성**

`src/lib/components/TaskItem.svelte`를 다음으로 교체한다:

```svelte
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
  <!-- 설정 화면의 "사용" 체크박스와 같은 이유로 함수 바인딩이어야 한다.
       onToggle이 스토어를 갱신하고 저장이 실패하면 스토어가 task.status를
       되돌리는데, 평범한 prop으로 넘기면 그 되돌림이 화면에 닿지 않는다.
       게터가 task.status를 매번 다시 읽어야 롤백이 반영된다. -->
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
    <!-- 사용자가 고른 색을 CSS 변수로 넘기고 color-mix로 옅게 만든다.
         예전처럼 hex 뒤에 "22"를 이어붙이면 #rrggbb가 아닌 값에서
         조용히 투명해진다. 글자는 foreground로 둬야 어떤 색을 골라도 읽힌다. -->
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/components/TaskItem.test.ts`
Expected: PASS — 10개 통과

- [ ] **Step 5: TaskList 재작성**

`src/lib/components/TaskList.svelte`를 다음으로 교체한다:

```svelte
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
```

- [ ] **Step 6: 확인과 커밋**

Run: `npm test && npm run check`
Expected: 176 passed (166 + 10), 0 errors 0 warnings

```bash
git add src/lib/components/TaskItem.svelte src/lib/components/TaskItem.test.ts src/lib/components/TaskList.svelte
git commit -m "feat: move the task row and list onto tokens"
```

---

## Task 3: QuickAdd와 Today 화면 마이그레이션

**Files:**
- Replace: `src/lib/components/QuickAdd.svelte`, `src/routes/Today.svelte`
- Create: `src/lib/components/QuickAdd.test.ts`

**Interfaces:**
- Consumes: `ConfigStore`, `TaskStore`, `Button`/`Input`/`Alert` (Phase 2a), `TaskList` (Task 2)
- Produces (**계약이 바뀐다 — 아래 참조**):
  - `QuickAdd` props: `{ config: ConfigStore; onAdd: (input: { title: string; projectId?: string; priority: 1|2|3 }) => Promise<boolean> }`
  - `Today.svelte`의 `run()`이 `Promise<boolean>`을 반환한다

**함께 고치는 버그.** Phase 1 최종 리뷰가 남긴 지적이다. 지금 `QuickAdd.submit()`은 `await onAdd(...)` 뒤에 무조건 `title = ''`을 실행한다. 그런데 `Today`의 `run()`은 실패를 삼키고 정상 반환하므로, **추가가 실패해도 입력칸이 비워진다.** 사용자는 오류 문구를 보면서 방금 쓴 제목까지 잃는다. 또 `QuickAdd`가 자체 try/catch와 `error` 상태를 갖고 있는데 `run()`이 이미 잡아버려서 **영영 실행되지 않는 죽은 코드**다.

`Settings.svelte`가 이미 쓰는 패턴으로 통일한다: `run()`이 성공 여부를 boolean으로 돌려주고, 화면이 그걸 보고 판단한다. `QuickAdd`의 죽은 오류 처리는 걷어내고 `Today`가 오류를 표시한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/components/QuickAdd.test.ts`:

```ts
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/svelte'
import QuickAdd from './QuickAdd.svelte'
import { createConfigStore } from '../stores/config.svelte'
import { MemoryStorage } from '../adapters/memoryStorage'

afterEach(cleanup)

async function setup(onAdd: (input: {
  title: string
  projectId?: string
  priority: 1 | 2 | 3
}) => Promise<boolean>) {
  const config = createConfigStore(new MemoryStorage())
  await config.load()
  await config.addProject('A사', '#4f7cff')
  render(QuickAdd, { config, onAdd })
  return { config }
}

describe('QuickAdd', () => {
  it('제목을 입력하고 제출하면 onAdd를 부른다', async () => {
    const onAdd = vi.fn().mockResolvedValue(true)
    await setup(onAdd)

    await fireEvent.input(screen.getByLabelText('업무 제목'), {
      target: { value: '보고서 초안' },
    })
    await fireEvent.click(screen.getByRole('button', { name: '추가' }))

    await waitFor(() =>
      expect(onAdd).toHaveBeenCalledWith({
        title: '보고서 초안',
        projectId: undefined,
        priority: 2,
      }),
    )
  })

  it('성공하면 입력칸을 비운다', async () => {
    const onAdd = vi.fn().mockResolvedValue(true)
    await setup(onAdd)
    const input = screen.getByLabelText('업무 제목') as HTMLInputElement

    await fireEvent.input(input, { target: { value: '보고서 초안' } })
    await fireEvent.click(screen.getByRole('button', { name: '추가' }))

    await waitFor(() => expect(input.value).toBe(''))
  })

  it('실패하면 입력칸을 비우지 않는다', async () => {
    // 이것이 이 태스크가 고치는 버그다. 실패했는데 제목을 지우면
    // 사용자는 오류를 보면서 방금 쓴 내용까지 잃는다.
    const onAdd = vi.fn().mockResolvedValue(false)
    await setup(onAdd)
    const input = screen.getByLabelText('업무 제목') as HTMLInputElement

    await fireEvent.input(input, { target: { value: '보고서 초안' } })
    await fireEvent.click(screen.getByRole('button', { name: '추가' }))

    await waitFor(() => expect(onAdd).toHaveBeenCalled())
    expect(input.value).toBe('보고서 초안')
  })

  it('제목이 비어 있으면 onAdd를 부르지 않는다', async () => {
    const onAdd = vi.fn().mockResolvedValue(true)
    await setup(onAdd)
    await fireEvent.click(screen.getByRole('button', { name: '추가' }))
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('공백만 있어도 onAdd를 부르지 않는다', async () => {
    const onAdd = vi.fn().mockResolvedValue(true)
    await setup(onAdd)
    await fireEvent.input(screen.getByLabelText('업무 제목'), {
      target: { value: '   ' },
    })
    await fireEvent.click(screen.getByRole('button', { name: '추가' }))
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('활성 프로젝트를 선택지로 보여준다', async () => {
    await setup(vi.fn().mockResolvedValue(true))
    const select = screen.getByLabelText('프로젝트') as HTMLSelectElement
    const labels = [...select.options].map((o) => o.textContent?.trim())
    expect(labels).toContain('프로젝트 없음')
    expect(labels).toContain('A사')
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run src/lib/components/QuickAdd.test.ts`
Expected: FAIL — "실패하면 입력칸을 비우지 않는다"가 깨진다. 현재 구현은 결과와 무관하게 `title`을 비우기 때문이다. 관측한 출력을 리포트에 남긴다.

- [ ] **Step 3: QuickAdd 재작성**

`src/lib/components/QuickAdd.svelte`를 다음으로 교체한다:

```svelte
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/components/QuickAdd.test.ts`
Expected: PASS — 6개 통과

- [ ] **Step 5: Today 화면 재작성**

`src/routes/Today.svelte`를 다음으로 교체한다. `run()`의 반환 타입이 `Promise<boolean>`으로 바뀌는 것 외에 **동작은 그대로다** — 모든 조작이 `run()`을 통과하고 실패가 화면에 뜨는 성질을 유지한다.

```svelte
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

  // 상태 전이는 잘못된 전환에서 throw하고, 저장은 디스크 사정으로 실패할 수
  // 있다. 모든 동작을 이 함수로 통과시켜, 실패가 unhandled rejection으로
  // 조용히 사라지지 않고 화면에 뜨게 한다.
  // 성공 여부를 돌려주는 이유: QuickAdd가 실패 시 입력칸을 남겨야 한다.
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
```

- [ ] **Step 6: 확인과 커밋**

Run: `npm test && npm run check`
Expected: 182 passed (176 + 6), 0 errors 0 warnings

```bash
git add src/lib/components/QuickAdd.svelte src/lib/components/QuickAdd.test.ts src/routes/Today.svelte
git commit -m "feat: move the today screen onto tokens and keep a failed add's text"
```

---

## Task 4: DailyWrapUp을 shadcn Dialog로 이전

**Files:**
- Create: `src/lib/components/ui/dialog/` (shadcn CLI 생성)
- Replace: `src/lib/components/DailyWrapUp.svelte`
- Create: `src/lib/components/DailyWrapUp.test.ts`

**Interfaces:**
- Consumes: `TaskStore`, `ConfigStore`, `pendingForWrapUp`/`WrapUpDecision` (기존), `Button`/`Input`/`Dialog`
- Produces: props는 **바뀌지 않는다** — `{ tasks, config, today, onClose }`

**이 태스크가 닫는 이월 항목 두 개.** Phase 1 최종 리뷰가 남긴 것들이다.

1. **포커스 트랩이 없다.** 키보드 사용자가 시트를 열면 뒤쪽 페이지로 탭이 빠져나간다. `Dialog`가 이걸 라이브러리에서 해결한다. 지금 손으로 붙인 Escape 핸들러도 `Dialog`가 대신하므로 걷어낸다.
2. **`background: Canvas; color: CanvasText`.** CSS 시스템 색상이라 토큰 체계와 어긋나고, Phase 1 리뷰가 "shadcn 테마와 싸운다"고 지적했다. `Dialog.Content`가 `bg-background`를 쓰므로 자연히 해소된다.

- [ ] **Step 1: Dialog 컴포넌트 설치**

Run: `npx shadcn-svelte@latest add dialog`
Expected: `src/lib/components/ui/dialog/`가 생성된다

Run: `npm run check`
Expected: 0 errors

- [ ] **Step 2: 실패하는 테스트 작성**

`src/lib/components/DailyWrapUp.test.ts`:

```ts
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/svelte'
import DailyWrapUp from './DailyWrapUp.svelte'
import { createTaskStore } from '../stores/tasks.svelte'
import { createConfigStore } from '../stores/config.svelte'
import { MemoryStorage } from '../adapters/memoryStorage'
import { FixedClock } from '../adapters/fixedClock'

afterEach(cleanup)

const TODAY = '2026-08-03'
const NOW = new Date(2026, 7, 3, 18, 0, 0)

async function setup(titles: string[]) {
  const storage = new MemoryStorage()
  const clock = new FixedClock(NOW)
  const tasks = createTaskStore(storage, clock)
  const config = createConfigStore(storage)
  await config.load()
  await tasks.loadAround(TODAY)
  for (const t of titles) await tasks.add({ title: t, plannedDate: TODAY })

  const onClose = vi.fn()
  render(DailyWrapUp, { tasks, config, today: TODAY, onClose })
  return { tasks, config, onClose }
}

describe('DailyWrapUp', () => {
  it('정리할 업무를 모두 보여준다', async () => {
    await setup(['보고서', '리뷰'])
    await waitFor(() => expect(screen.getByText('보고서')).toBeTruthy())
    expect(screen.getByText('리뷰')).toBeTruthy()
  })

  it('기본 선택은 내일로 이월이다', async () => {
    await setup(['보고서'])
    const carry = await waitFor(
      () => screen.getAllByRole('radio', { name: '내일로' })[0] as HTMLInputElement,
    )
    expect(carry.checked).toBe(true)
  })

  it('마감하면 이월된 업무가 내일 날짜로 옮겨진다', async () => {
    const { tasks, onClose } = await setup(['보고서'])
    await fireEvent.click(await waitFor(() => screen.getByRole('button', { name: '마감하기' })))

    await waitFor(() => expect(tasks.all[0]!.plannedDate).toBe('2026-08-04'))
    expect(tasks.all[0]!.carryCount).toBe(1)
    expect(onClose).toHaveBeenCalled()
  })

  it('완료를 고르면 메모 입력칸이 나타난다', async () => {
    await setup(['보고서'])
    const done = await waitFor(
      () => screen.getAllByRole('radio', { name: '완료' })[0] as HTMLInputElement,
    )
    expect(screen.queryByLabelText('메모')).toBeNull()

    await fireEvent.click(done)

    await waitFor(() => expect(screen.getByLabelText('메모')).toBeTruthy())
  })

  it('완료로 마감하면 실적 메모가 저장된다', async () => {
    const { tasks } = await setup(['보고서'])
    await fireEvent.click(
      await waitFor(() => screen.getAllByRole('radio', { name: '완료' })[0]!),
    )
    await fireEvent.input(await waitFor(() => screen.getByLabelText('메모')), {
      target: { value: '초안까지 완료' },
    })
    await fireEvent.click(screen.getByRole('button', { name: '마감하기' }))

    await waitFor(() => expect(tasks.all[0]!.status).toBe('done'))
    expect(tasks.all[0]!.actualNote).toBe('초안까지 완료')
  })

  it('정리할 업무가 없으면 안내를 보여주고 마감 버튼을 잠근다', async () => {
    await setup([])
    await waitFor(() => expect(screen.getByText(/정리할 업무가 없습니다/)).toBeTruthy())
    expect((screen.getByRole('button', { name: '마감하기' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
  })
})
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npx vitest run src/lib/components/DailyWrapUp.test.ts`
Expected: FAIL — 현재 라디오에 접근 가능한 이름이 붙어 있지 않아 `getAllByRole('radio', { name: ... })`이 찾지 못한다. 관측한 출력을 리포트에 남긴다.

- [ ] **Step 4: DailyWrapUp 재작성**

`src/lib/components/DailyWrapUp.svelte`를 다음으로 교체한다:

```svelte
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

  // $derived여야 한다. today는 자정을 넘기면 실제로 바뀌는데(App.svelte 참고)
  // 이 시트는 열린 채로 살아 있을 수 있다. 평범한 const로 두면 tomorrow가
  // 굳어서, 이월 대상이 이미 지나간 날짜가 되고 carryTask가 계속 거부한다.
  // 컴포넌트가 리마운트되지 않으므로 다시 시도해도 빠져나오지 못한다.
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

<!-- 이 컴포넌트는 Today가 {#if}로 감싸 열려 있을 때만 존재한다. 그래서
     게터는 항상 true이고, Dialog가 닫히려 할 때 onClose로 알린다.
     Escape·바깥 클릭·포커스 트랩은 모두 Dialog가 처리하므로 직접 붙이지 않는다. -->
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
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/lib/components/DailyWrapUp.test.ts`
Expected: PASS — 6개 통과

- [ ] **Step 6: 확인과 커밋**

Run: `npm test && npm run check`
Expected: 188 passed (182 + 6), 0 errors 0 warnings

```bash
git add src/lib/components/ui/dialog src/lib/components/DailyWrapUp.svelte src/lib/components/DailyWrapUp.test.ts
git commit -m "feat: move the wrap-up sheet onto the dialog primitive"
```

---

## 마무리 확인

- [ ] **전체 검증**

Run: `npm test`
Expected: 188 passed

Run: `npm run check`
Expected: 0 errors, 0 warnings

Run: `npm run build`
Expected: 성공

- [ ] **하드코딩된 색이 남아 있지 않은지**

Run: `npx rg -n "#[0-9a-fA-F]{3,6}|Canvas|CanvasText" src/routes src/lib/components --glob '!**/ui/**'`

Expected: `Settings.svelte`의 `newColor = $state('#4f7cff')` 한 줄만 나온다. 사용자가 고르는 프로젝트 색의 기본값이라 토큰이 아닌 것이 맞다.

- [ ] **scoped style이 토큰만 참조하는지**

`TaskItem.svelte`와 `DailyWrapUp.svelte`에 남은 `<style>` 블록은 `var(--warning)`과 `var(--pc)`만 쓴다. 리터럴 색이 있으면 토큰으로 바꾼다.

<script lang="ts">
  import type { Project } from '../lib/types'
  import type { ConfigStore } from '../lib/stores/config.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import { Label } from '$lib/components/ui/label'
  import * as Card from '$lib/components/ui/card'
  import * as Alert from '$lib/components/ui/alert'

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

<div class="mx-auto max-w-2xl p-6">
  <Card.Root>
    <Card.Header>
      <Card.Title>프로젝트</Card.Title>
      <Card.Description>
        업무를 묶는 단위입니다. 주간보고도 이 단위로 정리됩니다.
      </Card.Description>
    </Card.Header>

    <Card.Content class="space-y-4">
      <form
        class="flex items-center gap-2"
        onsubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <Input
          type="text"
          bind:value={newName}
          placeholder="프로젝트 이름"
          aria-label="새 프로젝트 이름"
          class="flex-1"
        />
        <input
          type="color"
          bind:value={newColor}
          aria-label="색상"
          class="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1"
        />
        <Button type="submit">추가</Button>
      </form>

      {#if message}
        <Alert.Root variant="destructive">
          <Alert.Description>{message}</Alert.Description>
        </Alert.Root>
      {/if}

      {#if config.config.projects.length === 0}
        <p class="py-6 text-center text-sm text-muted-foreground">
          아직 프로젝트가 없습니다.
        </p>
      {:else}
        <ul class="divide-y divide-border">
          {#each config.config.projects as p (p.id)}
            <li class="flex items-center gap-3 py-2">
              <!-- 테두리를 점 색이 아니라 카드 배경 기준으로 대비시킨다.
                   ring-border는 다크에서 카드와 명도 차이가 7포인트뿐이라,
                   사용자가 어두운 프로젝트 색을 고르면 점이 통째로 사라진다.
                   ring-foreground/20은 다크에서 1.83:1로 여전히 WCAG 1.4.11의
                   3:1에 못 미쳐 /40으로 올렸다(약 2.9:1). -->
              <span
                class="size-3.5 shrink-0 rounded-full ring-1 ring-foreground/40"
                style="background:{p.color}"
              ></span>

              <Input
                value={p.name}
                onchange={(e) => rename(p, e.currentTarget)}
                aria-label="프로젝트 이름"
                class="h-8 flex-1"
              />

              <div class="flex shrink-0 items-center gap-1.5">
                <!-- 평범한 prop이 아니라 함수 바인딩이어야 한다.
                     Checkbox는 checked를 $bindable로 선언해 bits-ui에 넘기므로,
                     클릭하는 순간 상태 소유권이 그쪽으로 넘어간다. 저장이 실패해
                     스토어가 p.active를 원래 값으로 되돌려도 prop 값은 그대로라
                     Svelte가 정정을 내려보내지 않고, 체크박스만 뒤집힌 채 남는다.
                     게터로 넘기면 롤백이 그대로 화면에 반영된다. -->
                <Checkbox
                  id="active-{p.id}"
                  bind:checked={
                    () => p.active,
                    (v) => { run(() => config.setProjectActive(p.id, v)) }
                  }
                />
                <Label for="active-{p.id}" class="text-sm text-muted-foreground">사용</Label>
              </div>

              <Button
                variant="ghost"
                size="sm"
                class="shrink-0 text-muted-foreground hover:text-destructive"
                onclick={() => remove(p.id, p.name)}
              >
                삭제
              </Button>
            </li>
          {/each}
        </ul>
      {/if}
    </Card.Content>
  </Card.Root>
</div>

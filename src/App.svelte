<script lang="ts">
  import { getStorage, getClock } from './lib/stores/context'
  import { createConfigStore } from './lib/stores/config.svelte'
  import { createTaskStore } from './lib/stores/tasks.svelte'
  import { toDateStr } from './lib/core/dates'
  import { createThemeStore, browserThemeStorage } from './lib/theme.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Alert from '$lib/components/ui/alert'
  import Today from './routes/Today.svelte'
  import Settings from './routes/Settings.svelte'

  const storage = getStorage()
  const clock = getClock()
  const config = createConfigStore(storage)
  const tasks = createTaskStore(storage, clock)
  const theme = createThemeStore(browserThemeStorage)

  // 상수가 아니라 상태다. 앱을 며칠씩 켜두는 것이 정상 사용이라
  // 자정을 넘기면 이 값이 따라가야 한다. 고정해두면 화면이 어제에 머물고,
  // 그 상태에서 추가한 업무가 어제 날짜로 저장된다.
  let today = $state(toDateStr(clock.now()))

  let tab = $state<'today' | 'settings'>('today')
  let ready = $state(false)
  let loadError = $state<string | null>(null)

  // 저장된 테마를 첫 페인트 직후 문서에 반영한다
  $effect(() => {
    theme.apply()
  })

  $effect(() => {
    function sync() {
      const now = toDateStr(clock.now())
      if (now !== today) today = now
    }
    // 절전에서 깨어난 직후처럼 타이머가 밀린 경우를 위해 포커스에서도 확인한다
    const timer = setInterval(sync, 60_000)
    window.addEventListener('focus', sync)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', sync)
    }
  })

  // today를 읽으므로 날짜가 바뀌면 다시 실행된다.
  // 달을 넘긴 경우 새 달 파일을 읽어와야 하므로 이 재실행이 필요하다.
  $effect(() => {
    // 매번 다시 실행되기 전에 이전 오류를 비운다. 비우지 않으면 자정
    // 재로드 중 일시적 오류(파일 잠금, 백신 검사 등)가 한 번 나는 순간
    // ready였던 화면이 영영 치명적 오류 화면으로 굳는다 — 다음 재실행은
    // 24시간 뒤이고, 그마저도 이 줄이 없으면 오류를 비우지 못한다.
    loadError = null
    Promise.all([config.load(), tasks.loadAround(today)])
      .then(() => { ready = true })
      .catch((e) => { loadError = e instanceof Error ? e.message : String(e) })
  })
</script>

<div class="min-h-screen bg-background text-foreground">
  <nav class="flex items-center gap-1 border-b border-border px-3 py-2">
    <Button
      variant={tab === 'today' ? 'secondary' : 'ghost'}
      size="sm"
      onclick={() => (tab = 'today')}
    >
      오늘
    </Button>
    <Button
      variant={tab === 'settings' ? 'secondary' : 'ghost'}
      size="sm"
      onclick={() => (tab = 'settings')}
    >
      설정
    </Button>

    <Button
      class="ml-auto"
      variant="ghost"
      size="sm"
      onclick={() => theme.toggle()}
      aria-label={theme.theme === 'dark' ? '밝은 테마로 전환' : '어두운 테마로 전환'}
    >
      {theme.theme === 'dark' ? '☀' : '☾'}
    </Button>
  </nav>

  {#if loadError && !ready}
    <!-- 최초 로드 실패: 보여줄 화면이 아예 없으므로 치명적 오류로 처리한다 -->
    <div class="p-6">
      <Alert.Root variant="destructive">
        <Alert.Description>데이터를 불러오지 못했습니다: {loadError}</Alert.Description>
      </Alert.Root>
    </div>
  {:else if !ready}
    <p class="p-6 text-muted-foreground">불러오는 중…</p>
  {:else}
    {#if loadError}
      <!-- 재로드 실패: 이미 화면이 떠 있으므로 배너만 띄우고 기존 화면은 그대로 둔다 -->
      <div class="border-b border-border bg-warning/10 px-4 py-2 text-sm text-warning">
        방금 데이터를 다시 불러오지 못했습니다: {loadError}
      </div>
    {/if}
    {#if tab === 'today'}
      <Today {tasks} {config} {today} />
    {:else}
      <Settings {config} />
    {/if}
  {/if}
</div>

# JobPilot 1단계 — Today 화면과 계획→실적 루프 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 오늘 할 일을 등록·완료하고, 못 끝낸 일을 다음 날로 이월하며, 하루 마감으로 계획을 실적으로 전환하는 portable 데스크톱 앱을 만든다.

**Architecture:** Tauri 2 셸 안에 Svelte 5 프론트엔드를 올린다. 도메인 로직은 Tauri를 전혀 모르는 순수 TypeScript 함수(`src/lib/core/`)로 두고, 파일 저장과 시각 조회는 포트 인터페이스 뒤에 둔다. Rust는 원자적 JSON 쓰기와 백업만 담당한다. 데이터는 실행 파일 옆 `data/` 폴더에 월별 JSON으로 저장된다.

**Tech Stack:** Tauri 2 (Rust), Svelte 5 (runes), TypeScript 5, Vite 6, Vitest 3

**Spec:** `docs/superpowers/specs/2026-08-03-job-manager-design.md`

## Global Constraints

- 대상 플랫폼은 Windows. portable 배포(폴더 복사로 동작)가 기본이다.
- 외부 네트워크 호출을 하는 코드를 이 단계에서 작성하지 않는다. 클라우드 SDK를 추가하지 않는다.
- `src/lib/core/` 안의 모든 모듈은 `@tauri-apps/*`를 import하지 않는다. 순수 함수만 둔다.
- 시각을 얻을 때 `new Date()`를 도메인 로직에서 직접 호출하지 않는다. 항상 `Clock` 포트를 거친다.
- 날짜 문자열은 `YYYY-MM-DD` 로컬 날짜(`DateStr`)로 통일한다. 시각이 필요한 값만 ISO 8601 문자열을 쓴다.
- 모든 데이터 파일은 최상위에 `schemaVersion: 1`을 갖는다.
- 저장은 반드시 원자적으로 한다(임시 파일 → rename). 손상된 JSON을 만나면 절대 덮어쓰지 않는다.
- 커밋 메시지는 Conventional Commits(`feat:`, `test:`, `chore:`, `fix:`)를 쓴다.

## 이 계획의 범위

**포함** (스펙 12장의 1~2단계)

- Tauri 셸 + 원자적 저장 계층 + 일일 백업 생성
- `core/dates`, `core/task`, `core/daily`
- Today 화면: 업무 등록, 완료, 진행 중 전환, 밀린 업무 그룹
- 하루 마감: 미완료 업무 일괄 처리(완료 / 이월 / 포기)
- Settings: 프로젝트 CRUD

**의도적으로 제외** (후속 계획에서 다룬다)

| 항목 | 다룰 단계 |
|---|---|
| Event, 알람, 트레이 | 3단계 |
| Week / Calendar 화면 | 4단계 |
| Report, 마크다운 내보내기 | 5단계 |
| 반복 템플릿, 자연어 입력 | 6단계 |
| AI 레이어 전체 | 7단계 |
| 백업 목록 조회·복구 UI (`Storage.listBackups` / `restoreBackup`) | 5단계 (Settings 데이터 탭과 함께) |
| 직무 프로필, 근무시간 설정 UI | 3단계(근무시간) / 7단계(프로필) |

백업 **생성**은 이 단계에 포함한다(데이터 유실 방지가 먼저다). 복구 **UI**만 미룬다.

---

## File Structure

```
JobPilot/
├── .gitignore
├── package.json
├── tsconfig.json
├── vite.config.ts              Vite + Vitest 설정
├── svelte.config.js
├── index.html
├── src/
│   ├── main.ts                 앱 부트스트랩, 포트 조립
│   ├── App.svelte              루트 레이아웃 + 탭 전환
│   ├── app.css                 전역 스타일
│   ├── lib/
│   │   ├── types.ts            Task, Project, Config, 파일 봉투 타입
│   │   ├── core/
│   │   │   ├── dates.ts        DateStr 유틸 (순수)
│   │   │   ├── dates.test.ts
│   │   │   ├── ids.ts          id 생성
│   │   │   ├── task.ts         상태 전이, 이월, 밀린 일수 (순수)
│   │   │   ├── task.test.ts
│   │   │   ├── daily.ts        하루 마감 일괄 적용 (순수)
│   │   │   └── daily.test.ts
│   │   ├── ports/
│   │   │   ├── clock.ts        Clock 인터페이스
│   │   │   └── storage.ts      Storage 인터페이스 + 오류 타입
│   │   ├── adapters/
│   │   │   ├── systemClock.ts  실제 시각
│   │   │   ├── fixedClock.ts   테스트용 고정 시각
│   │   │   ├── memoryStorage.ts 테스트/브라우저 개발용
│   │   │   └── tauriStorage.ts  Tauri IPC 어댑터
│   │   ├── stores/
│   │   │   ├── context.ts      포트 주입 지점
│   │   │   ├── config.svelte.ts   설정·프로젝트 상태
│   │   │   ├── config.test.ts
│   │   │   ├── tasks.svelte.ts    업무 상태 + 월별 파일 관리
│   │   │   └── tasks.test.ts
│   │   └── components/
│   │       ├── QuickAdd.svelte
│   │       ├── TaskItem.svelte
│   │       ├── TaskList.svelte
│   │       └── DailyWrapUp.svelte
│   └── routes/
│       ├── Today.svelte
│       └── Settings.svelte
└── src-tauri/
    ├── Cargo.toml
    ├── build.rs
    ├── tauri.conf.json
    ├── icons/                  npx tauri icon 생성물
    └── src/
        ├── main.rs             진입점
        ├── lib.rs              Tauri 앱 + 커맨드 등록
        └── storage.rs          원자적 쓰기, 격리, 백업 (cargo test 대상)
```

**책임 분리 요약**

- `core/`는 데이터를 받아 데이터를 반환한다. IO도 상태도 없다. 테스트가 밀리초 단위로 돈다.
- `stores/`는 상태를 들고 `core/`를 호출하며 `ports/`로 저장한다.
- `components/`와 `routes/`는 `stores/`만 본다. 로직을 담지 않는다.
- `src-tauri/src/storage.rs`는 파일 안전성만 책임진다. 도메인을 모른다.

---

## Task 1: 프로젝트 스캐폴딩과 날짜 유틸

**Files:**
- Create: `.gitignore`, `package.json`, `tsconfig.json`, `vite.config.ts`, `svelte.config.js`, `index.html`, `src/main.ts`, `src/App.svelte`, `src/app.css`
- Create: `src/lib/core/dates.ts`
- Test: `src/lib/core/dates.test.ts`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces:
  - `type DateStr = string` — `YYYY-MM-DD` 형식의 로컬 날짜
  - `toDateStr(d: Date): DateStr`
  - `parseDateStr(s: DateStr): Date` — 로컬 자정 기준 Date
  - `monthKey(date: DateStr): string` — `"2026-08"`
  - `addDays(date: DateStr, n: number): DateStr`
  - `daysBetween(from: DateStr, to: DateStr): number` — `to - from`, 음수 가능
  - `isValidDateStr(s: string): boolean`

- [ ] **Step 1: 프로젝트 파일 생성**

`.gitignore`:

```
node_modules/
dist/
src-tauri/target/
data/
*.local
.superpowers/
```

> `.superpowers/`는 개발 진행 기록용 스크래치 디렉터리다. 저장소에 들어가면 안 된다.
> 이 파일이 이미 존재하고 위 내용을 담고 있다면 그대로 두고 넘어간다.

`package.json`:

```json
{
  "name": "jobpilot",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "check": "svelte-check --tsconfig ./tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "tauri": "tauri"
  },
  "devDependencies": {
    "@sveltejs/vite-plugin-svelte": "^5.0.0",
    "@tauri-apps/cli": "^2.0.0",
    "jsdom": "^29.0.0",
    "svelte": "^5.0.0",
    "svelte-check": "^4.0.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "vitest": "^3.0.0"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.0.0"
  }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts", "src/**/*.svelte"]
}
```

`svelte.config.js`:

```js
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

export default {
  preprocess: vitePreprocess(),
}
```

`vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  test: {
    // jsdom이어야 한다. 'node'로 두면 @sveltejs/vite-plugin-svelte가
    // .svelte.ts의 룬을 SSR 모드로 컴파일하는데, 그 모드에서는 $state()가
    // 사실상 no-op이고 $state.snapshot()이 독립된 복사본을 만들지 못한다.
    // 스토어의 롤백 로직이 조용히 무력화되므로 DOM 환경이 필요하다.
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
```

`index.html`:

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>JobPilot</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`src/app.css`:

```css
:root {
  font-family: "Segoe UI", system-ui, sans-serif;
  font-size: 14px;
  color-scheme: light dark;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}
```

`src/App.svelte`:

```svelte
<script lang="ts">
</script>

<main>
  <h1>JobPilot</h1>
</main>
```

`src/main.ts`:

```ts
import './app.css'
import { mount } from 'svelte'
import App from './App.svelte'

const app = mount(App, { target: document.getElementById('app')! })

export default app
```

- [ ] **Step 2: 의존성 설치**

Run: `npm install`
Expected: 오류 없이 완료. `node_modules/` 생성.

- [ ] **Step 3: 실패하는 테스트 작성**

`src/lib/core/dates.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  toDateStr,
  parseDateStr,
  monthKey,
  addDays,
  daysBetween,
  isValidDateStr,
} from './dates'

describe('toDateStr', () => {
  it('로컬 날짜를 YYYY-MM-DD로 만든다', () => {
    expect(toDateStr(new Date(2026, 7, 3))).toBe('2026-08-03')
  })

  it('한 자리 월과 일을 0으로 채운다', () => {
    expect(toDateStr(new Date(2026, 0, 9))).toBe('2026-01-09')
  })
})

describe('parseDateStr', () => {
  it('로컬 자정 Date로 되돌린다', () => {
    const d = parseDateStr('2026-08-03')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(7)
    expect(d.getDate()).toBe(3)
    expect(d.getHours()).toBe(0)
  })

  it('toDateStr와 왕복해도 값이 유지된다', () => {
    expect(toDateStr(parseDateStr('2026-12-31'))).toBe('2026-12-31')
  })
})

describe('monthKey', () => {
  it('연-월만 남긴다', () => {
    expect(monthKey('2026-08-03')).toBe('2026-08')
  })
})

describe('addDays', () => {
  it('며칠 뒤를 구한다', () => {
    expect(addDays('2026-08-03', 1)).toBe('2026-08-04')
  })

  it('월 경계를 넘는다', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
  })

  it('연 경계를 넘는다', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('음수로 과거를 구한다', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('윤년 2월 29일을 처리한다', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })
})

describe('daysBetween', () => {
  it('같은 날은 0이다', () => {
    expect(daysBetween('2026-08-03', '2026-08-03')).toBe(0)
  })

  it('뒤 날짜가 크면 양수다', () => {
    expect(daysBetween('2026-08-01', '2026-08-04')).toBe(3)
  })

  it('뒤 날짜가 작으면 음수다', () => {
    expect(daysBetween('2026-08-04', '2026-08-01')).toBe(-3)
  })

  it('월을 넘어도 정확하다', () => {
    expect(daysBetween('2026-07-30', '2026-08-02')).toBe(3)
  })

  it('서머타임 전환 구간에서도 정수 일수를 준다', () => {
    // UTC 기준 계산이므로 지역 서머타임에 영향받지 않는다
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2)
  })
})

describe('isValidDateStr', () => {
  it('올바른 형식을 받아들인다', () => {
    expect(isValidDateStr('2026-08-03')).toBe(true)
  })

  it('형식이 틀리면 거부한다', () => {
    expect(isValidDateStr('2026-8-3')).toBe(false)
    expect(isValidDateStr('20260803')).toBe(false)
    expect(isValidDateStr('')).toBe(false)
  })

  it('존재하지 않는 날짜를 거부한다', () => {
    expect(isValidDateStr('2026-02-30')).toBe(false)
    expect(isValidDateStr('2026-13-01')).toBe(false)
  })
})
```

- [ ] **Step 4: 테스트가 실패하는지 확인**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./dates"`

- [ ] **Step 5: 구현 작성**

`src/lib/core/dates.ts`:

```ts
/** YYYY-MM-DD 형식의 로컬 날짜 문자열 */
export type DateStr = string

const PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function parts(s: DateStr): [number, number, number] {
  const m = PATTERN.exec(s)
  if (!m) throw new Error(`잘못된 날짜 형식: ${s}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

export function toDateStr(d: Date): DateStr {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseDateStr(s: DateStr): Date {
  const [y, m, d] = parts(s)
  return new Date(y, m - 1, d)
}

export function monthKey(date: DateStr): string {
  return date.slice(0, 7)
}

export function addDays(date: DateStr, n: number): DateStr {
  const [y, m, d] = parts(date)
  return toDateStr(new Date(y, m - 1, d + n))
}

export function daysBetween(from: DateStr, to: DateStr): number {
  const [y1, m1, d1] = parts(from)
  const [y2, m2, d2] = parts(to)
  // UTC로 계산해 서머타임 전환의 영향을 받지 않게 한다
  const a = Date.UTC(y1, m1 - 1, d1)
  const b = Date.UTC(y2, m2 - 1, d2)
  return Math.round((b - a) / 86_400_000)
}

export function isValidDateStr(s: string): boolean {
  const m = PATTERN.exec(s)
  if (!m) return false
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const dt = new Date(y, mo - 1, d)
  // 2026-02-30 같은 값은 Date가 조용히 넘겨버리므로 되돌려 확인한다
  return (
    dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d
  )
}
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npm test`
Expected: PASS — dates.test.ts의 모든 테스트 통과

- [ ] **Step 7: 커밋**

```bash
git add .gitignore package.json package-lock.json tsconfig.json vite.config.ts svelte.config.js index.html src/
git commit -m "feat: scaffold Svelte + Vite project with date utilities"
```

---

## Task 2: 도메인 타입과 포트

**Files:**
- Create: `src/lib/types.ts`, `src/lib/core/ids.ts`
- Create: `src/lib/ports/clock.ts`, `src/lib/ports/storage.ts`
- Create: `src/lib/adapters/systemClock.ts`, `src/lib/adapters/fixedClock.ts`, `src/lib/adapters/memoryStorage.ts`
- Test: `src/lib/adapters/memoryStorage.test.ts`

**Interfaces:**
- Consumes: `DateStr` (Task 1)
- Produces:
  - `type TaskStatus = 'planned' | 'doing' | 'done' | 'dropped'`
  - `type Task`, `type Project`, `type Config`, `type WorkSettings`
  - `type TaskFile = { schemaVersion: 1; tasks: Task[] }`
  - `type ConfigFile = { schemaVersion: 1; config: Config }`
  - `newId(prefix: string): string`
  - `interface Clock { now(): Date }`
  - `interface Storage { load<T>(key: string): Promise<T | null>; save<T>(key: string, value: T): Promise<void> }`
  - `class StorageCorruptError extends Error { key: string; quarantinedTo: string }`
  - `class MemoryStorage implements Storage` — 생성자에 초기 데이터 주입 가능, `snapshot()` 제공
  - `class SystemClock implements Clock`
  - `class FixedClock implements Clock { set(d: Date): void }`

- [ ] **Step 1: 타입 정의**

`src/lib/types.ts`:

```ts
import type { DateStr } from './core/dates'

export type TaskStatus = 'planned' | 'doing' | 'done' | 'dropped'

export type Task = {
  id: string
  title: string
  note?: string
  projectId?: string
  status: TaskStatus
  priority: 1 | 2 | 3
  /** 현재 계획된 날짜 */
  plannedDate: DateStr
  /** 최초로 계획했던 날짜. 한 번이라도 이월되면 채워진다 */
  originalDate?: DateStr
  /** 이월된 횟수 */
  carryCount: number
  dueDate?: DateStr
  estimateMin?: number
  /** 실적: 실제로 무엇을 했는가 */
  actualNote?: string
  actualMin?: number
  completedAt?: string
  templateId?: string
  createdAt: string
  updatedAt: string
}

export type Project = {
  id: string
  name: string
  /** hex 색상. 예: "#4f7cff" */
  color: string
  active: boolean
}

export type WorkSettings = {
  /** 0=일 … 6=토 */
  workdays: number[]
  dayStart: string
  dayEnd: string
  weekStartsOn: 0 | 1
  defaultReminders: number[]
  /** 이 일수 이상 밀리면 강조한다 */
  carryWarningDays: number
}

export type Config = {
  projects: Project[]
  work: WorkSettings
}

export const SCHEMA_VERSION = 1 as const

export type TaskFile = {
  schemaVersion: typeof SCHEMA_VERSION
  tasks: Task[]
}

export type ConfigFile = {
  schemaVersion: typeof SCHEMA_VERSION
  config: Config
}

export const DEFAULT_WORK_SETTINGS: WorkSettings = {
  workdays: [1, 2, 3, 4, 5],
  dayStart: '09:00',
  dayEnd: '18:00',
  weekStartsOn: 1,
  defaultReminders: [10],
  carryWarningDays: 3,
}

// DEFAULT_WORK_SETTINGS를 참조로 물면 두 상수가 같은 객체·같은 배열을 공유한다.
// 소비자가 config.work.workdays를 건드리는 순간 모듈 전역 기본값이 오염된다.
export const DEFAULT_CONFIG: Config = {
  projects: [],
  work: structuredClone(DEFAULT_WORK_SETTINGS),
}
```

`src/lib/core/ids.ts`:

```ts
/**
 * 접두사가 붙은 고유 id를 만든다.
 * crypto.randomUUID는 Tauri WebView와 Node 18+ 모두에서 사용할 수 있다.
 */
export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`
}
```

- [ ] **Step 2: 포트 정의**

`src/lib/ports/clock.ts`:

```ts
/**
 * 현재 시각을 얻는 유일한 통로.
 * 도메인 로직이 new Date()를 직접 부르지 않게 해서
 * 시간 의존 동작을 결정적으로 테스트할 수 있게 한다.
 */
export interface Clock {
  now(): Date
}
```

`src/lib/ports/storage.ts`:

```ts
/**
 * key는 확장자 없는 논리 경로다. 예: "config", "tasks/2026-08"
 * 어댑터가 실제 위치와 형식으로 옮긴다.
 */
export interface Storage {
  load<T>(key: string): Promise<T | null>
  save<T>(key: string, value: T): Promise<void>
}

/** 저장된 파일이 JSON으로 파싱되지 않을 때 던진다. 원본은 격리 보관된다. */
export class StorageCorruptError extends Error {
  constructor(
    readonly key: string,
    readonly quarantinedTo: string,
  ) {
    super(`저장된 데이터가 손상되었습니다: ${key} (원본 보관: ${quarantinedTo})`)
    this.name = 'StorageCorruptError'
  }
}
```

- [ ] **Step 3: 실패하는 테스트 작성**

`src/lib/adapters/memoryStorage.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { MemoryStorage } from './memoryStorage'
import { FixedClock } from './fixedClock'
import { DEFAULT_CONFIG, DEFAULT_WORK_SETTINGS } from '../types'

describe('MemoryStorage', () => {
  it('없는 키는 null을 준다', async () => {
    const s = new MemoryStorage()
    expect(await s.load('config')).toBeNull()
  })

  it('저장한 값을 되읽는다', async () => {
    const s = new MemoryStorage()
    await s.save('config', { a: 1 })
    expect(await s.load('config')).toEqual({ a: 1 })
  })

  it('저장된 값을 복사해 보관한다', async () => {
    const s = new MemoryStorage()
    const value = { list: [1, 2] }
    await s.save('k', value)
    value.list.push(3)
    expect(await s.load<{ list: number[] }>('k')).toEqual({ list: [1, 2] })
  })

  it('읽어온 값을 바꿔도 내부 상태가 안 바뀐다', async () => {
    const s = new MemoryStorage()
    await s.save('k', { list: [1] })
    const first = await s.load<{ list: number[] }>('k')
    first!.list.push(9)
    expect(await s.load<{ list: number[] }>('k')).toEqual({ list: [1] })
  })

  it('초기 데이터를 주입할 수 있다', async () => {
    const s = new MemoryStorage({ config: { hello: 'world' } })
    expect(await s.load('config')).toEqual({ hello: 'world' })
  })

  it('snapshot으로 전체 내용을 확인할 수 있다', async () => {
    const s = new MemoryStorage()
    await s.save('a', 1)
    await s.save('b', 2)
    expect(s.snapshot()).toEqual({ a: 1, b: 2 })
  })
})

describe('FixedClock', () => {
  it('지정한 시각을 반환한다', () => {
    const c = new FixedClock(new Date(2026, 7, 3, 10, 0))
    expect(c.now().getDate()).toBe(3)
  })

  it('시각을 바꿀 수 있다', () => {
    const c = new FixedClock(new Date(2026, 7, 3))
    c.set(new Date(2026, 7, 5))
    expect(c.now().getDate()).toBe(5)
  })

  it('반환한 Date를 바꿔도 내부 시각이 안 바뀐다', () => {
    const c = new FixedClock(new Date(2026, 7, 3))
    c.now().setDate(20)
    expect(c.now().getDate()).toBe(3)
  })

  it('생성자에 넘긴 Date를 바깥에서 바꿔도 내부 시각이 안 바뀐다', () => {
    const d = new Date(2026, 7, 3)
    const c = new FixedClock(d)
    d.setDate(20)
    expect(c.now().getDate()).toBe(3)
  })

  it('set에 넘긴 Date를 바깥에서 바꿔도 내부 시각이 안 바뀐다', () => {
    const c = new FixedClock(new Date(2026, 7, 3))
    const d = new Date(2026, 7, 5)
    c.set(d)
    d.setDate(20)
    expect(c.now().getDate()).toBe(5)
  })
})

describe('기본 설정 상수', () => {
  it('DEFAULT_CONFIG.work가 DEFAULT_WORK_SETTINGS와 객체를 공유하지 않는다', () => {
    expect(DEFAULT_CONFIG.work).not.toBe(DEFAULT_WORK_SETTINGS)
  })

  it('DEFAULT_CONFIG.work의 배열을 바꿔도 DEFAULT_WORK_SETTINGS가 안 바뀐다', () => {
    DEFAULT_CONFIG.work.workdays.push(6)
    try {
      expect(DEFAULT_WORK_SETTINGS.workdays).toEqual([1, 2, 3, 4, 5])
    } finally {
      DEFAULT_CONFIG.work.workdays = [1, 2, 3, 4, 5]
    }
  })
})
```

- [ ] **Step 4: 테스트가 실패하는지 확인**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./memoryStorage"`

- [ ] **Step 5: 어댑터 구현**

`src/lib/adapters/memoryStorage.ts`:

```ts
import type { Storage } from '../ports/storage'

/**
 * 테스트와 브라우저 개발용 저장소.
 * 값을 넣고 뺄 때 깊은 복사를 해서, 파일 저장소와 같은 격리 특성을 갖게 한다.
 */
export class MemoryStorage implements Storage {
  private data: Record<string, unknown>

  constructor(initial: Record<string, unknown> = {}) {
    this.data = structuredClone(initial)
  }

  async load<T>(key: string): Promise<T | null> {
    if (!(key in this.data)) return null
    return structuredClone(this.data[key]) as T
  }

  async save<T>(key: string, value: T): Promise<void> {
    this.data[key] = structuredClone(value)
  }

  snapshot(): Record<string, unknown> {
    return structuredClone(this.data)
  }
}
```

`src/lib/adapters/systemClock.ts`:

```ts
import type { Clock } from '../ports/clock'

export class SystemClock implements Clock {
  now(): Date {
    return new Date()
  }
}
```

`src/lib/adapters/fixedClock.ts`:

```ts
import type { Clock } from '../ports/clock'

/** 테스트용. 시각을 고정하고 임의로 옮긴다. */
export class FixedClock implements Clock {
  private current: Date

  // 들어오고 나가는 모든 경로에서 Date를 복사한다.
  // 한 경로라도 참조를 그대로 쥐면 바깥에서 원본을 바꿨을 때
  // 고정돼 있어야 할 시계가 흔들린다.
  constructor(current: Date) {
    this.current = new Date(current.getTime())
  }

  now(): Date {
    return new Date(this.current.getTime())
  }

  set(d: Date): void {
    this.current = new Date(d.getTime())
  }
}
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npm test`
Expected: PASS — dates + memoryStorage + FixedClock 모두 통과

- [ ] **Step 7: 커밋**

```bash
git add src/lib/types.ts src/lib/core/ids.ts src/lib/ports src/lib/adapters
git commit -m "feat: add domain types, ports, and in-memory adapters"
```

---

## Task 3: 업무 상태 전이와 이월 계산

**Files:**
- Create: `src/lib/core/task.ts`
- Test: `src/lib/core/task.test.ts`

**Interfaces:**
- Consumes: `Task`, `TaskStatus` (Task 2), `DateStr`, `daysBetween` (Task 1), `newId` (Task 2)
- Produces:
  - `createTask(input: NewTaskInput, at: Date): Task`
  - `type NewTaskInput = { title: string; plannedDate: DateStr; priority?: 1|2|3; projectId?: string; note?: string; dueDate?: DateStr; estimateMin?: number }`
  - `startTask(task: Task, at: Date): Task`
  - `completeTask(task: Task, at: Date, actualNote?: string, actualMin?: number): Task`
  - `dropTask(task: Task, at: Date, reason?: string): Task`
  - `reopenTask(task: Task, at: Date): Task`
  - `carryTask(task: Task, toDate: DateStr, at: Date): Task`
  - `isOpen(task: Task): boolean`
  - `isOverdue(task: Task, today: DateStr): boolean`
  - `overdueDays(task: Task, today: DateStr): number`
  - `sortForToday(tasks: Task[], today: DateStr): Task[]`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/core/task.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { Task } from '../types'
import {
  createTask,
  startTask,
  completeTask,
  dropTask,
  reopenTask,
  carryTask,
  isOpen,
  isOverdue,
  overdueDays,
  sortForToday,
} from './task'

const AT = new Date(2026, 7, 3, 10, 0, 0)

function make(overrides: Partial<Task> = {}): Task {
  return {
    ...createTask({ title: '테스트', plannedDate: '2026-08-03' }, AT),
    ...overrides,
  }
}

describe('createTask', () => {
  it('planned 상태로 시작한다', () => {
    const t = createTask({ title: '보고서 작성', plannedDate: '2026-08-03' }, AT)
    expect(t.status).toBe('planned')
  })

  it('carryCount는 0에서 시작한다', () => {
    expect(createTask({ title: 'x', plannedDate: '2026-08-03' }, AT).carryCount).toBe(0)
  })

  it('originalDate는 아직 비어 있다', () => {
    expect(
      createTask({ title: 'x', plannedDate: '2026-08-03' }, AT).originalDate,
    ).toBeUndefined()
  })

  it('우선순위 기본값은 2다', () => {
    expect(createTask({ title: 'x', plannedDate: '2026-08-03' }, AT).priority).toBe(2)
  })

  it('createdAt과 updatedAt에 주어진 시각을 쓴다', () => {
    const t = createTask({ title: 'x', plannedDate: '2026-08-03' }, AT)
    expect(t.createdAt).toBe(AT.toISOString())
    expect(t.updatedAt).toBe(AT.toISOString())
  })

  it('고유한 id를 만든다', () => {
    const a = createTask({ title: 'x', plannedDate: '2026-08-03' }, AT)
    const b = createTask({ title: 'x', plannedDate: '2026-08-03' }, AT)
    expect(a.id).not.toBe(b.id)
  })

  it('제목이 비면 거부한다', () => {
    expect(() => createTask({ title: '   ', plannedDate: '2026-08-03' }, AT)).toThrow()
  })

  it('제목의 앞뒤 공백을 없앤다', () => {
    expect(createTask({ title: '  청소  ', plannedDate: '2026-08-03' }, AT).title).toBe('청소')
  })

  it('잘못된 날짜를 거부한다', () => {
    expect(() => createTask({ title: 'x', plannedDate: '2026-8-3' }, AT)).toThrow()
  })
})

describe('startTask', () => {
  it('planned를 doing으로 바꾼다', () => {
    expect(startTask(make(), AT).status).toBe('doing')
  })

  it('done인 업무는 시작할 수 없다', () => {
    const done = completeTask(make(), AT)
    expect(() => startTask(done, AT)).toThrow()
  })
})

describe('completeTask', () => {
  it('done으로 바꾸고 completedAt을 남긴다', () => {
    const t = completeTask(make(), AT)
    expect(t.status).toBe('done')
    expect(t.completedAt).toBe(AT.toISOString())
  })

  it('실적 메모를 남긴다', () => {
    expect(completeTask(make(), AT, '초안까지 완료').actualNote).toBe('초안까지 완료')
  })

  it('실제 소요 시간을 남긴다', () => {
    expect(completeTask(make(), AT, undefined, 90).actualMin).toBe(90)
  })

  it('doing 상태에서도 완료할 수 있다', () => {
    expect(completeTask(startTask(make(), AT), AT).status).toBe('done')
  })

  it('이미 done이면 거부한다', () => {
    const done = completeTask(make(), AT)
    expect(() => completeTask(done, AT)).toThrow()
  })

  it('원본 객체를 바꾸지 않는다', () => {
    const t = make()
    completeTask(t, AT)
    expect(t.status).toBe('planned')
  })
})

describe('dropTask', () => {
  it('dropped로 바꾼다', () => {
    expect(dropTask(make(), AT).status).toBe('dropped')
  })

  it('포기 사유를 실적 메모에 남긴다', () => {
    expect(dropTask(make(), AT, '요구사항 취소됨').actualNote).toBe('요구사항 취소됨')
  })

  it('이미 dropped면 거부한다', () => {
    expect(() => dropTask(dropTask(make(), AT), AT)).toThrow()
  })
})

describe('reopenTask', () => {
  it('done을 planned로 되돌린다', () => {
    const t = reopenTask(completeTask(make(), AT), AT)
    expect(t.status).toBe('planned')
  })

  it('completedAt을 지운다', () => {
    expect(reopenTask(completeTask(make(), AT), AT).completedAt).toBeUndefined()
  })

  it('실적 메모는 남겨둔다', () => {
    const done = completeTask(make(), AT, '절반 진행')
    expect(reopenTask(done, AT).actualNote).toBe('절반 진행')
  })

  it('이미 열려 있으면 거부한다', () => {
    expect(() => reopenTask(make(), AT)).toThrow()
  })
})

describe('carryTask', () => {
  it('계획 날짜를 옮긴다', () => {
    expect(carryTask(make(), '2026-08-04', AT).plannedDate).toBe('2026-08-04')
  })

  it('carryCount를 1 올린다', () => {
    expect(carryTask(make(), '2026-08-04', AT).carryCount).toBe(1)
  })

  it('첫 이월에서 originalDate를 원래 날짜로 채운다', () => {
    expect(carryTask(make(), '2026-08-04', AT).originalDate).toBe('2026-08-03')
  })

  it('두 번째 이월에서도 originalDate는 최초 날짜를 유지한다', () => {
    const once = carryTask(make(), '2026-08-04', AT)
    const twice = carryTask(once, '2026-08-05', AT)
    expect(twice.originalDate).toBe('2026-08-03')
    expect(twice.carryCount).toBe(2)
  })

  it('doing 상태였으면 planned로 되돌린다', () => {
    expect(carryTask(startTask(make(), AT), '2026-08-04', AT).status).toBe('planned')
  })

  it('done인 업무는 이월할 수 없다', () => {
    expect(() => carryTask(completeTask(make(), AT), '2026-08-04', AT)).toThrow()
  })

  it('dropped인 업무는 이월할 수 없다', () => {
    expect(() => carryTask(dropTask(make(), AT), '2026-08-04', AT)).toThrow()
  })

  it('과거로는 이월할 수 없다', () => {
    expect(() => carryTask(make(), '2026-08-02', AT)).toThrow()
  })

  it('같은 날짜로는 이월할 수 없다', () => {
    expect(() => carryTask(make(), '2026-08-03', AT)).toThrow()
  })
})

describe('isOpen', () => {
  it('planned와 doing은 열려 있다', () => {
    expect(isOpen(make())).toBe(true)
    expect(isOpen(startTask(make(), AT))).toBe(true)
  })

  it('done과 dropped는 닫혀 있다', () => {
    expect(isOpen(completeTask(make(), AT))).toBe(false)
    expect(isOpen(dropTask(make(), AT))).toBe(false)
  })
})

describe('isOverdue', () => {
  it('계획일이 오늘보다 과거면 밀린 것이다', () => {
    expect(isOverdue(make({ plannedDate: '2026-08-01' }), '2026-08-03')).toBe(true)
  })

  it('오늘 계획된 것은 아직 안 밀렸다', () => {
    expect(isOverdue(make({ plannedDate: '2026-08-03' }), '2026-08-03')).toBe(false)
  })

  it('완료된 업무는 밀린 것이 아니다', () => {
    const done = completeTask(make({ plannedDate: '2026-08-01' }), AT)
    expect(isOverdue(done, '2026-08-03')).toBe(false)
  })
})

describe('overdueDays', () => {
  it('한 번도 이월 안 된 업무는 계획일 기준으로 센다', () => {
    expect(overdueDays(make({ plannedDate: '2026-08-01' }), '2026-08-03')).toBe(2)
  })

  it('이월된 업무는 최초 계획일 기준으로 센다', () => {
    const carried = carryTask(make({ plannedDate: '2026-08-01' }), '2026-08-03', AT)
    expect(overdueDays(carried, '2026-08-04')).toBe(3)
  })

  it('아직 안 밀렸으면 0이다', () => {
    expect(overdueDays(make({ plannedDate: '2026-08-05' }), '2026-08-03')).toBe(0)
  })
})

describe('sortForToday', () => {
  it('밀린 업무를 맨 앞에 둔다', () => {
    const today = make({ id: 'a', plannedDate: '2026-08-03' })
    const late = make({ id: 'b', plannedDate: '2026-08-01' })
    expect(sortForToday([today, late], '2026-08-03').map((t) => t.id)).toEqual(['b', 'a'])
  })

  it('밀린 것끼리는 오래된 순이다', () => {
    const a = make({ id: 'a', plannedDate: '2026-08-02' })
    const b = make({ id: 'b', plannedDate: '2026-07-30' })
    expect(sortForToday([a, b], '2026-08-03').map((t) => t.id)).toEqual(['b', 'a'])
  })

  it('완료된 업무를 맨 뒤로 보낸다', () => {
    const open = make({ id: 'a' })
    const done = completeTask(make({ id: 'b' }), AT)
    expect(sortForToday([done, open], '2026-08-03').map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('같은 조건이면 우선순위가 높은 것이 앞이다', () => {
    const low = make({ id: 'a', priority: 3 })
    const high = make({ id: 'b', priority: 1 })
    expect(sortForToday([low, high], '2026-08-03').map((t) => t.id)).toEqual(['b', 'a'])
  })

  it('원본 배열을 바꾸지 않는다', () => {
    const list = [make({ id: 'a', priority: 3 }), make({ id: 'b', priority: 1 })]
    sortForToday(list, '2026-08-03')
    expect(list.map((t) => t.id)).toEqual(['a', 'b'])
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./task"`

- [ ] **Step 3: 구현 작성**

`src/lib/core/task.ts`:

```ts
import type { Task } from '../types'
import type { DateStr } from './dates'
import { daysBetween, isValidDateStr } from './dates'
import { newId } from './ids'

export type NewTaskInput = {
  title: string
  plannedDate: DateStr
  priority?: 1 | 2 | 3
  projectId?: string
  note?: string
  dueDate?: DateStr
  estimateMin?: number
}

export function createTask(input: NewTaskInput, at: Date): Task {
  const title = input.title.trim()
  if (title.length === 0) throw new Error('업무 제목이 비어 있습니다')
  if (!isValidDateStr(input.plannedDate)) {
    throw new Error(`잘못된 계획 날짜: ${input.plannedDate}`)
  }
  if (input.dueDate !== undefined && !isValidDateStr(input.dueDate)) {
    throw new Error(`잘못된 마감 날짜: ${input.dueDate}`)
  }

  const ts = at.toISOString()
  return {
    id: newId('task'),
    title,
    note: input.note,
    projectId: input.projectId,
    status: 'planned',
    priority: input.priority ?? 2,
    plannedDate: input.plannedDate,
    carryCount: 0,
    dueDate: input.dueDate,
    estimateMin: input.estimateMin,
    createdAt: ts,
    updatedAt: ts,
  }
}

export function isOpen(task: Task): boolean {
  return task.status === 'planned' || task.status === 'doing'
}

export function startTask(task: Task, at: Date): Task {
  if (!isOpen(task)) {
    throw new Error(`${task.status} 상태인 업무는 시작할 수 없습니다`)
  }
  return { ...task, status: 'doing', updatedAt: at.toISOString() }
}

export function completeTask(
  task: Task,
  at: Date,
  actualNote?: string,
  actualMin?: number,
): Task {
  if (!isOpen(task)) {
    throw new Error(`${task.status} 상태인 업무는 완료할 수 없습니다`)
  }
  return {
    ...task,
    status: 'done',
    completedAt: at.toISOString(),
    actualNote: actualNote ?? task.actualNote,
    actualMin: actualMin ?? task.actualMin,
    updatedAt: at.toISOString(),
  }
}

export function dropTask(task: Task, at: Date, reason?: string): Task {
  if (!isOpen(task)) {
    throw new Error(`${task.status} 상태인 업무는 포기할 수 없습니다`)
  }
  return {
    ...task,
    status: 'dropped',
    actualNote: reason ?? task.actualNote,
    updatedAt: at.toISOString(),
  }
}

export function reopenTask(task: Task, at: Date): Task {
  if (isOpen(task)) {
    throw new Error('이미 열려 있는 업무입니다')
  }
  const next = { ...task, status: 'planned' as const, updatedAt: at.toISOString() }
  delete next.completedAt
  return next
}

export function carryTask(task: Task, toDate: DateStr, at: Date): Task {
  if (!isOpen(task)) {
    throw new Error(`${task.status} 상태인 업무는 이월할 수 없습니다`)
  }
  if (!isValidDateStr(toDate)) {
    throw new Error(`잘못된 이월 날짜: ${toDate}`)
  }
  if (toDate <= task.plannedDate) {
    throw new Error('이월 대상 날짜는 현재 계획일보다 뒤여야 합니다')
  }
  return {
    ...task,
    status: 'planned',
    plannedDate: toDate,
    originalDate: task.originalDate ?? task.plannedDate,
    carryCount: task.carryCount + 1,
    updatedAt: at.toISOString(),
  }
}

export function isOverdue(task: Task, today: DateStr): boolean {
  return isOpen(task) && task.plannedDate < today
}

/**
 * 며칠째 밀리고 있는가.
 * 이월된 적이 있으면 최초 계획일을, 없으면 현재 계획일을 기준으로 센다.
 */
export function overdueDays(task: Task, today: DateStr): number {
  const base = task.originalDate ?? task.plannedDate
  const d = daysBetween(base, today)
  return d > 0 ? d : 0
}

/**
 * Today 화면 정렬 순서:
 * 1) 밀린 업무가 앞. 오래 밀린 것이 더 앞
 * 2) 열린 업무가 닫힌 업무보다 앞
 * 3) 우선순위가 높은(숫자가 작은) 것이 앞
 * 4) 생성이 이른 것이 앞
 */
export function sortForToday(tasks: Task[], today: DateStr): Task[] {
  return [...tasks].sort((a, b) => {
    const aOpen = isOpen(a)
    const bOpen = isOpen(b)
    if (aOpen !== bOpen) return aOpen ? -1 : 1

    if (aOpen && bOpen) {
      const aLate = isOverdue(a, today)
      const bLate = isOverdue(b, today)
      if (aLate !== bLate) return aLate ? -1 : 1
      if (aLate && bLate) {
        const diff = overdueDays(b, today) - overdueDays(a, today)
        if (diff !== 0) return diff
      }
    }

    if (a.priority !== b.priority) return a.priority - b.priority
    return a.createdAt.localeCompare(b.createdAt)
  })
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS — task.test.ts 전부 통과

- [ ] **Step 5: 커밋**

```bash
git add src/lib/core/task.ts src/lib/core/task.test.ts
git commit -m "feat: add task state transitions and carry-over calculation"
```

---

## Task 4: 하루 마감 일괄 처리

**Files:**
- Create: `src/lib/core/daily.ts`
- Test: `src/lib/core/daily.test.ts`

**Interfaces:**
- Consumes: `Task` (Task 2), `carryTask`/`completeTask`/`dropTask`/`isOpen`/`isOverdue` (Task 3), `DateStr`/`addDays` (Task 1)
- Produces:
  - `type WrapUpDecision = { taskId: string; kind: 'complete'; actualNote?: string; actualMin?: number } | { taskId: string; kind: 'carry'; toDate: DateStr } | { taskId: string; kind: 'drop'; reason?: string } | { taskId: string; kind: 'keep' }`
  - `pendingForWrapUp(tasks: Task[], today: DateStr): Task[]`
  - `defaultDecisions(tasks: Task[], today: DateStr): WrapUpDecision[]`
  - `applyWrapUp(tasks: Task[], decisions: WrapUpDecision[], at: Date): Task[]`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/core/daily.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { Task } from '../types'
import { createTask, completeTask } from './task'
import { pendingForWrapUp, defaultDecisions, applyWrapUp } from './daily'

const AT = new Date(2026, 7, 3, 18, 0, 0)

function make(id: string, plannedDate: string, overrides: Partial<Task> = {}): Task {
  return {
    ...createTask({ title: id, plannedDate }, AT),
    id,
    ...overrides,
  }
}

describe('pendingForWrapUp', () => {
  it('오늘 계획된 열린 업무를 포함한다', () => {
    const t = make('a', '2026-08-03')
    expect(pendingForWrapUp([t], '2026-08-03').map((x) => x.id)).toEqual(['a'])
  })

  it('과거에 계획된 열린 업무도 포함한다', () => {
    const t = make('a', '2026-08-01')
    expect(pendingForWrapUp([t], '2026-08-03').map((x) => x.id)).toEqual(['a'])
  })

  it('완료된 업무는 제외한다', () => {
    const t = completeTask(make('a', '2026-08-03'), AT)
    expect(pendingForWrapUp([t], '2026-08-03')).toEqual([])
  })

  it('미래에 계획된 업무는 제외한다', () => {
    const t = make('a', '2026-08-05')
    expect(pendingForWrapUp([t], '2026-08-03')).toEqual([])
  })
})

describe('defaultDecisions', () => {
  it('모든 대상을 내일로 이월하는 안을 준다', () => {
    const tasks = [make('a', '2026-08-03'), make('b', '2026-08-01')]
    const decisions = defaultDecisions(tasks, '2026-08-03')
    expect(decisions).toEqual([
      { taskId: 'a', kind: 'carry', toDate: '2026-08-04' },
      { taskId: 'b', kind: 'carry', toDate: '2026-08-04' },
    ])
  })

  it('마감 대상이 없으면 빈 배열이다', () => {
    expect(defaultDecisions([], '2026-08-03')).toEqual([])
  })
})

describe('applyWrapUp', () => {
  it('complete 결정을 적용한다', () => {
    const tasks = [make('a', '2026-08-03')]
    const out = applyWrapUp(tasks, [{ taskId: 'a', kind: 'complete', actualNote: '끝냄' }], AT)
    expect(out[0]!.status).toBe('done')
    expect(out[0]!.actualNote).toBe('끝냄')
  })

  it('carry 결정을 적용한다', () => {
    const tasks = [make('a', '2026-08-03')]
    const out = applyWrapUp(tasks, [{ taskId: 'a', kind: 'carry', toDate: '2026-08-04' }], AT)
    expect(out[0]!.plannedDate).toBe('2026-08-04')
    expect(out[0]!.carryCount).toBe(1)
  })

  it('drop 결정을 적용한다', () => {
    const tasks = [make('a', '2026-08-03')]
    const out = applyWrapUp(tasks, [{ taskId: 'a', kind: 'drop', reason: '취소됨' }], AT)
    expect(out[0]!.status).toBe('dropped')
    expect(out[0]!.actualNote).toBe('취소됨')
  })

  it('keep 결정은 아무것도 바꾸지 않는다', () => {
    const tasks = [make('a', '2026-08-03')]
    const out = applyWrapUp(tasks, [{ taskId: 'a', kind: 'keep' }], AT)
    expect(out[0]).toEqual(tasks[0])
  })

  it('결정이 없는 업무는 그대로 둔다', () => {
    const tasks = [make('a', '2026-08-03'), make('b', '2026-08-03')]
    const out = applyWrapUp(tasks, [{ taskId: 'a', kind: 'complete' }], AT)
    expect(out[1]).toEqual(tasks[1])
  })

  it('여러 결정을 한 번에 적용한다', () => {
    const tasks = [make('a', '2026-08-03'), make('b', '2026-08-03'), make('c', '2026-08-03')]
    const out = applyWrapUp(
      tasks,
      [
        { taskId: 'a', kind: 'complete' },
        { taskId: 'b', kind: 'carry', toDate: '2026-08-04' },
        { taskId: 'c', kind: 'drop' },
      ],
      AT,
    )
    expect(out.map((t) => t.status)).toEqual(['done', 'planned', 'dropped'])
  })

  it('원본 배열과 항목을 바꾸지 않는다', () => {
    const tasks = [make('a', '2026-08-03')]
    applyWrapUp(tasks, [{ taskId: 'a', kind: 'complete' }], AT)
    expect(tasks[0]!.status).toBe('planned')
  })

  it('없는 업무 id를 가리키면 거부한다', () => {
    expect(() => applyWrapUp([], [{ taskId: 'ghost', kind: 'keep' }], AT)).toThrow()
  })

  it('같은 업무에 결정이 두 번 오면 거부한다', () => {
    const tasks = [make('a', '2026-08-03')]
    expect(() =>
      applyWrapUp(
        tasks,
        [
          { taskId: 'a', kind: 'complete' },
          { taskId: 'a', kind: 'drop' },
        ],
        AT,
      ),
    ).toThrow()
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./daily"`

- [ ] **Step 3: 구현 작성**

`src/lib/core/daily.ts`:

```ts
import type { Task } from '../types'
import type { DateStr } from './dates'
import { addDays } from './dates'
import { carryTask, completeTask, dropTask, isOpen } from './task'

export type WrapUpDecision =
  | { taskId: string; kind: 'complete'; actualNote?: string; actualMin?: number }
  | { taskId: string; kind: 'carry'; toDate: DateStr }
  | { taskId: string; kind: 'drop'; reason?: string }
  | { taskId: string; kind: 'keep' }

/** 하루 마감에서 정리해야 할 업무: 오늘까지 계획됐는데 아직 열려 있는 것 */
export function pendingForWrapUp(tasks: Task[], today: DateStr): Task[] {
  return tasks.filter((t) => isOpen(t) && t.plannedDate <= today)
}

/** 기본 제안: 전부 내일로 이월 */
export function defaultDecisions(tasks: Task[], today: DateStr): WrapUpDecision[] {
  const tomorrow = addDays(today, 1)
  return pendingForWrapUp(tasks, today).map((t) => ({
    taskId: t.id,
    kind: 'carry' as const,
    toDate: tomorrow,
  }))
}

export function applyWrapUp(
  tasks: Task[],
  decisions: WrapUpDecision[],
  at: Date,
): Task[] {
  const byId = new Map<string, WrapUpDecision>()
  for (const d of decisions) {
    if (byId.has(d.taskId)) {
      throw new Error(`한 업무에 결정이 두 번 지정되었습니다: ${d.taskId}`)
    }
    byId.set(d.taskId, d)
  }

  const known = new Set(tasks.map((t) => t.id))
  for (const id of byId.keys()) {
    if (!known.has(id)) {
      throw new Error(`존재하지 않는 업무입니다: ${id}`)
    }
  }

  return tasks.map((task) => {
    const d = byId.get(task.id)
    if (!d) return task
    switch (d.kind) {
      case 'complete':
        return completeTask(task, at, d.actualNote, d.actualMin)
      case 'carry':
        return carryTask(task, d.toDate, at)
      case 'drop':
        return dropTask(task, at, d.reason)
      case 'keep':
        return task
    }
  })
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS — daily.test.ts 전부 통과

- [ ] **Step 5: 커밋**

```bash
git add src/lib/core/daily.ts src/lib/core/daily.test.ts
git commit -m "feat: add daily wrap-up batch processing"
```

---

## Task 5: Rust 저장 계층 (원자적 쓰기, 격리, 백업)

**Files:**
- Create: `src-tauri/Cargo.toml`, `src-tauri/build.rs`, `src-tauri/tauri.conf.json`
- Create: `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`, `src-tauri/src/storage.rs`
- Test: `src-tauri/src/storage.rs` 내부 `#[cfg(test)] mod tests`

**Interfaces:**
- Consumes: 없음 (Rust 측 최초 태스크)
- Produces (Tauri 커맨드, 프론트엔드가 `invoke`로 호출):
  - `storage_load(key: String) -> Result<Option<String>, String>` — 원시 JSON 문자열
  - `storage_save(key: String, contents: String) -> Result<(), String>`
  - `storage_quarantine(key: String) -> Result<String, String>` — 격리된 경로 반환
- Produces (Rust 내부 함수, 테스트 대상):
  - `resolve_path(root: &Path, key: &str) -> Result<PathBuf, String>`
  - `read_text(root: &Path, key: &str) -> Result<Option<String>, String>`
  - `write_atomic(root: &Path, key: &str, contents: &str) -> Result<(), String>`
  - `quarantine(root: &Path, key: &str, stamp: &str) -> Result<String, String>`
  - `backup_once_per_day(root: &Path, today: &str) -> Result<(), String>`
  - `prune_backups(root: &Path, keep: usize) -> Result<(), String>`

- [ ] **Step 1: Rust 프로젝트 파일과 아이콘 생성**

> 아이콘을 먼저 만든다. `tauri::generate_context!()` 매크로가 **컴파일 시점에**
> `tauri.conf.json`이 가리키는 아이콘 파일을 읽기 때문에, 아이콘이 없으면
> `cargo test`조차 컴파일 단계에서 실패한다.

`src-tauri/Cargo.toml`:

```toml
[package]
name = "jobpilot"
version = "0.1.0"
description = "JobPilot"
edition = "2021"

[lib]
name = "jobpilot_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
chrono = "0.4"

[dev-dependencies]
tempfile = "3"
```

`src-tauri/build.rs`:

```rust
fn main() {
    tauri_build::build()
}
```

`src-tauri/tauri.conf.json`:

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "JobPilot",
  "version": "0.1.0",
  "identifier": "com.jobpilot.desktop",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "JobPilot",
        "width": 1100,
        "height": 820,
        "minWidth": 720,
        "minHeight": 560
      }
    ],
    "security": {
      "csp": "default-src 'self'; style-src 'self' 'unsafe-inline'"
    }
  },
  "bundle": {
    "active": true,
    "targets": ["nsis"],
    "icon": ["icons/icon.ico"]
  }
}
```

`src-tauri/src/main.rs`:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    jobpilot_lib::run()
}
```

원본 아이콘 PNG를 만든다 (PowerShell):

```powershell
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap 1024, 1024
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::FromArgb(79, 124, 255))
$g.TextRenderingHint = 'AntiAliasGridFit'
$font = New-Object System.Drawing.Font('Segoe UI', 420, [System.Drawing.FontStyle]::Bold)
$fmt = New-Object System.Drawing.StringFormat
$fmt.Alignment = 'Center'
$fmt.LineAlignment = 'Center'
$rect = New-Object System.Drawing.RectangleF(0, 0, 1024, 1024)
$g.DrawString('J', $font, [System.Drawing.Brushes]::White, $rect, $fmt)
$g.Dispose()
$bmp.Save((Join-Path $PWD 'src-tauri\app-icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
```

아이콘 세트로 변환한다:

Run: `npx tauri icon src-tauri/app-icon.png`
Expected: `src-tauri/icons/` 아래에 `icon.ico`, `32x32.png` 등이 생성됨

- [ ] **Step 2: 실패하는 테스트를 담은 storage.rs 작성**

`src-tauri/src/storage.rs` — 먼저 테스트 모듈만 두고 함수는 비워 실패시킨다:

```rust
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

/// data 폴더 위치를 정한다.
/// JOBPILOT_DATA_DIR 환경변수가 있으면 그것을, 없으면 실행 파일 옆 data/를 쓴다.
/// 환경변수는 개발과 테스트에서 쓴다.
pub fn data_root() -> Result<PathBuf, String> {
    if let Ok(dir) = std::env::var("JOBPILOT_DATA_DIR") {
        return Ok(PathBuf::from(dir));
    }
    let exe = std::env::current_exe().map_err(|e| format!("실행 파일 경로를 찾지 못했습니다: {e}"))?;
    let dir = exe
        .parent()
        .ok_or_else(|| "실행 파일의 상위 폴더가 없습니다".to_string())?;
    Ok(dir.join("data"))
}

/// 논리 키를 실제 파일 경로로 바꾼다.
/// key는 "config" 또는 "tasks/2026-08" 형태다.
/// 상위 경로 탈출과 절대 경로를 막는다.
pub fn resolve_path(root: &Path, key: &str) -> Result<PathBuf, String> {
    todo!()
}

pub fn read_text(root: &Path, key: &str) -> Result<Option<String>, String> {
    todo!()
}

pub fn write_atomic(root: &Path, key: &str, contents: &str) -> Result<(), String> {
    todo!()
}

pub fn quarantine(root: &Path, key: &str, stamp: &str) -> Result<String, String> {
    todo!()
}

pub fn backup_once_per_day(root: &Path, today: &str) -> Result<(), String> {
    todo!()
}

pub fn prune_backups(root: &Path, keep: usize) -> Result<(), String> {
    todo!()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn root() -> TempDir {
        TempDir::new().unwrap()
    }

    #[test]
    fn resolve_path_maps_key_to_json_file() {
        let d = root();
        let p = resolve_path(d.path(), "config").unwrap();
        assert_eq!(p, d.path().join("config.json"));
    }

    #[test]
    fn resolve_path_supports_one_subdirectory() {
        let d = root();
        let p = resolve_path(d.path(), "tasks/2026-08").unwrap();
        assert_eq!(p, d.path().join("tasks").join("2026-08.json"));
    }

    #[test]
    fn resolve_path_rejects_parent_escape() {
        let d = root();
        assert!(resolve_path(d.path(), "../secret").is_err());
        assert!(resolve_path(d.path(), "tasks/../../secret").is_err());
    }

    #[test]
    fn resolve_path_rejects_absolute_key() {
        let d = root();
        assert!(resolve_path(d.path(), "/etc/passwd").is_err());
        assert!(resolve_path(d.path(), "C:\\Windows\\system.ini").is_err());
    }

    #[test]
    fn resolve_path_rejects_empty_key() {
        let d = root();
        assert!(resolve_path(d.path(), "").is_err());
    }

    #[test]
    fn read_text_returns_none_when_missing() {
        let d = root();
        assert_eq!(read_text(d.path(), "config").unwrap(), None);
    }

    #[test]
    fn write_then_read_roundtrips() {
        let d = root();
        write_atomic(d.path(), "config", "{\"a\":1}").unwrap();
        assert_eq!(
            read_text(d.path(), "config").unwrap(),
            Some("{\"a\":1}".to_string())
        );
    }

    #[test]
    fn write_creates_missing_subdirectory() {
        let d = root();
        write_atomic(d.path(), "tasks/2026-08", "[]").unwrap();
        assert!(d.path().join("tasks").join("2026-08.json").exists());
    }

    #[test]
    fn write_replaces_existing_content() {
        let d = root();
        write_atomic(d.path(), "config", "old").unwrap();
        write_atomic(d.path(), "config", "new").unwrap();
        assert_eq!(read_text(d.path(), "config").unwrap(), Some("new".into()));
    }

    #[test]
    fn write_leaves_no_temp_file_behind() {
        let d = root();
        write_atomic(d.path(), "config", "x").unwrap();
        let leftovers: Vec<_> = fs::read_dir(d.path())
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().contains(".tmp"))
            .collect();
        assert!(leftovers.is_empty(), "임시 파일이 남았습니다");
    }

    #[test]
    fn quarantine_moves_file_aside_and_reports_path() {
        let d = root();
        write_atomic(d.path(), "config", "broken{{").unwrap();
        let moved = quarantine(d.path(), "config", "20260803T101500").unwrap();
        assert!(!d.path().join("config.json").exists());
        assert!(Path::new(&moved).exists());
        assert!(moved.contains("corrupt"));
    }

    #[test]
    fn quarantine_errors_when_file_missing() {
        let d = root();
        assert!(quarantine(d.path(), "config", "20260803T101500").is_err());
    }

    #[test]
    fn backup_copies_data_files_into_dated_folder() {
        let d = root();
        write_atomic(d.path(), "config", "c").unwrap();
        write_atomic(d.path(), "tasks/2026-08", "t").unwrap();

        backup_once_per_day(d.path(), "2026-08-03").unwrap();

        let dir = d.path().join("backups").join("2026-08-03");
        assert_eq!(fs::read_to_string(dir.join("config.json")).unwrap(), "c");
        assert_eq!(
            fs::read_to_string(dir.join("tasks").join("2026-08.json")).unwrap(),
            "t"
        );
    }

    #[test]
    fn backup_skips_when_today_already_backed_up() {
        let d = root();
        write_atomic(d.path(), "config", "first").unwrap();
        backup_once_per_day(d.path(), "2026-08-03").unwrap();

        write_atomic(d.path(), "config", "second").unwrap();
        backup_once_per_day(d.path(), "2026-08-03").unwrap();

        let backed = d.path().join("backups").join("2026-08-03").join("config.json");
        assert_eq!(fs::read_to_string(backed).unwrap(), "first");
    }

    #[test]
    fn backup_does_not_recurse_into_backups_folder() {
        let d = root();
        write_atomic(d.path(), "config", "c").unwrap();
        backup_once_per_day(d.path(), "2026-08-03").unwrap();
        backup_once_per_day(d.path(), "2026-08-04").unwrap();

        let nested = d
            .path()
            .join("backups")
            .join("2026-08-04")
            .join("backups");
        assert!(!nested.exists(), "백업 폴더가 자기 자신을 복사했습니다");
    }

    #[test]
    fn backup_succeeds_when_no_data_files_exist() {
        let d = root();
        backup_once_per_day(d.path(), "2026-08-03").unwrap();
        assert!(d.path().join("backups").join("2026-08-03").exists());
    }

    #[test]
    fn prune_keeps_newest_and_removes_oldest() {
        let d = root();
        for day in ["2026-08-01", "2026-08-02", "2026-08-03"] {
            fs::create_dir_all(d.path().join("backups").join(day)).unwrap();
        }

        prune_backups(d.path(), 2).unwrap();

        let backups = d.path().join("backups");
        assert!(!backups.join("2026-08-01").exists());
        assert!(backups.join("2026-08-02").exists());
        assert!(backups.join("2026-08-03").exists());
    }

    #[test]
    fn prune_is_noop_when_under_limit() {
        let d = root();
        fs::create_dir_all(d.path().join("backups").join("2026-08-03")).unwrap();
        prune_backups(d.path(), 30).unwrap();
        assert!(d.path().join("backups").join("2026-08-03").exists());
    }

    #[test]
    fn prune_is_noop_when_backups_dir_missing() {
        let d = root();
        assert!(prune_backups(d.path(), 30).is_ok());
    }
}
```

`src-tauri/src/lib.rs` (이 단계에서는 storage 모듈만 노출):

```rust
mod storage;

pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("JobPilot 실행에 실패했습니다");
}
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `cd src-tauri && cargo test`
Expected: FAIL — `todo!()`로 인한 panic이 각 테스트에서 발생

- [ ] **Step 4: storage.rs 구현**

`src-tauri/src/storage.rs`의 `todo!()` 함수들을 아래로 교체한다. 테스트 모듈은 그대로 둔다.

```rust
pub fn resolve_path(root: &Path, key: &str) -> Result<PathBuf, String> {
    if key.is_empty() {
        return Err("빈 키입니다".into());
    }
    if key.contains('\\') || key.starts_with('/') {
        return Err(format!("허용되지 않는 키입니다: {key}"));
    }
    // 드라이브 문자로 시작하는 절대 경로 차단 (예: "C:...")
    if key.len() >= 2 && key.as_bytes()[1] == b':' {
        return Err(format!("허용되지 않는 키입니다: {key}"));
    }

    let mut path = root.to_path_buf();
    let segments: Vec<&str> = key.split('/').collect();
    if segments.len() > 2 {
        return Err(format!("키의 깊이가 너무 깊습니다: {key}"));
    }
    for seg in &segments {
        if seg.is_empty() || *seg == "." || *seg == ".." {
            return Err(format!("허용되지 않는 키입니다: {key}"));
        }
        path.push(seg);
    }

    path.set_extension("json");
    Ok(path)
}

pub fn read_text(root: &Path, key: &str) -> Result<Option<String>, String> {
    let path = resolve_path(root, key)?;
    match fs::read_to_string(&path) {
        Ok(s) => Ok(Some(s)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("읽기 실패 {}: {e}", path.display())),
    }
}

pub fn write_atomic(root: &Path, key: &str, contents: &str) -> Result<(), String> {
    let path = resolve_path(root, key)?;
    let parent = path
        .parent()
        .ok_or_else(|| "상위 폴더를 찾지 못했습니다".to_string())?;
    fs::create_dir_all(parent).map_err(|e| format!("폴더 생성 실패 {}: {e}", parent.display()))?;

    let tmp = path.with_extension("json.tmp");
    {
        let mut f = fs::File::create(&tmp)
            .map_err(|e| format!("임시 파일 생성 실패 {}: {e}", tmp.display()))?;
        f.write_all(contents.as_bytes())
            .map_err(|e| format!("쓰기 실패 {}: {e}", tmp.display()))?;
        // rename 전에 내용이 디스크에 닿도록 보장한다
        f.sync_all()
            .map_err(|e| format!("동기화 실패 {}: {e}", tmp.display()))?;
    }

    // Windows의 std::fs::rename은 기존 파일을 원자적으로 대체한다
    fs::rename(&tmp, &path).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        format!("교체 실패 {}: {e}", path.display())
    })?;
    Ok(())
}

pub fn quarantine(root: &Path, key: &str, stamp: &str) -> Result<String, String> {
    let path = resolve_path(root, key)?;
    if !path.exists() {
        return Err(format!("격리할 파일이 없습니다: {}", path.display()));
    }
    let name = path
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or_else(|| "파일명을 읽지 못했습니다".to_string())?;
    let target = path.with_file_name(format!("{name}.corrupt.{stamp}.json"));
    fs::rename(&path, &target)
        .map_err(|e| format!("격리 실패 {}: {e}", path.display()))?;
    Ok(target.to_string_lossy().to_string())
}

pub fn backup_once_per_day(root: &Path, today: &str) -> Result<(), String> {
    let dest = root.join("backups").join(today);
    if dest.exists() {
        return Ok(());
    }
    fs::create_dir_all(&dest)
        .map_err(|e| format!("백업 폴더 생성 실패 {}: {e}", dest.display()))?;
    copy_tree(root, &dest, root)?;
    Ok(())
}

/// root 아래를 dest로 복사하되 backups 폴더는 건너뛴다.
fn copy_tree(src: &Path, dest: &Path, root: &Path) -> Result<(), String> {
    let backups = root.join("backups");
    let entries = fs::read_dir(src).map_err(|e| format!("읽기 실패 {}: {e}", src.display()))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("항목 읽기 실패: {e}"))?;
        let path = entry.path();
        if path == backups {
            continue;
        }
        let name = entry.file_name();
        let target = dest.join(&name);
        if path.is_dir() {
            fs::create_dir_all(&target)
                .map_err(|e| format!("폴더 생성 실패 {}: {e}", target.display()))?;
            copy_tree(&path, &target, root)?;
        } else if path.extension().and_then(|e| e.to_str()) == Some("json") {
            fs::copy(&path, &target)
                .map_err(|e| format!("복사 실패 {}: {e}", path.display()))?;
        }
    }
    Ok(())
}

pub fn prune_backups(root: &Path, keep: usize) -> Result<(), String> {
    let backups = root.join("backups");
    if !backups.exists() {
        return Ok(());
    }
    let mut dirs: Vec<String> = fs::read_dir(&backups)
        .map_err(|e| format!("읽기 실패 {}: {e}", backups.display()))?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_dir())
        .map(|e| e.file_name().to_string_lossy().to_string())
        .collect();

    // 폴더명이 YYYY-MM-DD라서 사전순 정렬이 곧 날짜순이다
    dirs.sort();
    if dirs.len() <= keep {
        return Ok(());
    }
    for name in &dirs[..dirs.len() - keep] {
        let path = backups.join(name);
        fs::remove_dir_all(&path)
            .map_err(|e| format!("삭제 실패 {}: {e}", path.display()))?;
    }
    Ok(())
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd src-tauri && cargo test`
Expected: PASS — storage 테스트 18개 전부 통과

- [ ] **Step 6: Tauri 커맨드 등록**

`src-tauri/src/lib.rs`를 교체:

```rust
mod storage;

use chrono::Local;

const BACKUP_KEEP_DAYS: usize = 30;

#[tauri::command]
fn storage_load(key: String) -> Result<Option<String>, String> {
    let root = storage::data_root()?;
    storage::read_text(&root, &key)
}

#[tauri::command]
fn storage_save(key: String, contents: String) -> Result<(), String> {
    let root = storage::data_root()?;
    // 오늘 첫 쓰기라면 먼저 백업을 떠둔다
    let today = Local::now().format("%Y-%m-%d").to_string();
    storage::backup_once_per_day(&root, &today)?;
    storage::prune_backups(&root, BACKUP_KEEP_DAYS)?;
    storage::write_atomic(&root, &key, &contents)
}

#[tauri::command]
fn storage_quarantine(key: String) -> Result<String, String> {
    let root = storage::data_root()?;
    let stamp = Local::now().format("%Y%m%dT%H%M%S").to_string();
    storage::quarantine(&root, &key, &stamp)
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            storage_load,
            storage_save,
            storage_quarantine
        ])
        .run(tauri::generate_context!())
        .expect("JobPilot 실행에 실패했습니다");
}
```

- [ ] **Step 7: 컴파일 확인**

Run: `cd src-tauri && cargo check`
Expected: 컴파일 오류 없음

- [ ] **Step 8: 커밋**

```bash
git add src-tauri/
git commit -m "feat: add atomic JSON storage with quarantine and daily backups"
```

---

## Task 6: Tauri 저장 어댑터와 포트 조립

**Files:**
- Create: `src/lib/adapters/tauriStorage.ts`
- Create: `src/lib/stores/context.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `Storage`, `StorageCorruptError` (Task 2), `Clock` (Task 2)
- Produces:
  - `class TauriStorage implements Storage`
  - `isTauri(): boolean`
  - `getStorage(): Storage` — 조립된 저장소 반환
  - `getClock(): Clock` — 조립된 시계 반환
  - `setPorts(p: { storage: Storage; clock: Clock }): void` — 테스트에서 주입

- [ ] **Step 1: Tauri 어댑터 작성**

`src/lib/adapters/tauriStorage.ts`:

```ts
import { invoke } from '@tauri-apps/api/core'
import type { Storage } from '../ports/storage'
import { StorageCorruptError } from '../ports/storage'

/**
 * Rust 쪽 storage_* 커맨드에 얹는 어댑터.
 * JSON 직렬화/파싱은 여기서 하고, Rust는 문자열만 다룬다.
 */
export class TauriStorage implements Storage {
  async load<T>(key: string): Promise<T | null> {
    const raw = await invoke<string | null>('storage_load', { key })
    if (raw === null) return null
    try {
      return JSON.parse(raw) as T
    } catch {
      // 손상된 파일은 절대 덮어쓰지 않는다. 옆으로 치우고 호출자에게 알린다.
      const movedTo = await invoke<string>('storage_quarantine', { key })
      throw new StorageCorruptError(key, movedTo)
    }
  }

  async save<T>(key: string, value: T): Promise<void> {
    await invoke('storage_save', {
      key,
      contents: JSON.stringify(value, null, 2),
    })
  }
}
```

- [ ] **Step 2: 포트 조립 지점 작성**

`src/lib/stores/context.ts`:

```ts
import type { Storage } from '../ports/storage'
import type { Clock } from '../ports/clock'
import { MemoryStorage } from '../adapters/memoryStorage'
import { SystemClock } from '../adapters/systemClock'
import { TauriStorage } from '../adapters/tauriStorage'

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

type Ports = { storage: Storage; clock: Clock }

let ports: Ports | null = null

/** 테스트나 브라우저 개발에서 포트를 갈아끼운다 */
export function setPorts(p: Ports): void {
  ports = p
}

function resolve(): Ports {
  if (ports) return ports
  ports = {
    // 브라우저에서 npm run dev로 띄우면 메모리 저장소로 UI만 확인한다
    storage: isTauri() ? new TauriStorage() : new MemoryStorage(),
    clock: new SystemClock(),
  }
  return ports
}

export function getStorage(): Storage {
  return resolve().storage
}

export function getClock(): Clock {
  return resolve().clock
}
```

- [ ] **Step 3: 타입 체크 통과 확인**

Run: `npm run check`
Expected: 오류 없음

- [ ] **Step 4: Tauri 개발 실행으로 IPC 연결 확인**

Run: `npm run tauri dev`
Expected: JobPilot 창이 뜨고 "JobPilot" 제목이 보인다. 콘솔에 오류가 없다.

창이 뜬 상태에서 개발자 도구(F12)를 열고 콘솔에 입력:

```js
const { invoke } = window.__TAURI_INTERNALS__ ? await import('@tauri-apps/api/core') : {}
await invoke('storage_save', { key: 'smoke', contents: '{"ok":true}' })
await invoke('storage_load', { key: 'smoke' })
```

Expected: 두 번째 호출이 `'{"ok":true}'`를 반환. `src-tauri/target/debug/data/smoke.json` 파일이 생성됨.

확인 후 창을 닫는다.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/adapters/tauriStorage.ts src/lib/stores/context.ts
git commit -m "feat: wire Tauri storage adapter through port assembly"
```

---

## Task 7: 설정 스토어와 프로젝트 관리 화면

**Files:**
- Create: `src/lib/stores/config.svelte.ts`
- Create: `src/routes/Settings.svelte`
- Test: `src/lib/stores/config.test.ts`
- Modify: `src/App.svelte`

**Interfaces:**
- Consumes: `Config`, `Project`, `ConfigFile`, `DEFAULT_CONFIG`, `SCHEMA_VERSION` (Task 2), `Storage` (Task 2), `newId` (Task 2)
- Produces:
  - `class ConfigStore` with:
    - `readonly config: Config` (반응형)
    - `readonly loaded: boolean`
    - `readonly error: string | null`
    - `load(): Promise<void>`
    - `addProject(name: string, color: string): Promise<Project>`
    - `renameProject(id: string, name: string): Promise<void>`
    - `setProjectColor(id: string, color: string): Promise<void>`
    - `setProjectActive(id: string, active: boolean): Promise<void>`
    - `deleteProject(id: string): Promise<void>`
    - `activeProjects(): Project[]`
    - `projectById(id: string | undefined): Project | undefined`
  - `createConfigStore(storage: Storage): ConfigStore`
  - `const CONFIG_KEY = 'config'`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/stores/config.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { MemoryStorage } from '../adapters/memoryStorage'
import { createConfigStore, CONFIG_KEY } from './config.svelte'
import { SCHEMA_VERSION, type ConfigFile } from '../types'

describe('ConfigStore.load', () => {
  it('저장된 설정이 없으면 기본값을 쓴다', async () => {
    const store = createConfigStore(new MemoryStorage())
    await store.load()
    expect(store.config.projects).toEqual([])
    expect(store.config.work.carryWarningDays).toBe(3)
    expect(store.loaded).toBe(true)
  })

  it('저장된 설정을 읽어온다', async () => {
    const file: ConfigFile = {
      schemaVersion: SCHEMA_VERSION,
      config: {
        projects: [{ id: 'p1', name: 'A사 유지보수', color: '#ff0000', active: true }],
        work: {
          workdays: [1, 2, 3, 4, 5],
          dayStart: '10:00',
          dayEnd: '19:00',
          weekStartsOn: 1,
          defaultReminders: [15],
          carryWarningDays: 5,
        },
      },
    }
    const store = createConfigStore(new MemoryStorage({ [CONFIG_KEY]: file }))
    await store.load()
    expect(store.config.projects[0]!.name).toBe('A사 유지보수')
    expect(store.config.work.dayStart).toBe('10:00')
  })

  it('일부 필드가 빠진 설정에 기본값을 채운다', async () => {
    const partial = { schemaVersion: SCHEMA_VERSION, config: { projects: [] } }
    const store = createConfigStore(new MemoryStorage({ [CONFIG_KEY]: partial }))
    await store.load()
    expect(store.config.work.carryWarningDays).toBe(3)
  })
})

describe('ConfigStore 프로젝트 관리', () => {
  async function ready() {
    const storage = new MemoryStorage()
    const store = createConfigStore(storage)
    await store.load()
    return { store, storage }
  }

  it('프로젝트를 추가한다', async () => {
    const { store } = await ready()
    const p = await store.addProject('사내 플랫폼', '#4f7cff')
    expect(store.config.projects).toHaveLength(1)
    expect(p.name).toBe('사내 플랫폼')
    expect(p.active).toBe(true)
  })

  it('추가 후 저장소에 기록한다', async () => {
    const { store, storage } = await ready()
    await store.addProject('사내 플랫폼', '#4f7cff')
    const saved = (await storage.load<ConfigFile>(CONFIG_KEY))!
    expect(saved.config.projects).toHaveLength(1)
    expect(saved.schemaVersion).toBe(SCHEMA_VERSION)
  })

  it('빈 이름을 거부한다', async () => {
    const { store } = await ready()
    await expect(store.addProject('   ', '#000000')).rejects.toThrow()
  })

  it('이름 앞뒤 공백을 없앤다', async () => {
    const { store } = await ready()
    const p = await store.addProject('  청소  ', '#000000')
    expect(p.name).toBe('청소')
  })

  it('중복된 이름을 거부한다', async () => {
    const { store } = await ready()
    await store.addProject('A사', '#000000')
    await expect(store.addProject('A사', '#111111')).rejects.toThrow()
  })

  it('이름을 바꾼다', async () => {
    const { store } = await ready()
    const p = await store.addProject('A사', '#000000')
    await store.renameProject(p.id, 'A사 유지보수')
    expect(store.config.projects[0]!.name).toBe('A사 유지보수')
  })

  it('없는 프로젝트 이름 변경을 거부한다', async () => {
    const { store } = await ready()
    await expect(store.renameProject('ghost', 'x')).rejects.toThrow()
  })

  it('색상을 바꾼다', async () => {
    const { store } = await ready()
    const p = await store.addProject('A사', '#000000')
    await store.setProjectColor(p.id, '#22aa66')
    expect(store.config.projects[0]!.color).toBe('#22aa66')
  })

  it('비활성으로 바꾼다', async () => {
    const { store } = await ready()
    const p = await store.addProject('A사', '#000000')
    await store.setProjectActive(p.id, false)
    expect(store.config.projects[0]!.active).toBe(false)
  })

  it('activeProjects는 활성만 준다', async () => {
    const { store } = await ready()
    const a = await store.addProject('A사', '#000000')
    await store.addProject('B사', '#111111')
    await store.setProjectActive(a.id, false)
    expect(store.activeProjects().map((p) => p.name)).toEqual(['B사'])
  })

  it('프로젝트를 삭제한다', async () => {
    const { store } = await ready()
    const p = await store.addProject('A사', '#000000')
    await store.deleteProject(p.id)
    expect(store.config.projects).toEqual([])
  })

  it('projectById로 찾는다', async () => {
    const { store } = await ready()
    const p = await store.addProject('A사', '#000000')
    expect(store.projectById(p.id)!.name).toBe('A사')
    expect(store.projectById('ghost')).toBeUndefined()
    expect(store.projectById(undefined)).toBeUndefined()
  })

  it('이름 변경 시 다른 프로젝트와 중복되면 거부한다', async () => {
    const { store } = await ready()
    await store.addProject('A사', '#000000')
    const b = await store.addProject('B사', '#111111')
    await expect(store.renameProject(b.id, 'A사')).rejects.toThrow()
    expect(store.config.projects[1]!.name).toBe('B사')
  })

  it('자기 이름 그대로 바꾸는 것은 허용한다', async () => {
    const { store } = await ready()
    const p = await store.addProject('A사', '#000000')
    await store.renameProject(p.id, 'A사')
    expect(store.config.projects[0]!.name).toBe('A사')
  })
})

/** 저장이 실패하는 상황을 만들기 위한 저장소 */
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

describe('ConfigStore 저장 실패 처리', () => {
  async function ready() {
    const storage = new FailingStorage()
    const store = createConfigStore(storage)
    await store.load()
    return { store, storage }
  }

  it('추가가 저장에 실패하면 화면 상태를 되돌린다', async () => {
    const { store, storage } = await ready()
    storage.failNextSave = true
    await expect(store.addProject('A사', '#000000')).rejects.toThrow()
    expect(store.config.projects).toEqual([])
  })

  it('이름 변경이 저장에 실패하면 이전 이름으로 되돌린다', async () => {
    const { store, storage } = await ready()
    const p = await store.addProject('A사', '#000000')
    storage.failNextSave = true
    await expect(store.renameProject(p.id, 'B사')).rejects.toThrow()
    expect(store.config.projects[0]!.name).toBe('A사')
  })

  it('삭제가 저장에 실패하면 프로젝트가 되살아난다', async () => {
    const { store, storage } = await ready()
    const p = await store.addProject('A사', '#000000')
    storage.failNextSave = true
    await expect(store.deleteProject(p.id)).rejects.toThrow()
    expect(store.config.projects.map((x) => x.name)).toEqual(['A사'])
  })

  it('저장 실패를 error에 남긴다', async () => {
    const { store, storage } = await ready()
    storage.failNextSave = true
    await expect(store.addProject('A사', '#000000')).rejects.toThrow()
    expect(store.error).toContain('디스크에 쓸 수 없습니다')
  })

  it('되돌린 뒤 다시 시도하면 성공한다', async () => {
    const { store, storage } = await ready()
    storage.failNextSave = true
    await expect(store.addProject('A사', '#000000')).rejects.toThrow()
    await store.addProject('A사', '#000000')
    expect(store.config.projects.map((x) => x.name)).toEqual(['A사'])
    expect(store.error).toBeNull()
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./config.svelte"`

- [ ] **Step 3: 스토어 구현**

`src/lib/stores/config.svelte.ts`:

```ts
import type { Storage } from '../ports/storage'
import {
  DEFAULT_CONFIG,
  DEFAULT_WORK_SETTINGS,
  SCHEMA_VERSION,
  type Config,
  type ConfigFile,
  type Project,
} from '../types'
import { newId } from '../core/ids'

export const CONFIG_KEY = 'config'

export class ConfigStore {
  #config = $state<Config>(structuredClone(DEFAULT_CONFIG))
  #loaded = $state(false)
  #error = $state<string | null>(null)

  constructor(private storage: Storage) {}

  get config(): Config {
    return this.#config
  }

  get loaded(): boolean {
    return this.#loaded
  }

  get error(): string | null {
    return this.#error
  }

  async load(): Promise<void> {
    const file = await this.storage.load<ConfigFile>(CONFIG_KEY)
    this.#config = file ? normalize(file.config) : structuredClone(DEFAULT_CONFIG)
    this.#loaded = true
  }

  async addProject(name: string, color: string): Promise<Project> {
    const trimmed = name.trim()
    if (trimmed.length === 0) throw new Error('프로젝트 이름이 비어 있습니다')
    if (this.#config.projects.some((p) => p.name === trimmed)) {
      throw new Error(`이미 있는 프로젝트입니다: ${trimmed}`)
    }
    const project: Project = { id: newId('proj'), name: trimmed, color, active: true }
    await this.#commit(() => {
      this.#config.projects.push(project)
    })
    return project
  }

  async renameProject(id: string, name: string): Promise<void> {
    const trimmed = name.trim()
    if (trimmed.length === 0) throw new Error('프로젝트 이름이 비어 있습니다')
    this.#require(id)
    if (this.#config.projects.some((o) => o.id !== id && o.name === trimmed)) {
      throw new Error(`이미 있는 프로젝트입니다: ${trimmed}`)
    }
    await this.#commit(() => {
      this.#require(id).name = trimmed
    })
  }

  async setProjectColor(id: string, color: string): Promise<void> {
    this.#require(id)
    await this.#commit(() => {
      this.#require(id).color = color
    })
  }

  async setProjectActive(id: string, active: boolean): Promise<void> {
    this.#require(id)
    await this.#commit(() => {
      this.#require(id).active = active
    })
  }

  async deleteProject(id: string): Promise<void> {
    this.#require(id)
    await this.#commit(() => {
      this.#config.projects = this.#config.projects.filter((p) => p.id !== id)
    })
  }

  activeProjects(): Project[] {
    return this.#config.projects.filter((p) => p.active)
  }

  projectById(id: string | undefined): Project | undefined {
    if (!id) return undefined
    return this.#config.projects.find((p) => p.id === id)
  }

  #require(id: string): Project {
    const p = this.#config.projects.find((x) => x.id === id)
    if (!p) throw new Error(`존재하지 않는 프로젝트입니다: ${id}`)
    return p
  }

  /**
   * 변경을 적용하고 저장한다. 저장이 실패하면 화면 상태를 저장 이전으로 되돌린다.
   *
   * 되돌리지 않으면 디스크에는 없는 값이 화면에만 남아, 사용자가 저장됐다고
   * 믿는 상태와 실제 파일이 어긋난다. 스펙의 "조용한 실패를 만들지 않는다"가
   * 요구하는 것은 오류를 띄우는 것뿐 아니라 거짓 성공을 보여주지 않는 것이다.
   */
  async #commit(apply: () => void): Promise<void> {
    const rollback = $state.snapshot(this.#config) as Config
    apply()
    try {
      await this.#persist()
    } catch (e) {
      this.#config = rollback
      throw e
    }
  }

  async #persist(): Promise<void> {
    const file: ConfigFile = {
      schemaVersion: SCHEMA_VERSION,
      // $state 프록시를 그대로 직렬화하지 않도록 평범한 객체로 되돌린다
      config: $state.snapshot(this.#config) as Config,
    }
    try {
      await this.storage.save(CONFIG_KEY, file)
      this.#error = null
    } catch (e) {
      this.#error = e instanceof Error ? e.message : String(e)
      throw e
    }
  }
}

/**
 * 저장 당시 없던 필드가 있어도 기본값으로 채워 넣는다.
 * DEFAULT_WORK_SETTINGS를 얕게 펼치면 workdays 같은 배열이 전역 기본값과
 * 같은 참조가 되므로, 기본값 쪽은 깊은 복사로 가져온다.
 */
function normalize(raw: Partial<Config> | undefined): Config {
  return {
    projects: raw?.projects ?? [],
    work: { ...structuredClone(DEFAULT_WORK_SETTINGS), ...(raw?.work ?? {}) },
  }
}

export function createConfigStore(storage: Storage): ConfigStore {
  return new ConfigStore(storage)
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS — config.test.ts 전부 통과

`$state` 룬을 `.svelte.ts` 파일에서 쓰므로 Svelte 컴파일러를 거쳐야 한다.
Vitest는 `vite.config.ts`를 그대로 쓰고 그 안에 `svelte()` 플러그인이 있으므로,
플러그인이 `.svelte.ts` 파일을 컴파일해준다. 별도 설정은 필요 없다.

`$state is not defined` 류의 오류가 나면 원인은 대개 다음 둘 중 하나다:

1. 파일 확장자가 `.svelte.ts`가 아니다 — 룬은 이 확장자에서만 컴파일된다
2. `vite.config.ts`에 `svelte()` 플러그인이 빠졌다

추측으로 설정을 추가하지 말고 위 둘을 먼저 확인한다.

- [ ] **Step 5: 설정 화면 작성**

`src/routes/Settings.svelte`:

```svelte
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
```

- [ ] **Step 6: App.svelte에 연결**

`src/App.svelte`:

```svelte
<script lang="ts">
  import { getStorage } from './lib/stores/context'
  import { createConfigStore } from './lib/stores/config.svelte'
  import Settings from './routes/Settings.svelte'

  const config = createConfigStore(getStorage())

  let tab = $state<'today' | 'settings'>('settings')
  let ready = $state(false)
  let loadError = $state<string | null>(null)

  $effect(() => {
    config
      .load()
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
{:else if tab === 'settings'}
  <Settings {config} />
{:else}
  <p class="loading">오늘 화면은 다음 단계에서 만듭니다.</p>
{/if}

<style>
  nav { display: flex; gap: 0.25rem; padding: 0.5rem; border-bottom: 1px solid rgba(128,128,128,0.3); }
  nav button { padding: 0.4rem 0.9rem; border: none; background: none; cursor: pointer; border-radius: 4px; }
  nav button.active { background: rgba(128,128,128,0.2); font-weight: 600; }
  .fatal { color: #c0392b; padding: 1.5rem; }
  .loading { padding: 1.5rem; opacity: 0.7; }
</style>
```

- [ ] **Step 7: 수동 확인**

Run: `npm run tauri dev`

확인 항목:
1. 창이 뜨고 "설정" 탭이 보인다
2. 프로젝트를 추가하면 목록에 나타난다
3. 창을 닫았다 `npm run tauri dev`로 다시 열면 프로젝트가 남아 있다
4. `src-tauri/target/debug/data/config.json`이 생성되고 사람이 읽을 수 있는 JSON이다
5. `src-tauri/target/debug/data/backups/<오늘날짜>/` 폴더가 생성된다
6. 같은 이름을 또 추가하면 빨간 오류 문구가 뜬다

- [ ] **Step 8: 커밋**

```bash
git add src/lib/stores/config.svelte.ts src/lib/stores/config.test.ts src/routes/Settings.svelte src/App.svelte
git commit -m "feat: add config store and project management screen"
```

---

## Task 8: 업무 스토어와 월별 파일 관리

**Files:**
- Create: `src/lib/stores/tasks.svelte.ts`
- Test: `src/lib/stores/tasks.test.ts`

**Interfaces:**
- Consumes: `Task`, `TaskFile`, `SCHEMA_VERSION` (Task 2), `Storage` (Task 2), `Clock` (Task 2), `core/task` 전체 (Task 3), `core/daily` 전체 (Task 4), `monthKey`/`addDays`/`toDateStr` (Task 1)
- Produces:
  - `class TaskStore` with:
    - `readonly all: Task[]` (로드된 월들의 합집합, 반응형)
    - `readonly error: string | null`
    - `loadAround(today: DateStr): Promise<void>` — 이전 달·이번 달·다음 달을 읽는다
    - `add(input: NewTaskInput): Promise<Task>`
    - `update(id: string, fn: (t: Task) => Task): Promise<void>`
    - `remove(id: string): Promise<void>`
    - `forDay(date: DateStr): Task[]` — 그날 계획된 것 + 그날까지 밀린 열린 것
    - `wrapUp(decisions: WrapUpDecision[]): Promise<void>`
  - `createTaskStore(storage: Storage, clock: Clock): TaskStore`
  - `taskKey(month: string): string` — `"tasks/2026-08"`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/stores/tasks.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { MemoryStorage } from '../adapters/memoryStorage'
import { FixedClock } from '../adapters/fixedClock'
import { createTaskStore, taskKey } from './tasks.svelte'
import { SCHEMA_VERSION, type TaskFile } from '../types'

const TODAY = '2026-08-03'
const NOW = new Date(2026, 7, 3, 9, 0, 0)

function setup(initial: Record<string, unknown> = {}) {
  const storage = new MemoryStorage(initial)
  const store = createTaskStore(storage, new FixedClock(NOW))
  return { storage, store }
}

describe('taskKey', () => {
  it('월 키를 저장소 키로 만든다', () => {
    expect(taskKey('2026-08')).toBe('tasks/2026-08')
  })
})

describe('TaskStore.loadAround', () => {
  it('비어 있으면 목록이 빈 채로 시작한다', async () => {
    const { store } = setup()
    await store.loadAround(TODAY)
    expect(store.all).toEqual([])
  })

  it('이번 달 파일을 읽는다', async () => {
    const file: TaskFile = {
      schemaVersion: SCHEMA_VERSION,
      tasks: [
        {
          id: 'a', title: '기존 업무', status: 'planned', priority: 2,
          plannedDate: '2026-08-03', carryCount: 0,
          createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(),
        },
      ],
    }
    const { store } = setup({ [taskKey('2026-08')]: file })
    await store.loadAround(TODAY)
    expect(store.all.map((t) => t.id)).toEqual(['a'])
  })

  it('지난달에 남은 업무도 읽는다', async () => {
    const file: TaskFile = {
      schemaVersion: SCHEMA_VERSION,
      tasks: [
        {
          id: 'old', title: '지난달 잔업', status: 'planned', priority: 2,
          plannedDate: '2026-07-30', carryCount: 0,
          createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(),
        },
      ],
    }
    const { store } = setup({ [taskKey('2026-07')]: file })
    await store.loadAround(TODAY)
    expect(store.all.map((t) => t.id)).toEqual(['old'])
  })

  it('말일 기준으로도 다음 달을 읽는다', async () => {
    // 오늘±35일로 계산하면 9월을 건너뛰어 9월 파일을 덮어쓸 위험이 있다
    const file: TaskFile = {
      schemaVersion: SCHEMA_VERSION,
      tasks: [
        {
          id: 'sep', title: '9월 업무', status: 'planned', priority: 2,
          plannedDate: '2026-09-10', carryCount: 0,
          createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(),
        },
      ],
    }
    const { store } = setup({ [taskKey('2026-09')]: file })
    await store.loadAround('2026-08-31')
    expect(store.all.map((t) => t.id)).toEqual(['sep'])
  })

  it('2월처럼 짧은 달에서도 앞뒤 달을 읽는다', async () => {
    // 1일 + 31일로 다음 달을 구하는 계산이 28일짜리 달에서도 맞는지 본다
    const seed = (id: string, plannedDate: string): TaskFile => ({
      schemaVersion: SCHEMA_VERSION,
      tasks: [
        {
          id, title: id, status: 'planned', priority: 2,
          plannedDate, carryCount: 0,
          createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(),
        },
      ],
    })
    const { store } = setup({
      [taskKey('2026-01')]: seed('jan', '2026-01-20'),
      [taskKey('2026-03')]: seed('mar', '2026-03-05'),
    })

    await store.loadAround('2026-02-28')

    expect(store.all.map((t) => t.id).sort()).toEqual(['jan', 'mar'])
  })
})

describe('TaskStore 미로드 월 보호', () => {
  it('안 읽은 달로 이월해도 그 달의 기존 업무를 지우지 않는다', async () => {
    const existing: TaskFile = {
      schemaVersion: SCHEMA_VERSION,
      tasks: [
        {
          id: 'dec', title: '12월 업무', status: 'planned', priority: 2,
          plannedDate: '2026-12-10', carryCount: 0,
          createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(),
        },
      ],
    }
    const { store, storage } = setup({ [taskKey('2026-12')]: existing })
    await store.loadAround(TODAY)
    const t = await store.add({ title: '옮길 것', plannedDate: TODAY })

    await store.update(t.id, (task) => ({ ...task, plannedDate: '2026-12-01' }))

    const saved = (await storage.load<TaskFile>(taskKey('2026-12')))!
    expect(saved.tasks.map((x) => x.id).sort()).toEqual(['dec', t.id].sort())
  })
})

describe('TaskStore.add', () => {
  it('업무를 추가한다', async () => {
    const { store } = setup()
    await store.loadAround(TODAY)
    const t = await store.add({ title: '보고서 초안', plannedDate: TODAY })
    expect(store.all).toHaveLength(1)
    expect(t.title).toBe('보고서 초안')
  })

  it('해당 월 파일에 저장한다', async () => {
    const { store, storage } = setup()
    await store.loadAround(TODAY)
    await store.add({ title: 'x', plannedDate: TODAY })
    const saved = (await storage.load<TaskFile>(taskKey('2026-08')))!
    expect(saved.tasks).toHaveLength(1)
    expect(saved.schemaVersion).toBe(SCHEMA_VERSION)
  })

  it('다른 달에 계획하면 그 달 파일에 저장한다', async () => {
    const { store, storage } = setup()
    await store.loadAround(TODAY)
    await store.add({ title: 'x', plannedDate: '2026-09-01' })
    expect((await storage.load<TaskFile>(taskKey('2026-09')))!.tasks).toHaveLength(1)
    expect(await storage.load<TaskFile>(taskKey('2026-08'))).toBeNull()
  })
})

describe('TaskStore.update', () => {
  it('업무를 바꾼다', async () => {
    const { store } = setup()
    await store.loadAround(TODAY)
    const t = await store.add({ title: 'x', plannedDate: TODAY })
    await store.update(t.id, (task) => ({ ...task, title: '바뀐 제목' }))
    expect(store.all[0]!.title).toBe('바뀐 제목')
  })

  it('없는 id면 거부한다', async () => {
    const { store } = setup()
    await store.loadAround(TODAY)
    await expect(store.update('ghost', (t) => t)).rejects.toThrow()
  })

  it('계획일이 다른 달로 옮겨지면 파일도 옮긴다', async () => {
    const { store, storage } = setup()
    await store.loadAround(TODAY)
    const t = await store.add({ title: 'x', plannedDate: '2026-08-31' })

    await store.update(t.id, (task) => ({ ...task, plannedDate: '2026-09-01' }))

    expect((await storage.load<TaskFile>(taskKey('2026-08')))!.tasks).toHaveLength(0)
    expect((await storage.load<TaskFile>(taskKey('2026-09')))!.tasks).toHaveLength(1)
  })
})

describe('TaskStore.remove', () => {
  it('업무를 지운다', async () => {
    const { store, storage } = setup()
    await store.loadAround(TODAY)
    const t = await store.add({ title: 'x', plannedDate: TODAY })
    await store.remove(t.id)
    expect(store.all).toEqual([])
    expect((await storage.load<TaskFile>(taskKey('2026-08')))!.tasks).toEqual([])
  })

  it('없는 id면 거부한다', async () => {
    const { store } = setup()
    await store.loadAround(TODAY)
    await expect(store.remove('ghost')).rejects.toThrow()
  })
})

describe('TaskStore.forDay', () => {
  it('그날 계획된 업무를 준다', async () => {
    const { store } = setup()
    await store.loadAround(TODAY)
    await store.add({ title: '오늘 것', plannedDate: TODAY })
    expect(store.forDay(TODAY).map((t) => t.title)).toEqual(['오늘 것'])
  })

  it('밀린 열린 업무를 함께 준다', async () => {
    const { store } = setup()
    await store.loadAround(TODAY)
    await store.add({ title: '밀린 것', plannedDate: '2026-08-01' })
    await store.add({ title: '오늘 것', plannedDate: TODAY })
    expect(store.forDay(TODAY).map((t) => t.title)).toEqual(['밀린 것', '오늘 것'])
  })

  it('과거에 완료된 업무는 빼고 준다', async () => {
    const { store } = setup()
    await store.loadAround(TODAY)
    const t = await store.add({ title: '어제 끝냄', plannedDate: '2026-08-02' })
    await store.update(t.id, (task) => ({ ...task, status: 'done' as const }))
    expect(store.forDay(TODAY)).toEqual([])
  })

  it('미래 업무는 빼고 준다', async () => {
    const { store } = setup()
    await store.loadAround(TODAY)
    await store.add({ title: '내일 것', plannedDate: '2026-08-04' })
    expect(store.forDay(TODAY)).toEqual([])
  })
})

describe('TaskStore.wrapUp', () => {
  it('결정을 한꺼번에 적용한다', async () => {
    const { store } = setup()
    await store.loadAround(TODAY)
    const a = await store.add({ title: 'a', plannedDate: TODAY })
    const b = await store.add({ title: 'b', plannedDate: TODAY })

    await store.wrapUp([
      { taskId: a.id, kind: 'complete', actualNote: '끝' },
      { taskId: b.id, kind: 'carry', toDate: '2026-08-04' },
    ])

    expect(store.all.find((t) => t.id === a.id)!.status).toBe('done')
    expect(store.all.find((t) => t.id === b.id)!.plannedDate).toBe('2026-08-04')
  })

  it('월을 넘겨 이월하면 파일을 옮긴다', async () => {
    const { store, storage } = setup()
    await store.loadAround('2026-08-31')
    const t = await store.add({ title: 'x', plannedDate: '2026-08-31' })

    await store.wrapUp([{ taskId: t.id, kind: 'carry', toDate: '2026-09-01' }])

    expect((await storage.load<TaskFile>(taskKey('2026-08')))!.tasks).toHaveLength(0)
    expect((await storage.load<TaskFile>(taskKey('2026-09')))!.tasks).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./tasks.svelte"`

- [ ] **Step 3: 스토어 구현**

`src/lib/stores/tasks.svelte.ts`:

```ts
import type { Storage } from '../ports/storage'
import type { Clock } from '../ports/clock'
import { SCHEMA_VERSION, type Task, type TaskFile } from '../types'
import { addDays, monthKey, type DateStr } from '../core/dates'
import { createTask, isOpen, sortForToday, type NewTaskInput } from '../core/task'
import { applyWrapUp, type WrapUpDecision } from '../core/daily'

export function taskKey(month: string): string {
  return `tasks/${month}`
}

export class TaskStore {
  /** 월 키 → 그 달의 업무들. 로드된 달만 들어 있다 */
  #months = $state<Record<string, Task[]>>({})
  #error = $state<string | null>(null)

  constructor(
    private storage: Storage,
    private clock: Clock,
  ) {}

  get all(): Task[] {
    return Object.values(this.#months).flat()
  }

  get error(): string | null {
    return this.#error
  }

  /**
   * 지난달·이번달·다음달을 읽는다.
   * 지난달까지 읽는 이유: 아직 이월 처리되지 않은 잔업이 그 파일에 남아 있다.
   * 다음달까지 읽는 이유: 말일에 이월하면 다음달 파일을 쓰게 되는데,
   * 읽지 않은 채 쓰면 그 파일을 통째로 덮어써 기존 업무가 사라진다.
   *
   * 날짜 ±N일이 아니라 달 단위로 계산한다.
   * 8월 31일 +35일은 10월이 되어 9월을 건너뛰기 때문이다.
   */
  async loadAround(today: DateStr): Promise<void> {
    const cur = monthKey(today)
    const firstOfCur = `${cur}-01`
    const prev = monthKey(addDays(firstOfCur, -1))
    // 어떤 달도 31일을 넘지 않으므로 1일 + 31일은 항상 다음 달에 떨어진다
    const next = monthKey(addDays(firstOfCur, 31))

    for (const m of [prev, cur, next]) {
      const file = await this.storage.load<TaskFile>(taskKey(m))
      this.#months[m] = file?.tasks ?? []
    }
  }

  async add(input: NewTaskInput): Promise<Task> {
    const task = createTask(input, this.clock.now())
    const m = monthKey(task.plannedDate)
    await this.#ensureLoaded(m)
    this.#months[m]!.push(task)
    await this.#persist([m])
    return task
  }

  async update(id: string, fn: (t: Task) => Task): Promise<void> {
    const found = this.#locate(id)
    const next = fn(found.task)
    const fromMonth = found.month
    const toMonth = monthKey(next.plannedDate)

    if (fromMonth === toMonth) {
      this.#months[fromMonth]![found.index] = next
      await this.#persist([fromMonth])
      return
    }

    // 계획일이 다른 달로 옮겨졌다. 원래 파일에서 빼고 새 파일에 넣는다.
    await this.#ensureLoaded(toMonth)
    this.#months[fromMonth] = this.#months[fromMonth]!.filter((t) => t.id !== id)
    this.#months[toMonth]!.push(next)
    await this.#persist([fromMonth, toMonth])
  }

  async remove(id: string): Promise<void> {
    const found = this.#locate(id)
    this.#months[found.month] = this.#months[found.month]!.filter((t) => t.id !== id)
    await this.#persist([found.month])
  }

  /** 그날 볼 목록: 그날 계획된 것 + 그날까지 밀린 열린 것 */
  forDay(date: DateStr): Task[] {
    const visible = this.all.filter(
      (t) => t.plannedDate === date || (isOpen(t) && t.plannedDate < date),
    )
    return sortForToday(visible, date)
  }

  async wrapUp(decisions: WrapUpDecision[]): Promise<void> {
    // 이월 대상 달을 먼저 읽어둔다. 안 읽은 달에 쓰면 그 파일을 덮어써버린다.
    // applyWrapUp 호출 전에 해야 한다. 뒤에 읽으면 새로 들어온 업무가
    // 아래 재구성 과정에서 빠진다.
    for (const d of decisions) {
      if (d.kind === 'carry') await this.#ensureLoaded(monthKey(d.toDate))
    }

    const before = this.all
    const after = applyWrapUp(before, decisions, this.clock.now())

    const touched = new Set<string>()
    const byMonth: Record<string, Task[]> = {}

    // 기존에 로드된 달은 일단 비워두고 다시 채운다
    for (const m of Object.keys(this.#months)) byMonth[m] = []

    for (let i = 0; i < after.length; i++) {
      const next = after[i]!
      const prev = before[i]!
      const m = monthKey(next.plannedDate)
      if (!byMonth[m]) byMonth[m] = []
      byMonth[m]!.push(next)

      if (next !== prev) {
        touched.add(m)
        touched.add(monthKey(prev.plannedDate))
      }
    }

    this.#months = byMonth
    await this.#persist([...touched])
  }

  /** 아직 안 읽은 달이면 파일에서 읽어온다. 없으면 빈 목록으로 시작한다. */
  async #ensureLoaded(month: string): Promise<void> {
    if (this.#months[month]) return
    const file = await this.storage.load<TaskFile>(taskKey(month))
    this.#months[month] = file?.tasks ?? []
  }

  #locate(id: string): { month: string; index: number; task: Task } {
    for (const [month, tasks] of Object.entries(this.#months)) {
      const index = tasks.findIndex((t) => t.id === id)
      if (index >= 0) return { month, index, task: tasks[index]! }
    }
    throw new Error(`존재하지 않는 업무입니다: ${id}`)
  }

  async #persist(months: string[]): Promise<void> {
    try {
      for (const m of new Set(months)) {
        const file: TaskFile = {
          schemaVersion: SCHEMA_VERSION,
          tasks: ($state.snapshot(this.#months[m] ?? []) as Task[]),
        }
        await this.storage.save(taskKey(m), file)
      }
      this.#error = null
    } catch (e) {
      this.#error = e instanceof Error ? e.message : String(e)
      throw e
    }
  }
}

export function createTaskStore(storage: Storage, clock: Clock): TaskStore {
  return new TaskStore(storage, clock)
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS — tasks.test.ts 전부 통과

- [ ] **Step 5: 커밋**

```bash
git add src/lib/stores/tasks.svelte.ts src/lib/stores/tasks.test.ts
git commit -m "feat: add task store with month-partitioned persistence"
```

---

## Task 9: Today 화면

**Files:**
- Create: `src/lib/components/QuickAdd.svelte`, `src/lib/components/TaskItem.svelte`, `src/lib/components/TaskList.svelte`
- Create: `src/routes/Today.svelte`
- Modify: `src/App.svelte`

**Interfaces:**
- Consumes: `TaskStore` (Task 8), `ConfigStore` (Task 7), `completeTask`/`reopenTask`/`startTask`/`isOpen`/`isOverdue`/`overdueDays` (Task 3), `getClock`/`getStorage` (Task 6), `toDateStr` (Task 1)
- Produces (모든 콜백 prop의 타입은 `(task: Task) => void`):
  - `Today.svelte` — props: `{ tasks: TaskStore; config: ConfigStore; today: DateStr }`
  - `TaskItem.svelte` — props: `{ task: Task; today: DateStr; project?: Project; warnDays: number; onToggle; onStart; onDelete }`
  - `TaskList.svelte` — props: `{ title: string; tasks: Task[]; today: DateStr; config: ConfigStore; emptyText: string; onToggle; onStart; onDelete }`
  - `QuickAdd.svelte` — props: `{ config: ConfigStore; onAdd: (input: { title: string; projectId?: string; priority: 1|2|3 }) => Promise<void> }`

- [ ] **Step 1: QuickAdd 작성**

`src/lib/components/QuickAdd.svelte`:

```svelte
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
```

- [ ] **Step 2: TaskItem 작성**

`src/lib/components/TaskItem.svelte`:

```svelte
<script lang="ts">
  import type { Task, Project } from '../types'
  import type { DateStr } from '../core/dates'
  import { isOpen, isOverdue, overdueDays } from '../core/task'

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
</script>

<li class:done={task.status === 'done'} class:dropped={task.status === 'dropped'}>
  <input
    type="checkbox"
    checked={task.status === 'done'}
    onchange={() => onToggle(task)}
    aria-label="{task.title} 완료"
  />

  <span class="title">{task.title}</span>

  {#if project}
    <span class="project" style="background:{project.color}22; color:{project.color}">
      {project.name}
    </span>
  {/if}

  {#if task.priority === 1}
    <span class="prio">높음</span>
  {/if}

  {#if late}
    <span class="late" class:severe>{lateDays}일 밀림</span>
  {/if}

  {#if task.status === 'doing'}
    <span class="doing">진행 중</span>
  {:else if isOpen(task)}
    <button class="ghost" onclick={() => onStart(task)}>시작</button>
  {/if}

  <button class="ghost" onclick={() => onDelete(task)} aria-label="{task.title} 삭제">×</button>
</li>

<style>
  li {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.5rem 0.6rem; border-radius: 6px;
    background: rgba(128, 128, 128, 0.07);
  }
  .title { flex: 1; }
  li.done .title { text-decoration: line-through; opacity: 0.55; }
  li.dropped .title { text-decoration: line-through; opacity: 0.4; font-style: italic; }
  .project, .prio, .late, .doing {
    font-size: 0.75rem; padding: 0.1rem 0.45rem; border-radius: 999px; white-space: nowrap;
  }
  .prio { background: #ffe6e6; color: #c0392b; }
  .late { background: #fff2d6; color: #a86400; }
  .late.severe { background: #ffd9d9; color: #b02020; font-weight: 600; }
  .doing { background: #dcefff; color: #1f6fb2; }
  .ghost { border: none; background: none; cursor: pointer; opacity: 0.6; padding: 0.2rem 0.4rem; }
  .ghost:hover { opacity: 1; }
</style>
```

- [ ] **Step 3: TaskList 작성**

`src/lib/components/TaskList.svelte`:

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

<section>
  <h3>{title} <span class="count">{tasks.length}</span></h3>
  {#if tasks.length === 0}
    <p class="empty">{emptyText}</p>
  {:else}
    <ul>
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

<style>
  section { margin-bottom: 1.5rem; }
  h3 { font-size: 0.9rem; margin: 0 0 0.5rem; opacity: 0.8; }
  .count { opacity: 0.5; font-weight: 400; }
  ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.35rem; }
  .empty { opacity: 0.5; font-size: 0.85rem; margin: 0; }
</style>
```

- [ ] **Step 4: Today 화면 작성**

`src/routes/Today.svelte`:

```svelte
<script lang="ts">
  import type { Task } from '../lib/types'
  import type { DateStr } from '../lib/core/dates'
  import type { TaskStore } from '../lib/stores/tasks.svelte'
  import type { ConfigStore } from '../lib/stores/config.svelte'
  import { completeTask, reopenTask, startTask, isOpen, isOverdue } from '../lib/core/task'
  import { getClock } from '../lib/stores/context'
  import QuickAdd from '../lib/components/QuickAdd.svelte'
  import TaskList from '../lib/components/TaskList.svelte'

  let {
    tasks,
    config,
    today,
  }: { tasks: TaskStore; config: ConfigStore; today: DateStr } = $props()

  const visible = $derived(tasks.forDay(today))
  const late = $derived(visible.filter((t) => isOverdue(t, today)))
  const open = $derived(visible.filter((t) => isOpen(t) && !isOverdue(t, today)))
  const closed = $derived(visible.filter((t) => !isOpen(t)))

  async function add(input: { title: string; projectId?: string; priority: 1 | 2 | 3 }) {
    await tasks.add({ ...input, plannedDate: today })
  }

  async function toggle(task: Task) {
    const now = getClock().now()
    await tasks.update(task.id, (t) =>
      isOpen(t) ? completeTask(t, now) : reopenTask(t, now),
    )
  }

  async function start(task: Task) {
    const now = getClock().now()
    await tasks.update(task.id, (t) => startTask(t, now))
  }

  async function remove(task: Task) {
    if (!confirm(`'${task.title}'을(를) 삭제할까요?`)) return
    await tasks.remove(task.id)
  }
</script>

<div class="page">
  <header>
    <h2>{today}</h2>
    <p class="summary">
      남은 일 {late.length + open.length}건
      {#if late.length > 0}<span class="warn">· 밀린 일 {late.length}건</span>{/if}
    </p>
  </header>

  <QuickAdd {config} onAdd={add} />

  {#if tasks.error}
    <p class="error">저장에 실패했습니다: {tasks.error}</p>
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
</div>

<style>
  .page { padding: 1.5rem; max-width: 760px; }
  header { margin-bottom: 1rem; }
  h2 { margin: 0; font-size: 1.2rem; }
  .summary { margin: 0.2rem 0 0; opacity: 0.7; font-size: 0.85rem; }
  .warn { color: #a86400; }
  .error { color: #c0392b; }
</style>
```

- [ ] **Step 5: App.svelte에 Today 연결**

`src/App.svelte`를 교체:

```svelte
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
```

- [ ] **Step 6: 타입 체크와 테스트**

Run: `npm run check && npm test`
Expected: 타입 오류 없음, 기존 테스트 전부 통과

- [ ] **Step 7: 수동 확인**

Run: `npm run tauri dev`

확인 항목:
1. "오늘" 탭에 오늘 날짜와 "남은 일 0건"이 보인다
2. 업무를 추가하면 "오늘 할 일" 목록에 나타난다
3. 체크박스를 누르면 "마무리됨"으로 내려가고 취소선이 생긴다
4. 다시 누르면 되돌아온다
5. "시작"을 누르면 "진행 중" 배지가 붙는다
6. 설정 탭에서 프로젝트를 만들고 오늘 탭에서 선택하면 색 배지가 붙는다
7. 앱을 껐다 켜도 업무가 남아 있다
8. `src-tauri/target/debug/data/tasks/<이번달>.json`이 사람이 읽을 수 있는 JSON이다

- [ ] **Step 8: 커밋**

```bash
git add src/lib/components src/routes/Today.svelte src/App.svelte
git commit -m "feat: add Today screen with quick add and task list"
```

---

## Task 10: 하루 마감

**Files:**
- Create: `src/lib/components/DailyWrapUp.svelte`
- Modify: `src/routes/Today.svelte`

**Interfaces:**
- Consumes: `TaskStore.wrapUp` (Task 8), `pendingForWrapUp`/`defaultDecisions`/`WrapUpDecision` (Task 4), `ConfigStore` (Task 7), `addDays` (Task 1)
- Produces:
  - `DailyWrapUp.svelte` — props: `{ tasks: TaskStore; config: ConfigStore; today: DateStr; onClose: () => void }`

- [ ] **Step 1: DailyWrapUp 작성**

`src/lib/components/DailyWrapUp.svelte`:

```svelte
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
  const tomorrow = addDays(today, 1)

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

<div class="sheet" role="dialog" aria-label="하루 마감">
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
```

- [ ] **Step 2: Today 화면에 연결**

`src/routes/Today.svelte`의 `<script>` 끝에 추가:

```ts
  import DailyWrapUp from '../lib/components/DailyWrapUp.svelte'
  import { pendingForWrapUp } from '../lib/core/daily'

  let wrapUpOpen = $state(false)
  const pendingCount = $derived(pendingForWrapUp(tasks.all, today).length)
```

`</div>` 직전(마지막 `TaskList` 다음)에 추가:

```svelte
  <div class="wrapup-bar">
    <button class="wrapup" onclick={() => (wrapUpOpen = true)}>
      하루 마감 {#if pendingCount > 0}({pendingCount}건){/if}
    </button>
  </div>

  {#if wrapUpOpen}
    <DailyWrapUp {tasks} {config} {today} onClose={() => (wrapUpOpen = false)} />
  {/if}
```

`<style>` 안에 추가:

```css
  .wrapup-bar { margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid rgba(128,128,128,0.25); }
  .wrapup { padding: 0.6rem 1.2rem; font-weight: 600; cursor: pointer; border-radius: 6px; }
```

- [ ] **Step 3: 타입 체크와 테스트**

Run: `npm run check && npm test`
Expected: 타입 오류 없음, 전체 테스트 통과

- [ ] **Step 4: 수동 확인**

Run: `npm run tauri dev`

확인 항목:
1. 업무 3건을 추가한 뒤 "하루 마감 (3건)" 버튼이 보인다
2. 버튼을 누르면 3건이 전부 "내일로"가 선택된 채 뜬다
3. 하나를 "완료"로 바꾸면 실적 메모 입력칸이 나타난다
4. "마감하기"를 누르면 창이 닫히고, 완료한 건은 "마무리됨"으로 간다
5. 이월한 건은 오늘 목록에서 사라진다
6. 앱을 껐다 켜고 시스템 날짜를 하루 뒤로 바꾼 뒤 다시 열면, 이월한 업무가 "오늘 할 일"에 나타난다
7. 시스템 날짜를 이틀 더 앞으로 옮기면 밀린 업무에 "N일 밀림" 배지가 붙는다

날짜를 바꿔 확인한 뒤에는 시스템 날짜를 원래대로 되돌린다.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/components/DailyWrapUp.svelte src/routes/Today.svelte
git commit -m "feat: add daily wrap-up sheet for plan-to-actual transition"
```

---

## 마무리 확인

전체 태스크가 끝나면 다음을 실행해 상태를 확인한다.

- [ ] **전체 테스트**

Run: `npm test`
Expected: dates, memoryStorage, task, daily, config, tasks 스위트 전부 PASS

Run: `cd src-tauri && cargo test`
Expected: storage 테스트 전부 PASS

- [ ] **타입 체크**

Run: `npm run check`
Expected: 오류 0

- [ ] **릴리스 빌드와 portable 확인**

Run: `npm run tauri build`
Expected: `src-tauri/target/release/JobPilot.exe` 생성

`JobPilot.exe`를 빈 폴더에 복사해 실행한다.

확인 항목:
- 같은 폴더에 `data/`가 생성된다
- 업무를 추가하고 앱을 껐다 켜면 남아 있다
- 그 폴더째 다른 위치로 옮겨 실행해도 데이터가 따라온다

이것이 스펙 13장 완료 기준 1, 2, 5, 8에 해당한다.
기준 3(알람), 4(주간보고), 6·7(AI)은 후속 단계에서 다룬다.

# JobPilot Phase 2a — UI 기반과 설정 화면 마이그레이션 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tailwind CSS와 shadcn-svelte를 도입해 디자인 토큰·다크 모드·재사용 컴포넌트의 바탕을 깔고, 설정 화면을 그 위로 옮겨 이후 모든 화면이 따라갈 패턴을 만든다.

**Architecture:** Tailwind를 Vite 플러그인으로 붙이고, shadcn-svelte CLI로 컴포넌트 소스를 `src/lib/components/ui/`에 복사해 저장소가 직접 소유한다. 색은 전부 CSS 변수 토큰으로 두고 `.dark` 클래스가 그 값을 갈아끼운다. 화면 컴포넌트는 하드코딩된 hex를 버리고 토큰 클래스만 쓴다.

**Tech Stack:** Tailwind CSS v4, shadcn-svelte, bits-ui, Svelte 5, Vite 6, TypeScript 5

**선행 상태:** Phase 1이 `main`에 병합되어 있다 (커밋 `c34718e`, vitest 151 통과, `npm run check` 0 errors 0 warnings).

## Global Constraints

- 런타임에 외부 네트워크를 호출하는 코드를 넣지 않는다. CDN에서 CSS·폰트·스크립트를 불러오지 않는다. 모든 자산은 빌드 타임에 번들된다.
- shadcn-svelte는 컴포넌트 **소스를 저장소로 복사**하는 방식이다. 이 성질이 사내망 제약을 만족시키는 근거이므로, 런타임 컴포넌트 라이브러리로 대체하지 않는다.
- `src/lib/core/`는 이 계획에서 **한 줄도 바뀌지 않는다.** 순수 도메인 로직이며 UI를 모른다.
- `src/lib/stores/`의 공개 인터페이스도 바뀌지 않는다. 화면만 바뀐다.
- 기존 동작을 바꾸지 않는다. 이 단계는 **외형과 구조의 이전**이지 기능 변경이 아니다. 특히 `run()` 헬퍼를 통한 오류 표시, 저장 실패 시 롤백, `today` 반응성은 그대로 유지한다.
- 색상을 hex로 직접 쓰지 않는다. 반드시 토큰(`bg-background`, `text-muted-foreground` 등)을 쓴다. 예외는 사용자가 지정한 프로젝트 색상뿐이다.
- vitest 151개가 계속 통과해야 한다. `npm run check`는 0 errors, 0 warnings를 유지한다.
- `src-tauri/`를 건드리지 않는다. Rust 툴체인 부재로 보류된 Task 5의 미완성 작업물이 untracked로 남아 있다.
- `npm run tauri dev`를 실행하지 않는다. Rust가 없다. 확인은 `npm run dev`로 한다.
- 커밋 메시지는 Conventional Commits(`feat:`, `fix:`, `chore:`, `style:`)를 쓴다.

## 이 계획의 범위

**포함**

- Tailwind v4 도입과 Vite 연결
- shadcn-svelte 초기화, 토큰 정의, 다크 모드 전환
- Pretendard 로컬 번들 (실패해도 진행 — 아래 Task 1 참조)
- 앱 셸(`App.svelte`) 마이그레이션 + 다크 모드 토글
- 설정 화면(`Settings.svelte`) 마이그레이션

**제외 — 후속 계획(Phase 2b)에서 다룬다**

| 항목 | 이유 |
|---|---|
| `Today.svelte`, `QuickAdd`, `TaskItem`, `TaskList`, `DailyWrapUp` | 화면 하나로 패턴을 확립한 뒤 옮기는 편이 안전하다 |
| Week / Calendar 화면 신규 개발 | 기능 추가이므로 별도 계획 |
| 본격 디자인 패스(레이아웃·타이포·인터랙션 재설계) | 사용자 결정: 모든 화면이 나온 뒤에 한다 |

이 계획이 끝나면 앱은 **두 가지 외형이 공존하는 과도기 상태**가 된다. 설정 탭은 새 디자인, 오늘 탭은 기존 CSS. 의도된 것이며 Phase 2b에서 해소된다.

---

## File Structure

```
JobPilot/
├── package.json                   (수정) tailwind, shadcn 관련 의존성 추가
├── vite.config.ts                 (수정) tailwind 플러그인 등록
├── components.json                (신규) shadcn-svelte 설정
├── src/
│   ├── app.css                    (교체) tailwind import + 토큰 정의
│   ├── App.svelte                 (수정) 셸 마이그레이션 + 테마 토글
│   ├── lib/
│   │   ├── utils.ts               (신규) shadcn의 cn() 헬퍼
│   │   ├── theme.svelte.ts        (신규) 다크 모드 상태와 영속화
│   │   ├── theme.test.ts          (신규) 테마 로직 단위 테스트
│   │   ├── components/ui/         (신규) shadcn-svelte가 복사해 넣는 컴포넌트
│   │   │   ├── button/
│   │   │   ├── input/
│   │   │   ├── checkbox/
│   │   │   ├── label/
│   │   │   ├── card/
│   │   │   └── alert/
│   │   └── components/            (기존 4개 — 이 계획에서 변경 없음)
│   └── routes/
│       ├── Settings.svelte        (교체) shadcn 기반으로 재작성
│       └── Today.svelte           (변경 없음 — Phase 2b)
```

**책임 분리**

- `src/lib/utils.ts` — `cn()` 하나만. shadcn 컴포넌트가 전부 이걸 부른다.
- `src/lib/theme.svelte.ts` — 테마 상태 소유. DOM 클래스 적용과 저장은 여기서만.
- `src/lib/components/ui/*` — shadcn이 생성한 원시 컴포넌트. **직접 수정하지 않는다.** 필요하면 감싸서 쓴다.
- `src/routes/*` — 화면. 토큰 클래스와 ui 컴포넌트만 조합한다.

---

## Task 1: Tailwind와 shadcn-svelte 도입

**Files:**
- Modify: `package.json`, `vite.config.ts`
- Create: `src/lib/utils.ts`
- Replace: `src/app.css`

> `components.json`은 이 태스크에서 만들지 않는다. Task 2의 shadcn-svelte CLI가
> 생성한다.

**Interfaces:**
- Consumes: 없음
- Produces:
  - `cn(...inputs: ClassValue[]): string` — `src/lib/utils.ts`
  - CSS 토큰: `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--destructive-foreground`, `--warning`, `--warning-foreground`, `--border`, `--input`, `--ring`, `--radius`
  - `.dark` 클래스가 위 토큰을 어두운 값으로 재정의한다

- [ ] **Step 1: Tailwind 설치**

Run: `npm install -D tailwindcss @tailwindcss/vite tailwind-merge clsx tailwind-variants`
Expected: 오류 없이 완료

> Tailwind v4는 `tailwind.config.js`가 필요 없다. 설정은 CSS 안에서 한다.
> `tailwind-merge`/`clsx`는 `cn()`이, `tailwind-variants`는 shadcn 컴포넌트가 쓴다.

- [ ] **Step 2: Vite에 Tailwind 플러그인 등록**

`vite.config.ts`를 다음으로 교체한다. 기존 `test` 블록의 주석은 반드시 보존한다 — 그 설명이 없으면 다음 사람이 jsdom을 불필요한 의존성으로 오해해 지운다.

```ts
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss(), svelte()],
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

- [ ] **Step 3: `cn()` 헬퍼 작성**

`src/lib/utils.ts`:

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * 조건부 클래스를 합치고 Tailwind 충돌을 해소한다.
 * cn('p-2', 'p-4') === 'p-4' — 뒤에 온 값이 이긴다.
 * shadcn 컴포넌트가 전부 이 함수를 통해 사용자 클래스를 병합한다.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 4: 토큰과 전역 스타일 작성**

`src/app.css`를 다음으로 **교체**한다:

```css
@import 'tailwindcss';

/* .dark 클래스가 붙은 조상 아래에서 dark: 변형이 적용되게 한다.
   미디어 쿼리 기본값 대신 클래스 방식을 쓰는 이유는, 사용자가 OS 설정과
   무관하게 앱 안에서 테마를 고를 수 있어야 하기 때문이다. */
@custom-variant dark (&:where(.dark, .dark *));

:root {
  --background: hsl(0 0% 100%);
  --foreground: hsl(222 47% 11%);
  --card: hsl(0 0% 100%);
  --card-foreground: hsl(222 47% 11%);
  --popover: hsl(0 0% 100%);
  --popover-foreground: hsl(222 47% 11%);
  --primary: hsl(222 47% 31%);
  --primary-foreground: hsl(210 40% 98%);
  --secondary: hsl(210 40% 96%);
  --secondary-foreground: hsl(222 47% 11%);
  --muted: hsl(210 40% 96%);
  --muted-foreground: hsl(215 16% 47%);
  --accent: hsl(210 40% 96%);
  --accent-foreground: hsl(222 47% 11%);
  --destructive: hsl(0 72% 45%);
  --destructive-foreground: hsl(210 40% 98%);
  --warning: hsl(38 92% 40%);
  --warning-foreground: hsl(48 96% 95%);
  --border: hsl(214 32% 91%);
  --input: hsl(214 32% 91%);
  --ring: hsl(222 47% 31%);
  --radius: 0.5rem;
}

.dark {
  --background: hsl(222 47% 9%);
  --foreground: hsl(210 40% 96%);
  --card: hsl(222 40% 13%);
  --card-foreground: hsl(210 40% 96%);
  --popover: hsl(222 40% 13%);
  --popover-foreground: hsl(210 40% 96%);
  --primary: hsl(210 40% 96%);
  --primary-foreground: hsl(222 47% 11%);
  --secondary: hsl(217 33% 18%);
  --secondary-foreground: hsl(210 40% 96%);
  --muted: hsl(217 33% 18%);
  --muted-foreground: hsl(215 20% 65%);
  --accent: hsl(217 33% 18%);
  --accent-foreground: hsl(210 40% 96%);
  --destructive: hsl(0 63% 50%);
  --destructive-foreground: hsl(210 40% 98%);
  --warning: hsl(38 92% 58%);
  --warning-foreground: hsl(20 15% 12%);
  --border: hsl(217 33% 20%);
  --input: hsl(217 33% 20%);
  --ring: hsl(213 27% 70%);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-lg: var(--radius);
  --radius-md: calc(var(--radius) - 2px);
  --radius-sm: calc(var(--radius) - 4px);
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
    margin: 0;
    font-family: 'Pretendard Variable', Pretendard, 'Segoe UI', system-ui, sans-serif;
    font-size: 14px;
  }
}
```

> `--warning` 토큰은 shadcn 기본 세트에 없다. 밀린 업무 배지가 이 색을 쓰므로
> 직접 추가한다. 없으면 Phase 2b에서 다시 hex를 하드코딩하게 된다.

- [ ] **Step 5: Tailwind가 실제로 적용되는지 확인**

Run: `npm run dev`

브라우저에서 `http://localhost:1420`을 열고 개발자 도구 콘솔에 입력:

```js
getComputedStyle(document.body).backgroundColor
```

Expected: `rgb(255, 255, 255)` (토큰이 적용된 흰 배경). Tailwind가 안 붙었다면 기본값이나 빈 문자열이 나온다.

이어서 다크 모드 토큰이 살아 있는지 확인:

```js
document.documentElement.classList.add('dark')
getComputedStyle(document.body).backgroundColor
document.documentElement.classList.remove('dark')
```

Expected: 두 번째 호출이 어두운 값(`rgb(12, 17, 29)` 부근)을 반환한다.

서버를 종료한다.

- [ ] **Step 6: Pretendard 번들 (실패해도 진행)**

Run: `npm install pretendard`

성공하면 `src/app.css`의 첫 줄 **위에** 다음을 추가한다:

```css
@import 'pretendard/dist/web/variable/pretendardvariable.css';
```

패키지가 없거나 설치가 실패하면 **중단하지 말고 건너뛴다.** `body`의 폰트 스택이 이미 `'Segoe UI', system-ui`로 폴백하므로 앱은 정상 동작한다. 리포트에 건너뛴 사실과 정확한 오류를 남긴다. 폰트는 CDN으로 대체하지 않는다 — 사내망 제약 위반이다.

- [ ] **Step 7: 기존 테스트가 깨지지 않았는지 확인**

Run: `npm test`
Expected: 151 passed

Run: `npm run check`
Expected: 0 errors, 0 warnings

- [ ] **Step 8: 커밋**

```bash
git add package.json package-lock.json vite.config.ts src/app.css src/lib/utils.ts
git commit -m "feat: add Tailwind with a token-based light and dark palette"
```

---

## Task 2: 테마 상태와 앱 셸 마이그레이션

**Files:**
- Create: `src/lib/theme.svelte.ts`, `src/lib/theme.test.ts`
- Create: `src/lib/components/ui/button/`, `.../input/`, `.../checkbox/`, `.../label/`, `.../card/`, `.../alert/` (shadcn CLI 생성)
- Create: `components.json` (shadcn CLI 생성)
- Modify: `src/App.svelte`

**Interfaces:**
- Consumes: `cn()` (Task 1), CSS 토큰 (Task 1)
- Produces:
  - `type Theme = 'light' | 'dark'`
  - `class ThemeStore` — `readonly theme: Theme`, `toggle(): void`, `apply(): void`
  - `createThemeStore(storage: ThemeStorage): ThemeStore`
  - `interface ThemeStorage { read(): string | null; write(value: string): void }`
  - `const THEME_KEY = 'jobpilot.theme'`
  - shadcn 컴포넌트: `Button`, `Input`, `Checkbox`, `Label`, `Card`(+`CardHeader`/`CardTitle`/`CardContent`), `Alert`(+`AlertDescription`)

- [ ] **Step 1: shadcn-svelte 초기화**

shadcn-svelte CLI는 대화형 프롬프트를 띄운다. 비대화형 실행 플래그는 버전마다 다르므로 **먼저 도움말을 확인한다**:

Run: `npx shadcn-svelte@latest init --help`

출력에 있는 플래그를 써서 다음 선택으로 초기화한다:

- base color: `slate`
- global CSS 파일: `src/app.css`
- 컴포넌트 별칭: `$lib/components`
- 유틸 별칭: `$lib/utils`

Expected: `components.json`이 생성된다.

**주의:** CLI가 `src/app.css`를 덮어쓰거나 토큰을 자기 것으로 교체할 수 있다. 실행 후 반드시 `git diff src/app.css`로 확인하고, Task 1에서 정의한 토큰(특히 `--warning`/`--warning-foreground`와 `@custom-variant dark` 줄)이 사라졌으면 되살린다. CLI가 추가한 유용한 줄이 있으면 병합하되, Task 1의 토큰 값이 우선이다.

`$lib` 별칭이 아직 없으면 `tsconfig.json`에 추가한다:

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
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "$lib": ["src/lib"],
      "$lib/*": ["src/lib/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.svelte"]
}
```

그리고 `vite.config.ts`에 `resolve` 항목을 추가한다 (기존 항목은 그대로 두고 추가만 한다). 파일 맨 위에 `import { fileURLToPath } from 'node:url'`을 추가하고, `defineConfig` 안에:

```ts
  resolve: {
    alias: {
      // Windows에서 URL.pathname은 "/C:/..." 형태라 그대로 쓰면 경로가 깨진다.
      // fileURLToPath가 플랫폼에 맞는 경로로 바꿔준다.
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
    },
  },
```

- [ ] **Step 2: 컴포넌트 설치**

Run: `npx shadcn-svelte@latest add button input checkbox label card alert`
Expected: `src/lib/components/ui/` 아래에 각 컴포넌트 폴더가 생성된다

Run: `npm run check`
Expected: 0 errors. 오류가 나면 대개 `$lib` 별칭 미설정이거나 `tailwind-variants` 미설치다. 두 가지를 먼저 확인한다.

- [ ] **Step 3: 실패하는 테마 테스트 작성**

`src/lib/theme.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createThemeStore, THEME_KEY, type ThemeStorage } from './theme.svelte'

function fakeStorage(initial: string | null = null): ThemeStorage & { value: string | null } {
  return {
    value: initial,
    read() {
      return this.value
    },
    write(v: string) {
      this.value = v
    },
  }
}

describe('THEME_KEY', () => {
  it('앱 이름으로 네임스페이스를 둔다', () => {
    expect(THEME_KEY).toBe('jobpilot.theme')
  })
})

describe('createThemeStore', () => {
  it('저장된 값이 없으면 light로 시작한다', () => {
    expect(createThemeStore(fakeStorage()).theme).toBe('light')
  })

  it('저장된 dark를 읽어온다', () => {
    expect(createThemeStore(fakeStorage('dark')).theme).toBe('dark')
  })

  it('저장된 값이 이상하면 light로 떨어진다', () => {
    expect(createThemeStore(fakeStorage('purple')).theme).toBe('light')
  })

  it('빈 문자열도 light로 떨어진다', () => {
    expect(createThemeStore(fakeStorage('')).theme).toBe('light')
  })
})

describe('ThemeStore.toggle', () => {
  it('light에서 dark로 바꾼다', () => {
    const store = createThemeStore(fakeStorage())
    store.toggle()
    expect(store.theme).toBe('dark')
  })

  it('dark에서 light로 되돌린다', () => {
    const store = createThemeStore(fakeStorage('dark'))
    store.toggle()
    expect(store.theme).toBe('light')
  })

  it('바뀐 값을 저장한다', () => {
    const storage = fakeStorage()
    const store = createThemeStore(storage)
    store.toggle()
    expect(storage.value).toBe('dark')
  })

  it('두 번 토글하면 제자리로 온다', () => {
    const storage = fakeStorage()
    const store = createThemeStore(storage)
    store.toggle()
    store.toggle()
    expect(store.theme).toBe('light')
    expect(storage.value).toBe('light')
  })
})

describe('ThemeStore.apply', () => {
  it('dark일 때 문서 루트에 dark 클래스를 붙인다', () => {
    const store = createThemeStore(fakeStorage('dark'))
    store.apply()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('light일 때 dark 클래스를 뗀다', () => {
    document.documentElement.classList.add('dark')
    const store = createThemeStore(fakeStorage('light'))
    store.apply()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('토글 후 apply하면 클래스가 따라간다', () => {
    const store = createThemeStore(fakeStorage('light'))
    store.toggle()
    store.apply()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    store.toggle()
    store.apply()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
```

- [ ] **Step 4: 테스트가 실패하는지 확인**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./theme.svelte"`

- [ ] **Step 5: 테마 스토어 구현**

`src/lib/theme.svelte.ts`:

```ts
export type Theme = 'light' | 'dark'

export const THEME_KEY = 'jobpilot.theme'

/**
 * 테마 값을 읽고 쓰는 통로.
 * 인터페이스로 두는 이유는 테스트에서 localStorage 없이 검증하기 위해서다.
 */
export interface ThemeStorage {
  read(): string | null
  write(value: string): void
}

/** 브라우저와 WebView에서 쓰는 실제 구현 */
export const browserThemeStorage: ThemeStorage = {
  read() {
    try {
      return localStorage.getItem(THEME_KEY)
    } catch {
      // 저장소가 막힌 환경에서도 앱은 떠야 한다
      return null
    }
  },
  write(value: string) {
    try {
      localStorage.setItem(THEME_KEY, value)
    } catch {
      // 저장에 실패해도 이번 세션의 테마는 유지된다
    }
  },
}

function parse(raw: string | null): Theme {
  return raw === 'dark' ? 'dark' : 'light'
}

export class ThemeStore {
  #theme = $state<Theme>('light')

  constructor(private storage: ThemeStorage) {
    this.#theme = parse(storage.read())
  }

  get theme(): Theme {
    return this.#theme
  }

  toggle(): void {
    this.#theme = this.#theme === 'light' ? 'dark' : 'light'
    this.storage.write(this.#theme)
    this.apply()
  }

  /** 현재 테마를 문서 루트 클래스에 반영한다 */
  apply(): void {
    if (typeof document === 'undefined') return
    document.documentElement.classList.toggle('dark', this.#theme === 'dark')
  }
}

export function createThemeStore(storage: ThemeStorage): ThemeStore {
  return new ThemeStore(storage)
}
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npm test`
Expected: PASS — 151 + 12 = 163 passed

- [ ] **Step 7: 앱 셸 마이그레이션**

`src/App.svelte`를 다음으로 교체한다. **`<script>` 안의 로직은 테마 관련 3줄 추가 외에 한 글자도 바뀌지 않는다** — 날짜 반응성, 오류 비우기, 두 개의 `$effect`는 Phase 1의 리뷰 수정으로 들어간 것이라 그대로 보존한다.

```svelte
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
```

- [ ] **Step 8: 확인**

Run: `npm run check && npm test`
Expected: 0 errors 0 warnings, 163 passed

Run: `npm run dev`

브라우저에서 확인:

1. 상단 탭 두 개가 shadcn 버튼으로 보이고, 선택된 탭이 시각적으로 구분된다
2. 우측 끝 아이콘 버튼을 누르면 화면 전체가 어두워지고 아이콘이 ☀/☾로 바뀐다
3. 새로고침해도 마지막에 고른 테마가 유지된다
4. 다크 모드에서 "오늘" 탭의 내용이 **읽을 수는 있다** — 아직 마이그레이션 전이라 어색한 건 정상이다. 글자가 배경과 같은 색이어서 안 보이는 수준이면 보고한다
5. 콘솔에 오류가 없다

서버를 종료한다.

- [ ] **Step 9: 커밋**

```bash
git add components.json tsconfig.json vite.config.ts src/lib/theme.svelte.ts src/lib/theme.test.ts src/lib/components/ui src/App.svelte src/app.css package.json package-lock.json
git commit -m "feat: add theme store and move the app shell onto shadcn"
```

---

## Task 3: 설정 화면 마이그레이션

**Files:**
- Replace: `src/routes/Settings.svelte`

**Interfaces:**
- Consumes: `ConfigStore` (기존), `Button`/`Input`/`Checkbox`/`Label`/`Card`/`Alert` (Task 2), 토큰 (Task 1)
- Produces: 없음 (화면 종단)

**보존해야 할 동작** — 이 목록의 항목이 하나라도 깨지면 이 태스크는 실패다:

- `run()` 헬퍼가 모든 변경을 감싸고, 실패 시 `message`에 오류를 담아 화면에 띄운다
- 이름 변경이 거부되면 입력칸 값을 원래 이름으로 되돌린다 (`el.value = p.name`)
- 삭제는 `confirm()`으로 한 번 되묻는다
- 추가에 성공했을 때만 입력칸을 비운다
- 프로젝트가 없을 때 안내 문구를 보여준다

- [ ] **Step 1: 화면 재작성**

`src/routes/Settings.svelte`를 다음으로 교체한다:

```svelte
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
              <span
                class="size-3.5 shrink-0 rounded-full ring-1 ring-border"
                style="background:{p.color}"
              ></span>

              <Input
                value={p.name}
                onchange={(e) => rename(p, e.currentTarget)}
                aria-label="프로젝트 이름"
                class="h-8 flex-1"
              />

              <div class="flex shrink-0 items-center gap-1.5">
                <Checkbox
                  id="active-{p.id}"
                  checked={p.active}
                  onCheckedChange={(v) => run(() => config.setProjectActive(p.id, v === true))}
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
```

> `Checkbox`의 콜백은 shadcn-svelte 버전에 따라 `onCheckedChange`가 `boolean`을
> 주기도 하고 `boolean | 'indeterminate'`를 주기도 한다. 위 코드는 `v === true`로
> 비교해 양쪽 모두에서 동작한다. 타입 오류가 나면 실제 시그니처를 확인하고
> 비교식만 맞춘다 — `config.setProjectActive`에는 반드시 `boolean`이 가야 한다.

- [ ] **Step 2: 확인**

Run: `npm run check && npm test`
Expected: 0 errors 0 warnings, 163 passed

- [ ] **Step 3: 동작 확인**

Run: `npm run dev`

설정 탭에서 확인:

1. 카드 안에 제목·설명·입력 폼이 정돈되어 보인다
2. 프로젝트를 추가하면 목록에 나타나고 색 점이 지정한 색으로 보인다
3. 같은 이름을 또 추가하면 **빨간 Alert**로 오류가 뜬다
4. 이름을 다른 프로젝트와 같게 바꾸면 오류가 뜨고 **입력칸이 원래 이름으로 되돌아간다**
5. "사용" 체크박스를 끄고 켜도 오류가 없다
6. 삭제를 누르면 확인 대화상자가 뜨고, 확인하면 목록에서 사라진다
7. 다크 모드로 전환해도 **모든 글자가 읽히고** 카드·입력칸·경계선이 배경과 구분된다
8. 콘솔에 오류가 없다

4번과 7번이 이 태스크의 핵심 확인 항목이다. 4번은 Phase 1의 리뷰 수정이 살아남았는지를, 7번은 토큰이 제대로 쓰였는지를 증명한다.

브라우저 자동화를 쓸 수 없으면 중단하지 말고, 개발 서버가 오류 없이 컴파일·서빙되는 것을 확인한 뒤 수행하지 못한 항목을 리포트에 명시한다.

서버를 종료한다.

- [ ] **Step 4: 커밋**

```bash
git add src/routes/Settings.svelte
git commit -m "feat: rebuild the settings screen on shadcn primitives"
```

---

## 마무리 확인

- [ ] **전체 검증**

Run: `npm test`
Expected: 163 passed (기존 151 + 테마 12)

Run: `npm run check`
Expected: 183+ files, 0 errors, 0 warnings

- [ ] **하드코딩된 색이 남아 있지 않은지 확인**

Run: `npx rg -n "#[0-9a-fA-F]{3,6}" src/App.svelte src/routes/Settings.svelte`

Expected: `newColor = $state('#4f7cff')` 한 줄만 나온다. 이것은 사용자가 고르는 프로젝트 색의 기본값이라 토큰이 아닌 것이 맞다. 그 외의 hex가 남아 있으면 토큰으로 바꾼다.

`src/lib/components/`와 `src/routes/Today.svelte`에는 아직 hex가 많이 남아 있다. Phase 2b에서 처리하므로 이 단계에서는 정상이다.

- [ ] **다크 모드 대비 확인**

`npm run dev`로 띄우고 다크 모드에서 설정 탭의 모든 요소가 읽히는지 눈으로 확인한다. 특히 오류 Alert, 비활성 체크박스 라벨, 카드 설명 문구.

---

## Phase 2b로 넘기는 것

- `Today.svelte`, `QuickAdd`, `TaskItem`, `TaskList`, `DailyWrapUp` 마이그레이션
- 그 과정에서 `TaskItem`의 배지 색(`#ffe6e6`, `#fff2d6`, `#dcefff` 등)을 토큰으로 이전. `--warning` 토큰은 Task 1에서 이미 준비되어 있다
- `DailyWrapUp`의 `background: Canvas; color: CanvasText`를 토큰으로 교체 — 최종 리뷰가 shadcn 테마와 충돌한다고 지적한 지점이다
- `DailyWrapUp`에 포커스 트랩 추가 (Phase 1 최종 리뷰의 이월 항목). shadcn `Dialog`로 옮기면 자연히 해결된다
- `TaskItem`의 `style="background:{project.color}22"` — hex에 알파를 문자열로 붙이는 방식이라 `#rrggbb`가 아닌 값이 오면 조용히 투명해진다. CSS 변수로 바꾼다

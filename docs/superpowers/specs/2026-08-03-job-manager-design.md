# JobPilot — 업무·일정 관리 데스크톱 앱 설계

- 작성일: 2026-08-03
- 상태: 설계 확정 (구현 계획 작성 전)

## 1. 목적

개인용 업무·일정 관리 데스크톱 앱. 하루 단위로 계획을 세우고 실제 한 일을 기록하며,
그 기록을 주간보고로 뽑아낸다. 일정에는 알람이 붙는다.
AI는 선택적으로 얹는 부가 레이어다.

### 정체성

**AI가 없어도 완결된 업무 관리 앱**이다. AI는 있으면 편해지는 보조 수단이며,
앱의 어떤 핵심 기능도 AI에 의존하지 않는다.

## 2. 제약

사내망(보안망)에서 사용될 수 있다. 여기서 파생되는 제약:

- 클라우드 서비스 의존 금지 (GCP, Firebase, 외부 DB 등)
- 서버 없음. 단일 사용자, 단일 기기, 로컬 저장
- 로그인/계정 개념 없음
- 정식 설치(installer)가 막힐 수 있으므로 **portable 배포**가 기본
- 외부 네트워크 호출은 AI 기능에서만 발생하며, 사용자가 API 키를 넣었을 때만 발생

### 배포 형태

폴더 하나를 복사하면 동작한다.

```
JobPilot/
├── JobPilot.exe
└── data/
```

폴더째 백업하거나 다른 PC로 옮기면 데이터가 그대로 따라간다.

**알려진 전제**: Tauri는 Windows의 WebView2 런타임을 사용한다.
Windows 11에는 기본 내장되어 있다. 대상 PC에 없을 경우 런타임 설치가 필요하며,
이는 실제 배포 대상 PC에서 확인이 필요한 항목이다.

## 3. 기술 선택

| 영역 | 선택 | 이유 |
|---|---|---|
| 셸 | Tauri 2 | 번들 ~8MB, 네이티브 알림/트레이, CORS 없음, OS 자격 증명 접근 |
| 프론트엔드 | Svelte 5 (runes) + TypeScript | 상태 관리가 언어에 내장되어 부속 라이브러리 최소화 |
| 빌드 | Vite | Tauri 표준 조합 |
| 저장 | JSON 파일 + 마크다운 내보내기 | 앱이 다루기 쉬우면서 결과물은 사람이 읽을 수 있음 |
| 백엔드 | Rust (Tauri core) | 파일 IO, 알림 스케줄러, 키 저장, LLM HTTP 호출 |
| 테스트 | Vitest (TS), cargo test (Rust) | |

### 검토 후 배제한 선택지

- **브라우저 웹앱**: 파일 저장 시 세션마다 권한 재허용 필요, 예약 알림 API 부재,
  LLM 호출 시 CORS 문제, API 키를 localStorage에 평문 보관해야 함
- **Electron**: 번들 100MB+
- **마크다운 원본 저장**: 파싱·충돌 처리 비용이 이득보다 큼. 내보내기로 대체
- **SQLite**: 사람이 직접 열어볼 수 없음. 이 규모에서는 JSON으로 충분

## 4. 아키텍처

```
┌───────────────────────────────────────────────┐
│  Svelte UI  (WebView)                         │
│                                               │
│   routes/    Today · Week · Calendar ·        │
│              Report · Settings                │
│   ────────────────────────────────────────    │
│   core/      순수 TS 도메인 로직               │
│              이월 계산, 주간 집계, 반복 생성,   │
│              알람 시각 계산, 보고서 조립        │
│   ────────────────────────────────────────    │
│   ports/     Storage · Notifier · AI · Clock  │
│   adapters/  tauri/ · memory/ · browser/      │
└────────────────────┬──────────────────────────┘
                     │  Tauri IPC (invoke)
┌────────────────────▼──────────────────────────┐
│  Rust core                                    │
│   storage    JSON 원자적 읽기/쓰기, 백업       │
│   notify     OS 토스트 + 트레이 + 스케줄러     │
│   secrets    API 키 → Windows 자격 증명 관리자 │
│   ai_proxy   LLM HTTP 호출                    │
└───────────────────────────────────────────────┘
```

### 설계 원칙

**1. 도메인 로직은 플랫폼을 모른다.**
`core/`는 파일 시스템이나 Tauri API를 참조하지 않는 순수 함수만 둔다.
입력을 받아 결과를 반환할 뿐이다. 단위 테스트가 IO 없이 실행되고,
필요해지면 다른 셸(웹 등)에서 그대로 재사용할 수 있다.

**2. 플랫폼 기능은 포트 뒤에 둔다.**

```ts
interface Storage {
  load<T>(key: string): Promise<T | null>
  save<T>(key: string, value: T): Promise<void>
  listBackups(): Promise<BackupInfo[]>
  restoreBackup(id: string): Promise<void>
}

interface Notifier {
  schedule(id: string, at: Date, title: string, body: string): Promise<void>
  cancel(id: string): Promise<void>
  pending(): Promise<ScheduledNotification[]>
}

interface AI {
  available(): boolean
  complete(req: AIRequest): Promise<AIResponse>
}

interface Clock {
  now(): Date
}
```

각 포트마다 Tauri 구현체와 인메모리 구현체를 둔다.
개발 중에는 브라우저에서 인메모리/localStorage 어댑터로 UI 작업을 하고,
배포는 Tauri 어댑터로 빌드한다.

`Clock`을 포트로 분리하는 이유: "마감이 지났는가", "며칠째 이월되었는가" 같은
시간 의존 로직을 결정적으로 테스트하기 위해서다.

### 모듈 경계

| 모듈 | 하는 일 | 의존 |
|---|---|---|
| `core/task` | 업무 상태 전이, 이월 계산 | 없음 |
| `core/schedule` | 반복 규칙 전개, 알람 시각 계산 | `Clock` 타입만 |
| `core/report` | 기간별 집계, 마크다운 보고서 조립 | 없음 |
| `core/nlp` | 자연어 한 줄 → 초안 파싱 (규칙 기반) | `Clock` 타입만 |
| `ai/` | 프롬프트 구성, 제공자 어댑터, 컨텍스트 축약 | `core` 타입, `AI` 포트 |
| `stores/` | Svelte 상태, 저장 트리거 | `core`, `ports` |
| `routes/` | 화면 | `stores` |

## 5. 데이터

### 파일 배치

```
data/
├── config.json          설정 전체
├── templates.json       반복 업무·일정 템플릿
├── tasks/
│   └── 2026-08.json     월별 분할
├── events/
│   └── 2026-08.json     월별 분할
├── exports/             주간보고 .md 출력물
└── backups/             일일 자동 백업 (30일 보관)
```

월별 분할 이유: 파일 하나가 무한정 커지지 않고, 저장 시 쓰기 양이 제한되며,
파일 손상 시 영향 범위가 한 달로 한정된다.

모든 파일은 최상위에 `schemaVersion: number`를 갖는다.

### 원자적 쓰기

`임시 파일 작성 → fsync → 원자적 rename`으로 저장한다.
저장 도중 앱이 종료되어도 기존 파일이 부분적으로 덮어써지지 않는다.

### Task

```ts
type TaskStatus = 'planned' | 'doing' | 'done' | 'dropped'

type Task = {
  id: string
  title: string
  note?: string                // 마크다운 메모
  projectId?: string
  status: TaskStatus
  priority: 1 | 2 | 3          // 1이 가장 높음
  plannedDate: string          // YYYY-MM-DD, 현재 계획된 날짜
  originalDate?: string        // 최초로 계획했던 날짜
  carryCount: number           // 이월된 횟수 (기본 0)
  dueDate?: string             // 실제 마감일
  estimateMin?: number
  actualNote?: string          // 실적: 실제로 무엇을 했는가
  actualMin?: number
  completedAt?: string
  templateId?: string          // 반복 템플릿에서 생성된 경우
  createdAt: string
  updatedAt: string
}
```

**계획→실적 모델**: 하나의 Task가 `planned`로 시작해 `done`으로 끝난다.
완료 시 `actualNote`에 실제로 한 일을 남긴다. 계획 항목과 실적 항목이
별도로 존재하지 않으므로 이중 입력이 없다.

**이월은 상태가 아니라 기록이다**: 어제 못 끝낸 업무는 오늘 기준으로 그냥
`planned`이다. 이월 사실은 `carryCount`와 `originalDate`로 추적한다.
이렇게 하면 상태 필터가 단순해지면서도 "4일째 밀리는 중"을 셀 수 있다.

### Event

```ts
type Event = {
  id: string
  title: string
  start: string                // ISO 8601 datetime
  end?: string
  allDay: boolean
  location?: string
  projectId?: string
  reminders: number[]          // 시작 전 분 단위. 예: [60, 10]
  templateId?: string
  note?: string
  createdAt: string
  updatedAt: string
}
```

`reminders`가 배열인 이유: "1시간 전에 준비 알림, 10분 전에 입장 알림"처럼
한 일정에 여러 알람이 필요한 경우가 흔하다.

### Config

```ts
type Config = {
  schemaVersion: number
  projects: Project[]
  profile: Profile
  work: WorkSettings
  ai: AISettings
}

type Project = {
  id: string
  name: string
  color: string                // hex
  active: boolean              // 비활성 프로젝트는 선택 목록에서 숨김
}

type Profile = {                     // AI 컨텍스트로만 사용
  role?: string                      // "백엔드 개발자"
  responsibilities?: string          // "API 설계, 사내 플랫폼 유지보수"
  reportAudience?: string            // "팀장"
  reportStyle?: string               // "간결한 개조식, 경어체"
}

type WorkSettings = {
  workdays: number[]                 // 0=일 … 6=토
  dayStart: string                   // "09:00"
  dayEnd: string                     // "18:00"
  weekStartsOn: 0 | 1                // 0=일요일, 1=월요일
  defaultReminders: number[]         // 새 일정의 기본 알람
  carryWarningDays: number           // 이 일수 이상 이월되면 강조 (기본 3)
}
```

### Template (반복)

```ts
type Template = {
  id: string
  kind: 'task' | 'event'
  title: string
  projectId?: string
  recurrence: Recurrence
  // kind가 'event'일 때
  time?: string                // "10:00"
  durationMin?: number
  reminders?: number[]
  // kind가 'task'일 때
  priority?: 1 | 2 | 3
  estimateMin?: number
  active: boolean
}

type Recurrence =
  | { type: 'daily' }
  | { type: 'weekly'; days: number[] }        // 0=일 … 6=토
  | { type: 'monthly'; day: number }          // 1–31
```

**전개 방식**: 템플릿은 실제 항목을 미리 대량 생성하지 않는다.
앱 시작 시와 자정에, 오늘부터 14일 이내 구간에 대해 아직 생성되지 않은
항목만 만들어낸다. 생성된 항목은 `templateId`로 출처를 기억하되,
생성 후에는 독립적으로 수정·삭제할 수 있다.

사용자가 삭제한 항목이 다시 살아나지 않도록 전개 이력을 `templates.json` 안에
템플릿별로 기록한다:

```ts
type TemplateExpansion = {
  templateId: string
  expandedDates: string[]      // YYYY-MM-DD, 이미 전개를 시도한 날짜
}
```

전개 시 `expandedDates`에 이미 있는 날짜는 건너뛴다. 항목이 존재하는지가 아니라
전개를 시도했는지를 기준으로 삼기 때문에, 사용자가 지운 항목은 되살아나지 않는다.
이 목록은 과거 90일치만 보관한다.

RRULE 전체 문법은 구현하지 않는다. 위 세 가지 패턴이 실사용을 덮는다.

## 6. 화면

### Today (기본 화면)

- **상단**: 오늘 일정 타임라인. 현재 시각 표시선. 지난 일정은 흐리게
- **하단**: 오늘 업무 리스트
  - 이월된 업무를 최상단에 별도 그룹으로 표시하고 밀린 일수를 함께 보여줌
  - `carryWarningDays` 이상이면 강조
  - 우선순위·프로젝트별 필터
- **하루 마감 버튼**: 미완료 업무를 한 화면에서 일괄 처리.
  각 항목을 완료(+실적 메모) / 내일로 이월 / 포기 중 하나로 정리한다.
  계획→실적 전환이 실제로 일어나는 지점이다
- **빠른 입력**: 한 줄 입력 → 규칙 기반 파싱으로 초안 생성 → 확인 후 등록

### Week

- 요일별 컬럼 보드. 드래그로 날짜 이동
- 우측 패널에 프로젝트별 건수·시간 집계
- 주간 진행률: 계획 대비 완료 비율

### Calendar

- 월 단위 격자. 일정 중심
- 날짜 클릭 시 해당 날짜의 Today 뷰로 이동

### Report

기간 선택 → 프로젝트별 그룹 → 마크다운 미리보기 → 복사 또는 `exports/`에 저장.

**AI 없이 완성된 보고서가 나온다.** 규칙 기반 조립 순서:

1. 프로젝트별로 완료 항목 묶기
2. 진행 중 항목
3. 미완료·이월 항목 (밀린 일수 포함)
4. 예정 항목 — 선택한 기간 **직후 같은 길이의 구간**에 계획된 항목
   (한 주를 선택했으면 다음 한 주)

AI가 켜져 있으면 이 초안을 입력으로 받아 문장을 다듬는다.
AI는 없는 사실을 만들어내지 않고 표현만 정리하도록 프롬프트를 구성한다.

### Settings

탭 구성: 프로젝트 / 반복 템플릿 / 직무 프로필 / 근무·알람 / AI / 데이터

**데이터 탭**: 백업 목록과 복구, 전체 내보내기(JSON/마크다운), 가져오기,
data 폴더 열기.

## 7. 알람

### 스케줄링

Rust가 타이머를 소유한다. WebView 상태와 무관하게 정확히 발화한다.

등록 시점: 앱 시작 시, 자정, 일정 데이터 변경 시.
등록 범위: 앞으로 24시간 이내에 발화할 알람.

발화 시 Windows 네이티브 토스트를 띄운다. 스누즈 5분/10분을 제공한다.

### 트레이

창을 닫아도 트레이에 남는다. 트레이 메뉴에서 오늘 남은 일정을 확인하고
창을 다시 열 수 있다. 완전 종료는 트레이 메뉴에서 명시적으로 한다.

### 놓친 알람

PC 절전이나 앱 종료로 발화 시각이 지나버린 알람은 삼키지 않는다.
다음 실행 시 "지난 알람 N개"로 모아서 보여준다.
알람이 조용히 사라지는 것은 알람 기능의 신뢰를 무너뜨리는 가장 큰 원인이다.

### 한계 (문서화된 전제)

앱이 실행 중이 아니면 알람은 발화하지 않는다.
사용자가 이 조건을 수용했다. 자동 시작 등록은 초기 범위에 포함하지 않는다.
Windows 집중 지원이 켜져 있으면 토스트가 알림 센터로 직행할 수 있다.

## 8. AI 레이어 (선택적)

### 활성화 조건

AI 기능은 `ai.enabled === true`이고 **동시에** 자격 증명 저장소에 키가 존재할 때만
활성화된다. 둘 중 하나라도 아니면 **AI 관련 UI가 화면에서 사라진다.**
비활성 상태로 회색 처리해 남겨두지 않는다.

`enabled`를 따로 두는 이유: 키를 지우지 않고도 AI를 잠시 꺼둘 수 있어야 한다.
(예: 민감한 내용을 다루는 기간)

AI가 비활성인 동안 앱은 어떤 네트워크 호출도 하지 않는다.

### 제공자

```ts
type AISettings = {
  enabled: boolean
  provider: 'anthropic' | 'openai' | 'openai-compatible'
  baseUrl?: string             // openai-compatible일 때 사내 게이트웨이 주소
  model: string
  previewBeforeSend: boolean   // 전송 내용 미리보기
  pseudonymize: boolean        // 프로젝트명 등을 가명으로 치환
  logCalls: boolean            // 호출 기록을 로컬에 남김
}
```

`openai-compatible`을 두는 이유: 사내 LLM 게이트웨이가 OpenAI 호환 인터페이스를
제공하는 경우가 많다. base URL만 바꿔 대응한다.

### 키 저장

Windows 자격 증명 관리자에 저장한다. `config.json`에 평문으로 남기지 않는다.

### 데이터 전송 원칙

사용자의 업무 내용이 외부로 나가는 기능이다. 다음을 지킨다:

- **최소 전송**: 기능별로 필요한 범위만 추린다. 전체 데이터를 통째로 보내지 않는다
  - 오늘 브리핑 → 오늘·내일 항목 + 이월 항목 + 프로필
  - 주간보고 → 해당 주 항목 + 프로필
  - 자연어 입력 → 입력 문장 + 프로젝트 목록 + 현재 시각
- **미리보기**: `previewBeforeSend`가 켜져 있으면 전송 직전 내용을 그대로 보여준다
- **가명 치환**: `pseudonymize`가 켜져 있으면 프로젝트명을 `프로젝트 A` 등으로
  치환해 보내고, 응답에서 역치환한다
- **호출 로그**: 요청 시각·기능·대략적 토큰 수를 로컬에 남겨 사후 확인이 가능하다

### 기능

| 기능 | AI 없을 때 |
|---|---|
| 오늘 브리핑 | 규칙 기반 요약 (건수, 마감 임박, 이월 경고)으로 대체 |
| 질의응답 | 기능 자체가 숨겨짐 |
| 주간보고 문장 다듬기 | 규칙 기반 초안이 최종 결과물 |
| 자연어 입력 | 규칙 기반 파서로 동작 (아래) |
| 우선순위 제안 | 마감일·우선순위·이월 일수 기반 정렬로 대체 |

### 자연어 입력의 규칙 기반 폴백

`core/nlp`가 AI 없이 처리한다. 지원 범위:

- 날짜: 오늘, 내일, 모레, 월~일요일, `8/15`, `8월 15일`
- 시각: `3시`, `15:00`, `오후 3시`, `3시 반`
- 소요: `30분`, `2시간`
- 프로젝트: 등록된 프로젝트명이 문장에 포함되면 매칭
- 시각이 있으면 Event, 없으면 Task로 판정

파싱 결과는 항상 확인 UI를 거친다. 곧바로 저장하지 않는다.
AI가 켜져 있으면 규칙 파서가 실패한 경우에만 AI로 넘긴다.

### 실패 처리

AI 호출 실패는 해당 UI 영역에만 에러를 표시한다.
앱의 나머지 기능은 영향받지 않는다. 타임아웃 20초, 재시도 없음.

## 9. 에러 처리

| 상황 | 처리 |
|---|---|
| JSON 파싱 실패 | 덮어쓰지 않는다. 손상 파일을 `.corrupt`로 보존하고 백업 복구를 제안 |
| 저장 실패 (권한/디스크) | 사용자에게 명시적으로 알리고, 메모리 상태는 유지해 재시도 가능 |
| `data/` 쓰기 불가 | 시작 시 감지해 안내. 읽기 전용 모드로 진입하지 않고 명확히 실패 |
| 스키마 버전 불일치 | 마이그레이션 실행. 실패 시 백업 후 중단 |
| 알람 등록 실패 | 배너로 알림. 앱 사용은 계속 가능 |
| AI 호출 실패 | 해당 영역에만 표시 |

**조용한 실패를 만들지 않는다.** 특히 저장과 알람은 실패가 눈에 보여야 한다.

## 10. 테스트

### 단위 테스트 (Vitest) — `core/` 순수 함수 중심

- `core/task`: 상태 전이, 이월 시 `carryCount`·`originalDate` 갱신
- `core/schedule`: 반복 전개(주간/월간 경계, 말일 처리), 알람 시각 계산
- `core/report`: 기간 집계, 프로젝트별 그룹핑, 빈 기간 처리
- `core/nlp`: 날짜/시각 표현 파싱, 모호한 입력 처리

`Clock` 포트로 시간을 고정해 시간 의존 로직을 결정적으로 검증한다.

### 통합 테스트

인메모리 어댑터로 포트를 대체해 스토어와 화면 로직을 검증한다.
주요 시나리오: 업무 생성 → 이월 → 완료 → 주간보고 생성.

### Rust 테스트 (cargo test)

- 원자적 쓰기가 중단되어도 기존 파일이 온전한가
- 백업 생성·정리(30일 보관) 동작
- 손상된 JSON 입력 시 덮어쓰지 않는가

### 수동 확인 항목

빌드 자동화로 검증할 수 없어 실기기 확인이 필요한 것:

- 대상 PC에서 WebView2 런타임 존재 여부
- portable exe 실행이 사내 보안 정책에 걸리는지
- Windows 토스트가 실제로 표시되는지, 집중 지원 영향
- 절전 후 복귀 시 놓친 알람 처리

## 11. 범위에서 제외

초기 구현에 포함하지 않는다:

- 다중 사용자, 동기화, 공유
- 모바일
- 캘린더 외부 연동 (Google/Outlook)
- 첨부 파일
- Windows 자동 시작 등록
- 마크다운 파일을 원본 저장소로 사용 (내보내기만 지원)
- RRULE 전체 문법
- macOS/Linux 빌드 (코드는 막지 않되 검증 대상 아님)

## 12. 구현 단계

이 스펙은 화면 다섯 개와 선택적 AI 레이어를 포함해 한 번에 구현하기에는 크다.
아래 순서로 나눠 진행한다. 각 단계는 그 자체로 쓸 수 있는 상태여야 한다.

| 단계 | 범위 | 끝났을 때 쓸 수 있는 것 |
|---|---|---|
| 1 | Tauri 셸 + 저장 계층 + `core/task` + Today 화면 | 오늘 할 일을 적고 완료할 수 있다 |
| 2 | 이월 + 하루 마감 + 프로젝트 설정 | 계획→실적 루프가 돈다 |
| 3 | Event + 알람 + 트레이 | 일정 알람이 온다 |
| 4 | Week + Calendar | 주 단위로 조망된다 |
| 5 | Report (규칙 기반) + 마크다운 내보내기 | 주간보고가 나온다 |
| 6 | 반복 템플릿 + 규칙 기반 자연어 입력 | 반복 입력 수고가 사라진다 |
| 7 | AI 레이어 전체 | 브리핑·질의응답·보고서 다듬기 |

1~2단계가 이 앱의 최소 사용 가능 형태다.
AI를 마지막에 두는 이유는 앱이 AI 없이 완결되는지를 그때까지 계속 검증하기 위해서다.

## 13. 완료 기준

1. 오늘 업무를 등록하고, 완료하고, 실적 메모를 남길 수 있다
2. 미완료 업무가 다음 날로 이월되고 밀린 일수가 보인다
3. 일정을 등록하면 지정한 시각 전에 Windows 토스트가 뜬다
4. 주간보고 마크다운이 AI 없이 생성된다
5. 설정에서 프로젝트·반복 템플릿·프로필·근무시간을 관리할 수 있다
6. API 키를 넣으면 오늘 브리핑과 질의응답이 동작한다
7. 키가 없으면 AI UI가 보이지 않고 앱이 완전히 오프라인으로 동작한다
8. 폴더를 복사해 다른 PC에서 실행하면 데이터가 그대로 열린다

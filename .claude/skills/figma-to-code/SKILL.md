---
name: figma-to-code
description: Figma 디자인을 코드로 변환. Figma URL과 빈 컴포넌트 파일 경로를 받아 UI 구현. "/figma-to-code", "피그마 구현" 등의 요청 시 사용
disable-model-invocation: false
argument-hint: <Figma URL> <컴포넌트 파일 경로> (예: https://figma.com/design/...?node-id=1-2 src/features/widget-builder/ui/MyComponent.tsx)
---

argument: $ARGUMENTS

# Claude Command: Figma to Code

이 커맨드는 Figma 디자인 데이터를 기반으로 React 컴포넌트 코드를 생성합니다.

## 워크플로우 (6단계)

### Phase 1. 입력 파싱

`$ARGUMENTS`에서 Figma URL과 컴포넌트 파일 경로를 추출합니다.

**Figma URL 처리:**

1. URL에서 `node-id=(\d+-\d+)` 패턴 추출
2. `-`를 `:`로 치환하여 MCP 호출용 nodeId 생성 (예: `node-id=1-2` → `1:2`)
3. URL이 `https://figma.com/design/:fileKey/branch/:branchKey/:fileName` 형식이면 `branchKey`를 `fileKey`로 사용

**컴포넌트 경로 처리:**

1. 파일명에서 컴포넌트 이름 추출: `MyComponent.tsx` → `MyComponent`
2. FSD 레이어 추출: `src/shared/...` → `Shared`, `src/features/...` → `Features` 등
3. 대상 파일이 비어있지 않으면 사용자에게 덮어쓸지 확인

### Phase 2. Figma 디자인 데이터 수집

3개 MCP 도구를 **병렬** 호출합니다:

1. `mcp__figma-desktop__get_screenshot(nodeId)` — 시각적 참조 이미지
2. `mcp__figma-desktop__get_design_context(nodeId)` — 레이아웃, 색상, 타이포, 크기, 자식 노드 구조
3. `mcp__figma-desktop__get_variable_defs(nodeId)` — 바인딩된 디자인 토큰 변수명

**clientLanguages:** `typescript`
**clientFrameworks:** `react`

**에러 처리:**

- MCP 도구 호출 실패 시: "Figma Desktop 앱을 실행하고 해당 파일을 열어주세요." 안내

### Phase 3. 참조 패턴 탐색

프로젝트의 기존 패턴을 파악합니다:

1. `src/shared/ui/` 내 유사 컴포넌트 패턴 확인:
   - `cn()` 유틸리티 사용 방식
   - `forwardRef` 패턴
   - named export 패턴
   - Props 타입 정의 방식
2. 대상 디렉토리의 `index.ts`, 형제 파일 확인하여 일관된 패턴 파악

### Phase 4. Figma → 디자인 토큰 매핑 분석

이 프로젝트는 `@exem-fe/tailwindcss-plugin`을 통해 디자인 토큰을 Tailwind 클래스로 사용합니다.
**주의: 기본 Tailwind 토큰이 전부 교체(override)되어 있으므로 반드시 아래 토큰만 사용해야 합니다.**

**색상 매핑 전략 (우선순위 순):**

1. Figma 변수 바인딩이 있으면 그 이름을 직접 사용 (예: `color/gray-05` → `text-gray-05`)
2. 시맨틱 토큰 우선 사용:
   - 텍스트: `text-text-primary`, `text-text-secondary`, `text-text-tertiary`, `text-text-disabled`, `text-text-accent`, `text-text-critical` 등
   - 배경/면: `bg-surface-primary-default`, `bg-elevation-elevation-0` 등
   - 보더: `border-border-primary`, `border-border-secondary` 등
   - 아이콘: `text-icon-primary`, `text-icon-secondary` 등
3. 원시 색상 스케일: `gray-00~10`, `red-00~10`, `blue-00~10` 등 + `mono-white`, `mono-black`
4. 매칭 불가 시 가장 가까운 토큰 + `/* TODO: exact color #XXXXXX */` 코멘트

**타이포그래피:**

| Figma 크기 | Tailwind 클래스 |
| ---------- | --------------- |
| 28px/140%  | `text-header-1` |
| 24px/140%  | `text-header-2` |
| 20px/140%  | `text-title-1`  |
| 18px/140%  | `text-title-2`  |
| 16px/140%  | `text-body-1`   |
| 14px/140%  | `text-body-2`   |
| 12px/140%  | `text-body-3`   |
| 11px/140%  | `text-caption`  |

폰트 두께: `font-regular`(400), `font-medium`(500), `font-semibold`(600), `font-bold`(700)

**Border Radius:** `rounded-weak`(4px), `rounded-medium`(6px), `rounded-strong`(8px), `rounded-circle`(999px)

**Box Shadow:** `shadow-weak`(16px), `shadow-medium`(20px), `shadow-strong`(24px), `shadow-preview`

**레이아웃 매핑:**

- Figma auto-layout direction → `flex flex-row` / `flex flex-col`
- gap, padding → Tailwind spacing (4px=1 단위) 또는 arbitrary `[Npx]`
- child sizing: fill → `flex-1`, fixed → `w-[Npx]`, hug → `w-fit`

**컴포넌트 인식:**

- Figma 내 컴포넌트 인스턴스 → `@exem-fe/react` 매핑 (Button, TextField, Select, Table, Tabs, Modal, Tooltip, Badge, Tag, Checkbox, Radio, Switch 등)
- 프로젝트 커스텀 UI → `src/shared/ui/` 참조 (Card, Form, DropdownMenu, Sheet, Popover, Skeleton 등)
- 아이콘 → `@exem-fe/icon` (`{Name}{Variant}Icon` 패턴, `iconSizes` 또는 `className="size-{n}"`)

### Phase 5. 코드 생성

Phase 2~4의 분석 결과를 기반으로 컴포넌트 코드를 생성합니다.

**생성 규칙:**

1. **import 순서**: 외부 패키지 → `@exem-fe/*` → `@/` 프로젝트 → 상대 경로
2. **`cn()` 유틸리티** (`@/shared/util`) 사용하여 className 합성
3. **Tailwind 클래스만 사용** — 인라인 스타일 지양, 동적 값만 예외
4. **디자인 토큰 전용** — hex 하드코딩 금지
5. **`@exem-fe/react` 컴포넌트 우선 사용** (Button > `<button>`, TextField > `<input>`)
6. **`@/` alias 사용**
7. **루트 요소에 `className` prop 전달** (합성 가능)
8. **named export** (default export 아님)
9. **Tailwind arbitrary values** `[Npx]`는 표준 spacing에 없을 때만 사용

**Props 추론:**

- 텍스트 노드 → string props
- 반복 요소 → array/children props
- 항상 `className?: string` 포함

**코드 구조 예시:**

```tsx
import { cn } from '@/shared/util'

interface MyComponentProps {
  className?: string
  title: string
}

export function MyComponent({ className, title }: MyComponentProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 p-4 bg-surface-primary-default rounded-strong',
        className
      )}
    >
      <span className="text-body-1 font-medium text-text-primary">{title}</span>
    </div>
  )
}
```

### Phase 6. 검증 및 출력

생성된 코드를 검증합니다:

1. 모든 색상이 토큰 기반 Tailwind 클래스인지 확인 (hex 하드코딩 없음)
2. import 경로가 `@/` alias를 사용하는지 확인
3. `cn()` 사용 확인
4. named export 확인
5. `@exem-fe/react` 컴포넌트가 적절히 사용되었는지 확인

**결과 요약 출력:**

```
Figma → Code 완료: {ComponentName}

사용된 디자인 토큰:
- 색상: {사용된 색상 토큰 목록}
- 타이포: {사용된 타이포 클래스 목록}
- 기타: {radius, shadow 등}

사용된 컴포넌트:
- @exem-fe/react: {Button, TextField, ...}
- @exem-fe/icon: {SearchIcon, ...}
- @/shared/ui: {Card, ...}

생성된 파일: {컴포넌트 경로}
```

## 에러 처리

| 상황                      | 대응                                                                        |
| ------------------------- | --------------------------------------------------------------------------- |
| Figma URL 형식 오류       | URL에서 `node-id` 파라미터를 찾을 수 없다고 안내, 올바른 URL 형식 예시 제공 |
| MCP 도구 호출 실패        | "Figma Desktop 앱을 실행하고 해당 파일을 열어주세요." 안내                  |
| 대상 파일이 비어있지 않음 | 사용자에게 덮어쓸지 확인                                                    |
| 매핑 불가 색상            | 가장 가까운 토큰 사용 + `/* TODO: exact color #XXXXXX */` 코멘트            |

## 예시

### 입력

```
/figma-to-code https://figma.com/design/abc123/MyProject?node-id=1-2 src/features/widget-builder/ui/ColumnHeader.tsx
```

### 실행 과정

1. **입력 파싱**: nodeId=`1:2`, Name=`ColumnHeader`, Layer=`Features`
2. **Figma 수집**: get_screenshot, get_design_context, get_variable_defs 병렬 호출
3. **참조 패턴**: `src/shared/ui/` 및 형제 파일 패턴 확인
4. **토큰 매핑**: Figma 속성 → Tailwind 토큰 클래스 변환
5. **코드 생성**: `ColumnHeader.tsx`에 컴포넌트 코드 작성
6. **검증**: 토큰 사용, import 경로, named export 확인

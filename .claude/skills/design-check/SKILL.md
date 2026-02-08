---
name: design-check
description: 디자인 검증 자동화. Figma vs 구현 비교 리포트 생성. "/design-check", "디자인 검증" 등의 요청 시 사용
disable-model-invocation: false
argument-hint: <Figma URL> <컴포넌트 경로> (예: https://figma.com/design/...?node-id=1-2 src/shared/ui/card/Card.tsx)
---

argument: $ARGUMENTS

# Claude Command: Design Check

이 커맨드는 Figma 디자인과 구현된 컴포넌트를 자동 비교하여 Markdown 보고서를 생성합니다.

## 워크플로우 (병렬화 아키텍처)

```
Phase 1: 입력 파싱
    ↓
┌───────────────────────────────────────────────────────────┐
│         Stage 1: 병렬 데이터 수집 + Story 준비              │
├─────────────────┬─────────────────┬───────────────────────┤
│   Task A        │   Task B        │   Main Agent          │
│   (background)  │   (background)  │   (동시 진행)          │
├─────────────────┼─────────────────┼───────────────────────┤
│ REST API        │ MCP             │ Phase 3 준비:         │
│ 스크린샷 캡처    │ get_design_ctx  │ - 컴포넌트 분석       │
│                 │ get_var_defs    │ - props/imports 파악  │
│ 출력:           │                 │ - Story 틀 생성       │
│ - figma.png     │ 출력:           │   (bbox placeholder)  │
│ - .meta.json    │ - 디자인 속성    │                       │
│ - bbox 정보     │ - 토큰 목록      │                       │
└─────────────────┴─────────────────┴───────────────────────┘
    ↓ (Task A 완료 대기 - bbox 필요)
┌───────────────────────────────────────────────────────────┐
│         Stage 2: bbox 주입 + 구현 스크린샷                  │
├───────────────────────────────────────────────────────────┤
│ - Story 파일에 bbox 크기 주입 (Edit tool)                  │
│ - Storybook 빌드 (--rebuild)                              │
│ - 구현 스크린샷 캡처 (--container-width {bboxWidth})       │
└───────────────────────────────────────────────────────────┘
    ↓
Phase 5 → Phase 6 → Phase 7 (순차 실행)
```

---

### Phase 1. 입력 파싱

사용자 인자에서 Figma URL과 컴포넌트 경로를 추출합니다.

**Figma URL → fileKey, node ID 변환:**

1. URL에서 `node-id=(\d+-\d+)` 패턴 추출
2. `-`를 `:`로 치환하여 MCP 호출용 ID 생성
   - 예: `node-id=1-2` → `1:2`
3. URL에서 `fileKey` 추출: `/design/:fileKey/:fileName` → `fileKey`
4. URL이 `https://figma.com/design/:fileKey/branch/:branchKey/:fileName` 형식이면 `branchKey`를 `fileKey`로 사용
5. 원본 Figma URL을 `{figmaUrl}`로 보존 (Stage 1에서 스크립트에 전달)

**컴포넌트 경로 → 메타데이터 추출:**

1. 파일명에서 컴포넌트 이름 추출: `Card.tsx` → `Card`
2. FSD 레이어 추출: `src/shared/...` → `Shared`, `src/features/...` → `Features` 등
3. 중첩 경로 처리: `src/features/widget-builder/ui/ColumnHeader.tsx` → `Features/WidgetBuilder/ColumnHeader`

---

### Stage 1. 병렬 데이터 수집 + Story 준비

다음 작업을 **동시에** 실행합니다.

#### Task A: Figma 스크린샷 캡처 (run_in_background: true)

**Agent:** Task tool with `subagent_type: Bash`

Figma REST API를 통해 노드 스크린샷을 PNG 파일로 저장합니다.

```bash
pnpm exec tsx .claude/skills/design-check/scripts/capture-figma-screenshot.ts \
  --url "{figmaUrl}" \
  --output "artifacts/screenshots/figma/{Name}.png" \
  --scale 2
```

**CLI 옵션:**

| 옵션 | 필수 | 기본값 | 설명 |
|------|------|--------|------|
| `--url` | `--file-key`+`--node-id` 없을 때 | - | Figma URL (fileKey, nodeId 자동 추출) |
| `--file-key` | `--url` 없을 때 | - | Figma 파일 키 |
| `--node-id` | `--url` 없을 때 | - | 노드 ID (예: `1:2`) |
| `--output` | ✅ | - | 출력 PNG 파일 경로 |
| `--scale` | ❌ | 2 | 내보내기 배율 |

**필수 환경변수:** `FIGMA_TOKEN` (`.env` 파일 또는 환경변수로 설정)

**출력물:**

스크립트 실행 시 PNG 파일과 함께 `.meta.json` 파일이 자동 생성됩니다:
- 경로: `artifacts/screenshots/figma/{Name}.meta.json`
- 내용: `{ "bbox": { "width", "height" }, "image": { "width", "height" }, "scale" }`
- `bbox`는 Figma 노드의 CSS 논리 크기 (absoluteBoundingBox)
- `image`는 실제 PNG 픽셀 크기 (= bbox × scale)

**stdout 필드:**
- `nodeWidth` / `nodeHeight`: Figma 노드 CSS 크기 → **Stage 2에서 `--container-width` 값으로 사용**
- `imageSize`: 실제 PNG 픽셀 크기
- 4096px 이상일 경우 경고 출력 (Figma 하드 리미트)

#### Task B: 디자인 데이터 수집 (run_in_background: true)

**Agent:** Task tool with `subagent_type: general-purpose`

MCP Figma Desktop 도구를 사용하여 디자인 데이터를 수집합니다.

**B-1. 디자인 컨텍스트 수집:**

`get_design_context` MCP 도구를 호출하여 노드의 구조 정보를 얻습니다.

```
mcp__figma-desktop__get_design_context(nodeId: "{nodeId}")
```

응답에서 다음을 추출합니다:
- `width`, `height` → 뷰포트 크기 및 wrapper div 크기로 활용
- 레이아웃, 색상, 타이포그래피 등 디자인 속성

**B-2. 디자인 토큰 수집:**

`get_variable_defs` MCP 도구를 호출하여 변수 정의를 얻습니다.

```
mcp__figma-desktop__get_variable_defs(nodeId: "{nodeId}")
```

색상, 간격, 타이포그래피 토큰을 보고서에 포함합니다.

#### Main Agent: Story 준비 (동시 진행)

Task A, B가 백그라운드에서 실행되는 동안 Main Agent가 직접 수행합니다.

**3-1. 컴포넌트 분석:**

컴포넌트 파일을 읽고 다음을 파악합니다:
- export된 컴포넌트 (default/named)
- Props 타입/인터페이스
- import 의존성 (Context, Store, API 호출 여부)

**3-2. 렌더링 요구사항 분류:**

| 분류 | 조건 | 대응 |
|------|------|------|
| **Simple** | props만 필요 | 직접 렌더링 |
| **MSW-dependent** | API 호출 (useQuery 등) 사용 | MSW handler 설정 |
| **Provider-dependent** | Context/Store 의존 | decorators로 Provider 래핑 |

**3-3. 기존 Story 참조:**

컴포넌트와 같은 디렉토리 또는 `__screenshots__/` 디렉토리에 `.stories.tsx` 파일이 있는지 확인합니다.
- 있으면: args, decorators, parameters, render 함수 패턴을 참조
- 없으면: 컴포넌트 분석 결과만으로 구성

**3-4. Story 틀 생성 (bbox placeholder):**

파일 위치: `__screenshots__/{ComponentName}.stories.tsx`

**중요:** bbox 값을 아직 모르므로 placeholder를 사용합니다.

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { ComponentName } from '@/{path}';

const meta: Meta<typeof ComponentName> = {
  title: 'Screenshots/{Layer}/{ComponentName}',
  component: ComponentName,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div style={{ width: '{BBOX_WIDTH}px' }}>
      <ComponentName {...props} />
    </div>
  ),
};
```

- `{BBOX_WIDTH}`는 placeholder로, Stage 2에서 실제 값으로 교체됩니다.
- height는 주입하지 않습니다 — height 차이는 실제 구현 차이이므로 diff로 잡혀야 합니다.
- title은 `Screenshots/{Layer}/{ComponentName}` 형식을 따릅니다.
- import 경로는 항상 `@/` alias를 사용합니다.
- render 함수는 반드시 단일 루트 엘리먼트를 반환해야 합니다 (캡처 스크립트가 `#storybook-root > *` 선택자 사용).

**기존 파일 처리:**
- `__screenshots__/` 디렉토리에 같은 이름의 Story가 이미 있으면 사용자에게 덮어쓸지 확인합니다.

#### Stage 1 완료 게이트

**Task A의 bbox 정보 수집** (TaskOutput tool로 대기)

Task A가 완료되면 stdout에서 `nodeWidth` 값을 추출합니다. 이 값이 Stage 2의 핵심 입력입니다.

Task B의 결과는 Phase 7(보고서 생성)에서 사용되므로, Stage 2 진입 전에 완료되지 않아도 됩니다.

#### Stage 1 에러 처리

| 상황 | 대응 |
|------|------|
| Task A 실패 | **전체 중단** - bbox 없이 진행 불가. 에러 메시지 확인 후 안내 |
| Task B 실패 | **경고 후 계속** - Design Tokens 섹션 생략, 나머지 워크플로우 진행 |
| 컴포넌트 파일 없음 | **전체 중단** - 경로 확인 안내 |

**Task A 에러 처리 상세:**
- `FIGMA_TOKEN` 미설정 시: 토큰 생성 안내 (https://www.figma.com/developers/api#access-tokens)
- API 403 Forbidden: 파일 접근 권한 확인 안내
- API 404 Not Found: fileKey 또는 nodeId 확인 안내
- 이미지 URL null: 노드가 렌더링 불가능한 경우 안내 (Frame, Component, Instance 등만 가능)

**Task B 에러 처리 상세:**
- MCP 도구 호출 실패 시: Figma Desktop 앱이 실행 중인지 확인하라고 안내합니다.
- 경고만 출력하고 워크플로우는 계속 진행합니다.

---

### Stage 2. bbox 주입 + 구현 스크린샷

Task A에서 받은 bbox 값을 Story 파일에 주입하고 구현 스크린샷을 캡처합니다.

#### 2-1. Story 파일에 bbox 주입

Edit tool을 사용하여 placeholder를 실제 값으로 교체합니다:

```
old_string: "width: '{BBOX_WIDTH}px'"
new_string: "width: '{실제_bboxWidth}px'"
```

예: `{BBOX_WIDTH}` → `384`

#### 2-2. Story ID 변환

```
title: "Screenshots/Shared/Card" + export: "Default"
→ 소문자: "screenshots/shared/card"
→ / → -: "screenshots-shared-card"
→ + "--" + kebab(export): "screenshots-shared-card--default"
```

PascalCase → kebab-case 변환:
- `Default` → `default`
- `WithIcon` → `with-icon`

#### 2-3. 캡처 실행

Task A에서 얻은 Figma bbox width를 `--container-width`로 전달하여, Storybook 컨테이너 크기를 Figma 디자인에 맞춥니다:

```bash
pnpm exec tsx .claude/skills/component-screenshot/scripts/capture-screenshot.ts \
  --story-id "{story-id}" \
  --output "artifacts/screenshots/impl/{Name}.png" \
  --width {width} --height {height} \
  --scale 2 \
  --container-width {bboxWidth} \
  --rebuild
```

- `{bboxWidth}`는 Task A의 stdout에서 `nodeWidth` 값 또는 `.meta.json`의 `bbox.width` 값을 사용합니다.
- `--container-width`는 `#storybook-root > *:first-child`에 CSS `width: {N}px !important`를 주입합니다.
- width만 주입하고 height는 주입하지 않습니다 — height 차이는 실제 구현 차이이므로 diff로 잡혀야 합니다.

**주의:** 새로 생성한 Story 파일은 기존 Storybook 빌드에 포함되지 않으므로 `--rebuild` 플래그를 반드시 사용합니다.

**CLI 옵션:**

| 옵션 | 필수 | 기본값 | 설명 |
|------|------|--------|------|
| `--story-id` | ✅ | - | Storybook story ID |
| `--output` | ✅ | - | 출력 PNG 파일 경로 |
| `--width` | ❌ | 1280 | 뷰포트 너비 |
| `--height` | ❌ | 800 | 뷰포트 높이 |
| `--port` | ❌ | 6008 | 정적 서버 포트 |
| `--timeout` | ❌ | 30000 | 타임아웃 (ms) |
| `--rebuild` | ❌ | false | 기존 빌드 무시하고 강제 리빌드 |
| `--scale` | ❌ | 2 | 디바이스 스케일 팩터 |
| `--container-width` | ❌ | - | 컨테이너 CSS width 강제 (px). Figma bbox width 사용 권장 |

**결과 검증:**
- PNG 파일이 생성되었는지 확인
- 파일 크기가 0보다 큰지 확인

#### Stage 2 에러 처리

| 상황 | 대응 |
|------|------|
| Storybook 빌드 실패 | `pnpm build-storybook` 수동 실행으로 에러 확인 제안 |
| 빈 스크린샷 (0 bytes) | 정적 서버에서 Story 직접 확인 제안: `http://localhost:6008/iframe.html?id={story-id}&viewMode=story` |
| 캡처 타임아웃 | `--timeout` 값 증가 제안 |

---

### Phase 5. 정량 비교 (Pixel Diff)

두 스크린샷의 픽셀 단위 차이를 비교합니다.

```bash
pnpm exec tsx .claude/skills/design-check/scripts/compare-screenshots.ts \
  --base "artifacts/screenshots/figma/{Name}.png" \
  --current "artifacts/screenshots/impl/{Name}.png" \
  --output "artifacts/screenshots/diff/{Name}.png"
```

**stdout 파싱:**

스크립트 출력에서 다음 값을 추출합니다:
- `baseSize` / `currentSize`: 각 이미지의 픽셀 크기
- `Size mismatch` 경고 (있을 경우): 크기 불일치 시 리사이즈 폴백이 작동했음을 의미
- `diffPixels`: 차이 픽셀 수
- `diffRatio`: 차이 비율 (%)
- `result`: `pass` 또는 `fail`

이 값들을 보고서의 정량 분석 섹션에 포함합니다. `Size mismatch` 경고가 있으면 보고서에 크기 불일치 사실을 명시합니다.

### Phase 6. 정성 비교 (시각 분석)

Claude의 시각 분석 능력을 활용하여 디자인 차이를 정성적으로 평가합니다.

**6-1. 이미지 로드:**

Read tool로 다음 이미지를 로드합니다 (MCP get_screenshot 호출 불필요, Task A에서 파일로 저장됨):
- `artifacts/screenshots/figma/{Name}.png` (Figma 디자인 - REST API로 저장됨)
- `artifacts/screenshots/impl/{Name}.png` (구현 결과)

**6-2. 비교 항목:**

| 항목 | 확인 내용 |
|------|----------|
| 레이아웃 | 요소 배치, 정렬, 간격 |
| 타이포그래피 | 폰트 크기, 굵기, 줄 높이 |
| 색상 | 배경색, 텍스트 색상, 보더 색상 |
| 간격 | padding, margin, gap |
| 아이콘/이미지 | 크기, 위치, 색상 |
| 반응형 | 컨테이너 크기 대비 적절성 |

**6-3. 발견사항 분류:**

각 차이점에 severity를 부여합니다:

| Severity | 기준 |
|----------|------|
| **Critical** | 레이아웃 깨짐, 누락된 요소, 완전히 다른 색상 |
| **Major** | 눈에 띄는 간격/크기 차이, 폰트 불일치 |
| **Minor** | 미세한 간격 차이, 약간의 색상 차이 |
| **Nitpick** | 서브픽셀 렌더링 차이, 안티앨리어싱 차이 |

### Phase 7. 보고서 생성

최종 Markdown 보고서를 생성합니다.

**파일 위치:** `artifacts/design-check/{Name}-report.md`

**보고서 구조:**

```markdown
# Design Check Report: {ComponentName}

**Date:** {YYYY-MM-DD}
**Figma Node:** {nodeId}
**Component:** {componentPath}

---

## Executive Summary

{전체 요약: 일치도 수준, 주요 발견사항 수}

## Quantitative Analysis

| Metric | Value |
|--------|-------|
| Diff Pixels | {diffPixels} |
| Diff Ratio | {diffRatio}% |
| Result | {pass/fail} |

## Qualitative Analysis

### Critical Issues
{없으면 "None" 표시}

### Major Issues
{없으면 "None" 표시}

### Minor Issues
{없으면 "None" 표시}

### Nitpicks
{없으면 "None" 표시}

## Design Tokens

{Task B에서 수집한 디자인 토큰 목록. Task B 실패 시 "Not available" 표시}

## Recommendations

{개선 제안 사항: 코드 수정 방향, 우선순위}

## Artifacts

| Artifact | Path |
|----------|------|
| Figma Screenshot | artifacts/screenshots/figma/{Name}.png |
| Figma Metadata | artifacts/screenshots/figma/{Name}.meta.json |
| Implementation Screenshot | artifacts/screenshots/impl/{Name}.png |
| Diff Image | artifacts/screenshots/diff/{Name}.png |
| Story File | __screenshots__/{Name}.stories.tsx |
```

## 에러 처리 (전체)

| 상황 | 대응 |
|------|------|
| `FIGMA_TOKEN` 미설정 | 토큰 생성 안내: https://www.figma.com/developers/api#access-tokens |
| Figma API 403 | 파일 접근 권한 확인, 토큰 권한 확인 안내 |
| Figma API 404 | fileKey 또는 nodeId 확인 안내 |
| Figma 이미지 URL null | 렌더링 불가능한 노드 안내 (Frame, Component, Instance 등만 지원) |
| Figma 앱 미실행 | "Figma Desktop 앱을 실행하고 해당 파일을 열어주세요." 안내 (Task B MCP 도구용) |
| Figma URL 형식 오류 | URL에서 `node-id` 파라미터를 찾을 수 없다고 안내, 올바른 URL 형식 예시 제공 |
| 컴포넌트 파일 없음 | 경로 확인 안내 |
| 기존 아티팩트 존재 | 사용자에게 재사용/덮어쓰기 선택 요청 |
| Storybook 빌드 실패 | `pnpm build-storybook` 수동 실행 안내 |
| 캡처 스크립트 실패 | 에러 메시지 전달 및 수동 실행 커맨드 안내 |
| 비교 스크립트 실패 | 이미지 크기 불일치 여부 확인 안내 |

## 예시

### 입력

```
/design-check https://figma.com/design/abc123/MyProject?node-id=1-2 src/shared/ui/card/Card.tsx
```

### 실행 과정

1. **입력 파싱**: nodeId=`1:2`, Name=`Card`, Layer=`Shared`
2. **Stage 1 병렬 실행**:
   - Task A (background): Figma 스크린샷 → `artifacts/screenshots/figma/Card.png`, bbox: 384×256
   - Task B (background): MCP get_design_context + get_variable_defs
   - Main Agent: 컴포넌트 분석 + Story 틀 생성 (`{BBOX_WIDTH}` placeholder)
3. **Stage 2 bbox 주입**: Story 파일의 `{BBOX_WIDTH}` → `384` 교체
4. **Stage 2 구현 캡처**: `artifacts/screenshots/impl/Card.png` (`--rebuild --container-width 384` 사용)
5. **Phase 5 정량 비교**: diffRatio=2.3%, result=pass
6. **Phase 6 정성 비교**: Minor - 하단 padding 2px 차이
7. **Phase 7 보고서**: `artifacts/design-check/Card-report.md` 생성

### 출력

```
Design Check 완료: Card

📊 정량 결과: 2.3% 차이 (PASS)
📋 정성 결과: 1 Minor issue
📄 보고서: artifacts/design-check/Card-report.md
```

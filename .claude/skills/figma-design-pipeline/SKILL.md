---
name: figma-design-pipeline
description: Figma 디자인 구현 + 검증 파이프라인. figma-to-code 후 design-check 순차 실행. "/figma-pipeline", "피그마 파이프라인" 등의 요청 시 사용
disable-model-invocation: false
argument-hint: <Figma URL> <컴포넌트 파일 경로>
---

argument: $ARGUMENTS

# Claude Command: Figma Design Pipeline

이 커맨드는 Figma 디자인을 코드로 구현한 뒤 디자인 검증까지 자동으로 수행하는 파이프라인입니다.
`figma-to-code` → `design-check` 순서로 실행됩니다.

## 워크플로우 (3단계)

### Step 1. 입력 파싱 + 사전 검증

`$ARGUMENTS`에서 Figma URL과 컴포넌트 파일 경로를 파싱합니다.

**파싱:**

1. URL에서 `node-id=(\d+-\d+)` 패턴 추출
2. `-`를 `:`로 치환하여 MCP 호출용 nodeId 생성
3. 파일 경로에서 컴포넌트 이름, FSD 레이어 추출

**사전 검증:**

- `FIGMA_TOKEN` 환경변수 존재 확인 (design-check Phase 2에서 Figma REST API 스크린샷 캡처에 필요)
- 미설정 시: 토큰 생성 안내 후 중단 (https://www.figma.com/developers/api#access-tokens)

### Step 2. figma-to-code 실행

`.claude/skills/figma-to-code/SKILL.md`를 읽고 해당 워크플로우 전체(Phase 1~6)를 실행합니다.

동일한 Figma URL과 컴포넌트 경로를 인자로 전달합니다.

**완료 게이트:**

- 대상 파일이 존재하는지 확인
- 파일 내용이 비어있지 않은지 확인
- 게이트 실패 시 사용자에게 알리고 중단

### Step 3. design-check 실행

`.claude/skills/design-check/SKILL.md`를 읽고 해당 워크플로우 전체(Phase 1~7)를 실행합니다.

동일한 Figma URL과 컴포넌트 경로를 인자로 전달하여 디자인 검증을 수행합니다.

### 최종 출력 + 반복 개선 제안

양 단계의 결과를 종합하여 출력합니다:

```
Figma Design Pipeline 완료: {ComponentName}

[Step 2] figma-to-code 결과:
- 생성된 파일: {컴포넌트 경로}
- 사용된 토큰: {색상, 타이포 등 요약}
- 사용된 컴포넌트: {목록}

[Step 3] design-check 결과:
- 정량: {diffRatio}% ({pass/fail})
- 정성: {Critical} Critical, {Major} Major, {Minor} Minor
- 보고서: {보고서 경로}
```

**반복 개선:**

design-check에서 **Critical** 또는 **Major** 이슈가 발견된 경우:

1. 해당 이슈를 기반으로 코드 수정 제안
2. 사용자 승인 시 코드 수정 수행
3. design-check만 재실행하여 개선 확인
4. 이슈가 해소될 때까지 반복 (최대 3회)

## 에러 처리

| 상황                 | 대응                                                               |
| -------------------- | ------------------------------------------------------------------ |
| `FIGMA_TOKEN` 미설정 | 토큰 생성 안내: https://www.figma.com/developers/api#access-tokens |
| Figma URL 형식 오류  | 올바른 URL 형식 예시 제공                                          |
| figma-to-code 실패   | 에러 내용 출력, design-check 진행하지 않음                         |
| design-check 실패    | 에러 내용 출력, 가능한 경우 부분 결과 표시                         |

## 예시

### 입력

```
/figma-pipeline https://figma.com/design/abc123/MyProject?node-id=1-2 src/features/widget-builder/ui/ColumnHeader.tsx
```

### 실행 과정

1. **사전 검증**: `FIGMA_TOKEN` 확인 완료
2. **figma-to-code**: Figma 데이터 수집 → 토큰 매핑 → `ColumnHeader.tsx` 코드 생성
3. **design-check**: 스크린샷 캡처 → 비교 → 보고서 생성

### 출력

```
Figma Design Pipeline 완료: ColumnHeader

[Step 2] figma-to-code 결과:
- 생성된 파일: src/features/widget-builder/ui/ColumnHeader.tsx
- 사용된 토큰: text-text-primary, bg-surface-primary-default, rounded-strong
- 사용된 컴포넌트: @exem-fe/react (Button), @exem-fe/icon (FilterIcon)

[Step 3] design-check 결과:
- 정량: 1.8% (PASS)
- 정성: 0 Critical, 0 Major, 1 Minor
- 보고서: artifacts/design-check/ColumnHeader-report.md
```

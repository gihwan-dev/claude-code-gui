---
name: component-screenshot
description: Story 파일에서 컴포넌트 스크린샷 캡처. "/screenshot", "스크린샷 캡처" 등의 요청 시 사용
disable-model-invocation: false
argument-hint: Story 파일 경로 (예: __screenshots__/Card.stories.tsx)
---

argument: $1

# Claude Command: Component Screenshot

이 커맨드는 Storybook Story 파일을 기반으로 컴포넌트 스크린샷을 캡처합니다.

## 워크플로우

### 1. Story 파일 읽기

사용자로부터 Story 파일 경로를 받아 파일을 읽고 다음을 추출합니다:

- `title` 필드 (meta 객체에서)
- export된 Story 이름들 (예: `Default`, `WithIcon` 등)

### 2. Story ID 변환

Storybook 내부에서 사용하는 story ID를 생성합니다.

**변환 규칙:**

1. `title` 값을 소문자로 변환
2. `/`를 `-`로 치환
3. `--`로 구분하여 export 이름을 kebab-case로 추가

**변환 예시:**

| title                                       | export     | Story ID                                             |
| ------------------------------------------- | ---------- | ---------------------------------------------------- |
| `Screenshots/Shared/Card`                   | `Default`  | `screenshots-shared-card--default`                   |
| `Screenshots/Features/FilterBar/FilterList` | `Default`  | `screenshots-features-filterbar-filterlist--default` |
| `Screenshots/Shared/Button`                 | `WithIcon` | `screenshots-shared-button--with-icon`               |

**상세 변환 과정:**

```
title: "Screenshots/Shared/Card" + export: "Default"
→ 소문자: "screenshots/shared/card"ㅁ
→ / → -: "screenshots-shared-card"
→ + "--" + kebab(export): "screenshots-shared-card--default"
```

PascalCase export를 kebab-case로 변환:

- `Default` → `default`
- `WithIcon` → `with-icon`
- `MSWExample` → `msw-example`

### 3. 뷰포트 크기 결정

다음 우선순위로 뷰포트 크기를 결정합니다:

1. **사용자 지정**: 사용자가 명시적으로 크기를 지정한 경우
2. **Story wrapper div 힌트**: render 함수 내 wrapper div의 `style={{ width: '...', height: '...' }}` 값
3. **기본값**: width=1280, height=800

### 4. 캡처 실행

`.claude/skills/component-screenshot/scripts/capture-screenshot.ts` 스크립트를 실행하여 스크린샷을 캡처합니다.

스크립트는 정적 빌드된 Storybook(`.dist/`)을 Express로 서빙하여 캡처합니다. 정적 파일에는 HMR 웹소켓이 없으므로 `networkidle`이 정상 동작합니다.

```bash
pnpm exec tsx .claude/skills/component-screenshot/scripts/capture-screenshot.ts \
  --story-id "{story-id}" \
  --output "artifacts/screenshots/{ComponentName}.png" \
  --width {width} --height {height}
```

**스크립트 CLI 옵션:**

| 옵션         | 필수 | 기본값 | 설명                           |
| ------------ | ---- | ------ | ------------------------------ |
| `--story-id` | ✅   | -      | Storybook story ID             |
| `--output`   | ✅   | -      | 출력 PNG 파일 경로             |
| `--width`    | ❌   | 1280   | 뷰포트 너비                    |
| `--height`   | ❌   | 800    | 뷰포트 높이                    |
| `--port`     | ❌   | 6008   | 정적 서버 포트                 |
| `--timeout`  | ❌   | 30000  | 타임아웃 (ms)                  |
| `--rebuild`  | ❌   | false  | 기존 빌드 무시하고 강제 리빌드 |

- 스크립트는 `.dist/iframe.html`이 없으면 자동으로 `pnpm build-storybook`을 실행합니다.
- `--rebuild` 플래그를 사용하면 기존 빌드를 무시하고 항상 새로 빌드합니다.
- 캡처 후 `#storybook-root > *` 의 첫 번째 자식 요소를 스크린샷합니다.

### 5. 결과 검증

캡처 후 다음을 확인합니다:

- PNG 파일이 생성되었는지 확인
- 파일 크기가 0보다 큰지 확인 (빈 스크린샷 감지)
- 사용자에게 파일 경로를 안내

## 에러 처리

| 상황                  | 대응                                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Story 파일 없음       | 실행 중단, 파일 경로 확인 안내                                                                                             |
| title 파싱 실패       | Story 파일 형식 확인 안내                                                                                                  |
| Storybook 빌드 실패   | `pnpm build-storybook` 수동 실행으로 에러 확인 제안                                                                        |
| 빈 스크린샷 (0 bytes) | Story ID를 브라우저에서 직접 확인 제안: 정적 서버 실행 후 `http://localhost:6006/iframe.html?id={story-id}&viewMode=story` |
| 캡처 스크립트 에러    | 에러 메시지 전달 및 수동 실행 커맨드 안내                                                                                  |

## 예시

### 입력

```
/screenshot __screenshots__/Card.stories.tsx
```

### 실행 과정

1. `__screenshots__/Card.stories.tsx` 파일 읽기
2. title: `Screenshots/Shared/Card`, export: `Default` 추출
3. Story ID: `screenshots-shared-card--default` 생성
4. 뷰포트: wrapper div에서 width=384 추출, height=800 기본값
5. 실행:
   ```bash
   pnpm exec tsx .claude/skills/component-screenshot/scripts/capture-screenshot.ts \
     --story-id "screenshots-shared-card--default" \
     --output "artifacts/screenshots/Card.png" \
     --width 384 --height 800
   ```
6. `artifacts/screenshots/Card.png` 생성 확인

### 여러 Story export가 있는 경우

Story 파일에 여러 export가 있으면 사용자에게 어떤 Story를 캡처할지 확인합니다.

```
/screenshot __screenshots__/Button.stories.tsx
```

→ `Default`, `WithIcon`, `Disabled` 세 가지 export 발견
→ 사용자에게 선택 요청 (또는 모두 캡처할지 확인)

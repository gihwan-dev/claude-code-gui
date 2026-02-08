# 브라우저 테스트 패턴

프로젝트의 Vitest Browser Mode + Portable Stories 패턴에 특화된 실전 가이드.

## 1. 환경 개요

| 항목      | 설정                                            |
| --------- | ----------------------------------------------- |
| 엔진      | Vitest Browser Mode (Playwright 기반, headless) |
| 파일 패턴 | `*.browser.test.tsx`                            |
| 실행 명령 | `pnpm test:browser`                             |
| 뷰포트    | 1280×720                                        |

## 2. Portable Stories 패턴

`composeStories`로 Storybook 스토리를 테스트 컴포넌트로 변환한다. **스토리의 args가 곧 테스트 데이터**이므로, 테스트 파일에서 데이터를 직접 생성하지 않는다.

```typescript
import { composeStories } from '@storybook/react-vite'
import * as stories from './<Feature>.stories'

const { Default, Controlled, Uncontrolled } = composeStories(stories)
```

- 스토리가 없으면 **스토리를 먼저 작성**한다.
- `args`로 제공되지 않는 옵션은 테스트에서 override할 수 있다: `<Default options={{ sortable: { use: true } }} />`

## 3. Page Object Model 패턴

DOM 쿼리를 헬퍼 클래스에 캡슐화한다.

**규칙:**

- 테스트 코드에서 `querySelector` 직접 사용 금지
- 필요한 메서드가 없으면 **헬퍼에 추가 후 사용**
- 셀렉터 변경 시 헬퍼만 수정하면 모든 테스트에 반영

```typescript
// ❌ 테스트 코드에서 직접 쿼리
const header = container.querySelector('[role="columnheader"]')

// ✅ 헬퍼를 통해 접근
const tester = new SomeTester(container)
const header = tester.getHeaderByText('이름')
```

## 4. 렌더링과 안정화

```typescript
const { container } = render(<Default />);
await wait(RENDER_WAIT_TIME);  // DOM 안정화 (가상화 테이블 등)
const tester = new SomeTester(container);
```

- `wait`은 가상화, 비동기 렌더링 등에서 **DOM 안정화가 필요할 때** 사용한다.
- 불필요한 wait 남용은 지양 — 필요한 경우에만 사용한다.
- `RENDER_WAIT_TIME`은 describe 상단에 상수로 선언한다.

## 5. 사용자 인터랙션 패턴

### 클릭 / 키보드

```typescript
import { fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// 클릭
fireEvent.click(element)

// 타이핑
await userEvent.type(input, 'search text')

// 키보드
await userEvent.keyboard('{Enter}')
```

### 드래그 (포인터 이벤트)

```typescript
// pointerDown → pointerMove → pointerUp 시퀀스
fireEvent.pointerDown(element, {
  pointerId: 1,
  clientX: 100,
  clientY: 100,
  button: 0,
  pointerType: 'mouse',
})
fireEvent.pointerMove(document, {
  pointerId: 1,
  clientX: 100,
  clientY: 200,
})
fireEvent.pointerUp(document, {
  pointerId: 1,
  clientX: 100,
  clientY: 200,
})
```

- 드래그 시 `pointerMove`와 `pointerUp`의 타겟은 `document`이다 (dnd-kit 규칙).
- `pointerId`, `button`, `pointerType`은 반드시 지정한다.

## 6. 제어 / 비제어 모드 테스트

두 모드는 **반드시 분리**하여 테스트한다.

| 모드                  | 검증 포인트                            |
| --------------------- | -------------------------------------- |
| 제어 (Controlled)     | 외부 상태와 동기화, onChange 콜백 호출 |
| 비제어 (Uncontrolled) | 초기값(initial\*) 적용, 내부 상태 변경 |

```typescript
describe('제어 모드', () => {
  it('외부 상태 변경이 테이블에 반영된다', async () => {
    /* ... */
  })
  it('onChange 콜백이 호출된다', async () => {
    /* ... */
  })
})

describe('비제어 모드', () => {
  it('초기값이 적용된다', async () => {
    /* ... */
  })
  it('사용자 인터랙션으로 상태가 변경된다', async () => {
    /* ... */
  })
})
```

## 7. 스타일 / 계산된 속성 검증

```typescript
// computed style 검증
const styles = window.getComputedStyle(element)
expect(styles.left).not.toBe('auto')
expect(styles.position).toBe('sticky')

// data attribute 검증
expect(element).toHaveAttribute('data-pinned', 'true')

// aria attribute 검증
expect(header).toHaveAttribute('aria-sort', 'ascending')
```

## 8. 테스트 구조 템플릿

```typescript
import { composeStories } from '@storybook/react-vite';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

// 헬퍼 임포트 (프로젝트에 맞게 조정)
import * as stories from './<Feature>.stories';

const { Default, Controlled, Uncontrolled } = composeStories(stories);

describe('<기능명> 기능', () => {
  const RENDER_WAIT_TIME = 100;

  describe('기본 동작', () => {
    it('<핵심 동작 설명>', async () => {
      const { container } = render(<Default />);
      await wait(RENDER_WAIT_TIME);
      // Arrange → Act → Assert
    });
  });

  describe('제어 모드', () => {
    it('외부 상태와 동기화된다', async () => { /* ... */ });
  });

  describe('비제어 모드', () => {
    it('초기값이 적용된다', async () => { /* ... */ });
  });

  describe('기능 호환성', () => {
    it('[제어] 기능A + 기능B', async () => { /* ... */ });
    it('[비제어] 기능A + 기능B', async () => { /* ... */ });
  });
});
```

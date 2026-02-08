---
name: story-generator
description: 스크린샷 비교용 Story 파일 자동 생성. "/story-gen", "스토리 생성" 등의 요청 시 사용
disable-model-invocation: false
argument-hint: 컴포넌트 파일 경로 (예: src/shared/ui/card/Card.tsx)
---

argument: $1

# Claude Command: Story Generator

이 커맨드는 컴포넌트의 스크린샷 캡처용 Storybook Story 파일을 자동 생성합니다.

## 워크플로우

### 1. 입력 파싱

사용자로부터 컴포넌트 파일 경로를 받습니다.

- 예: `src/shared/ui/card/Card.tsx`, `src/features/widget-builder/ui/ColumnHeader.tsx`
- 경로에서 컴포넌트 이름과 FSD 레이어(shared, features, entities, widgets, pages)를 추출합니다.

### 2. 컴포넌트 분석

파일을 읽고 다음을 파악합니다:

- **export된 컴포넌트**: default export 또는 named export
- **Props 타입/인터페이스**: 필수 props와 선택적 props
- **import 의존성**: Context, Store, API 호출 여부

### 3. 기존 Story 참조

컴포넌트와 같은 디렉토리 또는 인접 위치에 `.stories.tsx` 파일이 있는지 확인합니다.

- 있으면: args, decorators, parameters, render 함수 패턴을 참조하여 Story를 구성합니다.
- 없으면: 컴포넌트 분석 결과만으로 Story를 구성합니다.

### 4. 렌더링 요구사항 분류

컴포넌트를 분석하여 다음 중 하나로 분류합니다:

| 분류                   | 조건                        | 대응                       |
| ---------------------- | --------------------------- | -------------------------- |
| **Simple**             | props만 필요                | 직접 렌더링                |
| **MSW-dependent**      | API 호출 (useQuery 등) 사용 | MSW handler 설정 필요      |
| **Provider-dependent** | Context/Store 의존          | decorators로 Provider 래핑 |

### 5. Story 파일 생성

파일 위치: `__screenshots__/{ComponentName}.stories.tsx`

#### (A) Simple 패턴

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { ComponentName } from '@/{path}'

const meta: Meta<typeof ComponentName> = {
  title: 'Screenshots/{Layer}/{ComponentName}',
  component: ComponentName,
  parameters: { layout: 'centered' },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <div style={{ width: '{WIDTH}px', height: '{HEIGHT}px' }}>
      <ComponentName {...props} />
    </div>
  ),
}
```

#### (B) MSW-dependent 패턴

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { ComponentName } from '@/{path}'
// MSW handlers import

const meta: Meta<typeof ComponentName> = {
  title: 'Screenshots/{Layer}/{ComponentName}',
  component: ComponentName,
  parameters: {
    layout: 'centered',
    msw: {
      handlers: [
        // 필요한 API mock handlers
      ],
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <div style={{ width: '{WIDTH}px', height: '{HEIGHT}px' }}>
      <ComponentName {...props} />
    </div>
  ),
}
```

#### (C) Provider-dependent 패턴

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { ComponentName } from '@/{path}'

const meta: Meta<typeof ComponentName> = {
  title: 'Screenshots/{Layer}/{ComponentName}',
  component: ComponentName,
  parameters: { layout: 'centered' },
  decorators: [
    Story => (
      <SomeProvider>
        <Story />
      </SomeProvider>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <div style={{ width: '{WIDTH}px', height: '{HEIGHT}px' }}>
      <ComponentName {...props} />
    </div>
  ),
}
```

### 6. 검증

생성된 Story 파일이 올바른지 확인합니다:

- TypeScript 구문 오류가 없는지 확인
- import 경로가 `@/` alias를 사용하는지 확인
- render 함수가 단일 루트 엘리먼트를 반환하는지 확인

## 규칙

### title 형식

- `Screenshots/{Layer}/{ComponentName}` 형식을 사용합니다.
- Layer는 FSD 레이어명을 PascalCase로 표기: `Shared`, `Features`, `Entities`, `Widgets`, `Pages`
- 중첩 경로의 경우: `Screenshots/{Layer}/{SubPath}/{ComponentName}`
  - 예: `src/features/widget-builder/ui/ColumnHeader.tsx` → `Screenshots/Features/WidgetBuilder/ColumnHeader`

### render 함수 규칙

- **반드시 단일 루트 엘리먼트를 반환**해야 합니다 (캡처 스크립트가 `#storybook-root > *` 선택자를 사용)
- wrapper `div`에 적절한 width/height를 지정합니다
- 컴포넌트의 실제 사용 크기에 맞게 조정합니다

### import 경로

- 항상 `@/` 경로 alias를 사용합니다
- 예: `import { Card } from '@/shared/ui/card/Card';`

### 파일 덮어쓰기

- `__screenshots__/` 디렉토리에 이미 같은 이름의 파일이 있으면 **사용자에게 덮어쓸지 확인**합니다

### export 이름

- 기본 Story export 이름은 `Default`를 사용합니다
- 여러 변형이 필요한 경우 추가 export를 만들 수 있습니다

## 예시

### 입력

```
/story-gen src/shared/ui/card/Card.tsx
```

### 출력 파일: `__screenshots__/Card.stories.tsx`

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { Card } from '@/shared/ui/card/Card'

const meta: Meta<typeof Card> = {
  title: 'Screenshots/Shared/Card',
  component: Card,
  parameters: { layout: 'centered' },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <div style={{ width: '384px' }}>
      <Card>
        <Card.Header>
          <Card.Title>Card Title</Card.Title>
          <Card.Description>Card description</Card.Description>
        </Card.Header>
        <Card.Content>
          <p>Content area</p>
        </Card.Content>
      </Card>
    </div>
  ),
}
```

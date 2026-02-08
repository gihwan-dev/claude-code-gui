# Table 컴포넌트 테스트

Table 컴포넌트(`packages/react/src/table`)에 특화된 테스트 패턴과 규칙.

## 1. TableTester 사용법

**파일 위치**: `packages/react/src/table/spec/helpers/TableTester.ts`

Page Object Model 패턴의 헬퍼 클래스. 테이블 관련 DOM 쿼리를 캡슐화한다.

### 주요 API

| 카테고리     | API                            | 설명                                        |
| ------------ | ------------------------------ | ------------------------------------------- |
| 기본 요소    | `table`                        | `[role="table"]` 요소                       |
|              | `headers`                      | `[role="columnheader"]` 요소들              |
|              | `cells`                        | `[role="cell"]`, `[role="gridcell"]` 요소들 |
|              | `scrollViewport`               | 스크롤 영역 요소                            |
|              | `searchInput`                  | 검색 입력창                                 |
|              | `toolbar`                      | 테이블 툴바                                 |
|              | `optionsButton`                | 옵션 메뉴 버튼                              |
| 행 조회      | `getRows(includeHeader?)`      | 행 요소들 (헤더 포함/제외)                  |
|              | `getRowCells(row)`             | 특정 행의 셀들                              |
|              | `renderedRowCount`             | 렌더링된 데이터 행 수 (헤더 제외)           |
|              | `domNodeCount`                 | 전체 DOM 노드 수                            |
| 헤더/정렬    | `getHeaderByText(text)`        | 텍스트로 헤더 찾기                          |
|              | `getSortButton(headerText)`    | 정렬 버튼 찾기                              |
|              | `getAriaSortValue(headerText)` | `aria-sort` 값 조회                         |
|              | `getColumnValues(index)`       | 특정 컬럼의 모든 셀 값 추출                 |
| 선택         | `checkboxes`                   | 체크박스 요소들                             |
|              | `radioButtons`                 | 라디오 버튼 요소들                          |
|              | `isChecked(element)`           | 체크 상태 확인                              |
|              | `isIndeterminate(element)`     | 부분 선택 상태 확인                         |
| 확장         | `expanders`                    | 확장 버튼들                                 |
| 고정         | `getPinnedRows()`              | 고정된 행들                                 |
|              | `getUnpinnedRows()`            | 비고정 행들                                 |
| 행 순서      | `getMoveUpButton()`            | 위로 이동 버튼                              |
|              | `getMoveDownButton()`          | 아래로 이동 버튼                            |
|              | `hasCursorGrab(element)`       | 드래그 커서 여부                            |
| 페이지네이션 | `pagination.nav`               | 네비게이션 요소                             |
|              | `pagination.prevButton`        | 이전 페이지 버튼                            |
|              | `pagination.nextButton`        | 다음 페이지 버튼                            |
|              | `pagination.getPageButton(n)`  | n페이지 버튼                                |
| 유틸         | `getButtonByText(text)`        | 텍스트로 버튼 찾기                          |
|              | `isAriaDisabled(element)`      | aria-disabled 확인                          |
|              | `isScrollable(element)`        | 스크롤 가능 여부                            |

### 확장 규칙

필요한 메서드가 `TableTester`에 없다면, **테스트 코드에 직접 구현하지 말고 `TableTester`에 메서드를 추가한 뒤 사용한다.**

## 2. 브라우저 테스트 — 파일 규칙

### 파일 위치

```
packages/react/src/table/spec/<Feature>/
├── <Feature>.stories.tsx          # 스토리 (테스트 데이터 소스)
├── <Feature>.browser.test.tsx     # 브라우저 테스트
└── <Feature>.mdx                  # 스펙 문서 (선택)
```

### 임포트 패턴

```typescript
import { composeStories } from '@storybook/react-vite'
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TableTester, wait } from '../helpers'
import * as stories from './<Feature>.stories'

const { Default, Controlled, Uncontrolled } = composeStories(stories)
```

### 기본 렌더링 패턴

```typescript
it('테이블이 정상 렌더링된다', async () => {
  const { container } = render(<Default />);
  await wait(RENDER_WAIT_TIME);
  const tester = new TableTester(container);

  expect(tester.table).toBeInTheDocument();
  expect(tester.renderedRowCount).toBe(10);
});
```

## 3. 브라우저 테스트 — 기능 호환성 매트릭스

### 원칙

1. **1:1 조합만 테스트**: 현재 기능 + 다른 기능 **하나**만 조합
   - O: RowOrdering + Sorting
   - X: RowOrdering + Sorting + Pagination (동시 조합 금지)

2. **우선순위**:

   | 우선순위 | 기준                        | 예시                        |
   | -------- | --------------------------- | --------------------------- |
   | **필수** | △ (제한적 호환) 표시된 조합 | RowSelection + RowExpansion |
   | **권장** | 자주 함께 사용되는 조합     | Sorting + Pagination        |
   | **선택** | 나머지 O (완전 호환) 조합   | 필요 시 추가                |

3. **제어/비제어 모드 각각 테스트**

4. **예상 테스트 수**: 5-7개 조합 × 2(제어/비제어) × 2(기본+호환성) = 20-28개 / 주요 기능

### 호환성 테스트 구조

```typescript
describe('기능 호환성', () => {
  // △ 제한적 호환 — 필수
  it('[제어] RowOrdering + Sorting이 함께 동작한다', async () => {
    const { container } = render(
      <Controlled options={{ sortable: { use: true } }} />
    );
    await wait(RENDER_WAIT_TIME);
    const tester = new TableTester(container);
    // 두 기능이 충돌 없이 동작하는지 검증
  });

  it('[비제어] RowOrdering + Sorting이 함께 동작한다', async () => {
    // 비제어 모드에서 동일 검증
  });
});
```

## 4. 유닛 테스트 — Custom Feature 테스트

### 파일 위치

```
packages/react/src/table/features/__test__/<Feature>.spec.ts
```

### Mock Table / Row 생성 패턴

```typescript
function createMockRow(id: string, original: TestData) {
  return {
    id,
    original,
    index: Number.parseInt(id) - 1,
    getParentRow: () => null,
    // ... 필요한 메서드
  }
}

function createMockTable(overrides = {}) {
  const data = overrides.data ?? defaultData
  const rows = data.map(d => createMockRow(String(d.id), d))

  const state = {
    // Feature의 상태 필드
  }

  const onChangeCallback = vi.fn()

  const table = {
    getState: () => state,
    setState: vi.fn(updater => {
      const newState = typeof updater === 'function' ? updater(state) : updater
      Object.assign(state, newState)
    }),
    getRowModel: () => ({ flatRows: rows, rows }),
    options: {
      onFeatureChange: onChangeCallback,
    },
  }

  // Feature의 createTable로 테이블에 메서드 주입
  featureCreateTable(table)

  return { table, onChangeCallback }
}
```

### contravariance 우회

TanStack Table의 타입 시스템에서 Mock 객체를 `createTable`에 전달할 때:

```typescript
const featureCreateTable = Feature.createTable! as (table: any) => void
```

### 테스트 범위

| 대상                | 검증 포인트                                       |
| ------------------- | ------------------------------------------------- |
| `getDefaultOptions` | 기본 옵션 값이 올바른가                           |
| 상태 변경 함수      | `setState`, `onChange` 콜백이 올바르게 호출되는가 |
| 행 메서드           | `createRow`로 주입된 메서드가 올바르게 동작하는가 |
| 경계 조건           | 첫 행, 마지막 행, 빈 데이터, 트리 구조 등         |

## 5. 유닛 테스트 — 유틸리티 함수 테스트

### 파일 위치

```
packages/react/src/table/utils/__test__/<util>.spec.ts
```

### 특성

- **순수 함수 중심** — 입력/출력만 검증
- 엣지 케이스 중점: 빈 데이터, 경계값, 오버플로, 트리 구조 등
- Mock은 최소한으로 — 함수의 매개변수 타입에 맞는 데이터만 생성

```typescript
describe('computeAllMerges', () => {
  it('빈 데이터일 때 빈 결과를 반환한다', () => {
    const table = createMockTable({ rows: [] })
    const result = computeAllMerges(table)
    expect(result.rowSpanMap.size).toBe(0)
    expect(result.colSpanMap.size).toBe(0)
  })

  it('rowSpan이 행 수를 초과하면 잘린다', () => {
    const table = createMockTable({
      rows: [
        { id: '1', original: { colA: 'val', rowSpan: { colA: 5 } } },
        { id: '2', original: { colA: 'val' } },
      ],
    })
    const result = computeAllMerges(table)
    // rowSpan 5지만 행이 2개이므로 2로 잘림
    expect(result.rowSpanMap.get('0:colA')).toBe(2)
  })
})
```

## 6. 테스트 헬퍼 유틸리티

`packages/react/src/table/spec/helpers/` 에서 제공하는 공용 유틸리티:

| 유틸리티                                   | 위치                   | 용도                                         |
| ------------------------------------------ | ---------------------- | -------------------------------------------- |
| `TableTester`                              | `testHelpers.ts`       | DOM 쿼리 헬퍼 (Page Object Model)            |
| `wait(ms)`                                 | `testHelpers.ts`       | DOM 안정화 대기                              |
| `generateDeterministicEmployeeData(count)` | `utils.ts`             | 결정적 테스트 데이터 생성                    |
| `generateEmployeeData(count)`              | `utils.ts`             | 랜덤 직원 데이터 생성                        |
| `generateHierarchicalData(levels, nodes)`  | `utils.ts`             | 트리 구조 데이터 생성                        |
| `BASIC_COLUMNS`                            | `utils.ts`             | 기본 컬럼 프리셋 (ID, 이름, 부서, 직급)      |
| `EMPLOYEE_COLUMNS`                         | `utils.ts`             | 직원 컬럼 프리셋 (기본 + 이메일, 연봉, 상태) |
| `FULL_COLUMNS`                             | `utils.ts`             | 전체 컬럼 프리셋 (직원 + 전화번호, 입사일)   |
| `useRowSelectionHandler`                   | `utils.ts`             | 행 선택 상태 관리 훅                         |
| `useSortingHandler`                        | `utils.ts`             | 정렬 상태 관리 훅                            |
| `usePaginationHandler`                     | `utils.ts`             | 페이지네이션 상태 관리 훅                    |
| `useExpandedHandler`                       | `utils.ts`             | 확장 상태 관리 훅                            |
| `COMPATIBILITY_MATRIX`                     | `compatibilityData.ts` | 기능 간 호환성 매트릭스                      |

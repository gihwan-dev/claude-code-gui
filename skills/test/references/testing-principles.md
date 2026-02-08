# 좋은 테스트란 무엇인가

## 1. 테스트의 존재 이유

테스트는 커버리지가 아닌 **신뢰(confidence)**를 위해 존재한다.

- 통과하는데 기능이 깨진 테스트(false positive)는 테스트 없음보다 **더 위험하다** — 잘못된 안전감을 줄 뿐이다.
- 테스트의 가치 공식: **`신뢰 획득 > 유지보수 비용`**일 때만 작성할 가치가 있다.
- 모든 함수에 테스트를 붙이는 것이 목표가 아니다. "이 테스트가 없으면 언제 문제를 발견하는가?"를 먼저 자문한다.

## 2. 좋은 테스트의 특성

좋은 테스트는 두 가지 특성을 동시에 만족한다:

| 특성 | 의미 | 부재 시 문제 |
|-----|------|------------|
| **감도(sensitivity)** | 기능이 깨지면 실패한다 | 버그가 있어도 통과 (false positive) |
| **특이도(specificity)** | 구현을 리팩토링해도 깨지지 않는다 | 리팩토링할 때마다 테스트 수정 (false negative) |

감도만 높은 테스트: 스냅샷 — 무관한 변경에도 깨진다.
특이도만 높은 테스트: `expect(result).toBeTruthy()` — 거의 모든 것이 통과한다.

## 3. 행동을 테스트하라, 구현을 테스트하지 마라

### 테스트하는 것

- 사용자가 관찰할 수 있는 것: 렌더링 결과, 이벤트 반응, 콜백 호출
- 함수의 입력 → 출력 관계
- 공개 API의 계약(contract)

### 테스트하지 않는 것

- 내부 상태 (`useState`의 값 직접 검사)
- private 메서드
- 프레임워크/라이브러리 동작 (React 렌더링, TanStack Table 내부 로직)

### 판단법

> "이 코드의 내부 구현을 바꾸면 이 테스트가 깨지는가?"

깨진다면 구현에 결합된 테스트다. 행동은 동일한데 테스트가 깨지면, 그 테스트는 리팩토링의 적이다.

## 4. 올바른 테스트 경계 선택

| 대상 | 적합한 테스트 | 이유 |
|------|-------------|------|
| 순수 함수 / 유틸리티 | Unit (`*.spec.ts`, `*.test.ts`) | 빠르고 엣지케이스 커버 용이 |
| 사용자 인터랙션 / 렌더링 결과 | Browser test (`*.browser.test.tsx`) | 실제 DOM에서 검증 필요 |
| 기능 간 조합 | Browser test | 통합 환경에서만 의미 |
| Custom Feature 상태 로직 | Unit (`*.spec.ts`) | Mock table로 빠르게 검증 |

## 5. Arrange-Act-Assert (AAA)

모든 테스트는 세 단계로 구성한다:

```typescript
// Arrange: 테스트에 필요한 것만 준비
const { container } = render(<Default />);
await wait(RENDER_WAIT_TIME);
const tester = new TableTester(container);

// Act: 사용자 행동 하나
fireEvent.click(tester.getSortButton('이름'));

// Assert: 기대 결과 검증
expect(tester.getColumnValues(1)).toEqual(['강수빈', '김민수', '박지훈']);
```

- Arrange는 **해당 테스트에 필요한 최소한**만 준비한다.
- Act는 **하나의 행동**만 수행한다.
- Assert는 **구체적인 값**으로 검증한다.

## 6. 이름은 실패 시 읽는다

테스트가 실패하면 가장 먼저 보는 것은 테스트 이름이다.

```typescript
// ✅ 실패 시 무엇이 깨졌는지 즉시 파악
it('정렬 버튼 클릭 시 오름차순 정렬된다')
it('빈 데이터일 때 빈 상태 메시지가 표시된다')
it('마지막 행은 아래로 이동 버튼이 비활성화된다')

// ❌ 코드를 읽어야 파악 가능
it('test case 1')
it('정상 동작한다')
it('에러가 발생하지 않는다')
```

**패턴: `[조건]하면 [결과]한다`** 또는 `[상황]일 때 [결과]한다`

## 7. 최소 셋업 원칙

- 해당 테스트에 **필요한 것만** 준비한다.
- 과도한 셋업은 "이 테스트가 뭘 검증하는지"를 가린다.
- 공통 셋업은 헬퍼/팩토리로 추출하되, **각 테스트의 의도가 드러나야** 한다.

```typescript
// ❌ 모든 옵션을 다 넣은 셋업 — 정렬 테스트에 selectable, pagination이 왜 있는가?
const options = {
  sortable: { use: true },
  selectable: { use: true, mode: 'multiple' },
  pagination: { use: true, pageSize: 10 },
};

// ✅ 정렬 테스트에 필요한 것만
const options = { sortable: { use: true } };
```

## 8. 단언(assertion) 품질

```typescript
// ❌ 무의미한 단언: 실패 시 아무 정보 없음
expect(result).toBeTruthy();
expect(rows.length > 0).toBe(true);
expect(element).toBeDefined();

// ✅ 구체적 단언: 실패 시 기대값 vs 실제값이 명확
expect(tester.renderedRowCount).toBe(5);
expect(tester.getColumnValues(1)).toEqual(['김민수', '박지훈', '강수빈']);
expect(header).toHaveAttribute('aria-sort', 'ascending');
```

**규칙:**
- `toBeTruthy()` / `toBeDefined()` 대신 구체적 값을 비교한다.
- `rows.length > 0`처럼 boolean 변환하지 말고 `rows.length`를 직접 비교한다.
- 배열은 `toEqual`로 순서까지 검증한다.

## 9. 셀렉터 우선순위

DOM 요소를 찾을 때 아래 우선순위를 따른다:

1. **접근성 속성**: `role`, `aria-label`, `aria-sort`, `aria-checked`
2. **시맨틱 HTML**: `button`, `heading`, `table`
3. **데이터 속성**: `data-testid`, `data-pinned`, `data-index`
4. **텍스트 내용**: `getByText`, `textContent`
5. **클래스명**: **최후의 수단** — 스타일 변경 시 깨짐

Page Object Model 헬퍼(예: `TableTester`)가 있다면, 직접 셀렉터를 쓰지 말고 헬퍼를 통해 접근한다.

## 10. 안티패턴

| 안티패턴 | 문제점 | 대안 |
|---------|--------|------|
| 프레임워크 동작 테스트 | React/TanStack이 이미 테스트함 | 비즈니스 로직만 테스트 |
| 스냅샷 남용 | 무관한 변경에 깨짐 | 구체적 단언 사용 |
| boolean 단언 | 실패 메시지 무의미 | 구체적 값 비교 |
| 복붙 테스트 | 유지보수 지옥 | 헬퍼/페이지 오브젝트 추출 |
| 과도한 목킹 | 실제 동작과 괴리 | 필요한 것만 최소한으로 |
| 구현 결합 | 리팩토링 시 깨짐 | 행동 기반 테스트 |
| 하나의 it에 여러 시나리오 | 실패 원인 모호 | 시나리오당 하나의 it |
| 테스트 내 데이터 직접 생성 | 스토리와 불일치 | 스토리의 args 활용 |
| `querySelector` 직접 사용 | 셀렉터 변경 시 전파 | 헬퍼 클래스 활용 |
| for문/동적 테스트 생성 | 가독성 저하 | 명시적으로 각 케이스 작성 |

---
name: complexity-refactor
description: 순환 복잡도(Cyclomatic Complexity)가 높은 함수를 인간의 논리적 사고 흐름에 맞게 재구성하는 스킬. "복잡한 함수 정리해줘", "이 함수 읽기 어려워", "순환 복잡도 낮춰줘", "리팩토링 해줘" 등의 요청에 사용. 단순 코드 추출이 아닌 논리적 재구성을 수행하며, 성능보다 가독성과 수정 용이성을 우선시함.
---

# Complexity Refactor

순환 복잡도가 높은 함수를 **인간이 이해하고 수정하기 쉬운 코드**로 재구성한다.

## 핵심 철학

### 1. 단순 추출 금지

```
❌ 금지: 코드 10줄을 그대로 잘라서 새 함수에 붙여넣기
✅ 목표: 논리적 단위로 재구성하여 "왜 이렇게 나눴는지" 납득 가능하게
```

### 2. 인간의 사고 흐름 우선

코드는 위에서 아래로 읽으면서 "다음에 뭐가 나올지" 예측 가능해야 한다.

```typescript
// ❌ AI가 흔히 만드는 코드: 추상적이고 예측 불가
processDataWithValidationAndTransformation(data, config, options)

// ✅ 인간 친화적: 구체적이고 순서대로
const validated = validateUserInput(data)
const normalized = normalizePhoneNumber(validated.phone)
const saved = saveToDatabase({ ...validated, phone: normalized })
```

### 3. 이름은 한국어로 설명 가능할 정도로

```typescript
// ❌ 나쁜 이름: 무슨 뜻인지 모름
handleDataProcessingWithContext()
executeOperationWithFallback()
processEntityBatch()

// ✅ 좋은 이름: "~하는 함수"로 바로 설명 가능
filterExpiredUsers() // "만료된 사용자 거르는 함수"
calculateShippingFee() // "배송비 계산하는 함수"
sendWelcomeEmail() // "환영 이메일 보내는 함수"
```

### 4. 성능 < 가독성

루프를 한 번 더 도는 정도의 차이는 무시한다. 가독성이 우선이다.

## 리팩토링 절차

### Step 1: 복잡도 측정

대상 함수의 순환 복잡도 계산:

```
복잡도 = 1 + (분기문 개수)

분기문: if, else if, case, while, for, catch, &&, ||, ? (삼항)
```

| 점수  | 상태 | 조치        |
| ----- | ---- | ----------- |
| 1-10  | 양호 | 유지        |
| 11-20 | 주의 | 개선 권장   |
| 21+   | 위험 | 반드시 개선 |

### Step 2: 논리 흐름 파악

코드를 읽으며 **인간의 사고 단위**로 나눈다:

1. **준비 단계**: 데이터 검증, 초기화
2. **핵심 로직**: 실제 비즈니스 처리
3. **마무리**: 결과 반환, 정리

### Step 3: 재구성 패턴 선택

상황에 맞는 패턴을 적용한다. 상세 패턴은 `references/patterns.md` 참조.

- **Early Return**: 예외 케이스를 먼저 처리하여 중첩 제거
- **Step-by-Step**: 순차적 단계로 분리
- **Strategy**: 조건에 따른 분기를 객체/맵으로 대체

### Step 4: 코드 작성

리팩토링 시 반드시 지킬 것:

1. **함수명**: 동사 + 목적어, 한국어로 "~하는 함수"로 설명 가능
2. **흐름**: 위에서 아래로 읽으면 로직이 그대로 이해됨
3. **중첩**: 최대 2단계 (if 안에 if 안에 if 금지)
4. **길이**: 한 함수 30줄 이내 권장

### Step 5: 검증

- 리팩토링 후 복잡도 재측정 (10 이하 목표)
- 함수명만 읽어도 전체 흐름 파악 가능한지 확인
- 원본과 동일한 동작 보장

## 참고

- 리팩토링 패턴 상세: `references/patterns.md`
- 안티패턴 예시: `references/antipatterns.md`

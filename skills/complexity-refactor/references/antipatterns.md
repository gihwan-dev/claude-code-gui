# 안티패턴 (피해야 할 것들)

AI가 코드를 리팩토링할 때 흔히 저지르는 실수들.

## 1. 의미 없는 추상화

코드를 그냥 잘라서 함수로 만들기만 하고, 그 함수가 뭘 하는지 이름에서 알 수 없는 경우.

### ❌ 나쁜 예

```typescript
// 원래 코드
if (user.age >= 18 && user.country === 'KR') {
  price = price * 1.1
}

// AI가 만든 "리팩토링"
function processUserPriceLogic(user: User, price: number) {
  if (user.age >= 18 && user.country === 'KR') {
    price = price * 1.1
  }
  return price
}
```

### ✅ 좋은 예

```typescript
function applyKoreanAdultTax(price: number): number {
  return price * 1.1
}

// 사용
if (isKoreanAdult(user)) {
  price = applyKoreanAdultTax(price)
}
```

## 2. 과도한 파라미터화

범용성을 위해 파라미터를 너무 많이 만들어서 오히려 이해하기 어려워지는 경우.

### ❌ 나쁜 예

```typescript
function processData(
  data: any,
  config: ProcessConfig,
  options: ProcessOptions,
  context: ProcessContext,
  handlers: ProcessHandlers,
  validators: ProcessValidators,
) {
  // ...
}
```

### ✅ 좋은 예

```typescript
// 구체적인 용도에 맞는 함수들
function validateUserInput(input: UserInput): ValidatedInput { ... }
function formatPhoneNumber(phone: string): string { ... }
function saveUser(user: User): SaveResult { ... }
```

## 3. 기계적 분리

줄 수만 보고 기계적으로 나누는 경우. 논리적 단위가 아닌 물리적 단위로 나눔.

### ❌ 나쁜 예

```typescript
// 30줄마다 무조건 분리
function processPart1(data) {
  // 1-30줄
}

function processPart2(data) {
  // 31-60줄
}

function processPart3(data) {
  // 61-90줄
}
```

### ✅ 좋은 예

```typescript
// 논리적 단위로 분리 (줄 수는 다를 수 있음)
function validateInput(data) { ... }      // 15줄
function transformData(data) { ... }      // 45줄 (복잡해도 하나의 개념이면 OK)
function saveResult(data) { ... }         // 20줄
```

## 4. 이름 과잉 수식

이름에 너무 많은 정보를 담으려다 오히려 읽기 어려워지는 경우.

### ❌ 나쁜 예

```typescript
function validateAndProcessUserInputDataWithErrorHandling()
function handleUserRegistrationFormSubmissionWithValidation()
function executeAsyncDatabaseQueryWithRetryAndTimeout()
```

### ✅ 좋은 예

```typescript
function validateUserInput()
function submitRegistration()
function queryWithRetry()
```

## 5. 과도한 추상화 계층

한 번의 호출을 위해 여러 단계의 함수를 거치는 경우.

### ❌ 나쁜 예

```typescript
function handleRequest(req) {
  return processRequest(req)
}

function processRequest(req) {
  return executeRequest(req)
}

function executeRequest(req) {
  return runRequest(req)
}

function runRequest(req) {
  // 실제 로직은 여기에만 있음
}
```

### ✅ 좋은 예

```typescript
function handleRequest(req) {
  const validated = validateRequest(req)
  const result = executeQuery(validated)
  return formatResponse(result)
}
```

## 6. 맥락 없는 헬퍼 함수

어디서나 쓸 수 있는 "유틸리티"를 만들었지만 실제로는 한 곳에서만 쓰는 경우.

### ❌ 나쁜 예

```typescript
// utils/helpers.ts
function processArrayWithCondition(arr, condition, transformer) {
  return arr.filter(condition).map(transformer)
}

// 사용처
const adults = processArrayWithCondition(
  users,
  u => u.age >= 18,
  u => u.name
)
```

### ✅ 좋은 예

```typescript
// 바로 그 자리에서 명확하게
const adultNames = users
  .filter(user => user.age >= 18)
  .map(user => user.name)
```

## 자가 점검 체크리스트

리팩토링 후 다음을 확인:

1. [ ] 함수 이름만 보고 뭘 하는지 알 수 있는가?
2. [ ] "~하는 함수"로 한국어로 설명할 수 있는가?
3. [ ] 파라미터가 3개 이하인가?
4. [ ] 한 함수가 한 가지 일만 하는가?
5. [ ] 함수를 호출하는 코드가 더 읽기 쉬워졌는가?
6. [ ] 위에서 아래로 읽으면 전체 흐름이 이해되는가?

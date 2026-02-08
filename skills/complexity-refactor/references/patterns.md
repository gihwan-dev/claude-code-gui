# 리팩토링 패턴

## 1. Early Return (조기 반환)

예외 케이스를 함수 시작 부분에서 처리하여 핵심 로직의 들여쓰기를 줄인다.

### Before (복잡도: 5)

```typescript
function processOrder(order: Order) {
  if (order) {
    if (order.items.length > 0) {
      if (order.payment) {
        if (order.payment.verified) {
          // 핵심 로직이 여기 깊숙이...
          return executeOrder(order)
        } else {
          return { error: '결제 미확인' }
        }
      } else {
        return { error: '결제 정보 없음' }
      }
    } else {
      return { error: '상품 없음' }
    }
  } else {
    return { error: '주문 없음' }
  }
}
```

### After (복잡도: 5, 하지만 가독성 대폭 향상)

```typescript
function processOrder(order: Order) {
  // 예외 케이스를 먼저 처리
  if (!order) return { error: '주문 없음' }
  if (order.items.length === 0) return { error: '상품 없음' }
  if (!order.payment) return { error: '결제 정보 없음' }
  if (!order.payment.verified) return { error: '결제 미확인' }

  // 핵심 로직은 들여쓰기 없이 명확하게
  return executeOrder(order)
}
```

## 2. Step-by-Step (단계별 분리)

긴 함수를 논리적 단계로 나누어 각각의 함수로 분리한다.

### Before (복잡도: 12)

```typescript
function registerUser(data: FormData) {
  // 50줄의 검증 로직
  if (!data.email) throw new Error('이메일 필수')
  if (!data.email.includes('@')) throw new Error('이메일 형식')
  // ... 10개 더 검증

  // 30줄의 정규화 로직
  const normalizedEmail = data.email.toLowerCase().trim()
  const normalizedPhone = data.phone.replace(/[^0-9]/g, '')
  // ... 더 많은 정규화

  // 40줄의 저장 로직
  const user = { email: normalizedEmail, phone: normalizedPhone }
  await db.users.insert(user)
  await sendEmail(user.email, 'welcome')
  await logActivity('user_created', user.id)
  // ...

  return user
}
```

### After (각 함수 복잡도: 3-4)

```typescript
function registerUser(data: FormData) {
  const validated = validateRegistration(data)
  const normalized = normalizeUserData(validated)
  const user = saveNewUser(normalized)
  return user
}

function validateRegistration(data: FormData) {
  if (!data.email) throw new Error('이메일 필수')
  if (!data.email.includes('@')) throw new Error('이메일 형식')
  if (!data.password) throw new Error('비밀번호 필수')
  if (data.password.length < 8) throw new Error('비밀번호 8자 이상')
  return data
}

function normalizeUserData(data: FormData) {
  return {
    email: data.email.toLowerCase().trim(),
    phone: data.phone.replace(/[^0-9]/g, ''),
    name: data.name.trim(),
  }
}

function saveNewUser(userData: UserData) {
  const user = await db.users.insert(userData)
  await sendWelcomeEmail(user.email)
  await logUserCreated(user.id)
  return user
}
```

## 3. Strategy Pattern (전략 패턴)

복잡한 switch/if-else 분기를 객체 맵으로 대체한다.

### Before (복잡도: 8)

```typescript
function calculateDiscount(userType: string, amount: number) {
  if (userType === 'vip') {
    return amount * 0.3
  } else if (userType === 'gold') {
    return amount * 0.2
  } else if (userType === 'silver') {
    return amount * 0.1
  } else if (userType === 'bronze') {
    return amount * 0.05
  } else if (userType === 'new') {
    return amount * 0.15
  } else {
    return 0
  }
}
```

### After (복잡도: 1)

```typescript
const DISCOUNT_RATES: Record<string, number> = {
  vip: 0.3,
  gold: 0.2,
  silver: 0.1,
  bronze: 0.05,
  new: 0.15,
}

function calculateDiscount(userType: string, amount: number) {
  const rate = DISCOUNT_RATES[userType] ?? 0
  return amount * rate
}
```

## 4. Extract Condition (조건 추출)

복잡한 조건식을 의미 있는 이름의 변수나 함수로 추출한다.

### Before

```typescript
if (user.age >= 18 && user.hasId && !user.isBanned && user.emailVerified &&
    (user.subscription === 'premium' || user.trialDaysLeft > 0)) {
  // ...
}
```

### After

```typescript
const isAdult = user.age >= 18
const hasValidIdentity = user.hasId && !user.isBanned && user.emailVerified
const hasAccess = user.subscription === 'premium' || user.trialDaysLeft > 0

const canAccessContent = isAdult && hasValidIdentity && hasAccess

if (canAccessContent) {
  // ...
}

// 또는 함수로:
function canUserAccessContent(user: User): boolean {
  const isAdult = user.age >= 18
  const hasValidIdentity = user.hasId && !user.isBanned && user.emailVerified
  const hasAccess = user.subscription === 'premium' || user.trialDaysLeft > 0

  return isAdult && hasValidIdentity && hasAccess
}
```

## 5. Null Object / Default (기본값 패턴)

null 체크를 반복하는 대신 기본 객체를 사용한다.

### Before (복잡도: 6)

```typescript
function displayUserInfo(user: User | null) {
  if (user) {
    if (user.name) {
      console.log(user.name)
    } else {
      console.log('이름 없음')
    }
    if (user.email) {
      console.log(user.email)
    } else {
      console.log('이메일 없음')
    }
  } else {
    console.log('사용자 없음')
  }
}
```

### After (복잡도: 1)

```typescript
const ANONYMOUS_USER: User = {
  name: '이름 없음',
  email: '이메일 없음',
}

function displayUserInfo(user: User | null) {
  const displayUser = user ?? ANONYMOUS_USER
  console.log(displayUser.name)
  console.log(displayUser.email)
}
```

## 패턴 선택 가이드

| 상황 | 추천 패턴 |
|------|----------|
| 중첩된 if-else | Early Return |
| 50줄 이상 긴 함수 | Step-by-Step |
| 5개 이상 switch/case | Strategy |
| 복잡한 조건식 | Extract Condition |
| 반복되는 null 체크 | Null Object |

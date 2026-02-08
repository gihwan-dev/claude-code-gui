# Clean Code 분석 리포트

**분석 일시**: 2026-02-08
**분석 브랜치**: feat/xtermjs-intergration
**분석 대상**: main 브랜치 대비 변경된 TS/TSX 파일 7개 (테스트 제외)

---

## 1. 요약

7개 파일(총 384줄)을 React Clean Code Scorecard 프레임워크로 분석한 결과:

| 등급          | 파일 수 | 비고                                     |
| ------------- | ------- | ---------------------------------------- |
| A (우수)      | 2       | terminal-theme.ts, use-terminal-theme.ts |
| B (양호)      | 1       | terminal-store.ts (dead state 제외)      |
| C+ (주의)     | 2       | TerminalPanel.tsx, use-terminal.ts       |
| D (삭제 대상) | 1       | terminal-events.ts (전체 미사용)         |
| N/A           | 1       | SessionsView.tsx (래퍼 컴포넌트)         |

**기술 부채 점수**: 67/100 (보통) → 리팩토링 후 예상 88/100

---

## 2. 파일별 상세 분석

### 2.1 src/hooks/use-terminal.ts (169줄) — 위험

| 카테고리   | 평가 항목        | 측정/관찰 값 | 상태 | 비고                      |
| ---------- | ---------------- | ------------ | ---- | ------------------------- |
| 복잡도     | 순환 복잡도 (CC) | 18           | 주의 | 주 useEffect 내 다수 분기 |
| 규모       | 라인 수 (LoC)    | 169          | 주의 | 100줄 이내 권장           |
| 상태       | useRef 개수      | 7            | 위험 | 0-3 건강, >6 위험         |
| 인터페이스 | Options/Return   | 3/3          | 양호 | 명확한 타입 정의          |
| 결합도     | 의존성 수 (DC)   | 6            | 양호 |                           |
| 응집도     | LCOM4 (추정)     | 3            | 위험 | 3개 독립 책임 혼재        |
| 위생       | 훅 의존성 준수   | 위반         | 위험 | initialThemeRef 우회      |

**CRS**: 약 129 (>100 = God Component/Hook)

**LCOM4 분석 — 3개 독립 그룹**:

- **그룹 1**: 터미널 초기화/라이프사이클 (terminalRef, terminalInstanceRef, fitAddonRef)
- **그룹 2**: 콜백 동기화 (onDataRef, writeRef, fitRef)
- **그룹 3**: 테마 관리 (initialThemeRef, terminalTheme)

**주요 문제**:

1. `initialThemeRef` 패턴으로 useEffect 의존성 배열 우회 (React 원칙 위반)
2. 7개 useRef로 과도한 간접 참조
3. 단일 useEffect에 초기화·리사이징·WebGL·이벤트 바인딩 모두 집중

---

### 2.2 src/components/terminal/TerminalPanel.tsx (55줄) — 주의

| 카테고리   | 평가 항목        | 측정/관찰 값 | 상태 | 비고                    |
| ---------- | ---------------- | ------------ | ---- | ----------------------- |
| 복잡도     | 순환 복잡도 (CC) | 7            | 양호 | handleData 내 분기      |
| 규모       | 라인 수 (LoC)    | 55           | 양호 |                         |
| 상태       | useRef 개수      | 2            | 양호 |                         |
| 인터페이스 | Props 개수       | 0            | 양호 |                         |
| 결합도     | 의존성 수 (DC)   | 5            | 양호 |                         |
| 응집도     | LCOM4 (추정)     | 2            | 주의 | UI + 라인버퍼 로직 혼재 |
| 위생       | Zustand 셀렉터   | 준수         | 양호 |                         |

**CRS**: 약 96 (Boundary 상한선)

**LCOM4 분석 — 2개 독립 그룹**:

- **그룹 A**: UI 렌더링 (isReady, cols, rows, terminalRef)
- **그룹 B**: 라인 버퍼 로직 (lineBufferRef, writeRef, handleData)

**주요 문제**: handleData 내 라인 편집 로직이 UI 컴포넌트에 직접 포함됨 → 커스텀 훅으로 분리 필요

---

### 2.3 src/hooks/use-terminal-theme.ts (29줄) — 우수

| 카테고리   | 평가 항목            | 측정/관찰 값 | 상태 | 비고      |
| ---------- | -------------------- | ------------ | ---- | --------- |
| 복잡도     | 순환 복잡도 (CC)     | 3            | 양호 |           |
| 규모       | 라인 수 (LoC)        | 29           | 양호 |           |
| 상태       | State Count          | 0            | 양호 |           |
| 인터페이스 | Return               | ITheme       | 양호 |           |
| 결합도     | 의존성 수 (DC)       | 4            | 양호 |           |
| 응집도     | LCOM4 (추정)         | 1            | 양호 | 단일 책임 |
| 위생       | useSyncExternalStore | 올바른 사용  | 양호 |           |

**CRS**: 약 42 (Atomic 수준) — 모범 사례

---

### 2.4 src/store/terminal-store.ts (43줄) — 양호 (dead state 주의)

| 카테고리   | 평가 항목        | 측정/관찰 값 | 상태 | 비고 |
| ---------- | ---------------- | ------------ | ---- | ---- |
| 복잡도     | 순환 복잡도 (CC) | 0            | 양호 |      |
| 규모       | 라인 수 (LoC)    | 43           | 양호 |      |
| 상태       | State Fields     | 5            | 양호 |      |
| 인터페이스 | API              | 4 setters    | 양호 |      |
| 결합도     | 의존성 수 (DC)   | 2            | 양호 |      |
| 응집도     | LCOM4 (추정)     | 1            | 양호 |      |
| 위생       | devtools         | 적용됨       | 양호 |      |

**CRS**: 약 48 (Atomic)

**주요 문제**: `connectionStatus`/`setConnectionStatus`가 테스트 외 프로덕션 코드에서 미사용 (YAGNI 위반)

---

### 2.5 src/components/terminal/terminal-theme.ts (51줄) — 우수

| 카테고리 | 평가 항목        | 측정/관찰 값 | 상태 | 비고        |
| -------- | ---------------- | ------------ | ---- | ----------- |
| 복잡도   | 순환 복잡도 (CC) | 0            | 양호 | 순수 데이터 |
| 규모     | 라인 수 (LoC)    | 51           | 양호 |             |
| 위생     | 타입 안전성      | ITheme       | 양호 |             |

순수 데이터 구조. 문제 없음.

---

### 2.6 src/lib/terminal-events.ts (28줄) — 삭제 대상

**전체 코드베이스에서 한 번도 import되지 않음.** 4개 인터페이스 + 1개 상수 객체 모두 dead code.

---

### 2.7 src/components/views/SessionsView.tsx (9줄) — 불필요한 래퍼

TerminalPanel 자체가 `flex h-full flex-col`을 가지고 있어 SessionsView의 동일한 래퍼 div가 중복됨.

---

## 3. 수정 계획

### P1: Dead Code 제거

1. `src/lib/terminal-events.ts` 삭제
2. `terminal-store.ts`에서 `connectionStatus` 관련 코드 제거
3. 관련 테스트 업데이트

### P2: TerminalPanel 응집도 개선

1. `handleData`/`lineBufferRef`/`writeRef` → `use-line-buffer.ts` 훅으로 추출
2. TerminalPanel LCOM4: 2 → 1

### P3: use-terminal.ts initialThemeRef 제거

1. `initialThemeRef` 패턴 제거, 직접 테마 사용
2. useEffect 의존성 배열 정직하게 수정

### P4: SessionsView 래퍼 div 제거

1. 중복 `div` 제거하여 직접 `<TerminalPanel />` 반환

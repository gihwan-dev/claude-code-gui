---
name: test
description: 테스트 코드 작성 스킬. "테스트 작성", "브라우저 테스트", "유닛 테스트", "테이블 테스트" 등의 요청 시 사용
argument-hint: 테스트 대상 (예: RowOrdering 브라우저 테스트, cellMergingUtils 유닛 테스트)
---

# Role

당신은 까다로운 기준을 가진 **QA Engineer**입니다. 당신의 목표는 "가장 가성비 높고 신뢰할 수 있는 테스트 스위트"를 작성하는 것입니다. 커버리지 수치가 아닌, **기능이 깨졌을 때 반드시 실패하는 테스트**를 만듭니다.

# 핵심 원칙

1. **Confidence > Coverage** — 테스트는 신뢰를 위해 존재한다. 통과하는데 기능이 깨진 테스트(false positive)는 테스트 없음보다 나쁘다.
2. **Behavior > Implementation** — 사용자가 관찰할 수 있는 행동만 테스트한다. 내부 상태, private 메서드, 프레임워크 동작은 테스트하지 않는다.
3. **한국어 필수** — 모든 `describe`, `it` 문구는 반드시 한국어로 작성한다.

# 워크플로우

## Step 1: 테스트 유형 판별

요청을 분석하여 적절한 테스트 유형을 결정합니다.

| 파일 패턴 | 테스트 유형 | 참조 문서 |
|-----------|-----------|----------|
| `*.browser.test.tsx` | 브라우저 통합 테스트 | `references/browser-testing.md` |
| `*.spec.ts` | 기능/유틸리티 유닛 테스트 | `references/testing-principles.md` |
| `*.test.ts(x)` | jsdom 유닛 테스트 | `references/testing-principles.md` |

## Step 2: 레퍼런스 참조

테스트 유형에 따라 해당 레퍼런스를 읽습니다.

- **브라우저 테스트** → `references/browser-testing.md` 필수 참조
- **유닛/스펙 테스트** → `references/testing-principles.md` 중심
- **Table 컴포넌트 관련** → 위 문서 + `references/table-testing.md` 추가 참조

## Step 3: 기존 코드 파악

1. 테스트 대상 코드를 읽어 동작을 이해합니다.
2. 기존 테스트가 있다면 읽어 패턴과 헬퍼를 파악합니다.
3. (브라우저 테스트) Storybook stories 파일을 읽어 `composeStories`로 사용할 스토리를 파악합니다.
4. (Table 테스트) `TableTester`의 활용 가능한 메서드를 파악합니다.

## Step 4: 테스트 작성

레퍼런스의 패턴에 따라 테스트를 작성합니다.

## Step 5: 검증

아래 체크리스트를 확인합니다.

# 공통 체크리스트

## 작성 전

- [ ] 무엇을 검증하려는지 명확한가? (기능? 엣지케이스? 호환성?)
- [ ] 적절한 테스트 유형을 선택했는가? (browser / spec / test)
- [ ] (브라우저 테스트) 필요한 스토리가 존재하는가? 없다면 스토리를 먼저 작성했는가?

## 작성 후

- [ ] `describe`, `it` 문구가 한국어인가?
- [ ] 테스트 이름만 보고 실패 원인을 파악할 수 있는가?
- [ ] 구현이 아닌 행동을 테스트하고 있는가?
- [ ] 단언(assertion)이 구체적인가? (`toBeTruthy()` 대신 구체적 값 비교)
- [ ] 최소한의 셋업만 사용하고 있는가?
- [ ] 하나의 `it`에 하나의 시나리오만 있는가?

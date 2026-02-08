---
name: milestone-execute
description: 마일스톤 다음 단계 실행. milestone.md의 미완료 Phase를 plan.md 기반으로 구현. "다음 작업", "마일스톤 실행", "Phase 진행" 등의 요청 시 사용
disable-model-invocation: false
argument-hint: "[Phase 번호] (생략 시 다음 미완료 Phase 자동 선택)"
---

# 워크플로우: 마일스톤 Phase 실행

**목표**: `milestone.md`에서 다음 미완료 Phase를 식별하고, `plan.md`의 구현 상세를 참고하여 실제 코드를 구현합니다.

## 1단계: 컨텍스트 로드

프로젝트 루트에서 다음 4개 파일을 읽습니다:

1. `SPEC.md` — 요구사항 (기능/비기능 요구사항, 제약조건, 사용자 시나리오)
2. `milestone.md` — 작업 목록 및 진행 상태
3. `plan.md` — 구현 상세 (아키텍처, 디렉토리 구조, 데이터 흐름 등)
4. `survey.md` — 아키텍처 결정 사항

- SPEC.md가 없으면 `/spec`을 먼저 실행하도록 안내합니다.
- milestone.md가 없으면 `/milestone`을 먼저 실행하도록 안내합니다.
- plan.md가 없으면 `/planner`를 먼저 실행하도록 안내합니다.
- survey.md가 없으면 `/survey`를 먼저 실행하도록 안내합니다.

## 2단계: 대상 Phase 판별

- 인자로 Phase 번호가 주어진 경우: 해당 Phase를 대상으로 선택합니다.
- 인자가 없는 경우: `milestone.md`에서 **첫 번째 미완료(`[ ]`) 항목이 포함된 Phase**를 자동 선택합니다.
- 모든 Phase가 완료된 경우: 사용자에게 "모든 마일스톤이 완료되었습니다"를 알리고 종료합니다.

선택된 Phase와 포함된 작업 항목들을 사용자에게 보여주고 진행 여부를 확인합니다.

## 3단계: 태스크 리스트 생성

해당 Phase의 미완료 체크박스 항목들을 `TaskCreate`로 태스크 리스트에 등록합니다.

- **subject**: 체크박스의 볼드 텍스트 (작업 제목)
- **description**: 해당 항목의 목표, 포함 내용, 검증 기준 + `plan.md`에서 관련 구현 상세
- **activeForm**: 작업 제목의 현재진행형 (예: "조건부 서식 데이터 모델 구현" → "조건부 서식 데이터 모델 구현 중")

이미 완료(`[x]`)된 항목은 건너뜁니다.

## 4단계: 구현 실행 (병렬+순차 하이브리드)

### 4-A: 의존성 분석

Phase의 모든 미완료 태스크를 검토하여 실행 그래프(Layer)를 생성합니다.

**의존 관계 판정 기준:**

| 관계 | 판정 | 근거 |
|------|------|------|
| 같은 파일 수정 | 순차 | 동시 수정 시 충돌 |
| export → import 관계 | 순차 | 선행 타입/함수가 있어야 후행 구현 가능 |
| 다른 디렉토리, 독립 기능 | 병렬 | 충돌 없음 |
| 공통 컨텍스트만 참조 (읽기 전용) | 병렬 | 충돌 없음 |

**Layer 생성 예시:**
```
Layer 1: [Task A, Task B]  ← 독립적, 병렬 실행
Layer 2: [Task C]           ← Task A의 export를 import
Layer 3: [Task D, Task E]  ← Task C 완료 후 독립적, 병렬 실행
```

`TaskUpdate`로 의존 관계를 `addBlockedBy`/`addBlocks`에 등록합니다.

### 4-B: 에이전트 타입 매핑

각 태스크의 성격에 따라 최적의 에이전트를 선택합니다:

| 태스크 성격 | subagent_type | model | 판단 기준 |
|------------|---------------|-------|----------|
| React 컴포넌트 UI 구현 | frontend-developer | sonnet | JSX, 스타일, 이벤트 핸들링 |
| 타입 정의, 제네릭, 유틸리티 타입 | typescript-pro | sonnet | type, interface, 제네릭 제약 |
| API 로직, 비즈니스 로직, 훅 | general-purpose | sonnet | 데이터 처리, 상태 관리 |
| 복잡한 아키텍처 결정 포함 | general-purpose | opus | 설계 판단이 필요한 경우 |
| 보일러플레이트, 설정 파일 | general-purpose | haiku | 단순 반복 작업 |

### 4-C: 병렬+순차 하이브리드 실행

Layer별로 실행합니다:

**Layer 내 (병렬):**
- 독립 태스크들은 Task tool로 동시 실행 (`run_in_background: true`)
- 각 Task sub-agent에게 전달할 정보:
  - 해당 태스크의 description (목표, 구현 상세, 검증 기준)
  - `SPEC.md`, `plan.md`, `survey.md`의 관련 섹션 요약
  - 준수 사항 (CLAUDE.md 패턴, FSD 원칙, 기존 코드 컨벤션)

**Layer 간 (순차):**
- 선행 Layer의 모든 태스크 완료 확인 후 다음 Layer 실행
- 각 Layer 완료 시 중간 검증 실행:
  ```bash
  pnpm typecheck
  ```
- typecheck 실패 시: 오류를 분석하고 수정한 후 다음 Layer로 진행

**단일 태스크 또는 순차 의존만 있는 경우:**
- sub-agent 없이 오케스트레이터가 직접 순차 구현 (기존 방식 유지)

각 태스크 완료 시 `TaskUpdate`로 상태를 `completed`로 변경합니다.

### 구현 시 준수 사항

- `CLAUDE.md`의 아키텍처 패턴 및 디렉토리 구조를 따릅니다.
- FSD 원칙을 준수합니다.
- 기존 코드베이스의 패턴과 컨벤션을 따릅니다.
- 보안 취약점을 도입하지 않습니다.

## 5단계: 검증

각 작업 항목의 "검증" 기준에 따라 검증을 수행합니다.

- `pnpm run typecheck` — 타입 검사
- `pnpm run lint` — 린트 검사
- `pnpm run test:unit` — 관련 단위 테스트 실행 (테스트가 있는 경우)

검증 실패 시:
1. 오류를 분석하고 수정합니다.
2. 수정 후 다시 검증합니다.
3. 반복적으로 실패하면 사용자에게 보고하고 판단을 요청합니다.

## 6단계: 마일스톤 업데이트

모든 작업이 완료되면 `/milestone-update` 스킬을 호출하여:

- 완료된 체크박스를 `[x]`로 업데이트합니다.
- 세션 노트에 구현 요약을 추가합니다.

## 7단계: 결과 보고

실행 결과를 사용자에게 보고합니다:

- 완료된 Phase 번호 및 제목
- 구현된 작업 항목 목록
- 실행 방식 요약 (병렬 Layer 수, 사용된 에이전트 타입)
- 검증 결과
- 다음 미완료 Phase 안내 (있는 경우)

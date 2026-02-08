---
name: issue-start
description: >
  Obsidian 이슈 기반 작업 시작. 이슈를 분석하고 Agent Team으로 검증 후 구현 계획 수립 및 실행.
  "이슈 시작", "이슈 진행", "다음 이슈" 등의 요청 시 사용.
  Requires: CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
disable-model-invocation: false
argument-hint: '[이슈 이름] (생략 시 개발 TODO.md에서 다음 미완료 이슈 자동 선택)'
---

# 워크플로우: Obsidian 이슈 기반 작업 시작

**목표**: Obsidian 이슈 문서를 분석하고, Agent Team으로 검증한 뒤 구현 계획을 수립하여 실행합니다.

**이슈 문서 경로**: `/Users/choegihwan/Documents/Projects/Obsidian-frontend-journey/Project/claude-gui-app/`
**프로젝트 경로**: `/Users/choegihwan/Documents/Projects/claude-code-gui/`

## 1단계: 이슈 선택

`개발 TODO.md`를 읽습니다 (경로: 이슈 문서 경로).

- **인자가 있는 경우**: 해당 이름의 이슈를 선택합니다.
- **인자가 없는 경우**: Phase 순서 + 위치 기준으로 **첫 번째 미완료(`[ ]`) 이슈**를 자동 선택합니다.
  - `[x]`로 체크된 항목은 건너뜁니다.
  - `[[위키링크]]`가 있는 항목을 우선합니다 (상세 이슈 파일이 있으므로).
- 모든 이슈가 완료된 경우: "모든 이슈가 완료되었습니다"를 알리고 종료합니다.

선택된 이슈의 `.md` 파일을 읽습니다 (이슈 문서 경로에서 `[[위키링크 이름]].md`).

## 2단계: 관련 이슈 파악

- 이슈 본문의 `[[위키링크]]`를 추출하여 연결된 이슈 파일을 읽습니다.
- `개발 TODO.md`에서 의존 관계(`> 의존:`)를 확인합니다.
- **완료된 선행 이슈**의 `## 작업 로그` 섹션을 참고하여 맥락을 파악합니다.
  - 어떤 기술 결정이 내려졌는지, 어떤 파일이 생성/수정되었는지 확인

## 3단계: 프로젝트 컨텍스트 로드

프로젝트 루트에서 다음을 읽습니다:

- `AGENTS.md` — 아키텍처 패턴, 개발 규칙
- `CLAUDE.md` — 빌드 명령, 코드 스타일, 핵심 규칙

이슈의 카테고리 태그에 따라 **관련 문서를 선택적으로** 로드합니다:

| 태그                               | 추가 로드 문서                                                       |
| ---------------------------------- | -------------------------------------------------------------------- |
| `#UI` / `#UX`                      | `docs/developer/` 관련 가이드 (state-management, static-analysis 등) |
| `#인프라` / `#CLI연동` / `#시스템` | Rust 관련 문서, `docs/developer/tauri-commands.md`                   |
| 스펙 참조 필요 시                  | `docs/SPEC.md`, `docs/IMPLEMENTATION-SPEC.md` (이슈 문서 경로)       |

## 4단계: Agent Team 동적 구성 및 병렬 분석

`TeamCreate`로 팀을 생성합니다.

이슈 카테고리에 따라 **필요한 팀원만** 동적으로 생성합니다:

| 팀원                   | subagent_type | 생성 조건                      | 역할                                                    |
| ---------------------- | ------------- | ------------------------------ | ------------------------------------------------------- |
| `codebase-researcher`  | Explore       | 항상                           | 기존 코드 탐색, 재사용 가능 요소 식별, 관련 패턴 조사   |
| `issue-reviewer`       | Plan          | 항상                           | 이슈 내용 재검증, 누락 사항/모순 발견, 명확화 질문 도출 |
| `architecture-analyst` | Plan          | `#인프라` `#CLI연동` `#시스템` | 아키텍처 적합성 분석, 설계 방향 제안                    |
| `ux-designer`          | Plan          | `#UI` `#UX`                    | UI/UX 설계, 컴포넌트 구조, 사용자 경험 검토             |
| `rust-analyst`         | Plan          | Rust 관련 이슈                 | Tauri v2 패턴 적합성, Rust 구현 방향                    |

각 팀원에게 전달할 정보:

- 이슈 상세 (선택된 이슈 `.md` 전문)
- 관련 이슈 요약 (선행 이슈의 작업 로그 포함)
- 프로젝트 컨텍스트 (CLAUDE.md, AGENTS.md 핵심 규칙)

**핵심 원칙**: 이슈/문서에 적힌 내용은 **항상 재검증**합니다.

- `issue-reviewer`가 이슈의 가정, 기술적 타당성, 누락 사항을 비판적으로 검증
- `codebase-researcher`가 이슈에서 언급한 기존 코드/패턴이 실제로 존재하는지 확인

## 5단계: 분석 종합 + 사용자 질문

팀 분석 결과를 종합합니다:

- 각 팀원의 핵심 발견사항 요약
- 이슈에서 누락되거나 모호한 부분 정리
- 기술적 리스크 또는 주의사항

확인이 필요한 사항을 `AskUserQuestion`으로 사용자에게 질문합니다:

- 설계 결정이 필요한 부분
- 이슈 재검증에서 발견된 문제
- 구현 방향에 대한 선택지

팀을 셧다운합니다 (`SendMessage` type: `shutdown_request`).

## 6단계: Plan Mode 진입 + 구현 계획 수립

`EnterPlanMode`를 호출합니다.

구현 계획에 포함할 내용:

- 구현 단계 (Layer 기반 병렬+순차 구조)
- 수정/생성할 파일 목록
- 각 단계의 검증 기준
- 팀 분석에서 나온 주의사항 반영

사용자 승인 후 실행으로 진행합니다.

## 7단계: 구현 실행

`TaskCreate`로 태스크를 등록합니다.

**Layer 기반 병렬+순차 하이브리드 실행** (milestone-execute 패턴 참조):

### 의존성 분석

| 관계                             | 판정 | 근거                                   |
| -------------------------------- | ---- | -------------------------------------- |
| 같은 파일 수정                   | 순차 | 동시 수정 시 충돌                      |
| export → import 관계             | 순차 | 선행 타입/함수가 있어야 후행 구현 가능 |
| 다른 디렉토리, 독립 기능         | 병렬 | 충돌 없음                              |
| 공통 컨텍스트만 참조 (읽기 전용) | 병렬 | 충돌 없음                              |

### 에이전트 타입 매핑

| 태스크 성격                      | subagent_type      | model  | 판단 기준                    |
| -------------------------------- | ------------------ | ------ | ---------------------------- |
| React 컴포넌트 UI 구현           | frontend-developer | sonnet | JSX, 스타일, 이벤트 핸들링   |
| 타입 정의, 제네릭, 유틸리티 타입 | typescript-pro     | sonnet | type, interface, 제네릭 제약 |
| API 로직, 비즈니스 로직, 훅      | general-purpose    | sonnet | 데이터 처리, 상태 관리       |
| 복잡한 아키텍처 결정 포함        | general-purpose    | opus   | 설계 판단이 필요한 경우      |
| 보일러플레이트, 설정 파일        | general-purpose    | haiku  | 단순 반복 작업               |

### 실행 방식

- **Layer 내 (병렬)**: 독립 태스크를 Task tool로 동시 실행 (`run_in_background: true`)
- **Layer 간 (순차)**: 선행 Layer 완료 확인 후 다음 Layer 실행
- **중간 검증**: 각 Layer 완료 시 `pnpm typecheck` 실행
- **단일 태스크**: sub-agent 없이 직접 순차 구현

### 구현 시 준수 사항

- `CLAUDE.md`의 아키텍처 패턴 및 디렉토리 구조
- Zustand selector 패턴 (ast-grep 검증)
- React Compiler 활성화 → 수동 useMemo/useCallback 불필요
- i18n: 모든 사용자 대면 문자열은 `/locales/*.json`에 추가
- 보안 취약점 금지

## 8단계: 검증 + 완료 안내

`pnpm check:all`을 실행하여 전체 검증합니다:

- typecheck, lint, ast-grep, format, rust checks, tests

검증 실패 시:

1. 오류를 분석하고 수정합니다.
2. 수정 후 다시 검증합니다.
3. 반복 실패 시 사용자에게 보고합니다.

검증 통과 후:

- 구현 결과 요약 보고 (생성/수정 파일, 기술 결정, 검증 결과)
- `/issue-update` 실행을 안내합니다 (이슈 문서 업데이트 + TODO 체크박스 갱신)

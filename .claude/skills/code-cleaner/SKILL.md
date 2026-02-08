---
name: unused-code-cleaner
description: "AI 코드 생성 후 불필요한 코드 정리 스킬. git diff로 변경된 TS/JS 파일을 분석하여 사용되지 않는 코드를 자동 제거한다. 트리거: unused 코드 정리, 불필요한 코드 삭제, dead code 제거, 코드 클린업, AI 작업 후 정리 요청 시"
---

# Unused Code Cleaner

AI 코드 생성 후 발생하는 불필요한 코드를 자동으로 정리한다.

## 워크플로우

### 1. 변경된 파일 확인

```bash
git diff --name-only HEAD
```

staged 파일 포함 시:
```bash
git diff --name-only HEAD --staged
```

특정 커밋/브랜치 비교 시:
```bash
git diff --name-only <base>..<target>
```

### 2. TS/JS 파일 필터링

확장자 필터: `.ts`, `.tsx`, `.js`, `.jsx`

제외 대상:
- `node_modules/`
- `.d.ts` 파일 (타입 선언)
- 설정 파일 (`*.config.ts`, `*.config.js`)

### 3. 파일별 분석 및 수정 (적응형 병렬화)

**변경 파일 수에 따른 분석 전략:**

#### 2개 이하: 순차 분석 (기존 방식)

각 파일을 직접 읽고 아래 패턴을 찾아 제거합니다.

#### 3개 이상: 병렬 분석 → 순차 수정

**3-A: 병렬 분석**

각 파일의 unused 코드를 Task sub-agent로 동시 탐지합니다:

```
Task call:
  subagent_type: "general-purpose"
  model: "haiku"
  description: "Detect unused code in [파일명]"
  run_in_background: true
  prompt: |
    Analyze the following file for unused code. DO NOT modify any files.
    Only report what you find.

    File to analyze: [파일 경로]

    Check for these patterns:
    1. Unused exports: Run `git diff HEAD -- [파일]` to find newly added exports,
       then search the project for imports of each export name.
    2. Unused functions: Functions defined but never called within the file or project.
    3. Unused types/interfaces: Type declarations not referenced anywhere.
    4. Commented code blocks: Code blocks that are commented out (preserve TODO/FIXME/NOTE comments).
    5. Orphan console.log: Debugging console.log statements.

    For unused exports, verify by searching the project:
    - Check for dynamic imports: import() patterns
    - Check barrel files (index.ts) for re-exports
    - Check if used in test files

    Output a JSON-like report:
    {
      "file": "[파일 경로]",
      "findings": [
        {"type": "unused_export", "name": "...", "line": N, "confidence": "high/medium"},
        {"type": "unused_function", "name": "...", "line": N, "confidence": "high/medium"},
        ...
      ]
    }

    Only report findings with medium or high confidence.
```

모든 파일의 분석 Task가 완료될 때까지 대기합니다.

**3-B: 순차 수정**

오케스트레이터가 모든 분석 결과를 수집한 후:

1. 각 finding을 검토하여 false positive 제거 (특히 cross-file 의존성 확인)
2. confidence가 "high"인 것부터 순차적으로 파일을 수정
3. confidence가 "medium"인 것은 한번 더 확인 후 수정

**수정은 반드시 오케스트레이터가 직접 수행합니다** (sub-agent의 동시 파일 수정 방지).

#### 제거 대상 (lint/TS로 못 잡는 것들)

| 패턴 | 설명 |
|------|------|
| Unused exports | 새로 추가된 export 중 프로젝트 어디서도 import 안 되는 것 |
| Unused functions | 정의 후 호출되지 않는 함수 |
| Unused types/interfaces | 참조되지 않는 타입 선언 |
| Commented code blocks | 주석 처리된 코드 블록 (설명 주석은 유지) |
| Orphan console.log | 디버깅용으로 추가된 console.log |

#### Unused Export 탐지 방법

1. `git diff`로 새로 추가된 export 식별:
```bash
git diff HEAD -- <file> | grep "^+" | grep -E "export (const|function|class|type|interface|enum)"
```

2. 프로젝트 전체에서 해당 export가 import되는지 확인:
```bash
grep -r --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" "import.*<export_name>.*from" .
grep -r --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" "{ <export_name>" .
```

3. 어디서도 import 안 되면 삭제

#### 주의사항

- 동적 import (`import()`)로 사용될 수 있으므로 해당 패턴도 검색
- barrel file (index.ts)에서 re-export되는 경우 추적
- 주석 중 TODO, FIXME, NOTE, 설명 주석은 유지

### 4. 수정 적용

파일 수정 후 변경 사항 요약 출력:
- 제거된 import 수
- 제거된 변수/함수 수
- 제거된 코드 라인 수
- (병렬 분석 시) 분석 방식 요약: 파일 수, 병렬 에이전트 수

## 사용 예시

```
사용자: 방금 작업한 코드 unused 정리해줘
사용자: git diff 보고 불필요한 코드 삭제해
사용자: dead code 클린업
```

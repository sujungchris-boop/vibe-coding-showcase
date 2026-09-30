# DECISIONS — 아키텍처 결정 기록 (ADR)

> 코드만 봐서는 알 수 없는 "왜"를 기록한다. 새 결정이 생기면 ADR을 추가하고, 뒤집으면 Status를 Deprecated로 바꾸고 새 ADR을 만든다.
> (ADR-001~010은 2026-06~07 개발 세션들의 결정을 이관 시점(2026-09-30)에 소급 기록한 것)

## ADR-001: 순수 HTML/CSS/JS, 무빌드
**Status:** Accepted
**Decision:** 번들러·프레임워크·npm 의존성 없이 순수 웹 기술만 사용. 페이지당 HTML 1파일 + 공유 모듈 3개(utils/styles/firebase).
**Reason:** 고등학생·교사가 코드를 직접 열어 이해할 수 있어야 하고, 어떤 머신에서도 `npx serve` 하나로 실행돼야 함. 학생 작품(단일 HTML)과 같은 기술 세계관 유지.
**Implication:** React/Vite 등 도입 금지. 복잡도는 모듈 분리와 관례로 해결.

## ADR-002: 클라이언트 전용 인증 + 열린 Firestore 규칙
**Status:** Accepted (한계 인지한 채 의도적)
**Decision:** 백엔드 인증 없이 SHA-256 해시 비번(클라 검증). Firestore 규칙은 입력 검증만, 접근 제어 없음. 관리자 코드 소스 하드코딩.
**Reason:** 교실 내부용 소규모 서비스 — Firebase Auth 도입 비용 대비 위험 수용 가능 판단. 단 비밀번호 평문 저장만은 금지(학생들이 타 서비스와 같은 비번을 쓸 수 있음).
**Implication:** 공개 인터넷에 노출된 상태로 민감 데이터를 넣지 말 것. 규모·공개도가 커지면 Firebase Auth 도입(ROADMAP Later).

## ADR-003: 작품은 Firestore, 레포는 플랫폼 코드
**Status:** Accepted
**Decision:** 학생 작품(콘텐츠)은 git이 아니라 Firestore에 산다. 예외: `flame-of-gospel.html`(소유자 명의 대표 시연작)만 레포에 트래킹.
**Reason:** 작품은 학생이 UI로 계속 갱신하는 데이터이지 코드 리뷰 대상이 아님. 버전 관리도 Firestore `versions` 서브컬렉션이 담당.
**Implication:** 에이전트가 작품을 수정/복구할 땐 Firestore(REST 또는 admin UI 롤백)로 작업. 레포 clone만으로는 작품 데이터가 없음을 전제할 것.

## ADR-004: Claude 채택, Haiku 기본 + 신호 기반 라우터
**Status:** Accepted
**Decision:** 스튜디오 LLM을 Gemini Flash에서 Claude로 전환(Haiku 4.5 기본, 무거운 작업·전면 재작성 신호만 Sonnet 4.6). 프로바이더 추상화(`LLM_PROVIDER`)는 유지.
**Reason:** 코드 생성 품질·한국어 자연스러움(아이 대상 코칭 톤)이 결정 기준. Haiku가 가성비 최적, Sonnet은 3배 단가라 필요할 때만.
**Implication:** '컨텍스트가 크면 Sonnet 승급' 규칙은 **금지** — 부분 수정 도입 후 큰 작품의 사소한 수정까지 3배 단가로 가던 실제 비용 사고($18/3일)의 원인이었음. 라우터 변경 시 admin 사용량으로 비용 영향 확인.

## ADR-005: 부분 수정(````edit` SEARCH/REPLACE) 프로토콜
**Status:** Accepted
**Decision:** 기존 작품 수정 시 전체 파일 재생성 대신 수정 블록만 출력·적용. all-or-nothing 적용 + 공백 유연 매칭.
**Reason:** 전체 재생성 구조에선 `max_tokens`가 작품 크기의 상한이 됨 — 학생 작품이 커지자(80KB+) 생성이 잘려 작품이 파손되는 실사고 발생. 부분 수정으로 크기 상한 제거 + 출력 토큰 수십 배 절감(81KB 작품 수정 실측: 출력 75토큰).
**Implication:** SYSTEM_PROMPT의 프로토콜 정의와 `extractEdits`/`applyEdits` 파서는 한 몸 — 한쪽만 바꾸면 안 됨. 프로토콜 준수율은 모델 의존적이므로 모델 교체 시 재검증 필수.

## ADR-006: append-only 히스토리 + 프롬프트 캐싱
**Status:** Accepted
**Decision:** 스튜디오 대화 히스토리를 원문 그대로 append-only로 유지하고, 서버가 system+마지막 메시지에 `cache_control`을 걸어 프리픽스 캐시 히트를 만든다. 작품 코드 전문은 히스토리에 한 번만.
**Reason:** 기존 구조(매 턴 코드 전체 재주입)는 턴당 수만 입력 토큰 정가 과금 — 실측 호출당 $0.16. 캐싱 구조로 $0.02(8배 절감), 신규 정가 입력은 턴당 수 토큰.
**Implication:** **히스토리 중간 수정 금지**(캐시 전멸). 컴팩션(32개/220K자)과 SEARCH 불일치 리셋만이 허용된 재구성 지점. Anthropic 외 프로바이더는 캐싱 방식이 다르므로 이 구조를 전제로 이식하지 말 것.

## ADR-007: 작품 버전 히스토리 + 관리자 롤백
**Status:** Accepted
**Decision:** 모든 작품 업데이트 직전 상태를 `works/{id}/versions/{n}`에 자동 보관, admin에서 원클릭 롤백(복원도 새 버전으로).
**Reason:** 실사고 — 학생이 잘린 코드를 저장해 작품이 파손됐는데 이전 버전이 어디에도 없어 복구 불가였음(엔진 절반을 재구성으로 살림). 재발 방지.
**Implication:** 업데이트 경로를 새로 만들면 반드시 `archiveWorkVersion` 호출을 포함할 것. 보관 실패가 저장을 막으면 안 됨(경고만).

## ADR-008: 잘림 감지는 형식이 아니라 완성 기준
**Status:** Accepted
**Decision:** 응답 잘림 판정을 "닫는 펜스 유무"가 아니라 "내용 완결"(`</html>` 종결, `REPLACE` 종결)로 한다. 구분자 변형은 유연 허용.
**Reason:** 실사고 — 모델(Haiku)이 긴 출력에서 닫는 펜스를 자주 생략·구분자를 변형하는데, 형식 기준 감지가 **완성된 응답을 계속 "잘렸다"고 오탐**해 학생 작업이 막혔음(로그로 스트림 완주 확인됨).
**Implication:** 파서 수정 시 오탐/진짜잘림 양쪽 회귀 케이스 필수. `stopReason` 로깅으로 사후 판별 가능.

## ADR-009: GLM/Kimi 등 저가 모델 전환 보류
**Status:** Accepted (조건부 재검토)
**Decision:** 2026-07 검토 결과 전환하지 않음.
**Reason:** ① 캐싱 적용 후 실효 단가에서 이점이 작음(스티커 가격 ≠ 실효 가격) ② 부분 수정 프로토콜 준수율 재검증 비용 ③ 아이 대상 한국어 코칭 톤은 Claude 강점 ④ 학생 데이터의 중국계 API 전송은 학교 맥락에서 부적절.
**Implication:** 재검토 트리거: 월 비용이 실질 부담이 되고, 일일 상한 등 다른 수단을 소진했을 때. 전환 시 반드시 병행 테스트로 프로토콜·톤 검증.

## ADR-010: 학생 개인정보는 레포 밖
**Status:** Accepted
**Decision:** 성적·평가·개인 식별 정보는 git에 절대 커밋하지 않는다. 소유자 로컬(예: Downloads)에만 보관.
**Reason:** 레포가 공개·반공개 환경(클라우드 에이전트, CI, 협업자)으로 흐르는 것을 전제하는 GitHub-first 구조에서 미성년 학생 정보 보호는 절대 조건.
**Implication:** 성적 관련 작업은 소유자가 파일을 제공할 때만, 산출물도 로컬에만. 에이전트는 평가 관련 파일을 커밋 후보에서 항상 제외.

## ADR-011: GitHub-first / agent-agnostic 프로젝트 메모리
**Status:** Accepted (2026-09-30)
**Decision:** GitHub 레포를 canonical state로 삼고, 프로젝트 컨텍스트를 `AGENTS.md` + `docs/`(ARCHITECTURE·DECISIONS·ROADMAP·HANDOFF)로 버전 관리한다. `CLAUDE.md`는 Claude 환경 특이사항만 남기고 공통 문서를 참조한다.
**Reason:** 특정 모델·에이전트·머신·세션에 종속되지 않고 어디서든 이어서 개발 가능해야 함. 대화 히스토리는 소멸하지만 레포는 남는다.
**Implication:** 세션 종료 시 HANDOFF 갱신이 프로토콜의 일부. 에이전트별 지식 분화 금지 — 공통 정보는 공통 문서로.

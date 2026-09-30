# HANDOFF — 현재 작업 상태 인수인계

> 에이전트 간 operational memory. 의미 있는 세션이 끝날 때마다 갱신한다 (작업 일기가 아니라 "다음에 무엇을"이 중심).
> 오래 유지될 정보는 AGENTS/ARCHITECTURE/DECISIONS로 옮길 것.

## Current Handoff
- **Last updated:** 2026-09-30
- **Last agent:** Claude Code local (macOS, Fable 5)
- **Branch:** `main` (origin과 동기화됨)
- **Latest relevant commit:** GitHub-first 문서 구조 이관 커밋 (이 커밋) — 직전 기능 커밋은 `280c94b`(잘림 오탐 수정, 2026-07-13)

## Current State
- 플랫폼 안정 운영 중, 라이브 정상(HTTP 200): https://vibe-coding-showcase-ten.vercel.app
- **학기 사이 휴지기** — 마지막 학생 활동·AI 호출 2026-07-13. 학생 9명, 작품 13개(+시연작).
- 2026-07-25 학기 성적 평가 완료·제출(파일은 소유자 로컬 전용, ADR-010).
- 2026-09-30 GitHub-first/agent-agnostic 문서 구조로 이관 (ADR-011). 코드 변경 없음.

## Recently Completed (기능 기준 최근순)
1. 잘림 오탐 수정 — 완성 기준 판정 + `stopReason` 로깅 (`280c94b`, ADR-008)
2. 토큰 비용 8배 절감 — 프롬프트 캐싱 + 신호 기반 라우터 (`b780ef6`, ADR-006)
3. 부분 수정 프로토콜 — 작품 크기 상한 제거 (`53137f4`, ADR-005)
4. 작품 버전 히스토리 + admin 롤백 (`ec24b99`, ADR-007)

## In Progress
- 없음. 미완/중단된 작업 없음, uncommitted 변경 없음.

## Next Recommended Task
- 새 학기 시작 시: admin 사용량에서 비용 추세 확인(Haiku+캐시읽기 위주인지) → 부담되면 **학생별 일일 상한** 구현(ROADMAP Next).
- 학생 커뮤니티 이슈 보고("잘렸다"/"수정이 안 된다") 시: `usage.stopReason`·모델 분포부터 진단 (ARCHITECTURE의 스튜디오 파이프라인 참고).

## Important Context
- 작품 데이터는 레포에 없다(Firestore가 원본, ADR-003) — clone만으로 갤러리가 비어 보이는 게 아니라, 라이브 Firestore를 그대로 읽는다.
- 스튜디오 히스토리는 append-only가 불변 조건(ADR-006). SYSTEM_PROMPT와 클라이언트 파서는 한 몸(ADR-005).
- 성적·학생 개인정보 작업은 소유자가 파일을 줄 때만, 결과물도 로컬에만(ADR-010).

## Known Issues / Watchlist
- 클라이언트 전용 보안 한계(의도적, ADR-002) — 규칙이 열려 있어 악의적 삭제 가능. 사고 시 Firebase Auth 도입 논의.
- 레이트리밋은 인메모리 베스트에포트(콜드스타트·다중 인스턴스에서 불완전).
- 작품 iframe sandbox에서 localStorage 예외(ARCHITECTURE 참고) — 작품이 저장 기능을 쓰면 안내 필요.
- admin 추정 비용은 요율표(`TOKEN_RATES`) 기준 — 단가 변동 시 갱신 필요.

## Relevant Files
- 지침: `AGENTS.md` · 구조: `docs/ARCHITECTURE.md` · 이유: `docs/DECISIONS.md` · 방향: `docs/ROADMAP.md`
- 학생 작품 제작 제약: `PLATFORM.md`
- 핵심 코드: `api/generate.js`(LLM 파이프라인) · `studio.html`(스튜디오 클라) · `utils.js`(파서) · `firebase.js`(버전 보관)

## Validation Status
- 2026-09-30 확인: `node --check`(utils/api/firebase) 통과 · 라이브 200 · Firestore 접근 정상 · git clean(main=origin/main).
- 자동 테스트/CI 없음(수동 검증 체계 — AGENTS.md Validation 절 참고). CI 스모크는 ROADMAP Later.

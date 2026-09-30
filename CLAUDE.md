# CLAUDE.md — Claude Code 환경 노트

> **프로젝트의 공통 지침·컨텍스트는 이 파일이 아니라 공유 문서에 있다.** 의미 있는 작업 전에 반드시:
> 1. **`AGENTS.md`** — 모든 에이전트 공통 1차 지침 (스택·구조·원칙·제약·검증·세션 프로토콜)
> 2. **`docs/HANDOFF.md`** — 지금 어디까지 왔고 다음에 무엇을 하는가
> 3. 필요 시 `docs/ARCHITECTURE.md`(구조) · `docs/DECISIONS.md`(결정 이유) · `docs/ROADMAP.md`(방향) · `PLATFORM.md`(학생 작품 제약)
>
> AGENTS.md와 docs/가 canonical shared context다. 여기에는 **Claude Code 환경에서만 해당하는 것**만 남긴다.

## Claude Code 전용 노트
- **로컬 미리보기**: `.claude/launch.json`의 `showcase` 설정(`npx serve`, 포트 8899)을 preview 도구로 실행. Bash로 서버를 직접 띄우지 말 것.
- **미리보기 패널은 hidden 탭** — `requestAnimationFrame`이 발화하지 않아 rAF 기반 애니메이션·게임이 멈춘 것처럼 보인다. 검증 요령은 AGENTS.md Validation 절(전역 함수 수동 구동) 참고. 플랫폼 코드에서 스크린샷 검증이 필요한 애니메이션은 `setInterval` 구동을 고려.
- **임시 파일은 세션 scratchpad 디렉터리에** — 프로젝트 루트를 더럽히지 말 것 (검증 스크립트·중간 산출물 등).
- **auto-memory와의 관계**: Claude 로컬 세션의 메모리 파일은 이 머신에만 있다. 프로젝트 지식은 반드시 레포 문서(AGENTS/docs)에 남겨야 다른 환경·에이전트가 이어받는다 — 메모리에는 레포에 못 넣는 것(개인 선호 등)만.
- 커밋 메시지 attribution은 시스템 안내를 따른다.

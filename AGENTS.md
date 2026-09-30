# AGENTS.md — 바이브코딩 쇼케이스 공통 에이전트 지침

> **모든 coding agent(Claude Code, Codex, 기타)·모든 머신·모든 세션의 1차 지침서.**
> GitHub repository가 이 프로젝트의 canonical state다. 어떤 로컬 머신도, 어떤 AI 대화도 primary가 아니다.
> 작업 전 필독: 이 파일 → `docs/HANDOFF.md`(현재 상태) → 필요 시 `docs/ARCHITECTURE.md`·`docs/DECISIONS.md`·`docs/ROADMAP.md`.

## Project Overview
커버넌트 하이스쿨 학생들이 AI 활용 수업("바이브코딩")에서 만든 결과물을 아카이빙·전시하는 웹사이트.
학생들은 어린이 주일학교(KIDS)용 게이미피케이션 교구를 AI와 함께 제작한다.
- 소유자: 나 국장 (sujungchris@gmail.com) — 교사이자 프로덕트 오너.
- 현재 단계: 한 학기 운영 완료(학생 9명·작품 13개), 안정 운영 중. 상세는 `docs/HANDOFF.md`.

## Technology Stack
- **순수 HTML/CSS/JS** — 빌드 도구·프레임워크·npm 의존성 없음. 각 페이지는 `<script type="module">`.
- **Vercel**: 정적 호스팅 + 서버리스 함수 1개(`api/generate.js`, CommonJS, Node 내장 fetch). `main` push = 자동 배포.
- **Firebase Firestore**(데이터) + **Storage**(프로필 사진). 클라이언트에서 직접 접근(백엔드 없음).
- **LLM**: Anthropic Claude (Haiku 4.5 기본, 라우터로 Sonnet 4.6 승급). Gemini 폴백 경로 있음.
- 라이브: https://vibe-coding-showcase-ten.vercel.app · GitHub: https://github.com/sujungchris-boop/vibe-coding-showcase

## Repository Structure
| 경로 | 역할 |
|------|------|
| `index.html` | 전시 메인 — 작품 갤러리 + 학생 필터 |
| `work.html` | 작품 상세 (`?id=`) — 미리보기 + 반응(❤️⭐👏) + 댓글 |
| `student.html` | 학생 프로필 (`?name=`) |
| `submit.html` | 학생 제출/관리 — 비번 인증, 작품 추가·업데이트·삭제, 프로필 사진 |
| `studio.html` | **AI 스튜디오** — 채팅→생성→라이브 미리보기→반복 수정→게시. 부분 수정 프로토콜·디자인씽킹 단계 띠 |
| `admin.html` | 관리자 — 학생/작품/댓글 관리, AI 사용량·비용, **작품 버전 기록·롤백** |
| `api/generate.js` | 서버리스 LLM 프록시 — 키 은닉, 프로바이더 추상화, 모델 라우터, 프롬프트 캐싱, 레이트리밋 |
| `utils.js` | 공통 함수 (escape/buildSrcdoc/해시/extractHtml/extractEdits/applyEdits 등) |
| `styles.css` | 공유 디자인 토큰·컴포넌트. 페이지별 override는 각 페이지 인라인 `:root` |
| `firebase.js` | Firebase 초기화(`app`/`db`) + `archiveWorkVersion` export |
| `firebase-config.js` | Firebase 공개 설정값 (시크릿 아님) |
| `flame-of-gospel.html` | 대표 시연작 "복음의 불길" — 플랫폼 코드가 아니라 **작품 콘텐츠** (Firestore에도 게시됨) |
| `PLATFORM.md` | **학생 작품 기획·제작 제약 가이드** (단일 HTML·CDN·크기 한도) — 작품/기획 작업 시 필독 |
| `docs/` | ARCHITECTURE·DECISIONS·ROADMAP·HANDOFF (공유 프로젝트 메모리) |
| `.claude/launch.json` | 로컬 미리보기 서버 정의 (`npx serve`, 포트 8899) |

## Architecture Principles (지켜야 할 것)
1. **무빌드 순수 웹** — 번들러·프레임워크·npm 의존성을 도입하지 않는다 (ADR-001).
2. **학생 작품 = 자체 완결형 HTML 1파일**, `iframe sandbox="allow-scripts" srcdoc` 렌더. 레거시(html/css/js 분리형)와 100% 호환 유지.
3. **공통 코드는 한 곳에서** — 함수 `utils.js`, 스타일 `styles.css`, Firebase 초기화 `firebase.js`. 중복 금지.
4. **데이터의 원본은 Firestore** — 작품·학생·댓글·사용량은 레포가 아니라 DB에 산다 (ADR-003).
5. 스튜디오 히스토리는 **append-only** — 중간 수정 시 프롬프트 캐시 전체 미스 (ADR-006). 상세: `docs/ARCHITECTURE.md`.

## Development Principles
- **주도적 PO 모드**: 소유자가 방향만 주면 구현→검증→커밋→푸시→배포 확인까지 완주. 되돌릴 수 있는 일은 묻지 말고 진행, 파괴적/대외적 결정만 확인.
- **디자인 언어**: 사이트는 아기자기 파스텔(Jua/Gaegu 폰트, 핑크 계열). 학생 작품 자체는 고유 미감 존중.
- **한국어 우선**: UI 문구·커밋 외 문서·학생 대면 텍스트는 한국어.
- 플랫폼 기능을 바꾸면 **`api/generate.js`의 `SYSTEM_PROMPT`도 같이 갱신** (스튜디오 AI가 화면/기능을 잘못 안내하지 않게). 디자인씽킹 단계를 바꾸면 SYSTEM_PROMPT와 `studio.html`(단계 띠·`DT_STARTERS`) **둘 다** 갱신.

## Critical Constraints (깨뜨리면 사고)
- **페이지 간 링크는 `work?id=` 형태** (`work.html?id=` 금지) — `npx serve`·Vercel cleanUrls가 `.html`을 뗀다.
- **인라인 `<script>` 안에 literal `</script>` 금지** — 파서가 모듈을 그 지점에서 끊는다 (실제 프로덕션 장애 있었음). 주석·문자열 안이라도 `<\/script>`로 이스케이프.
- **학생 개인정보(성적·평가·연락처)는 레포에 절대 커밋 금지** (ADR-010). 시크릿(API 키)도 금지 — Vercel env로만.
- **Firestore `usage`·`works` 등의 스키마 필드를 제거·개명하지 말 것** — admin 집계·레거시 작품 호환이 깨진다. 추가는 자유.
- 스튜디오 부분 수정 프로토콜(````edit` SEARCH/REPLACE)·캐싱 구조를 바꿀 땐 `docs/ARCHITECTURE.md`의 불변 조건 먼저 확인.
- destructive git 금지: `reset --hard`·force push·히스토리 변경 없음. 소유자 명시 요청 시에만.

## Sources of Truth
| 영역 | 원본 |
|---|---|
| 코드·문서·프로젝트 컨텍스트 | **GitHub `main`** |
| 학생·작품·댓글·AI 사용량 데이터 | **Firestore** (`covenant-high-school-vibe`) — 레포에 없음 |
| 시크릿 (LLM API 키) | **Vercel 환경변수** — 어디에도 커밋 안 됨 |
| Firestore/Storage 보안 규칙 | 레포 `docs/ARCHITECTURE.md`의 규칙 블록 = 정본. 변경 시 문서 갱신 + Firebase Console에 수동 게시 |
| 학생 성적·평가 자료 | 소유자 로컬 전용 (레포·클라우드 밖). 필요 시 소유자에게 요청 |

## Environment
- 런타임: **Node.js**(버전 민감하지 않음, `npx` 사용 가능하면 됨) + `git`. **`npm install` 불필요** — 의존성 없음.
- 로컬 미리보기: `npx serve . -p 8899 --no-clipboard` (또는 `.claude/launch.json`의 `showcase`). 정적 페이지만 서빙 — **서버리스 함수는 로컬 serve로 안 돈다** (함수 검증은 배포 후 라이브에서, 또는 `vercel dev`).
- Vercel 환경변수(이름만 기록, 값은 Vercel Settings에): `LLM_PROVIDER`(기본 gemini, 현재 운영은 `claude`), `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`(비우면 라우터 자동), `GEMINI_API_KEY`, `GEMINI_MODEL`. 템플릿: `.env.example`.
- 배포: `git push origin main` → Vercel 자동 배포(~1분). 별도 배포 명령 없음.

## Validation (테스트 프레임워크 없음 — 수동+스크립트 검증)
- JS 문법: `node --check utils.js api/generate.js firebase.js`
- 로컬 스모크: `npx serve` 후 각 페이지 로드 + **브라우저 콘솔 에러 0** 확인.
- 라이브 스모크: 배포 후 `curl -s -o /dev/null -w "%{http_code}" https://vibe-coding-showcase-ten.vercel.app/` = 200, 갤러리에 작품 렌더 확인.
- 함수(e2e): 배포 후 `POST /api/generate`에 실제 메시지로 스트림 확인 (과거 검증 스크립트 패턴은 git log의 커밋 메시지 참고).
- **검증 원칙**: 요소 존재가 아니라 **실제 동작**(클릭→상태 변화)으로 검증. 게임류는 정적 HUD 텍스트에 속지 말 것. 헤드리스/숨김 탭에선 `requestAnimationFrame`이 발화하지 않으므로, 전역 함수를 수동 호출(`for(...) updateGame()`)해 상태 변화를 단언.
- utils의 파서(extractHtml/extractEdits/applyEdits)를 만지면 **단위 케이스로 회귀 확인** (정상·잘림·펜스 누락·구분자 변형 — 과거 오탐 사고 있었음, ADR-008).

## Agent Session Protocol
**시작 시:** ① `git status`·branch·`git fetch`로 원격과의 차이 확인(divergence 있으면 임의 해결 금지, 먼저 분석) ② 이 파일 → `docs/HANDOFF.md` → 관련 ARCHITECTURE/DECISIONS ③ `git log --oneline -10`으로 최근 흐름 파악 ④ 작업 시작.
**종료 시:** ① 변경 검토 + 가능한 검증 실행 ② 중요한 결정이 생겼으면 `docs/DECISIONS.md`에 ADR 추가 ③ 로드맵이 실질 변경되면 `docs/ROADMAP.md` 갱신 ④ **`docs/HANDOFF.md`를 최신 상태로 갱신** ⑤ logical commit 단위로 정리해 push ⑥ push 안 된 변경이 남으면 명확히 보고.
사소한 변경마다 모든 문서를 기계적으로 갱신하지 말 것 — 다음 에이전트가 알아야 할 상태 변화가 있을 때만.

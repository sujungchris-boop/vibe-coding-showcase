# 바이브코딩 쇼케이스 (Vibe Coding Showcase)

커버넌트 하이스쿨 학생들이 AI(클로드) 활용 수업에서 만든 결과물을 아카이빙·전시하는 웹사이트.
학생들은 어린이 주일학교(KIDS)를 위한 게이미피케이션 교구를 바이브코딩으로 제작한다.

## 스택 & 배포
- **순수 HTML/CSS/JS** (빌드 도구 없음, 프레임워크 없음). 각 페이지는 `<script type="module">`.
- **Vercel 서버리스 함수** — `api/generate.js` 한 개 (AI 스튜디오용 LLM 호출). 정적 사이트 + 함수 하이브리드.
- **Firebase Firestore** — 실시간 데이터 저장 (`works`, `students`, `comments`, `usage` 컬렉션)
- **Firebase Storage** — 프로필 사진 (`profiles/` 경로)
- **배포:** Vercel (GitHub `main` push 시 자동 배포) → https://vibe-coding-showcase-ten.vercel.app
- **GitHub:** https://github.com/sujungchris-boop/vibe-coding-showcase
- **로컬 실행:** `.claude/launch.json`의 `showcase` 설정 (`npx serve`, 포트 8899)

> ⚠️ `npx serve`는 `.html` 확장자를 떼고 쿼리스트링을 날리므로, 페이지 간 링크는
> `work.html?id=` 가 아니라 **`work?id=`** 형태로 작성한다 (student도 동일).

## 페이지 구조
| 파일 | 역할 |
|------|------|
| `index.html` | 전시회 메인. 작품 갤러리 + 학생별 필터. 카드 클릭 → `work` |
| `work.html` | 작품 상세. 전체화면 미리보기 + 댓글(피드백). `?id=` |
| `student.html` | 학생 프로필. 해당 학생의 작품 모음. `?name=` |
| `submit.html` | 학생 제출 페이지. 비밀번호 인증 → 작품 추가/업데이트/삭제, 프로필 사진 |
| `studio.html` | **AI 스튜디오.** 채팅으로 AI에게 통짜 HTML 생성 요청 → 라이브 프리뷰 → 반복 수정 → `게시하기`(이름+비번 인증)로 `works`에 `fullHtml` 저장. **디자인씽킹 단계 띠**(공감→발상→만들기→개선)·SSE 스트리밍 응답·코드 보기/다운로드 포함 |
| `admin.html` | 관리자. 학생/작품/댓글 관리 + 삭제 + 통계 + **AI 사용량(토큰/추정비용)** |
| `api/generate.js` | **Vercel 서버리스 함수.** API 키를 숨기고 LLM 호출. 프로바이더 추상화(기본 Gemini, env로 Claude 교체) |
| `utils.js` | **공통 함수 모듈** — escapeHtml/escapeAttr/buildSrcdoc/nameToColor/formatDate/해시/showToast |
| `styles.css` | **공유 CSS** — 리셋·공통 디자인토큰(`:root`)·토스트·스크롤바. 페이지별로 다른 토큰은 각 페이지 인라인 `<style>`의 `:root`에서 override (styles.css를 먼저 로드하므로 인라인이 이김) |
| `firebase.js` | **Firebase 초기화** — `app`/`db`를 한 곳에서 생성해 export. 각 페이지는 `import { db } from './firebase.js'` (Firestore 함수는 CDN에서 직접 import, Storage는 submit만 `app`으로) |
| `firebase-config.js` | Firebase 설정값 (프로젝트: covenant-high-school-vibe). `firebase.js`에서만 import |

## 데이터 모델
- `works/{id}`: `studentName, title, description, fullHtml, html, css, js, version(숫자), createdAt, updatedAt`
  - **입력 방식 2가지** (submit.html 모드 토글): ① `fullHtml`(통짜 HTML 한 파일, 기본·추천) ② `html`/`css`/`js` 분리.
    한쪽 모드로 저장하면 반대편 필드는 빈 문자열로 둔다. 렌더는 `buildSrcdoc`(utils.js)이
    `fullHtml`이 있으면 그대로, 없으면 html/css/js 조합으로 처리 → **레거시 작품 100% 호환**.
  - 같은 작품을 **업데이트하면 version 증가** (v1 → v2 …). 새 작품은 별도 문서.
  - 레거시 `round` 필드("1차" 등)가 일부 남아있을 수 있음 — 신규는 version 사용.
- `students/{이름}`: `name, password(SHA-256 해시), photoURL?, createdAt`
- `comments/{id}`: `workId, author, content, createdAt`
- `usage/{id}`: `model, inputTokens, outputTokens, totalTokens, createdAt` — AI 스튜디오 호출 1건당 1문서.
  studio.html이 응답받은 토큰 수를 클라에서 기록. admin.html이 모델별 집계·추정비용 표시(요율표 `TOKEN_RATES`).

## AI 스튜디오 / 서버리스 함수 (`api/generate.js`)
- 정적 사이트에 Vercel 함수 1개를 더한 구조. 의존성 없이 Node 내장 `fetch`로 LLM API 직접 호출(CommonJS `module.exports`).
- **프로바이더 추상화** — 환경변수 `LLM_PROVIDER`로 분기 (`gemini` 기본 | `claude`).
- **Vercel 환경변수** (Settings → Environment Variables, 깃/코드에 키 절대 금지):
  - `LLM_PROVIDER` (선택, 기본 `gemini`)
  - `GEMINI_API_KEY` + `GEMINI_MODEL`(기본 `gemini-2.5-flash`)
  - `ANTHROPIC_API_KEY` + `CLAUDE_MODEL`(선택 — 설정 시 그 모델로 고정. **비우면 라우터가 Haiku⇄Sonnet 자동 선택**)
- **레이트리밋**: `/api/generate`는 로그인 없이 호출 가능하므로 IP당 분당 호출 상한(인메모리, 기본 12/분)으로 비용 남용을 1차 방어. 강한 보장은 Vercel KV/Firestore 카운터로 확장.
- **스튜디오 히스토리 트리밍**: studio.html이 매 턴 후 과거 버전의 통짜 HTML을 비우고 최신 1개만 유지 → 대화가 길어져도 입력 토큰이 누적되지 않음.
- **생성 크기 한도**: 스튜디오는 매 수정마다 파일 전체를 재생성하므로 `max_tokens`(현재 **32768** ≈ 코드 ~100KB)가 한 작품 "한 번 생성"의 상한. 스트리밍이라 크게 잡을 수 있음(Sonnet/Haiku 최대 64K). 최종 저장 상한은 Firestore `fullHtml` <500KB → **큰 작품은 단계별로.** 제작 가이드: `PLATFORM.md`.
- **모델 라우터** (`pickClaudeModel`, api/generate.js): Claude 사용 시 기본 Haiku, 무거운 작업 신호(3D·물리·게임엔진·시뮬·셰이더·멀티플레이) 또는 큰 작업물(누적 >14KB)이면 Sonnet으로 자동 승급 → 가성비 유지하며 복잡한 것만 고품질. `CLAUDE_MODEL` 설정 시 라우팅 끔(고정). admin "AI 사용량"에서 모델별 분포 확인 가능.
- 요청 `POST /api/generate { messages:[{role,content}] }` → 응답 `{ reply, html, usage }` (`reply`=대화 텍스트, `html`=추출된 통짜 결과물, 없으면 `''`).
- **`SYSTEM_PROMPT`**(api/generate.js 상단)는 "자유로운 범용 AI"로 두되 플랫폼 배경(쇼케이스/학생/어린이 교구)·스튜디오 흐름·게시 버튼 동작·코드 환경 제약(통짜 HTML·CDN만)을 알려준다. `extractHtml`이 ```html 코드블록만 결과물로 분리하고 나머지는 대화로 처리(티키타카).
  - ⭐ **플랫폼 기능을 바꾸면 `SYSTEM_PROMPT`도 같이 갱신한다** — AI가 화면/기능을 잘못 안내하지 않도록 (예: 게시 버튼·새 페이지·새 흐름 추가 시 프롬프트에 반영).
  - 🧠 **디자인씽킹 코치**: `SYSTEM_PROMPT`에 단계별 코칭 지침(공감=질문으로 대상 구체화, 발상=아이디어 제안, 만들기, 개선=어린이 관점 비평·우선순위). studio.html 채팅 위 **단계 띠** + 각 단계 시작문장 도우미(`DT_STARTERS`). 단계/코칭을 바꾸면 **둘 다 갱신**.
- ⚠️ **로컬 `npx serve`는 함수를 안 돌린다.** 함수 검증은 `vercel dev` 또는 Vercel 배포 후. studio UI 자체는 로컬 확인 가능.

## 인증 (클라이언트 전용)
- **학생 비밀번호:** `utils.js`의 `hashPassword`(SHA-256+고정 솔트)로 해시 저장. 평문 미저장.
  - 로그인 검증은 `verifyPassword` (레거시 평문도 호환 → 성공 시 해시로 자동 업그레이드).
- **신규 학생 등록:** 관리자 코드 `chrisna` 필요 (submit.html에 하드코딩).
- **관리자 로그인:** `admin` / `chrisna` (admin.html에 하드코딩).

> ⚠️ **알려진 보안 한계 (클라이언트 전용 구조):** 관리자 코드·관리자 비번이 소스에 노출되고,
> Firestore 규칙이 열려 있어 누구나 쓰기/삭제가 가능하다. 비밀번호는 해시라 평문은 안 새지만
> 완전한 보호(삭제 권한 제한 등)는 **Firebase Authentication 도입**이 필요. 현재는 수업용으로 의도적 보류.

## Firestore 보안 규칙 (Console에 게시)
입력 검증으로 과대 문서/스팸을 막는다. 접근 제어(삭제 권한 등)는 클라 전용 한계상 열려 있음.
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /works/{id} {
      allow read: if true;
      allow create, update: if request.resource.data.studentName is string
        && request.resource.data.studentName.size() <= 30
        && request.resource.data.get('title', '').size() <= 100
        && request.resource.data.get('fullHtml', '').size() < 500000
        && request.resource.data.get('html', '').size() < 200000
        && request.resource.data.get('css', '').size() < 200000
        && request.resource.data.get('js', '').size() < 200000;
      allow delete: if true;
    }

    match /students/{id} {
      allow read: if true;
      allow create, update: if request.resource.data.name is string
        && request.resource.data.name.size() <= 30
        && request.resource.data.password is string;
      allow delete: if true;
    }

    match /comments/{id} {
      allow read: if true;
      allow create: if request.resource.data.content is string
        && request.resource.data.content.size() > 0
        && request.resource.data.content.size() <= 1000
        && request.resource.data.get('author', '').size() <= 30;
      allow update: if false;
      allow delete: if true;
    }

    match /usage/{id} {
      allow read: if true;
      allow create: if request.resource.data.totalTokens is number
        && request.resource.data.get('model', '').size() <= 60;
      allow update: if false;
      allow delete: if true;
    }
  }
}
```
복합 인덱스 필요: `works` 컬렉션 `studentName(==) + createdAt(desc)` —
`comments` `workId(==) + createdAt(asc)`. 쿼리 에러 시 콘솔 링크로 자동 생성.

## Firebase Storage 규칙 (Console에 게시)
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /profiles/{fileName} { allow read, write: if true; }
  }
}
```

## 작업 관례
- 코드 변경 후 로컬(`showcase` 프리뷰)에서 확인 → GitHub push → Vercel 자동 배포.
- 학생 결과물은 iframe `sandbox="allow-scripts"` + `srcdoc`로 렌더. **CDN 라이브러리는 작동**
  (p5.js·Three.js·Phaser·GSAP·Tone.js 등 `<script src="https://cdn...">` 포함 OK).
  안 되는 것: `npm install`·빌드가 필요한 다중 파일 프로젝트(Vite/Next 등). React는 CDN UMD+Babel standalone이면 가능.
  → **학생 가이드: "클로드에게 '하나의 HTML 파일로 만들어줘'라고 요청"하고 그 코드를 '전체 HTML' 모드에 붙여넣기.**
- 공통 코드는 한 곳에서 공유 (중복 금지): 함수는 `utils.js`, 스타일은 `styles.css`(`<link>`), Firebase 초기화는 `firebase.js`(`import { db }`).

# 바이브코딩 쇼케이스 (Vibe Coding Showcase)

커버넌트 하이스쿨 학생들이 AI(클로드) 활용 수업에서 만든 결과물을 아카이빙·전시하는 웹사이트.
학생들은 어린이 주일학교(KIDS)를 위한 게이미피케이션 교구를 바이브코딩으로 제작한다.

## 스택 & 배포
- **순수 HTML/CSS/JS** (빌드 도구 없음, 프레임워크 없음). 각 페이지는 `<script type="module">`.
- **Firebase Firestore** — 실시간 데이터 저장 (`works`, `students`, `comments` 컬렉션)
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
| `admin.html` | 관리자. 학생/작품/댓글 관리 + 삭제 + 통계 |
| `utils.js` | **공통 모듈** — escapeHtml/escapeAttr/buildSrcdoc/nameToColor/해시/showToast |
| `firebase-config.js` | Firebase 설정값 (프로젝트: covenant-high-school-vibe) |

## 데이터 모델
- `works/{id}`: `studentName, title, description, html, css, js, version(숫자), createdAt, updatedAt`
  - 같은 작품을 **업데이트하면 version 증가** (v1 → v2 …). 새 작품은 별도 문서.
  - 레거시 `round` 필드("1차" 등)가 일부 남아있을 수 있음 — 신규는 version 사용.
- `students/{이름}`: `name, password(SHA-256 해시), photoURL?, createdAt`
- `comments/{id}`: `workId, author, content, createdAt`

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
- 학생 결과물은 iframe `sandbox="allow-scripts"` + `srcdoc`로 렌더. **순수 HTML/CSS/JS만** 지원
  (React 등 프레임워크는 동작 안 함 — 학생 가이드에 반영할 것).
- 공통 함수는 `utils.js`에 두고 각 페이지에서 import (중복 금지).

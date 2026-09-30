# ARCHITECTURE — 현재 시스템 구조

> 이 문서는 **현재 구현된** 아키텍처를 기술한다. 미래 계획은 `ROADMAP.md`, 결정의 이유는 `DECISIONS.md`.

## High-level
```
브라우저 (정적 페이지들, 빌드 없음)
 ├─ Firestore/Storage에 직접 읽기·쓰기 (백엔드 없음, 클라이언트 전용)
 └─ POST /api/generate ──► Vercel 서버리스 함수 1개
                             ├─ 프로바이더 추상화 (claude | gemini)
                             ├─ 모델 라우터 (Haiku ⇄ Sonnet)
                             ├─ 프롬프트 캐싱 (cache_control)
                             ├─ 레이트리밋 (IP당 12회/분, 인메모리)
                             └─ SSE 스트리밍 → 브라우저
배포: GitHub main push → Vercel 자동 배포 (정적 + 함수)
```

## 페이지와 데이터 흐름
- 모든 페이지가 `firebase.js`에서 `db`를 import해 Firestore에 직접 접근한다 (`onSnapshot` 실시간 구독 다수).
- 학생 작품 렌더: `buildSrcdoc(work)`(utils.js) → `iframe sandbox="allow-scripts" srcdoc` — 작품 JS는 부모 DOM·다른 origin 접근 불가. CDN `<script src>`는 동작.
  - ⚠️ sandbox에는 `allow-same-origin`이 없어 **작품 내 localStorage 접근은 예외를 던진다** (작품이 try/catch 없이 쓰면 깨짐).
- 갤러리·프로필의 카드 미리보기도 같은 srcdoc 방식(축소 렌더).

## 데이터 모델 (Firestore)
- `works/{id}`: `studentName, title, description, fullHtml, html, css, js, version(숫자), reactions(map), createdAt, updatedAt`
  - 입력 2모드: ① `fullHtml`(통짜, 기본·추천) ② `html/css/js` 분리(레거시). 한쪽 저장 시 반대편은 `''`.
    렌더는 `buildSrcdoc`이 fullHtml 우선 → 레거시 100% 호환.
  - 업데이트 시 `version` 증가. 새 작품은 새 문서.
  - **버전 히스토리**: 업데이트 직전 상태를 `works/{id}/versions/{버전번호}`에 자동 보관 — `archiveWorkVersion`(firebase.js), submit·studio 공용. 보관 실패는 저장을 막지 않음(경고만).
  - admin "버전" 버튼 → 목록 → 롤백: 선택 버전 내용을 **새 버전 번호로** 복원(복원 전 현재 상태도 보관 → 롤백의 롤백 가능).
  - 레거시 `round` 필드가 일부 문서에 남아있을 수 있음 — 신규는 version만.
- `students/{이름}`: `name, password(SHA-256 해시), photoURL?, createdAt`
- `comments/{id}`: `workId, author, content, createdAt`
- `usage/{id}`: `model, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, stopReason, totalTokens, createdAt` — 스튜디오 LLM 호출 1건당 1문서(클라이언트가 기록). admin이 모델별 집계 + 요율표(`TOKEN_RATES`)로 추정 비용 표시(캐시읽기 0.1×, 캐시쓰기 1.25×).

## AI 스튜디오 파이프라인 (studio.html + api/generate.js)
핵심 설계 목표: **작품 크기와 무관한 수정** + **토큰 비용 최소화** + **잘린 코드로부터 작품 보호**.

1. **부분 수정 프로토콜** (ADR-005): 기존 작품 수정 시 모델은 전체 파일 대신 ````edit` 블록(`<<<<<<< SEARCH / ======= / >>>>>>> REPLACE`)만 출력 → 클라이언트가 `applyEdits`(utils.js)로 적용. **all-or-nothing**(하나라도 불일치 시 미반영) + 공백 유연 매칭 폴백. 새 작품·전면 개편만 통짜 ````html`. 프로토콜 정의는 `SYSTEM_PROMPT`, 파서는 `extractEdits`.
2. **append-only 히스토리 + 프롬프트 캐싱** (ADR-006): 히스토리는 원문 그대로 쌓는다. 작품 코드 전문은 **딱 한 번** 히스토리에 실림(첫 수정 시작 시 `[현재 작품 전체 코드]` 주입, 또는 모델의 전체 생성 응답 자체). 서버가 system+마지막 메시지에 `cache_control`(ephemeral, TTL 5분) → 프리픽스 전체가 매 턴 캐시 히트(입력 90% 할인). 모델은 "원본 + 자기가 낸 edit들"로 최신 상태를 추적(SYSTEM_PROMPT에 명시).
   - **불변 조건: 히스토리를 중간에 수정하면 캐시 전부 미스.** SEARCH 불일치 시엔 히스토리를 비워 다음 턴에 최신 코드로 재기준(자동 복구). 32개 메시지 또는 220K자 초과 시 컴팩션(비우고 재주입). user/assistant 역할 교대 필수(Anthropic API) — 실패 턴은 히스토리에서 제거.
3. **잘림 방어** (ADR-008): 판정 기준은 형식이 아니라 **완성 여부** — 닫는 펜스가 없어도 `</html>`로 끝나면 완성본 인정, edit 블록이 `REPLACE`로 완결됐으면 구제, 구분자 변형(`<` 4개 이상 등) 허용. 진짜 중간 절단만 경고로 치환(잘린 코드를 채팅에 노출하지 않음). submit·studio 게시는 `</html>` 미종결 시 confirm 재확인. `stopReason`(end_turn/max_tokens)이 usage에 기록돼 사후 진단 가능.
4. **모델 라우터** (`pickClaudeModel`): 기본 Haiku 4.5. 무거운 작업 신호(3D·물리·시뮬 등)나 전면 재작성 문구만 Sonnet 4.6 승급. '컨텍스트 크면 승급' 규칙은 비용 사고로 **제거됨** (ADR-004). `CLAUDE_MODEL` env 설정 시 고정.
5. **생성 한도**: `max_tokens` 64000(모델 최대) — 전체 재생성용. 저장 상한은 Firestore fullHtml <500KB. 스튜디오 미리보기 툴바에 크기 게이지.
6. **레이트리밋**: 함수는 무인증 호출 가능 → IP당 분당 12회(인메모리, 베스트에포트). 강한 보장 필요 시 Vercel KV/Firestore 카운터로 확장.
7. 디자인씽킹 코치: SYSTEM_PROMPT에 단계별 코칭(공감→발상→만들기→개선) + studio.html 단계 띠·`DT_STARTERS`. 변경 시 둘 다 갱신.
8. 요청/응답: `POST /api/generate {messages:[{role,content}]}` → SSE 스트림 `data:{delta}`… `data:{done,usage}`. 스트림 전 가드 오류(429/400)는 일반 JSON.

## 인증·보안 (클라이언트 전용 — 의도적 한계, ADR-002)
- 학생 비번: `hashPassword`(SHA-256+고정 솔트)로 해시 저장, 평문 미저장. `verifyPassword`는 레거시 평문 호환(성공 시 자동 해시 승격). 현재 전원 해시 상태 확인됨.
- 신규 학생 등록: 관리자 코드 `chrisna`(submit.html 하드코딩). 관리자 로그인: `admin`/`chrisna`(admin.html 하드코딩).
- **알려진 한계**: 관리자 코드가 소스에 노출, Firestore 규칙이 열려 있어 누구나 쓰기/삭제 가능. 완전한 보호는 Firebase Authentication 도입 필요 — 수업용으로 의도적 보류(ROADMAP 참고).

## Firestore 보안 규칙 (정본 — 변경 시 여기 갱신 + Firebase Console에 수동 게시)
입력 검증으로 과대 문서/스팸만 방어. 접근 제어는 열려 있음(위 한계 참고).
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

      // 버전 히스토리 (롤백용 보관) — works 업데이트 직전 스냅샷
      match /versions/{v} {
        allow read: if true;
        allow create: if request.resource.data.get('fullHtml', '').size() < 500000
          && request.resource.data.get('html', '').size() < 200000
          && request.resource.data.get('css', '').size() < 200000
          && request.resource.data.get('js', '').size() < 200000;
        allow update: if false;
        allow delete: if true;
      }
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
복합 인덱스: `works` `studentName(==)+createdAt(desc)` · `comments`는 인덱스 회피를 위해 클라 정렬 사용 중. 쿼리 에러 시 콘솔 링크로 자동 생성.

## Firebase Storage 규칙 (정본)
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /profiles/{fileName} { allow read, write: if true; }
  }
}
```

## 배포·출력 확인 (preview 전략)
- **배포**: `main` push → Vercel 자동 배포(~1분). `vercel.json`은 `cleanUrls`만 — 그래서 내부 링크는 `work?id=` 형태(`.html` 없이).
- **결과물 확인 경로**: ① 로컬 `npx serve`(정적 UI, 함수 제외) ② 라이브 URL(전체) ③ 함수 단독은 curl로 `POST /api/generate` 스트림 확인 ④ Vercel은 branch push 시 preview URL도 만들어줌(현재 워크플로는 main 직행이라 미사용 — ROADMAP 참고).
- 대용량 산출물 없음: 결과물은 HTML 텍스트(Firestore 저장)라 별도 artifact storage 불필요. 이미지·영상 파이프라인 없음.

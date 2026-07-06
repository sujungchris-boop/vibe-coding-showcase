// Firebase 초기화 — 한 곳에서만 앱/DB를 생성해 모든 페이지가 공유한다.
// (index/work/student/submit/admin/studio에 중복되던 initializeApp+getFirestore 부트스트랩을 모음)
//
// 사용: import { db } from './firebase.js';   // Firestore 함수는 각 페이지가 CDN에서 직접 import
//       import { app } from './firebase.js';  // Storage 등 추가 SDK가 필요할 때 (예: submit.html)
//
// Storage SDK는 submit.html만 쓰므로 여기서 로드하지 않는다(다른 페이지에 불필요한 번들 방지).

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import firebaseConfig from './firebase-config.js';

export const app = initializeApp(firebaseConfig);
export const db  = getFirestore(app);

// 작품을 덮어쓰기 전에 현재 상태를 works/{id}/versions/{버전}에 보관 — admin 롤백의 원본.
// 보관 실패(예: Firestore 규칙 미게시)해도 저장 흐름을 막지 않는다(경고만).
export async function archiveWorkVersion(workId, w) {
  if (!workId || !w) return;
  try {
    const v = w.version || 1;
    await setDoc(doc(db, 'works', workId, 'versions', String(v)), {
      title: w.title || '',
      description: w.description || '',
      fullHtml: w.fullHtml || '',
      html: w.html || '', css: w.css || '', js: w.js || '',
      version: v,
      archivedAt: serverTimestamp(),
    });
  } catch (e) { console.warn('버전 보관 실패(저장은 계속 진행):', e); }
}

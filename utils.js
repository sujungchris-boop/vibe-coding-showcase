// 공통 유틸리티 — 모든 페이지에서 import해서 사용
// (index / submit / work / student / admin 에서 중복되던 함수를 한 곳으로 모음)

// ── HTML 이스케이프 ──
export function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escapeAttr(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── 작품 코드 → iframe srcdoc ──
// fullHtml(통짜 HTML 한 파일)이 있으면 그대로 렌더 — CDN 라이브러리(p5/Three/Phaser 등) 지원.
// 없으면 레거시 방식(html/css/js 분리)으로 조합.
export function buildSrcdoc(w) {
  if (w.fullHtml && w.fullHtml.trim()) return w.fullHtml;
  // 사용자 JS 안의 "</script>"가 srcdoc의 <script> 블록을 닫아버리지 않도록 이스케이프.
  const js = String(w.js || '').replace(/<\/script>/gi, '<\\/script>');
  return `<!DOCTYPE html><html><head><style>${w.css || ''}</style></head><body>${w.html || ''}<script>${js}<\/script></body></html>`;
}

// ── 이름 기반 아바타 색상 ──
export function nameToColor(name) {
  let hash = 0;
  for (const ch of String(name)) hash = ch.charCodeAt(0) + (hash << 5) - hash;
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 55%, 45%)`;
}

// ── 비밀번호 해시 (SHA-256) ──
// 클라이언트 전용 구조이므로 솔트는 비밀이 아니지만, 평문 저장을 막는 것이 목적.
const PW_SALT = 'covenant-vibe-2026';

export async function hashPassword(pw) {
  const data = new TextEncoder().encode(pw + PW_SALT);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function isHashed(stored) {
  return /^[0-9a-f]{64}$/.test(stored || '');
}

// 입력 비밀번호와 저장값 비교. 레거시(평문) 저장값도 호환.
export async function verifyPassword(input, stored) {
  if (!stored) return false;
  if (isHashed(stored)) return (await hashPassword(input)) === stored;
  return input === stored; // 레거시 평문 — 로그인 성공 시 호출부에서 해시로 업그레이드
}

// ── 날짜 포맷 (Firestore Timestamp → 'ko-KR' 표기) ──
// 여러 페이지에 흩어져 있던 `ts?.toDate?.() ? ... : fallback` 패턴을 한 곳으로.
export function formatDate(ts, { withTime = false, fallback = '' } = {}) {
  const d = ts?.toDate?.();
  if (!d) return fallback;
  const opts = withTime
    ? { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { month: 'short', day: 'numeric' };
  return d.toLocaleString('ko-KR', opts);
}

// ── Toast (페이지에 #toast 요소가 있을 때) ──
export function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = 'toast show ' + type;
  setTimeout(() => { toast.className = 'toast'; }, 3000);
}

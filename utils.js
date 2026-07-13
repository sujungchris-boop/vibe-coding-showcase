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

// ── 모델 출력에서 대화(reply)와 결과물(html) 분리 — AI 스튜디오가 스트림 완료 후 사용 ──
// 코드는 ```html 코드블록 안에 온다. 없으면 순수 대화로 본다. (예전엔 서버 api/generate가 했음)
export function extractHtml(text) {
  const raw = (text || '').trim();
  const fenceRe = /```(\w*)\s*\n([\s\S]*?)```/g;
  const blocks = [];
  let m;
  while ((m = fenceRe.exec(raw)) !== null) {
    blocks.push({ lang: (m[1] || '').toLowerCase(), code: m[2], full: m[0] });
  }
  let chosen = null;
  for (const b of blocks) {
    if (b.lang === 'html' || /<!doctype html|<html[\s>]/i.test(b.code)) chosen = b;
  }
  if (!chosen && blocks.length === 1 && blocks[0].lang !== 'edit' && /<[a-z][\s\S]*>/i.test(blocks[0].code)) chosen = blocks[0];
  if (!chosen && /^<!doctype html|^<html[\s>]/i.test(raw)) return { reply: '', html: raw };
  if (!chosen) {
    // 닫히지 않은 ``` 펜스 처리 — 두 경우를 구분한다:
    // ① 내용이 </html>로 끝남 = 모델이 '닫는 펜스만' 빼먹은 완성본 (Haiku가 긴 출력에서 흔함) → 결과물로 인정
    // ② 그 외 = 진짜 중간에 끊긴 응답 → 잘린 코드를 채팅에 노출하지 않고 경고로 치환
    const fenceCount = (raw.match(/```/g) || []).length;
    if (fenceCount % 2 === 1) {
      const cut = raw.lastIndexOf('```');
      const nl = raw.indexOf('\n', cut);
      const body = nl === -1 ? '' : raw.slice(nl + 1).trim();
      const before = raw.slice(0, cut).trim();
      if (/<\/html>\s*$/i.test(body)) {
        return { reply: before, html: body };
      }
      if (raw.length - cut > 400) {
        return {
          reply: (before ? before + '\n\n' : '') +
            '⚠️ 코드가 너무 길어서 중간에 잘렸어요! 이 코드는 사용하지 말고, "조금 더 간단하게 만들어줘" 또는 "핵심 기능만 먼저 만들어줘"처럼 범위를 줄여 다시 요청해주세요.',
          html: '',
        };
      }
    }
    return { reply: raw, html: '' };
  }
  const html = chosen.code.trim();
  const reply = raw.replace(chosen.full, '').replace(/\n{3,}/g, '\n\n').trim();
  return { reply, html };
}

// ── 부분 수정(```edit) 프로토콜 — 큰 작품도 수정량만 출력받아 적용 ──
// 모델 출력의 ```edit 블록에서 SEARCH/REPLACE 쌍들을 분리한다.
// 반환: { blocks: [{search, replace}], reply, truncated }
export function extractEdits(text) {
  const raw = (text || '').trim();
  const out = { blocks: [], reply: raw, truncated: false };
  if (!raw.includes('```edit')) return out;
  // 구분자는 유연하게 허용 — 모델이 <<<<<<<<(8개), '======= ' (뒤 공백) 등으로 살짝 다르게 쓰는 일이 흔하다.
  const PAIR = /<{4,} *SEARCH *\n([\s\S]*?)\n={4,} *\n([\s\S]*?)\n>{4,} *REPLACE/g;
  let reply = raw;

  // ① 닫힌 ```edit 블록들
  const fenceRe = /```edit[^\n]*\n([\s\S]*?)```/g;
  let m, lastEnd = 0;
  while ((m = fenceRe.exec(raw)) !== null) {
    reply = reply.replace(m[0], '');
    PAIR.lastIndex = 0;
    let p;
    while ((p = PAIR.exec(m[1])) !== null) out.blocks.push({ search: p[1], replace: p[2] });
    lastEnd = m.index + m[0].length;
  }

  // ② 닫히지 않은 마지막 ```edit 펜스 — 내용이 REPLACE로 완결됐으면 '닫는 펜스만 누락'이므로 구제,
  //    아니면 진짜 잘린 응답으로 판정.
  const tailIdx = raw.indexOf('```edit', lastEnd);
  if (tailIdx !== -1) {
    const tailFull = raw.slice(tailIdx);
    const nl = tailFull.indexOf('\n');
    const tail = nl === -1 ? '' : tailFull.slice(nl + 1);
    const complete = /(^|\n)>{4,} *REPLACE$/.test(tail.trimEnd());
    PAIR.lastIndex = 0;
    const tailBlocks = [];
    let p;
    while ((p = PAIR.exec(tail)) !== null) tailBlocks.push({ search: p[1], replace: p[2] });
    if (complete && tailBlocks.length > 0) {
      out.blocks.push(...tailBlocks);
      reply = reply.replace(tailFull, '');
    } else {
      out.truncated = true;
      reply = reply.replace(tailFull, '');
    }
  }

  // ③ 쌍 개수 대조 — 닫힌 블록 안에서 쌍이 중간에 끊겼거나 형식이 크게 어긋난 경우
  if (!out.truncated) {
    const pairOpens = (raw.match(/<{4,} *SEARCH/g) || []).length;
    if (pairOpens > out.blocks.length) out.truncated = true;
  }
  out.reply = reply.replace(/\n{3,}/g, '\n\n').trim();
  return out;
}

// SEARCH/REPLACE 쌍들을 html에 적용. 전부 성공해야 반영(all-or-nothing).
// 매칭: ① 원문 그대로 → ② 공백 유연 매칭(들여쓰기 오차 허용).
export function applyEdits(html, blocks) {
  let result = html;
  const failed = [];
  for (const b of blocks) {
    const s = b.search;
    if (s && result.includes(s)) {
      result = result.replace(s, b.replace);
      continue;
    }
    // 공백 유연 매칭: 줄 안 공백 무시, 줄 구조는 유지
    const flex = s.trim().split('\n').map(line =>
      line.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
    ).join('\\s*\\n\\s*');
    let matched = false;
    if (flex) {
      try {
        const re = new RegExp(flex);
        const hit = result.match(re);
        if (hit) { result = result.replace(re, b.replace.replace(/\$/g, '$$$$')); matched = true; }
      } catch (_) { /* 정규식 실패 → 실패 처리 */ }
    }
    if (!matched) failed.push(b);
  }
  if (failed.length > 0) return { ok: false, html, applied: blocks.length - failed.length, failedCount: failed.length };
  return { ok: true, html: result, applied: blocks.length, failedCount: 0 };
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

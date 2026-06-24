// Vercel 서버리스 함수 — AI 스튜디오용 코드 생성
//
// API 키는 환경변수에만 둔다 (브라우저/깃에 노출 금지).
// 프로바이더 추상화: 기본 Gemini, 환경변수로 Claude 교체 가능.
//
// 필요한 환경변수 (Vercel 프로젝트 Settings → Environment Variables):
//   LLM_PROVIDER     'gemini' (기본) | 'claude'
//   GEMINI_API_KEY   Gemini 사용 시 필수
//   GEMINI_MODEL     기본 'gemini-2.5-flash'
//   ANTHROPIC_API_KEY  Claude 사용 시 필수
//   CLAUDE_MODEL     (선택) 설정 시 그 모델로 고정. 비우면 라우터가 Haiku⇄Sonnet 자동 선택
//
// 요청  (POST):  { messages: [{ role:'user'|'assistant', content:string }, ...] }
// 응답:          { reply, html, usage: { model, inputTokens, outputTokens, totalTokens } }
//                reply=대화 텍스트, html=추출된 결과물(없으면 ''), usage=토큰

const SYSTEM_PROMPT = `너는 자유롭고 유능한 범용 AI 어시스턴트야. 무엇이든 편하게 대화해 — 질문에 답하고, 같이 브레인스토밍하고, 설명하고, 의견도 내고, 농담도 한다. 일반 챗봇처럼 막힘없이 자연스럽게 대화하면 돼. 아래 배경을 알고 있되, 정해진 역할이나 주제에 갇히지는 마.

[이 플랫폼이 뭔지 — 배경 지식]
- 여기는 '바이브코딩 쇼케이스'라는 사이트야. 커버넌트 하이스쿨 학생들이 AI와 함께 만든 결과물을 전시·아카이빙하는 곳이고, 너와 대화하는 사람은 주로 그 학생이야(친근하고 격려하는 톤이 잘 맞아).
- 학생들은 자주 '어린이 주일학교(KIDS)를 위한 게이미피케이션 교구'를 만들어. 다만 이건 어디까지나 배경일 뿐이야 — 학생이 다른 걸 만들고 싶어 하면 주제를 강요하지 말고 자유롭게 도와줘.
- 너는 이 사이트 안의 'AI 스튜디오'라는 화면에 들어와 있어.

[AI 스튜디오 사용 흐름]
- 왼쪽은 너와의 채팅, 오른쪽은 '라이브 미리보기'야. 네가 웹 결과물(웹페이지·게임·도구·시각화·애니메이션 등)을 코드로 만들면 사용자가 오른쪽에서 바로 눈으로 본다.
- 사용자가 만들거나 고쳐 달라고 하면 코드를 주고("이 부분 이렇게 바꿔줘" 식으로 계속 반복 수정 가능), 그냥 묻거나 이야기하고 싶을 땐 코드 없이 자연스럽게 대답해. 코드를 줄지 말지는 맥락 보고 판단해.
- 미리보기 오른쪽 위에 '게시하기' 버튼이 있어. 누르면 지금 미리보기의 결과물이 이 사이트의 작품 갤러리(쇼케이스)에 본인 이름으로 게시되고(이름·비밀번호 인증), 나중에 다시 불러와 수정할 수도 있어. "게시/저장/올리기"를 물으면 → "오른쪽 위 '게시하기' 버튼을 누르면 쇼케이스에 게시돼요"라고 안내해. 네가 직접 게시해 줄 수는 없지만 버튼의 존재와 동작은 확실히 아니까, "난 게시 못 한다"거나 "코드를 복사해 직접 저장하라"는 식으로 잘못 안내하지 마.

[코드를 줄 때만 지키는 환경 제약]
- 미리보기는 HTML 파일 하나를 통째로 렌더해. 그러니 결과물은 자체 완결형 HTML 한 파일이어야 한다(<!DOCTYPE html>…</html>). 학생 작품은 iframe(sandbox=allow-scripts, srcdoc)로 렌더된다.
- 라이브러리는 CDN <script src>로만 가져온다(p5.js, Three.js, Phaser, GSAP, Tone.js 등 자유롭게). npm 설치나 빌드가 필요한 건 미리보기에서 못 돌아간다.
- 코드는 \`\`\`html 코드블록 하나에 전체 파일을 넣는다. 수정 요청이면 부분이 아니라 전체 파일을 다시 완성해서 준다.

그 외엔 제약 없어. 기본은 한국어지만 사용자가 다른 언어를 쓰면 맞춘다.`;

// 모델 출력에서 대화 텍스트(reply)와 HTML 결과물(html)을 분리.
// 코드는 ```html 코드블록 안에 온다. 없으면 순수 대화로 본다.
function extractHtml(text) {
  const raw = (text || '').trim();
  const fenceRe = /```(\w*)\s*\n([\s\S]*?)```/g;
  const blocks = [];
  let m;
  while ((m = fenceRe.exec(raw)) !== null) {
    blocks.push({ lang: (m[1] || '').toLowerCase(), code: m[2], full: m[0] });
  }
  // html로 표시됐거나 문서처럼 보이는 마지막 블록을 결과물로 채택
  let chosen = null;
  for (const b of blocks) {
    if (b.lang === 'html' || /<!doctype html|<html[\s>]/i.test(b.code)) chosen = b;
  }
  if (!chosen && blocks.length === 1 && /<[a-z][\s\S]*>/i.test(blocks[0].code)) chosen = blocks[0];

  // 코드블록이 전혀 없고 응답 전체가 HTML 문서면 그것을 결과물로
  if (!chosen && /^<!doctype html|^<html[\s>]/i.test(raw)) {
    return { reply: '', html: raw };
  }
  if (!chosen) return { reply: raw, html: '' };

  const html = chosen.code.trim();
  const reply = raw.replace(chosen.full, '').replace(/\n{3,}/g, '\n\n').trim();
  return { reply, html };
}

async function callGemini(messages) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 16384 },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API 오류 (${res.status}): ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  const u = data?.usageMetadata || {};
  return {
    text,
    usage: {
      model,
      inputTokens: u.promptTokenCount || 0,
      outputTokens: u.candidatesTokenCount || 0,
      totalTokens: u.totalTokenCount || 0,
    },
  };
}

// ── Claude 모델 라우터 ──
// 기본 Haiku(가성비). 무거운 작업(3D·물리·게임엔진·시뮬·셰이더·멀티플레이) 신호가 있거나
// 현재 작업물(누적 HTML)이 크면 Sonnet으로 자동 승급. CLAUDE_MODEL env가 있으면 그 값으로 고정(라우팅 끔).
const CLAUDE_HAIKU = 'claude-haiku-4-5';
const CLAUDE_SONNET = 'claude-sonnet-4-6';
function pickClaudeModel(messages) {
  if (process.env.CLAUDE_MODEL) return process.env.CLAUDE_MODEL; // 수동 고정
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  const text = (lastUser && lastUser.content) || '';
  const heavy = /three\.?js|webgl|3d|3차원|물리|physics|시뮬|simulat|셰이더|shader|멀티플레이|multiplayer|phaser|matter\.?js|cannon|rpg|플랫포머|platformer/i;
  const totalLen = messages.reduce((n, m) => n + ((m.content && m.content.length) || 0), 0);
  if (heavy.test(text) || totalLen > 14000) return CLAUDE_SONNET;
  return CLAUDE_HAIKU;
}

async function callClaude(messages, model) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY가 설정되지 않았습니다.');
  model = model || process.env.CLAUDE_MODEL || 'claude-haiku-4-5';

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 16384,
      system: SYSTEM_PROMPT,
      messages: messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude API 오류 (${res.status}): ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = (data?.content || []).map(b => b.text || '').join('');
  const u = data?.usage || {};
  return {
    text,
    usage: {
      model,
      inputTokens: u.input_tokens || 0,
      outputTokens: u.output_tokens || 0,
      totalTokens: (u.input_tokens || 0) + (u.output_tokens || 0),
    },
  };
}

// ── 레이트리밋 (인메모리, 베스트에포트) ──
// /api/generate는 로그인 없이 호출 가능하므로, 한 IP의 연타·폭주로 LLM 토큰 비용이
// 무제한 발생하는 것을 막는다. Vercel 함수는 stateless하지만 워밍된 인스턴스는 모듈
// 스코프를 재사용하므로, 같은 인스턴스로 들어오는 빠른 반복 호출을 차단할 수 있다.
// ⚠️ 콜드스타트·다중 인스턴스에선 완벽하지 않다 — 강한 보장이 필요하면
//    Vercel KV / Upstash, 또는 Firestore 카운터로 확장할 것.
const RL_WINDOW_MS = 60 * 1000; // 1분 창
const RL_MAX = 12;              // IP당 분당 최대 호출 (대화형 스튜디오엔 충분, 봇 연타는 차단)
const rlHits = new Map();       // ip -> 최근 호출 타임스탬프[]

function rateLimited(ip) {
  const now = Date.now();
  const arr = (rlHits.get(ip) || []).filter(t => now - t < RL_WINDOW_MS);
  arr.push(now);
  rlHits.set(ip, arr);
  if (rlHits.size > 5000) { // 메모리 누수 방지: 오래된 IP 정리
    for (const [k, v] of rlHits) {
      if (!v.length || now - v[v.length - 1] > RL_WINDOW_MS) rlHits.delete(k);
    }
  }
  return arr.length > RL_MAX;
}

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'] || '';
  return xff.split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST만 허용됩니다.' });
    return;
  }

  if (rateLimited(clientIp(req))) {
    res.status(429).json({ error: '요청이 너무 잦아요. 잠시 후 다시 시도해주세요.' });
    return;
  }

  try {
    // Vercel은 보통 req.body를 파싱해 주지만, 안전하게 양쪽 모두 처리
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body || '{}');
    if (!body) {
      const raw = await new Promise(resolve => {
        let d = ''; req.on('data', c => d += c); req.on('end', () => resolve(d));
      });
      body = JSON.parse(raw || '{}');
    }

    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (messages.length === 0) {
      res.status(400).json({ error: 'messages가 비어 있습니다.' });
      return;
    }
    // 과도한 히스토리 방지 (간단한 가드)
    if (messages.length > 40) {
      res.status(400).json({ error: '대화가 너무 깁니다. 새로 시작해주세요.' });
      return;
    }

    const provider = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();
    const result = provider === 'claude' ? await callClaude(messages, pickClaudeModel(messages)) : await callGemini(messages);
    const { reply, html } = extractHtml(result.text);

    if (!reply && !html) {
      res.status(502).json({ error: 'AI가 빈 응답을 반환했습니다. 다시 시도해주세요.' });
      return;
    }
    res.status(200).json({ reply, html, usage: result.usage });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || '서버 오류가 발생했습니다.' });
  }
};

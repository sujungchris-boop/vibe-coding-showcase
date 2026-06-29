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
// 응답:          SSE 스트림 (text/event-stream). 각 줄 `data: {...}`
//                { delta:'...' } 생성 중 텍스트 조각(여러 번) · { done:true, usage:{...} } 완료 · { error:'...' } 실패
//                결과물(html) 추출은 클라이언트가 utils.extractHtml로 처리한다 (스트림 완료 후).

const SYSTEM_PROMPT = `너는 자유롭고 유능한 범용 AI 어시스턴트야. 무엇이든 편하게 대화해 — 질문에 답하고, 같이 브레인스토밍하고, 설명하고, 의견도 내고, 농담도 한다. 일반 챗봇처럼 막힘없이 자연스럽게 대화하면 돼. 아래 배경을 알고 있되, 정해진 역할이나 주제에 갇히지는 마.

[이 플랫폼이 뭔지 — 배경 지식]
- 여기는 '바이브코딩 쇼케이스'라는 사이트야. 커버넌트 하이스쿨 학생들이 AI와 함께 만든 결과물을 전시·아카이빙하는 곳이고, 너와 대화하는 사람은 주로 그 학생이야(친근하고 격려하는 톤이 잘 맞아).
- 학생들은 자주 '어린이 주일학교(KIDS)를 위한 게이미피케이션 교구'를 만들어. 다만 이건 어디까지나 배경일 뿐이야 — 학생이 다른 걸 만들고 싶어 하면 주제를 강요하지 말고 자유롭게 도와줘.
- 너는 이 사이트 안의 'AI 스튜디오'라는 화면에 들어와 있어.

[AI 스튜디오 사용 흐름]
- 왼쪽은 너와의 채팅, 오른쪽은 '라이브 미리보기'야. 네가 웹 결과물(웹페이지·게임·도구·시각화·애니메이션 등)을 코드로 만들면 사용자가 오른쪽에서 바로 눈으로 본다.
- 사용자가 만들거나 고쳐 달라고 하면 코드를 주고("이 부분 이렇게 바꿔줘" 식으로 계속 반복 수정 가능), 그냥 묻거나 이야기하고 싶을 땐 코드 없이 자연스럽게 대답해. 코드를 줄지 말지는 맥락 보고 판단해.
- 미리보기 오른쪽 위에 '게시하기' 버튼이 있어. 누르면 지금 미리보기의 결과물이 이 사이트의 작품 갤러리(쇼케이스)에 본인 이름으로 게시되고(이름·비밀번호 인증), 나중에 다시 불러와 수정할 수도 있어. "게시/저장/올리기"를 물으면 → "오른쪽 위 '게시하기' 버튼을 누르면 쇼케이스에 게시돼요"라고 안내해. 네가 직접 게시해 줄 수는 없지만 버튼의 존재와 동작은 확실히 아니까, "난 게시 못 한다"거나 "코드를 복사해 직접 저장하라"는 식으로 잘못 안내하지 마.

[생각을 돕는 코치 역할 — 중요]
너는 코드만 찍어내는 도구가 아니라, 학생이 스스로 생각하게 돕는 디자인씽킹 코치이기도 해. 채팅 위에 '공감 → 발상 → 만들기 → 개선' 단계 띠가 있어. 학생이 각 단계 도움을 청하면 이렇게 코치해:
- 공감: 바로 만들지 말고 "누구(몇 살)를 위한 건지, 그 아이가 뭘 좋아하고 뭘 어려워할지" 짧은 질문 2~3개로 대상을 또렷하게 해. 답을 들으면 한 문장으로 정리해줘.
- 발상: 아이디어를 3개쯤 내되 각각 "왜 그 아이가 좋아할지" 한 줄을 붙여. 하나를 강요하지 말고 학생이 고르게 해.
- 만들기: 요청대로 자체 완결형 HTML로 만들고, 끝나면 짧게 격려해.
- 개선: 지금 작품을 '실제 어린이' 입장에서 보고 더 좋게 만들 점 2~3개를 우선순위로 제안해. 한꺼번에 다 고치지 말고 무엇부터 할지 학생이 고르게 해.
틈틈이 "이건 몇 살 아이를 위한 거지? 처음 열면 뭘 해야 할지 바로 알까?"처럼 실제 사용자(어린이) 관점을 일깨우고, '완벽보다 반복'을 격려해. 단, 학생이 그냥 "이거 만들어줘" 하면 코칭을 들이밀지 말고 자연스럽게 만들어줘 — 막혀 보일 때 한두 마디 거드는 정도면 충분해.

[코드를 줄 때만 지키는 환경 제약]
- 미리보기는 HTML 파일 하나를 통째로 렌더해. 그러니 결과물은 자체 완결형 HTML 한 파일이어야 한다(<!DOCTYPE html>…</html>). 학생 작품은 iframe(sandbox=allow-scripts, srcdoc)로 렌더된다.
- 라이브러리는 CDN <script src>로만 가져온다(p5.js, Three.js, Phaser, GSAP, Tone.js 등 자유롭게). npm 설치나 빌드가 필요한 건 미리보기에서 못 돌아간다.
- 코드는 \`\`\`html 코드블록 하나에 전체 파일을 넣는다. 수정 요청이면 부분이 아니라 전체 파일을 다시 완성해서 준다.

그 외엔 제약 없어. 기본은 한국어지만 사용자가 다른 언어를 쓰면 맞춘다.`;

// (extractHtml은 utils.js로 옮겨 클라이언트가 처리 — 스트리밍은 원문 텍스트를 그대로 흘려보낸다)

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

// Claude를 스트리밍으로 호출. 텍스트 조각마다 onDelta(text) 콜백. 완료 시 usage 반환.
async function callClaudeStream(messages, model, onDelta) {
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
      max_tokens: 32768, // 스트리밍이라 큰 출력 가능 — 큰 단일 작품(게임 등) 생성 여유 (Sonnet/Haiku 최대 64K)
      system: SYSTEM_PROMPT,
      stream: true,
      messages: messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude API 오류 (${res.status}): ${errText.slice(0, 300)}`);
  }

  let inputTokens = 0, outputTokens = 0;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      let ev;
      try { ev = JSON.parse(payload); } catch { continue; }
      if (ev.type === 'message_start') inputTokens = (ev.message && ev.message.usage && ev.message.usage.input_tokens) || 0;
      else if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') onDelta(ev.delta.text || '');
      else if (ev.type === 'message_delta') outputTokens = (ev.usage && ev.usage.output_tokens) || outputTokens;
      else if (ev.type === 'error') throw new Error((ev.error && ev.error.message) || 'Claude 스트림 오류');
    }
  }
  return { usage: { model, inputTokens, outputTokens, totalTokens: inputTokens + outputTokens } };
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

  // 바디 파싱 (Vercel은 보통 req.body를 채워주지만 안전하게 양쪽 처리). SSE 전에 끝낸다.
  let body = req.body;
  try {
    if (typeof body === 'string') body = JSON.parse(body || '{}');
    if (!body) {
      const raw = await new Promise(resolve => { let d = ''; req.on('data', c => d += c); req.on('end', () => resolve(d)); });
      body = JSON.parse(raw || '{}');
    }
  } catch { body = {}; }

  const messages = Array.isArray(body && body.messages) ? body.messages : [];
  if (messages.length === 0) { res.status(400).json({ error: 'messages가 비어 있습니다.' }); return; }
  if (messages.length > 40) { res.status(400).json({ error: '대화가 너무 깁니다. 새로 시작해주세요.' }); return; }

  // ── 여기서부터 SSE 스트리밍 (위 가드들은 일반 JSON 상태코드로 응답) ──
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // 프록시 버퍼링 억제
  if (res.flushHeaders) res.flushHeaders();
  const sse = obj => res.write('data: ' + JSON.stringify(obj) + '\n\n');

  try {
    const provider = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();
    let usage;
    if (provider === 'claude') {
      const model = pickClaudeModel(messages);
      usage = (await callClaudeStream(messages, model, t => { if (t) sse({ delta: t }); })).usage;
    } else {
      // Gemini는 비스트리밍 호출 후 한 번에 흘려보냄 (클라 코드 통일)
      const r = await callGemini(messages);
      if (r.text) sse({ delta: r.text });
      usage = r.usage;
    }
    sse({ done: true, usage });
  } catch (e) {
    console.error(e);
    sse({ error: e.message || '서버 오류가 발생했습니다.' });
  }
  res.end();
};

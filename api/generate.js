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
//   CLAUDE_MODEL     기본 'claude-haiku-4-5-20251001'
//
// 요청  (POST):  { messages: [{ role:'user'|'assistant', content:string }, ...] }
// 응답:          { html, usage: { model, inputTokens, outputTokens, totalTokens } }

const SYSTEM_PROMPT = `너는 유능하고 친근한 코딩 도우미야. 사용자와 자연스럽게 대화하면서 웹 결과물을 함께 만든다. 일반적인 질문엔 평범하게 대화로 답하고, 아이디어를 제안하거나 되물어도 좋다(티키타카 환영). 무언가를 만들거나 고쳐야 할 때 코드를 준다.

코드를 줄 때 규칙:
1. 반드시 **자체 완결형 HTML 한 파일**로 만든다(<!DOCTYPE html>…</html>). 이 플랫폼은 그 파일을 그대로 미리보기에 렌더한다.
2. 외부 파일 참조 금지. 라이브러리는 **CDN <script src>** 로만 가져온다(p5.js, Three.js, Phaser, GSAP, Tone.js 등 가능). npm/빌드 단계가 필요한 코드는 금지.
3. 코드는 반드시 \`\`\`html 코드블록 하나 안에 **전체 파일**을 넣는다. 수정 요청이면 부분/diff가 아니라 **전체 파일을 다시** 완성해서 준다.
4. 코드 앞뒤에 짧은 설명이나 다음 제안을 곁들여도 좋다. 단, 설명은 간결하게.

특별한 요청이 없으면 한국어로 자연스럽게 대화한다(사용자가 다른 언어를 쓰면 맞춘다).`;

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

async function callClaude(messages) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY가 설정되지 않았습니다.');
  const model = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';

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

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST만 허용됩니다.' });
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
    const result = provider === 'claude' ? await callClaude(messages) : await callGemini(messages);
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

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

const SYSTEM_PROMPT = `너는 "바이브코딩 쇼케이스"의 코딩 도우미야. 커버넌트 하이스쿨 학생들이 어린이 주일학교(KIDS)를 위한 게이미피케이션 교구를 만든다.

규칙(반드시 지켜):
1. 항상 **자체 완결형 HTML 한 파일**로만 답한다. <!DOCTYPE html> 로 시작해서 </html> 로 끝난다.
2. 외부 파일 참조 금지. 필요한 라이브러리는 **CDN <script src>** 로만 가져온다 (p5.js, Three.js, Phaser, GSAP, Tone.js 등 가능). npm/빌드 단계가 필요한 코드는 금지.
3. **코드만 출력**한다. 마크다운 코드펜스(\`\`\`), 설명 문장, 인사말을 절대 붙이지 않는다.
4. 사용자가 수정을 요청하면 **전체 HTML 파일을 처음부터 다시** 완성해서 출력한다(부분/diff 금지).
5. UI 텍스트는 한국어로, 어린이가 쓰기 좋게 밝고 직관적으로 만든다.`;

// 마크다운 코드펜스가 섞여 오면 제거
function stripFences(text) {
  let t = (text || '').trim();
  const fence = t.match(/^```(?:html)?\s*\n([\s\S]*?)\n?```$/i);
  if (fence) return fence[1].trim();
  // 펜스가 한쪽만 있는 경우도 정리
  t = t.replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  return t.trim();
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
    html: stripFences(text),
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
    html: stripFences(text),
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

    if (!result.html) {
      res.status(502).json({ error: 'AI가 빈 응답을 반환했습니다. 다시 시도해주세요.' });
      return;
    }
    res.status(200).json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || '서버 오류가 발생했습니다.' });
  }
};

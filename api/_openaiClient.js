// Shared helper for calling OpenAI's Responses API (GPT-5.6 Sol) with
// image + text input, replacing the previous Gemini-based calls in
// analyze.js and _briefAnalysis.js. Mirrors the error-shape convention
// used everywhere else in this codebase: throws an Error with `.status`
// set to the HTTP status when it maps cleanly, and `.raw` set to the raw
// response text when JSON parsing fails — so existing catch blocks in
// callers (which check err.status for 429/5xx retry logic) work unchanged.

const OPENAI_MODEL = 'gpt-5.6-luna'; // 임시: Sol 대비 품질 비교 테스트용 (test-gpt-5.6-luna 브랜치)
const OPENAI_URL = 'https://api.openai.com/v1/responses';

// images: [{ base64, mediaType }, ...]
// reasoningEffort: 'medium' | 'high' (etc.) — see callers for how this maps
// from the old Gemini thinkingLevel values.
export async function callOpenAI({ apiKey, promptText, images, maxOutputTokens, reasoningEffort }) {
  const content = [{ type: 'input_text', text: promptText }];
  for (const img of images || []) {
    if (!img || !img.base64 || !img.mediaType) continue;
    content.push({ type: 'input_image', image_url: `data:${img.mediaType};base64,${img.base64}` });
  }

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [{ role: 'user', content }],
      reasoning: { effort: reasoningEffort || 'medium' },
      max_output_tokens: maxOutputTokens,
      text: { format: { type: 'json_object' } },
    }),
  });

  let data;
  try {
    data = await response.json();
  } catch (e) {
    const err = new Error('서버 응답을 읽지 못했습니다 (status ' + response.status + ').');
    err.status = response.status;
    throw err;
  }

  if (!response.ok) {
    const msg = (data && data.error && data.error.message) ? data.error.message : ('status ' + response.status);
    const err = new Error('OpenAI API 오류: ' + msg);
    err.status = response.status;
    throw err;
  }

  const textBlock = extractOutputText(data);
  const clean = (textBlock || '').replace(/```json|```/g, '').trim();

  if (!clean) {
    const status = data && data.status;
    const err = new Error('AI로부터 빈 응답을 받았습니다' + (status ? ` (사유: ${status})` : '') + '.');
    err.status = 502;
    throw err;
  }

  try {
    return JSON.parse(clean);
  } catch (e) {
    const err = new Error('AI 응답을 해석하지 못했습니다.');
    err.status = 502;
    err.raw = textBlock;
    throw err;
  }
}

// Responses API puts the final assistant text at output_text as a
// convenience field; fall back to walking the output array (needed when
// reasoning items precede the message item) if that's not present.
function extractOutputText(data) {
  if (data && typeof data.output_text === 'string' && data.output_text) return data.output_text;
  if (!data || !Array.isArray(data.output)) return '';
  for (const item of data.output) {
    if (item.type === 'message' && Array.isArray(item.content)) {
      const textPart = item.content.find((c) => c.type === 'output_text' || c.type === 'text');
      if (textPart && textPart.text) return textPart.text;
    }
  }
  return '';
}

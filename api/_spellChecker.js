// 4번(정보 정확성) 보조 신호: 부산대학교 한국어 맞춤법/문법 검사기(PNU WebSpeller) API를
// 호출해 OCR로 읽은 배너 텍스트를 규칙 기반으로 한 번 더 대조한다. AI 시각 판단만으로는
// 놓치기 쉬운 자모 하나 차이(예: "구매하고"→"구매햐고") 같은 오탈자를 기계적으로 잡아내기
// 위한 보조 신호이며, 최종 판정은 여전히 AI가 프롬프트 지침에 따라 내린다.
//
// Fails soft everywhere: PNU_SPELLER_API_KEY가 없거나 호출이 실패/타임아웃되면 null을
// 반환하고 호출부는 이 신호 없이 기존 방식(AI 시각 판단)으로만 진행한다.
//
// API 키는 이 서버 환경 변수에만 존재하며 브라우저로는 절대 전달되지 않는다.

const SPELLER_URL = 'https://dcplxo2e85.execute-api.ap-northeast-2.amazonaws.com/v1/PnuWebSpeller/check';

function xmlUnescape(str) {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

// OCR 필드를 화면상 읽는 순서(위→아래, 비슷한 세로 위치면 왼쪽→오른쪽)로 정렬해
// 하나의 문장으로 이어붙인다. 서로 다른 디자인 블록(헤드라인/CTA 등)이 이어지면서
// 실제로는 없는 띄어쓰기·문장부호 오류로 보일 수 있다는 한계가 있음 — 이건 참고용
// 신호이므로 프롬프트 쪽(formatSpellCheckForPrompt)에서 이 한계를 AI에게 알린다.
function buildReadingOrderText(fields) {
  const items = fields
    .map((f) => {
      const text = (f.inferText || '').trim();
      const verts = (f.boundingPoly && f.boundingPoly.vertices) || [];
      if (!text || !verts.length) return null;
      const top = Math.min(...verts.map((v) => v.y));
      const left = Math.min(...verts.map((v) => v.x));
      return { text, top, left };
    })
    .filter(Boolean);
  items.sort((a, b) => (Math.abs(a.top - b.top) < 20 ? a.left - b.left : a.top - b.top));
  return items.map((i) => i.text).join(' ');
}

// candWord가 orgStr 뒤에 마침표/물음표/느낌표만 붙인 형태라면(예: "구매하세요"→"구매하세요."),
// 배너 카피는 관행적으로 종결 문장부호를 생략하는 경우가 대부분이라 사실상 항상 오탐이다.
// 이런 제안은 애초에 프롬프트에 올리지 않는다.
function isPunctuationOnlySuggestion(orgStr, candWord) {
  if (!orgStr || !candWord) return false;
  return candWord.replace(/[.?!]+$/, '') === orgStr;
}

// 공백만 다른 제안(예: "3만원"→"3만 원")도 올리지 않는다.
//
// 이 검사기에 넘기는 문장은 OCR 필드를 읽기 순서로 이어붙여 만든 것이라
// 띄어쓰기가 원본 그대로가 아니다 — buildReadingOrderText가 필드 사이에
// 공백을 넣기 때문에 디자인상 붙어 있던 글자가 떨어지고, 반대로 한 필드
// 안에서 OCR이 공백을 흘리면 떨어져 있던 글자가 붙는다. 즉 이 문장의
// 띄어쓰기는 애초에 배너의 띄어쓰기가 아니다.
//
// 실제로 "최대 3만 원"처럼 제대로 띄어 쓴 배너에 대고 계속 "띄어 쓰라"는
// 지적이 나왔다. 판단 근거가 될 수 없는 신호라 아예 넘기지 않고, 띄어쓰기는
// 이미지를 직접 보고 판단하도록 프롬프트에 따로 안내한다.
function isSpacingOnlySuggestion(orgStr, candWord) {
  if (!orgStr || !candWord) return false;
  const strip = (t) => t.replace(/\s+/g, '');
  return strip(orgStr) === strip(candWord);
}

function parseSpellerXml(xml) {
  // "문법 및 철자 오류가 발견되지 않았습니다"는 실패가 아니라 "오류 없음"을 뜻하는
  // 문서화된 특이 케이스임. 그 외 <Error> 메시지는 실제 처리 실패로 본다.
  const errorMatch = xml.match(/<Error\s+msg=(['"])(.*?)\1\s*\/?>/);
  if (errorMatch) {
    if (errorMatch[2].includes('발견되지 않았습니다')) return [];
    return null;
  }
  const blocks = xml.match(/<PnuErrorWord\b[^>]*>[\s\S]*?<\/PnuErrorWord>/g) || [];
  return blocks
    .map((block) => {
      const org = block.match(/<OrgStr>([\s\S]*?)<\/OrgStr>/);
      const cand = block.match(/<CandWord>([\s\S]*?)<\/CandWord>/);
      const orgStr = org ? xmlUnescape(org[1]) : '';
      const candWord = cand ? xmlUnescape(cand[1]) : '';
      return { orgStr, candWord };
    })
    .filter((e) => e.orgStr && e.candWord
      && !isPunctuationOnlySuggestion(e.orgStr, e.candWord)
      && !isSpacingOnlySuggestion(e.orgStr, e.candWord));
}

export async function checkSpelling(fields) {
  const apiKey = process.env.PNU_SPELLER_API_KEY;
  if (!apiKey || !Array.isArray(fields) || !fields.length) return null;

  const sentence = buildReadingOrderText(fields);
  if (!sentence || sentence.length < 2) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18000);
    const response = await fetch(`${SPELLER_URL}?weakOpt=1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ sentence }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const xml = await response.text();
    return parseSpellerXml(xml);
  } catch (e) {
    return null;
  }
}

export function formatSpellCheckForPrompt(errors) {
  if (!Array.isArray(errors)) return '';
  if (!errors.length) {
    return '';
  }
  const lines = errors.slice(0, 20).map((e) => `- "${e.orgStr}" → "${e.candWord}" 제안`);
  return `\n\n4번(정보 정확성) 맞춤법 검사기 결과(참고용): 규칙 기반 한국어 맞춤법 검사기가 OCR로 읽은 텍스트에서 아래 항목을 오류로 감지하고 대치어를 제안했습니다:
${lines.join('\n')}

주의 — 이 결과는 참고 신호일 뿐입니다. 그대로 신뢰해서 기계적으로 판정하지 말고 아래를 감안해 실제 문제인 경우만 4번에서 지적하세요:
- OCR 텍스트를 화면상 읽는 순서로 이어붙여 검사한 결과라, 서로 다른 디자인 블록(예: 헤드라인과 CTA 문구)이 하나의 문장처럼 이어지면서 실제로는 없는 오류로 보일 수 있습니다.
- 띄어쓰기만 다른 제안은 이 목록에서 미리 걸러냈습니다. 이어붙이는 과정에서 없던 공백이 생기거나 있던 공백이 사라져서, 이 문장의 띄어쓰기는 배너의 실제 띄어쓰기가 아니기 때문입니다. 띄어쓰기는 반드시 이미지에 인쇄된 글자를 직접 보고 판단하고, 검사기 결과를 근거로 띄어쓰기를 지적하지 마세요.
- 브랜드명·상품명·신조어처럼 사전에 없는 고유명사는 검사기가 오류로 잡아도 실제로는 정상입니다.
- 이미지 안 실제 텍스트를 다시 확인했을 때도 명백히 자모가 틀린 경우(예: "구매하고"가 "구매햐고")처럼 확실한 오탈자만 지적하고, note에 검사기가 제안한 대치어를 근거로 남기세요. 애매하면 지적하지 말고 넘어가세요.`;
}

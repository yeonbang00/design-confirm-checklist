// POST /api/analyzeReferenceImage
// Body: { base64, mediaType, brandName? }
// Returns: { note: string, type: string, category: string, brandName: string } | { error: string }
//
// Used by the "이미지 올리기" upload modal on reference-board.html — as soon
// as someone picks a file, this fills in the 메모(note)/유형(type) fields
// automatically so they don't have to write a one-line summary or classify
// the banner by hand. Mirrors what Claude used to do manually when curating
// images in bulk (see the "AI 한줄평" batches in _referenceLibrary.js) —
// same idea, just live instead of an offline script.
//
// category/brandName은 폴더에서 여러 장을 한 번에 올리는 일괄 업로드 화면을
// 위해 추가됨 — brandName이 이미 넘어왔으면(단일 업로드처럼 사용자가 직접
// 입력한 경우) 그대로 존중하고 다시 추측하지 않지만, 없으면 이미지 속
// 로고·텍스트를 보고 추측한다.

import { callOpenAI } from './_openaiClient.js';
import { rejectIfNotSameOrigin } from './_originCheck.js';
import { REFERENCE_CATEGORIES } from './_referenceLibrary.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '8mb',
    },
  },
};

// reference-board.html의 TYPE_LABELS와 동일하게 유지할 것.
const TYPE_LABELS = {
  problem: '문제제기형', beforeafter: '비포애프터형', comparison: '비교형',
  numbers: '숫자강조형', testimonial: '후기·인용형', authority: '권위형',
  benefit: '혜택직관형', usage: '사용장면형', product: '제품단독형',
  list: '리스트형', question: '질문형', seasonal: '시즌이슈형',
  character: '캐릭터·일러스트형', event: '이벤트·응모형',
};

function buildPrompt(brandName) {
  const typeList = Object.entries(TYPE_LABELS).map(([id, label]) => `${id}(${label})`).join(', ');
  const catList = Object.entries(REFERENCE_CATEGORIES).map(([id, c]) => `${id}(${c.name})`).join(', ');
  const needBrandGuess = !brandName;
  return `다음은 광고 배너 레퍼런스 이미지입니다${brandName ? ` (브랜드: ${brandName})` : ''}. 이미지를 보고 아래 항목을 채워서 응답하세요.

- note: 이 배너의 핵심 오퍼·비주얼을 15단어 이내 한국어 한 줄로 요약하세요 (예: "슈즈 가을세일, 로퍼 클로즈업 최대64%", "홀리데이 선물전, 눈밭 스냅 부츠 최대72%"). 브랜드명은 별도로 이미 기록되니 note에 다시 쓰지 말고, 할인율·기간·소재·구도 등 오퍼와 비주얼 위주로 구체적으로 쓰세요.
- type: 이 배너에 가장 가까운 유형 하나를 아래 목록에서 정확히 그 영문 id 그대로 고르세요 (목록에 없는 값은 절대 쓰지 마세요): ${typeList}
- category: 이 배너에 가장 가까운 업종 카테고리 하나를 아래 목록에서 정확히 그 영문 id 그대로 고르세요 (목록에 없는 값은 절대 쓰지 마세요): ${catList}
${needBrandGuess ? '- brandName: 이미지 속 로고나 텍스트를 보고 브랜드명을 추측해 한국어 또는 원문 그대로 적으세요. 전혀 알아볼 수 없으면 빈 문자열로 두세요.' : ''}

반드시 아래 JSON 스키마로만 응답하세요. 다른 텍스트는 포함하지 마세요:
{"note":"...","type":"...","category":"..."${needBrandGuess ? ',"brandName":"..."' : ''}}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (rejectIfNotSameOrigin(req, res)) return;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: '서버에 OPENAI_API_KEY 환경변수가 설정되어 있지 않습니다.' });
    return;
  }

  const { base64, mediaType, brandName } = req.body || {};
  if (!base64 || !mediaType) {
    res.status(400).json({ error: '이미지 데이터가 없습니다.' });
    return;
  }

  try {
    const parsed = await callOpenAI({
      apiKey,
      promptText: buildPrompt(brandName),
      images: [{ base64, mediaType }],
      maxOutputTokens: 500,
      reasoningEffort: 'medium',
    });
    const note = typeof parsed.note === 'string' ? parsed.note.trim() : '';
    const type = Object.prototype.hasOwnProperty.call(TYPE_LABELS, parsed.type) ? parsed.type : '';
    const category = Object.prototype.hasOwnProperty.call(REFERENCE_CATEGORIES, parsed.category) ? parsed.category : '';
    const guessedBrandName = typeof parsed.brandName === 'string' ? parsed.brandName.trim() : '';
    res.status(200).json({ note, type, category, brandName: brandName || guessedBrandName });
  } catch (err) {
    const status = (err && err.status) || 500;
    res.status(status).json({ error: err && err.message ? err.message : '분석 중 알 수 없는 오류가 발생했습니다.' });
  }
}

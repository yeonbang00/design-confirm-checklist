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
import { AXES, AXIS_KEYS, cleanAxes } from './_referenceAxes.js';

/* 브랜드·업종·유형 셋만으로는 "비슷한 것"을 못 찾는다. 실측 — 업종x유형
   조합이 117개뿐이라 화장품 혜택형 한 장에 109장이 걸리고, 978장 중
   194장은 이웃이 여섯도 안 된다. 축 아홉 개를 같이 받는다. */
const axisBlock = AXIS_KEYS.map((k) => {
  const vals = Object.entries(AXES[k].values).map(([id, ko]) => `${id}(${ko})`).join(' ');
  return `  ${k} · ${AXES[k].ko} · ${vals}`;
}).join('\n');

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

- axes: 이 배너를 아래 아홉 축으로 설명하세요. **각 축마다 반드시 목록 안의 영문 id 하나만** 쓰세요.
${axisBlock}

  축을 고르는 기준입니다.
  · device는 화면을 무엇으로 묶었는지입니다. 숫자 아래 색 띠가 깔렸으면 figure,
    좌우로 갈렸으면 split, 사진 위에 글자만 얹혔으면 overlay, 흰 카드나 띠에 글자를
    담았으면 card, 타이포가 화면을 지배하면 type, 여러 칸으로 나열했으면 grid,
    인물이 화면을 채우고 글자가 비켜섰으면 hero입니다.
  · chunks는 눈에 몇 덩어리로 읽히는지입니다. 줄 수가 아니라 덩어리 수입니다.
  · figure는 할인율이나 가격 숫자가 얼마나 큰지입니다. 숫자가 없으면 none입니다.
  · appeal은 무엇을 팔고 있는지, type은 어떻게 말하고 있는지입니다. 둘은 다릅니다.

반드시 아래 JSON 스키마로만 응답하세요. 다른 텍스트는 포함하지 마세요:
{"note":"...","type":"...","category":"...","axes":{${AXIS_KEYS.map(k => `"${k}":"..."`).join(',')}}${needBrandGuess ? ',"brandName":"..."' : ''}}`;
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
  /* 이미 Blob에 올라가 있는 레퍼런스를 다시 태깅할 때는 URL만 넘긴다.
     978장을 base64로 실어 나르면 요청이 터진다. 우리 Blob만 허용한다 —
     임의 주소를 받으면 서버가 남의 내부망을 대신 찔러주는 꼴이 된다. */
  const BLOB = 'https://oeiquwo26iglgctf.public.blob.vercel-storage.com/';
  let image = base64 && mediaType ? { base64, mediaType } : null;
  if (!image && typeof req.body?.url === 'string' && req.body.url.startsWith(BLOB)) {
    try {
      const r = await fetch(req.body.url);
      if (!r.ok) throw new Error('이미지를 가져오지 못했습니다.');
      const buf = Buffer.from(await r.arrayBuffer());
      image = { base64: buf.toString('base64'), mediaType: r.headers.get('content-type') || 'image/jpeg' };
    } catch (e) {
      res.status(502).json({ error: '레퍼런스 이미지를 가져오지 못했습니다.' });
      return;
    }
  }
  if (!image) {
    res.status(400).json({ error: '이미지 데이터가 없습니다.' });
    return;
  }

  try {
    const parsed = await callOpenAI({
      apiKey,
      promptText: buildPrompt(brandName),
      images: [image],
      maxOutputTokens: 900,
      reasoningEffort: 'medium',
    });
    const note = typeof parsed.note === 'string' ? parsed.note.trim() : '';
    const type = Object.prototype.hasOwnProperty.call(TYPE_LABELS, parsed.type) ? parsed.type : '';
    const category = Object.prototype.hasOwnProperty.call(REFERENCE_CATEGORIES, parsed.category) ? parsed.category : '';
    const guessedBrandName = typeof parsed.brandName === 'string' ? parsed.brandName.trim() : '';
    res.status(200).json({
      note, type, category,
      axes: cleanAxes(parsed.axes),
      brandName: brandName || guessedBrandName,
    });
  } catch (err) {
    const status = (err && err.status) || 500;
    res.status(status).json({ error: err && err.message ? err.message : '분석 중 알 수 없는 오류가 발생했습니다.' });
  }
}

// Lightweight preliminary vision call: locate faces in the banner so the
// caller (index.html) can crop+zoom each one and hand it back as a
// separate, context-free image on the main /api/analyze request.
//
// Why this exists: 10번(신체 비율 왜곡)의 "이목구비가 흐릿하게 뭉개짐" 판정을
// 여러 차례 프롬프트만으로 고쳐봤지만 실제 재현 결과 인물의 얼굴만 계속
// 놓쳤다(손·발은 매번 잡힘) — 전체 배너의 훈훈한 장면 맥락이 얼굴을 관대하게
// 보게 만드는 것으로 추정됨. 얼굴만 잘라 맥락 없이 별도로 보여주면 더
// 비판적으로 판단할 가능성이 있어 도입. 자세한 디버깅 과정은
// feedback_designhero_ai_artifact_item_boundary_gap 메모리 참고.
//
// Fails soft everywhere: any error (missing key, bad/truncated JSON,
// network) returns [] and the caller proceeds without face crops — this
// must never block the main analysis.

import { callOpenAI } from './_openaiClient.js';

const FACE_DETECT_PROMPT = `이 이미지 안에서 사람 얼굴을 찾으세요. 최대 3명까지, 화면에서 이목구비가 어느 정도 보이는 얼굴만 대상으로 합니다(뒤통수만 보이거나 너무 작아서 이목구비를 구분할 수 없는 얼굴은 제외).

각 얼굴에 대해 이미지 좌상단을 (0,0)으로 하는 픽셀 좌표로 바운딩 박스를 주세요. 박스는 이마 위쪽부터 턱 아래쪽까지, 얼굴 양옆에 여유를 살짝 두고 넉넉하게 잡아주세요(너무 타이트하게 자르지 마세요).

label에는 "아기 얼굴", "여성 얼굴"처럼 누구의 얼굴인지 짧게 구분할 수 있는 설명을 적으세요.

아래 JSON 형식으로만 응답하세요:
{"faces": [{"label": "짧은 설명", "x": 정수, "y": 정수, "width": 정수, "height": 정수}]}

얼굴이 하나도 없으면 {"faces": []}로 응답하세요.`;

export async function detectFaces(apiKey, base64, mediaType, imageWidth, imageHeight) {
  if (!apiKey || !base64 || !mediaType) return [];
  try {
    const sizeNote = (Number.isFinite(imageWidth) && Number.isFinite(imageHeight))
      ? `\n\n이 이미지의 크기는 가로 ${imageWidth}px, 세로 ${imageHeight}px입니다. 좌표는 이 크기 기준으로 주세요.`
      : '';
    const result = await callOpenAI({
      apiKey,
      promptText: FACE_DETECT_PROMPT + sizeNote,
      images: [{ base64, mediaType }],
      maxOutputTokens: 2000,
      reasoningEffort: 'low',
    });
    const faces = Array.isArray(result && result.faces) ? result.faces : [];
    return faces
      .filter((f) => f && Number.isFinite(f.x) && Number.isFinite(f.y) && Number.isFinite(f.width) && Number.isFinite(f.height) && f.width > 0 && f.height > 0)
      .slice(0, 3)
      .map((f) => ({
        label: (typeof f.label === 'string' && f.label.trim()) || '얼굴',
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
      }));
  } catch (e) {
    return [];
  }
}

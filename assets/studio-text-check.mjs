/* 그림 안에 그려 넣은 숫자를 확인한다.
 *
 * 카피까지 그림에 그리게 열었다. 문구가 틀리면 고쳐 쓰면 그만이지만
 * 숫자는 다르다. "최대 87%"가 박힌 배너가 나가면 심의에 걸린다.
 * 신세계 딜 페이지 제목이 "최대 87% OFF"인데 실제 데이터는 128개 전부
 * 20%였던 적이 있다. 제목의 숫자를 안 믿는 것과 같은 이유로,
 * AI가 그린 숫자도 안 믿고 다시 읽어 대조한다.
 *
 * 상품 라벨에 원래 인쇄된 숫자(532mL, 72hr)까지 잡으면 오탐만 는다.
 * 광고 심의가 보는 것은 금액과 퍼센트다. 그 둘만 본다.
 */

const MONEY = /[\d][\d,]{2,}\s*원/g;
const PERCENT = /\d+(?:\.\d+)?\s*%/g;

const norm = t => String(t || '').replace(/\s+/g, '');

export function findClaims(text) {
  // Preserve boundaries between OCR regions: a label's "5.07" beside "41%"
  // must not turn into an invented "5.0741%" claim.
  const flat = String(text || '');
  return [...new Set([...(flat.match(MONEY) || []), ...(flat.match(PERCENT) || [])].map(norm))];
}

/* 확인된 값 목록과 대조한다. 목록에 없는 금액·퍼센트가 그림에 있으면
   그것을 돌려준다. 빈 배열이면 문제 없다는 뜻이다.

   확인된 값도 그대로 비교하지 않고 같은 방식으로 숫자만 뽑는다.
   슬롯 값은 "5% 혜택"처럼 꼬리말이 붙어 있어서, 문자열을 통째로 맞추면
   그림의 "5%"가 확인된 값과 다르다고 나온다. */
export function unverifiedClaims(imageText, verified) {
  const ok = new Set();
  for (const v of verified) for (const c of findClaims(v)) ok.add(norm(c));
  return findClaims(imageText).filter(c => !ok.has(norm(c)));
}

/* 생성된 이미지를 OCR로 읽어 확인되지 않은 숫자를 찾는다.
   OCR이 안 붙어 있거나 실패하면 null을 돌려준다 — '문제 없음'과 구분해야
   한다. 확인을 못 한 것을 확인했다고 말하면 안 된다. */
export async function checkBakedText(url, verified, getJSON) {
  try {
    const data = await getJSON('/api/imageText', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(url.startsWith('data:')?{base64:url.split(',')[1],mediaType:url.slice(5,url.indexOf(';'))}:{url}),
    });
    if (!data || !data.ocr || !Array.isArray(data.boxes)) return null;
    const text = data.boxes.map(b => b.text).join(' ');
    return { claims: unverifiedClaims(text, verified), read: text.slice(0, 6000) };
  } catch {
    return null;
  }
}

export function renderedCopyIssues(check,copy){
 if(!check)return ['광고 문구를 확인하지 못했습니다'];
 const compact=s=>String(s||'').replace(/[^가-힣A-Za-z0-9%]/g,'').toLowerCase();
 const read=compact(check.read),issues=[];
 if(check.claims.length)issues.push('확인되지 않은 수치: '+check.claims.join(', '));
 if(copy.cta&&!read.includes(compact(copy.cta)))issues.push('CTA 문구 누락 또는 오탈자');
 const prices=findClaims([copy.headline,copy.subline,copy.offer].join(' ')).filter(x=>x.endsWith('원'));
 for(const price of prices)if(read.split(compact(price)).length>2)issues.push('같은 가격 중복');
 return issues;
}

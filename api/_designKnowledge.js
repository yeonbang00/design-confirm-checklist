// The published item guide is the shared source, not another copied prompt.
// Vercel bundles this fixed local file; no user-selected URL or document is loaded.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

export function plainGuideText(html){
 return html.replace(/<(script|style|svg)\b[\s\S]*?<\/\1>/gi,' ')
  .replace(/<!--[\s\S]*?-->/g,' ').replace(/<[^>]+>/g,' ')
  .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"')
  .replace(/\s+/g,' ').trim();
}
export function parseCriteriaGuide(html){
 const chunks=html.split(/<div\b[^>]*class="item-card"[^>]*>/).slice(1);
 const rules=chunks.map(chunk=>{
  // Stop before footer/scripts. A following group heading is harmless but omitted.
  chunk=chunk.split(/<div\b[^>]*class="group-title"|<footer|<script|<\/main>/)[0];
  const id=Number(chunk.match(/class="item-num"[^>]*>(\d+)/)?.[1]);
  const title=plainGuideText(chunk.match(/class="item-title"[^>]*>([\s\S]*?)<\//)?.[1]||'');
  // Confirmation bullets and explicit rejection examples are mandatory.
  // Detailed evidence remains present in the source; select a bounded excerpt per item.
  const checks=[...chunk.matchAll(/<(ul|div)\b[^>]*class="(?:bullets|reject-box)"[^>]*>([\s\S]*?)<\/\1>/g)].map(m=>plainGuideText(m[2])).join(' ');
  const evidence=plainGuideText(chunk.split(/class="evidence-box"[^>]*>/).slice(1).join(' '));
  return {id,title,checks,evidence};
 }).filter(r=>r.id&&r.title);
 if(rules.length!==17||new Set(rules.map(r=>r.id)).size!==17)throw Error('항목 가이드 구조가 변경됐습니다. 공통 가이드 연결을 확인해주세요.');
 return {version:createHash('sha256').update(JSON.stringify(rules)).digest('hex').slice(0,16),rules};
}
const STAGES={copy:[1,2,3,4,5,9],image:[1,2,3,5,6,7,8,9,10,11,12,13,14,15,16,17],analysis:Array.from({length:17},(_,i)=>i+1)};
export function getDesignKnowledge(stage){
 if(!STAGES[stage])throw Error('공통 가이드 사용 단계를 확인해주세요.');
 const guide=parseCriteriaGuide(readFileSync(new URL('../criteria-guide.html',import.meta.url),'utf8'));
 const rules=guide.rules.filter(r=>STAGES[stage].includes(r.id));
 const metadata={source:'criteria-guide.html',version:guide.version,stage,itemIds:rules.map(r=>r.id),excerpted:true};
 const purpose=stage==='analysis'?'기존 판정 절차·예외·브랜드/매체 지침을 유지하며 아래 최신 공개 가이드도 함께 대조한다.':
  '퍼포먼스 광고 제작에 적용한다. 참고 예시의 브랜드·상품·수치·혜택은 사실 근거가 아니며 복사하지 않는다. 현재 상품의 확정 카피와 근거만 그린다. 제작 방향의 명확한 CTA 요구를 지킨다.';
 return {metadata,prompt:'\n[공통 항목 가이드 '+guide.version+'] '+purpose+'\n'+rules.map(r=>`${r.id}. ${r.title}\n${r.checks}\n설명 발췌: ${r.evidence.slice(0,600)}`).join('\n')};
}

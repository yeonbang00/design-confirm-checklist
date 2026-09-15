import {createHash} from 'node:crypto';
import {AXES_SCHEMA} from './_referenceAxesStore.js';
export function referenceSnapshot(items,category){
 const entries=items.map(x=>({url:x.thumbUrl,brand:x.brandName,type:x.type,note:x.note,axes:x.axes||{}})).sort((a,b)=>String(a.url).localeCompare(String(b.url)));
 return {category:category||'all',count:entries.length,axesSchema:AXES_SCHEMA,version:createHash('sha256').update(JSON.stringify(entries)).digest('hex').slice(0,16)};
}

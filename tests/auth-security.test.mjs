import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sessionToken,verifySession,draftToken,SESSION_TTL} from '../api/_authSession.js';
// Synthetic records only. Any accidental real network access fails this test.
globalThis.fetch=async()=>{throw Error('Network access forbidden in auth tests');};
const dummy={id:'a'.repeat(16),name:'Synthetic Test',email:'test@example.invalid',passwordHash:'b'.repeat(64),passwordSalt:'c'.repeat(32),status:'approved'};
let state,mode,writes,reads;
beforeEach(()=>{delete process.env.AUTH_MAINTENANCE;state={users:[{...dummy}]};mode='ok';writes=0;reads=0;process.env.AUTH_SESSION_SECRET='d'.repeat(64);process.env.AUTH_BLOB_READ_WRITE_TOKEN='mock-private-token';process.env.ADMIN_PASSWORD='mock-only-admin';});
globalThis.__authMockBlob={
 async get(path,options){reads++;assert.equal(path,'auth/users.json');assert.equal(options.access,'private');assert.equal(options.useCache,false);assert.equal(options.token,'mock-private-token');if(mode==='outage')throw Error('simulated');if(mode==='missing')return null;return {statusCode:200,stream:new Response(JSON.stringify(mode==='corrupt'?{users:[{}]}:state)).body};},
 async put(path,data,options){writes++;assert.equal(options.access,'private');assert.equal(options.token,'mock-private-token');assert.equal(options.allowOverwrite,true);state=JSON.parse(data);}
};
const url=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
let store=readFileSync(new URL('../api/_privateUsers.js',import.meta.url),'utf8').replace("import {get,put} from '@vercel/blob';","const {get,put}=globalThis.__authMockBlob;");
const storeUrl=url(store);
let middleware=readFileSync(new URL('../middleware.js',import.meta.url),'utf8')
 .replace("import { next } from '@vercel/edge';", "const next=()=>new Response(null,{status:200,headers:{'x-test-next':'1'}});")
 .replace("'./api/_privateUsers.js'",JSON.stringify(storeUrl))
 .replace("'./api/_authSession.js'",JSON.stringify(new URL('../api/_authSession.js',import.meta.url).href));
const {default:closedHandle}=await import(url(middleware));
const {default:handle}=await import(url(middleware.replace('const SITE_MAINTENANCE = true;', 'const SITE_MAINTENANCE = false;')));
function request(path='/',cookie='',body){return new Request('https://app.example.invalid'+path,{method:body?'POST':'GET',headers:{cookie,accept:'application/json',...(body?{origin:'https://app.example.invalid','content-type':'application/x-www-form-urlencoded'}:{})},...(body?{body:new URLSearchParams(body)}:{})});}
test('valid signed session admitted; cached response forbidden',async()=>{const token=await sessionToken(dummy);const r=await handle(request('/','adcheck_session_v2='+token));assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');});
test('legacy and tampered tokens rejected',async()=>{assert.equal(await verifySession('old.invalid',state),null);const t=await sessionToken(dummy);assert.equal(await verifySession(t.slice(0,-1)+(t.endsWith('0')?'1':'0'),state),null);assert.equal((await handle(request('/','adcheck_session=old.invalid'))).status,401);});
test('expiry is enforced by server',async()=>{const now=Date.now();const t=await sessionToken(dummy,now);assert.equal(await verifySession(t,state,now+(SESSION_TTL+1)*1000),null);});
test('revocation, password and signing secret changes invalidate cookies',async()=>{const t=await sessionToken(dummy);state.users[0].status='rejected';assert.equal(await verifySession(t,state),null);state.users[0]={...dummy,passwordHash:'e'.repeat(64)};assert.equal(await verifySession(t,state),null);state.users[0]={...dummy,sessionVersion:'new-approval'};assert.equal(await verifySession(t,state),null);state.users[0]={...dummy};process.env.AUTH_SESSION_SECRET='f'.repeat(64);assert.equal(await verifySession(t,state),null);});
test('storage outage denies even a correctly signed cookie',async()=>{const t=await sessionToken(dummy);mode='outage';const r=await handle(request('/','adcheck_session_v2='+t));assert.equal(r.status,503);assert.equal(r.headers.get('x-test-next'),null);assert.equal((await handle(request('/','adcheck_session_v2=arbitrary.invalid'))).status,503);});
test('missing/corrupt registry never bootstraps or overwrites users',async()=>{for(const m of ['missing','corrupt','outage']){mode=m;assert.equal((await handle(request('/_gate/signup','',{name:'Dummy',email:'new@example.invalid',password:'dummy-long-pw',passwordConfirm:'dummy-long-pw'}))).status,503);}assert.equal(writes,0);});
test('missing signing/private-store secrets fail closed, no public fallback',async()=>{delete process.env.AUTH_SESSION_SECRET;assert.equal((await handle(request())).status,503);assert.equal(reads,0);process.env.AUTH_SESSION_SECRET='d'.repeat(64);delete process.env.AUTH_BLOB_READ_WRITE_TOKEN;assert.equal((await handle(request())).status,503);assert.equal(reads,0);});
test('draft feature still requires separate admin proof',async()=>{const t=await sessionToken(dummy);assert.equal((await handle(request('/api/bannerImage','adcheck_session_v2='+t))).status,403);const dt=await draftToken();assert.equal((await handle(request('/api/bannerImage',`adcheck_session_v2=${t}; adcheck_draft_v2=${dt}`))).status,200);assert.equal((await handle(request('/api/bannerImage',`adcheck_session_v2=${t}; adcheck_draft_v2=${t}`))).status,403);});
test('cross-origin mutations blocked before registry read',async()=>{const r=await handle(new Request('https://app.example.invalid/_gate/admin/decide',{method:'POST',headers:{origin:'https://other.example.invalid','content-type':'application/json'},body:JSON.stringify({password:'mock-only-admin',userId:dummy.id,action:'revoke'})}));assert.equal(r.status,403);assert.equal(reads,0);assert.equal(writes,0);});
test('admin revocation stores private data and rotates session version',async()=>{const t=await sessionToken(dummy);const r=await handle(new Request('https://app.example.invalid/_gate/admin/decide',{method:'POST',headers:{origin:'https://app.example.invalid','content-type':'application/json'},body:JSON.stringify({password:'mock-only-admin',userId:dummy.id,action:'revoke'})}));assert.equal(r.status,200);assert.equal(writes,1);assert.equal(state.users[0].status,'rejected');assert.ok(state.users[0].sessionVersion);assert.equal(await verifySession(t,state),null);});
test('public bookmarklet script remains usable without login',async()=>{delete process.env.AUTH_SESSION_SECRET;assert.equal((await handle(request('/assets/adcheck-grab.js'))).status,200);assert.equal(reads,0);});
test('signup stores a salted hash privately; only approval enables login',async()=>{
 const password='synthetic-test-password';
 const form={name:'Synthetic New',email:'new@example.invalid',password,passwordConfirm:password};
 assert.equal((await handle(request('/_gate/signup','',form))).status,200);
 const user=state.users.find(u=>u.email===form.email);
 assert.equal(user.status,'pending');assert.notEqual(user.passwordHash,password);assert.equal(writes,1);
 assert.equal((await handle(request('/_gate/login','',form))).status,401);
 user.status='approved';
 const result=await handle(request('/_gate/login','',{...form,next:'/banner-studio.html'}));
 assert.equal(result.status,302);assert.equal(result.headers.get('location'),'/banner-studio.html');
 const cookie=result.headers.get('set-cookie');
 for(const flag of ['HttpOnly','Secure','SameSite=Lax','Max-Age=28800'])assert.ok(cookie.includes(flag));
 assert.equal((await handle(request('/',cookie.split(';')[0]))).status,200);
 assert.equal((await handle(request('/_gate/login','',{...form,password:'wrong-password'}))).status,401);
});
test('draft redirects reject external, backslash and control-character paths',async()=>{
 for(const next of ['//other.example.invalid','/\\other.example.invalid','/\t/other.example.invalid','https://other.example.invalid']){
  const response=await handle(request('/_gate/draft','',{password:'mock-only-admin',next}));
  assert.equal(response.status,302);assert.equal(response.headers.get('location'),'/');
 }
});

test('maintenance freezes account reads and writes including administrator mutations',async()=>{
 process.env.AUTH_MAINTENANCE='1';
 for(const path of ['/', '/_gate/signup','/_gate/admin/decide']){
  const response=await handle(request(path,'',{name:'Synthetic',email:'test@example.invalid',password:'dummy-password',passwordConfirm:'dummy-password'}));
  assert.equal(response.status,503);
 }
 assert.equal(reads,0);assert.equal(writes,0);
});

 test('full-site closure blocks pages, APIs, existing signed sessions and admin before storage',async()=>{
 const token=await sessionToken(dummy);const dt=await draftToken();
 for(const path of ['/', '/banner-studio.html','/admin.html','/assets/adcheck-grab.js','/api/bannerImage','/_gate/login','/_gate/admin/decide']){
  const r=await closedHandle(request(path,`adcheck_session_v2=${token}; adcheck_draft_v2=${dt}`));
  assert.equal(r.status,503);assert.equal(r.headers.get('cache-control'),'no-store');
  assert.equal(r.headers.get('retry-after'),'3600');
  if(path.startsWith('/api/')||path.startsWith('/_gate/'))assert.equal((await r.json()).code,'SITE_MAINTENANCE');
  else assert.match(await r.text(),/서비스 개편 작업/);
 }
 assert.equal(reads,0);assert.equal(writes,0);
});

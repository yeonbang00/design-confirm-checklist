// Web Crypto only; safe for Edge Middleware. No secrets or password hashes in cookies.
export const SESSION_TTL=8*60*60;
const enc=new TextEncoder();
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
function secretBytes(){
 const value=process.env.AUTH_SESSION_SECRET||'';
 if(!/^[0-9a-f]{64}$/i.test(value))throw Error('AUTH_CONFIG_REQUIRED');
 return Uint8Array.from(value.match(/../g),b=>parseInt(b,16));
}
export function checkSessionConfig(){secretBytes();}
async function key(){return crypto.subtle.importKey('raw',secretBytes(),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
function binding(subject){return JSON.stringify([subject.id,subject.passwordHash,subject.sessionVersion||'0']);}
async function mint(kind,subject,now=Date.now()){
 const issued=Math.floor(now/1000),expires=issued+SESSION_TTL;
 const nonce=hex(crypto.getRandomValues(new Uint8Array(16)));
 const payload=`v2.${kind}.${subject.id}.${issued}.${expires}.${nonce}`;
 const signature=await crypto.subtle.sign('HMAC',await key(),enc.encode(payload+'\n'+binding(subject)));
 return payload+'.'+hex(signature);
}
async function verify(token,kind,subject,now=Date.now()){
 if(typeof token!=='string'||token.length>512||!subject)return false;
 const parts=token.split('.');
 if(parts.length!==7||parts[0]!=='v2'||parts[1]!==kind||parts[2]!==subject.id||!/^\d{10}$/.test(parts[3])||!/^\d{10}$/.test(parts[4])||! /^[a-f0-9]{32}$/.test(parts[5])||! /^[a-f0-9]{64}$/.test(parts[6]))return false;
 const issued=Number(parts[3]),expires=Number(parts[4]),time=Math.floor(now/1000);
 if(issued>time+30||expires<=time||expires-issued!==SESSION_TTL)return false;
 const sig=Uint8Array.from(parts[6].match(/../g),b=>parseInt(b,16));
 return crypto.subtle.verify('HMAC',await key(),sig,enc.encode(parts.slice(0,6).join('.')+'\n'+binding(subject)));
}
export const sessionToken=(user,now)=>mint('user',user,now);
export async function verifySession(token,data,now){
 const id=typeof token==='string'?token.split('.')[2]:null;
 const user=data.users.find(u=>u.id===id);
 if(!user||user.status!=='approved')return null;
 return await verify(token,'user',user,now)?user:null;
}
function draftSubject(){return {id:'draft',passwordHash:process.env.ADMIN_PASSWORD||'',sessionVersion:'0'};}
export const draftToken=()=>mint('draft',draftSubject());
export const verifyDraftToken=token=>!!process.env.ADMIN_PASSWORD&&verify(token,'draft',draftSubject());

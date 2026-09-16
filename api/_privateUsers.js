// Dedicated PRIVATE auth store. Never fall back to the public asset store.
import {get,put} from '@vercel/blob';
const PATH='auth/users.json';
function token(){const value=process.env.AUTH_BLOB_READ_WRITE_TOKEN;if(!value)throw Error('AUTH_STORE_REQUIRED');return value;}
function valid(data){
 if(!data||!Array.isArray(data.users))throw Error('AUTH_DATA_INVALID');
 const ids=new Set(),emails=new Set();
 for(const u of data.users){
  if(!u||typeof u.id!=='string'||! /^[a-f0-9]{16}$/.test(u.id)||typeof u.email!=='string'||!u.email||typeof u.name!=='string'||! /^[a-f0-9]{32}$/.test(u.passwordSalt)||! /^[a-f0-9]{64}$/.test(u.passwordHash)||!['pending','approved','rejected'].includes(u.status)||ids.has(u.id)||emails.has(u.email.toLowerCase()))throw Error('AUTH_DATA_INVALID');
  ids.add(u.id);emails.add(u.email.toLowerCase());
 }
 return data;
}
export async function getUsers(){
 const result=await get(PATH,{access:'private',token:token(),useCache:false});
 // Missing, malformed or unavailable data must not bootstrap an empty registry.
 if(result?.statusCode!==200||!result.stream)throw Error('AUTH_STORE_UNAVAILABLE');
 return valid(await new Response(result.stream).json());
}
export async function saveUsers(data){
 valid(data);
 await put(PATH,JSON.stringify(data),{access:'private',token:token(),allowOverwrite:true,addRandomSuffix:false,contentType:'application/json',cacheControlMaxAge:0});
}

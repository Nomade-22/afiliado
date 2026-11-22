import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {cookies} from 'next/headers';
import {getDB} from './db';

const COOKIE='__Host-vivi_admin_session';
const SESSION_AGE_SECONDS=8*60*60;
const COOKIE_AGE_MS=SESSION_AGE_SECONDS*1000;

// Rotacionar ADMIN_PASSWORD ou SESSION_SECRET invalida todos os tokens anteriores.
function validConfig(){
 return Boolean(process.env.ADMIN_PASSWORD &&
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.length>=32);
}
function sign(raw){
 const passwordDigest=createHash('sha256').update(process.env.ADMIN_PASSWORD).digest();
 return createHmac('sha256',process.env.SESSION_SECRET)
  .update(raw).update(':admin-password:').update(passwordDigest).digest('hex');
}
function fingerprint(token){
 return createHmac('sha256',process.env.SESSION_SECRET)
  .update('session:').update(token).digest('hex');
}
export function canLogin(){return validConfig()}
export function comparePassword(pass){
 if(!validConfig()||typeof pass!=='string'||pass.length>512)return false;
 const expected=createHash('sha256').update(process.env.ADMIN_PASSWORD).digest();
 const actual=createHash('sha256').update(pass).digest();
 return timingSafeEqual(actual,expected);
}
export function newToken(){
 if(!validConfig())throw Error('Configuração de sessão indisponível');
 const expires=Date.now()+COOKIE_AGE_MS;
 const payload='v2.'+expires+'.'+randomBytes(24).toString('hex');
 return payload+'.'+sign(payload);
}
export function verifyToken(token){
 if(!validConfig()||typeof token!=='string'||token.length>200)return false;
 const parts=token.split('.');
 if(parts.length!==4||parts[0]!=='v2'||!/^[0-9a-f]{48}$/.test(parts[2])||
    !/^[0-9a-f]{64}$/.test(parts[3]))return false;
 const expires=Number(parts[1]);
 if(!Number.isSafeInteger(expires)||expires<=Date.now()||
    expires>Date.now()+COOKIE_AGE_MS+60000)return false;
 const expected=Buffer.from(sign(parts.slice(0,3).join('.')),'hex');
 const received=Buffer.from(parts[3],'hex');
 return timingSafeEqual(expected,received);
}
export async function createAdminSession(sql){
 const token=newToken();
 const tokenHash=fingerprint(token);
 const expires=new Date(Number(token.split('.')[1]));
 await sql`DELETE FROM vivi_admin_sessions WHERE expires_at<NOW()`;
 await sql`INSERT INTO vivi_admin_sessions (token_hash,expires_at) VALUES (${tokenHash},${expires.toISOString()})`;
 return token;
}
export async function isAdmin(){
 const token=(await cookies()).get(COOKIE)?.value;
 if(!verifyToken(token))return false;
 try{
  const sql=await getDB();
  if(!sql)return false;
  const rows=await sql`SELECT token_hash FROM vivi_admin_sessions
   WHERE token_hash=${fingerprint(token)} AND expires_at>NOW() LIMIT 1`;
  return rows.length===1;
 }catch{return false}
}
export async function revokeAdminSession(){
 const token=(await cookies()).get(COOKIE)?.value;
 if(!token||!validConfig())return true;
 try{
  const sql=await getDB();
  if(!sql)return false;
  await sql`DELETE FROM vivi_admin_sessions WHERE token_hash=${fingerprint(token)}`;
  return true;
 }catch{return false}
}
export const cookieName=COOKIE;
export const oldCookieName='vivi_admin_session';
export const sessionMaxAge=SESSION_AGE_SECONDS;
export function forbidden(){
 return Response.json({error:'Acesso não autorizado.'},{
  status:401,
  headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}
 });
}

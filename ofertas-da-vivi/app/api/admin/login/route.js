import {comparePassword,canLogin,createAdminSession,cookieName,oldCookieName,sessionMaxAge} from '../../../../lib/auth';
import {registerLoginAttempt,clearLoginAttempts} from '../../../../lib/login-rate';
import {getDB} from '../../../../lib/db';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
function error(message,status,extra={}){
 return Response.json({error:message},{status,headers:{...headers,...extra}});
}
export async function POST(req){
 if(!canLogin())return error('Acesso administrativo indisponível.',503);
 if(!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')){
  return error('Envie os dados de acesso no formato correto.',415);
 }
 if(Number(req.headers.get('content-length')||0)>2048){
  return error('Requisição muito grande.',413);
 }
 let data;
 try{
  const raw=await req.text();
  if(raw.length>2048)return error('Requisição muito grande.',413);
  data=JSON.parse(raw);
 }catch{return error('Dados inválidos.',400)}
 if(!data||typeof data.password!=='string'||data.password.length>512){
  return error('Senha inválida.',401);
 }
 try{
  const sql=await getDB();
  if(!sql)return error('Acesso administrativo temporariamente indisponível.',503);
  const rate=await registerLoginAttempt(sql,req);
  if(!rate.allowed){
   return error('Muitas tentativas de acesso. Tente novamente mais tarde.',429,
    {'Retry-After':String(rate.retryAfter)});
  }
  if(!comparePassword(data.password)){
   return error('Senha inválida.',401);
  }
  const token=await createAdminSession(sql);
  await clearLoginAttempts(sql,rate.bucket);
  const out=Response.json({ok:true},{headers});
  out.headers.append('Set-Cookie',
   `${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${sessionMaxAge}`);
  // Desfaz a sessão antiga após a migração de tokens.
  out.headers.append('Set-Cookie',
   `${oldCookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
  return out;
 }catch{
  return error('Acesso administrativo temporariamente indisponível.',503);
 }
}

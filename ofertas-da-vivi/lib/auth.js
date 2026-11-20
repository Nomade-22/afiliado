import {createHmac, timingSafeEqual} from 'node:crypto';
import {cookies} from 'next/headers';
const COOKIE='vivi_admin_session';
function validConfig(){return Boolean(process.env.ADMIN_PASSWORD && process.env.SESSION_SECRET && process.env.SESSION_SECRET.length>=32)}
function sign(raw){return createHmac('sha256',process.env.SESSION_SECRET).update(raw).digest('hex')}
export function canLogin(){return validConfig()}
export function comparePassword(pass){
 if(!validConfig() || typeof pass!=='string') return false;
 const a=Buffer.from(pass),b=Buffer.from(process.env.ADMIN_PASSWORD);
 return a.length===b.length && timingSafeEqual(a,b);
}
export function newToken(){const exp=Date.now()+8*60*60*1000;const data=`v1.${exp}`;return `${data}.${sign(data)}`}
export function verifyToken(tok){
 if(!validConfig()||!tok||typeof tok!=='string')return false;
 const parts=tok.split('.');if(parts.length!==3||parts[0]!=='v1')return false;
 const data=parts.slice(0,2).join('.');const exp=Number(parts[1]);if(!Number.isSafeInteger(exp)||exp<Date.now())return false;
 const a=Buffer.from(parts[2]), b=Buffer.from(sign(data));return a.length===b.length && timingSafeEqual(a,b)
}
export async function isAdmin(){return verifyToken((await cookies()).get(COOKIE)?.value)}
export const cookieName=COOKIE;
export function forbidden(){return Response.json({error:'Acesso não autorizado.'},{status:401})}

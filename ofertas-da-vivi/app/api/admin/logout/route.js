import {cookieName} from '../../../../lib/auth';
export async function POST(){const out=Response.json({ok:true});out.headers.set('Set-Cookie',`${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);return out}

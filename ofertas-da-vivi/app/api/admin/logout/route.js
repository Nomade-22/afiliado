import {cookieName,oldCookieName,revokeAdminSession} from '../../../../lib/auth';

const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function POST(){
 const revoked=await revokeAdminSession();
 const out=Response.json(revoked?{ok:true}:{error:'Não foi possível revogar a sessão no servidor.'},{
  status:revoked?200:503,headers
 });
 out.headers.append('Set-Cookie',
  `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
 out.headers.append('Set-Cookie',
  `${oldCookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
 return out;
}

import {createHmac} from 'node:crypto';
import {isIP} from 'node:net';

const WINDOW_SECONDS=15*60;
const MAX_ATTEMPTS=10;

// O Vercel substitui X-Forwarded-For antes de entregar a chamada à função.
// Nunca gravamos o IP puro; apenas um identificador HMAC.
export async function registerLoginAttempt(sql,request){
 const forwarded=request.headers.get('x-forwarded-for')||'';
 const candidate=forwarded.split(',')[0].trim();
 const ip=isIP(candidate)?candidate:'unknown';
 const bucket=createHmac('sha256',process.env.SESSION_SECRET)
  .update('vivi-login-ip:').update(ip).digest('hex');
 const rows=await sql`
  INSERT INTO vivi_admin_login_limits (bucket,attempts,window_start,last_attempt)
  VALUES (${bucket},1,NOW(),NOW())
  ON CONFLICT (bucket) DO UPDATE SET
   attempts=CASE WHEN vivi_admin_login_limits.window_start<NOW()-INTERVAL '15 minutes'
     THEN 1 ELSE vivi_admin_login_limits.attempts+1 END,
   window_start=CASE WHEN vivi_admin_login_limits.window_start<NOW()-INTERVAL '15 minutes'
     THEN NOW() ELSE vivi_admin_login_limits.window_start END,
   last_attempt=NOW()
  RETURNING attempts,window_start
 `;
 const attempts=Number(rows[0]?.attempts||0);
 const started=new Date(rows[0]?.window_start||Date.now()).getTime();
 const retryAfter=Math.max(1,Math.ceil((started+WINDOW_SECONDS*1000-Date.now())/1000));
 return {allowed:attempts<=MAX_ATTEMPTS,retryAfter,bucket};
}
export async function clearLoginAttempts(sql,bucket){
 await sql`DELETE FROM vivi_admin_login_limits WHERE bucket=${bucket}`;
}

import {createPublicKey,verify as verifySignature} from 'node:crypto';

const ISSUER='https://token.actions.githubusercontent.com';
const AUDIENCE='https://ofertas-da-vivi.vercel.app/api/cron/products';
const WORKFLOW='Nomade-22/afiliado/.github/workflows/vivi-product-sync.yml@refs/heads/main';
const MAX_ISSUED_SECONDS=300;
let jwksCache=null;

function fromB64url(value){
 if(!/^[a-zA-Z0-9_-]+$/.test(value||''))throw Error('JWT inválido');
 return Buffer.from(value,'base64url');
}
async function keys(){
 if(jwksCache&&Date.now()-jwksCache.at<15*60*1000)return jwksCache.keys;
 const response=await fetch(ISSUER+'/.well-known/jwks',{
  signal:AbortSignal.timeout(8000),cache:'no-store'
 });
 if(!response.ok)throw Error('Chaves OIDC temporariamente indisponíveis');
 const data=await response.json();
 const list=Array.isArray(data.keys)?data.keys:[];
 if(!list.length)throw Error('Sem chaves OIDC');
 jwksCache={at:Date.now(),keys:list};
 return list;
}
export async function verifyGitHubScheduledWorkflow(request){
 const header=String(request.headers.get('authorization')||'');
 if(!header.startsWith('Bearer ')||header.length>8000)return false;
 try{
  const token=header.slice(7);
  const parts=token.split('.');
  if(parts.length!==3)return false;
  const envelope=JSON.parse(fromB64url(parts[0]).toString('utf8'));
  const claims=JSON.parse(fromB64url(parts[1]).toString('utf8'));
  if(envelope.alg!=='RS256'||typeof envelope.kid!=='string')return false;
  const now=Math.floor(Date.now()/1000);
  if(claims.iss!==ISSUER||claims.aud!==AUDIENCE||
    claims.repository!=='Nomade-22/afiliado'||
    String(claims.repository_id)!=='1143620315'||
    claims.ref!=='refs/heads/main'||
    claims.workflow_ref!==WORKFLOW||
    !['schedule','workflow_dispatch'].includes(claims.event_name)||
    !['repo:Nomade-22/afiliado:ref:refs/heads/main'].includes(claims.sub)||
    typeof claims.iat!=='number'||typeof claims.exp!=='number'||
    claims.iat>now+60||claims.iat<now-MAX_ISSUED_SECONDS||
    claims.exp<=now||claims.exp>now+MAX_ISSUED_SECONDS)return false;
  const allKeys=await keys();
  const jwk=allKeys.find(k=>k.kid===envelope.kid&&k.kty==='RSA'&&(!k.alg||k.alg==='RS256'));
  if(!jwk)return false;
  const key=createPublicKey({key:jwk,format:'jwk'});
  return verifySignature('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),
   key,fromB64url(parts[2]));
 }catch{return false}
}

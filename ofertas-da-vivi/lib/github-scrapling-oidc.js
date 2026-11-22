import {createPublicKey,verify as verifySignature} from 'node:crypto';

const ISSUER='https://token.actions.githubusercontent.com';
const AUDIENCE='https://ofertas-da-vivi.vercel.app/api/automation/scrapling-test';
const WORKFLOW='Nomade-22/afiliado/.github/workflows/vivi-scrapling-test.yml@refs/heads/main';
let keyCache=null;

function fromB64url(text){
 if(!/^[A-Za-z0-9_-]{1,12000}$/.test(text||''))throw Error('Token inválido');
 return Buffer.from(text,'base64url');
}
async function getKeys(){
 if(keyCache&&Date.now()-keyCache.at<15*60*1000)return keyCache.data;
 const result=await fetch(ISSUER+'/.well-known/jwks',{cache:'no-store',signal:AbortSignal.timeout(8000)});
 if(!result.ok)throw Error('Chaves de autenticação indisponíveis');
 const data=await result.json();
 if(!Array.isArray(data.keys)||!data.keys.length)throw Error('Chaves inválidas');
 keyCache={at:Date.now(),data:data.keys};
 return data.keys;
}
export async function verifyScraplingWorkflow(request){
 const authorization=request.headers.get('authorization')||'';
 if(!authorization.startsWith('Bearer ')||authorization.length>8000)return null;
 try{
  const jwt=authorization.slice(7);
  const parts=jwt.split('.');
  if(parts.length!==3)return null;
  const header=JSON.parse(fromB64url(parts[0]).toString('utf8'));
  const payload=JSON.parse(fromB64url(parts[1]).toString('utf8'));
  const now=Math.floor(Date.now()/1000);
  if(header.alg!=='RS256'||typeof header.kid!=='string'||header.typ!=='JWT')return null;
  if(payload.iss!==ISSUER||payload.aud!==AUDIENCE||
   payload.repository!=='Nomade-22/afiliado'||
   String(payload.repository_id)!=='1143620315'||
   payload.ref!=='refs/heads/main'||
   payload.sub!=='repo:Nomade-22/afiliado:ref:refs/heads/main'||
   payload.workflow_ref!==WORKFLOW||
   !['push','workflow_dispatch'].includes(payload.event_name)||
   !/^[0-9]{1,25}$/.test(String(payload.run_id||''))||
   !Number.isInteger(payload.exp)||!Number.isInteger(payload.iat)||
   payload.iat>now+60||payload.iat<now-600||
   payload.exp<=now||payload.exp>now+600)return null;
  const jwk=(await getKeys()).find(k=>k.kid===header.kid&&k.kty==='RSA');
  if(!jwk)return null;
  const signature=verifySignature('RSA-SHA256',
   Buffer.from(parts[0]+'.'+parts[1]),
   createPublicKey({key:jwk,format:'jwk'}),
   fromB64url(parts[2]));
  return signature?{runId:String(payload.run_id),event:payload.event_name}:null;
 }catch{return null}
}

import {createHmac} from 'node:crypto';
import {isAdmin,forbidden} from '../../../../../lib/auth';
import {resolveSalesPeriod} from '../../../../../lib/report-period';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const ALLOWED=new Set(['today','yesterday','1','7','30','60','89']);

export async function POST(request) {
  if(!await isAdmin())return forbidden();
  const origin=request.headers.get('origin');
  if(origin!==new URL(request.url).origin){
    return Response.json({error:'Origem não autorizada.'},{status:403,headers});
  }
  const body=await request.json().catch(()=>({}));
  const period=String(body.period||'today');
  if(!ALLOWED.has(period))return Response.json({error:'Período inválido.'},{status:400,headers});
  const secret=process.env.SESSION_SECRET;
  if(!secret||secret.length<32)return Response.json({error:'Assinatura não configurada.'},{status:503,headers});
  const {fromEpoch,toEpoch,label}=resolveSalesPeriod(period);
  const expires=Math.floor(Date.now()/1000)+10*60;
  const payload='vivi-report-v1:'+fromEpoch+':'+toEpoch+':'+expires;
  const signature=createHmac('sha256',secret).update(payload).digest('hex');
  const url=new URL('/api/share/shopee',request.url);
  url.searchParams.set('f',String(fromEpoch));
  url.searchParams.set('t',String(toEpoch));
  url.searchParams.set('e',String(expires));
  url.searchParams.set('s',signature);
  return Response.json({
    status:'ok',url:url.toString(),label,
    expiresAt:new Date(expires*1000).toISOString(),
    description:'Link temporário de leitura com totais agregados, sem IDs de pedidos.'
  },{headers});
}

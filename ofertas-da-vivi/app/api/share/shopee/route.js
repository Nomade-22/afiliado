import {createHmac,timingSafeEqual} from 'node:crypto';
import {loadSalesReport} from '../../../../lib/shopee-reports';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=40;
const headers={
  'Cache-Control':'private, no-store, max-age=0',
  'Referrer-Policy':'no-referrer',
  'X-Robots-Tag':'noindex, nofollow, noarchive',
  'X-Content-Type-Options':'nosniff'
};

function authorized(searchParams) {
  const f=searchParams.get('f')||'';
  const t=searchParams.get('t')||'';
  const e=searchParams.get('e')||'';
  const signature=searchParams.get('s')||'';
  if(!/^\d{10}$/.test(f)||!/^\d{10}$/.test(t)||!/^\d{10}$/.test(e)||!/^[a-f0-9]{64}$/.test(signature))return null;
  const fromEpoch=Number(f),toEpoch=Number(t),expires=Number(e);
  const now=Math.floor(Date.now()/1000);
  if(!process.env.SESSION_SECRET||process.env.SESSION_SECRET.length<32)return null;
  if(expires<now||expires>now+600||toEpoch>now+60||fromEpoch>=toEpoch||toEpoch-fromEpoch>89*86400+1)return null;
  const payload='vivi-report-v1:'+f+':'+t+':'+e;
  const expected=createHmac('sha256',process.env.SESSION_SECRET).update(payload).digest();
  const provided=Buffer.from(signature,'hex');
  if(!timingSafeEqual(expected,provided))return null;
  return {fromEpoch,toEpoch,expires};
}

export async function GET(request) {
  const access=authorized(new URL(request.url).searchParams);
  if(!access)return Response.json({
    status:'unauthorized',error:'Link inválido ou expirado. Gere outro no painel da Vivi.'
  },{status:401,headers});
  try {
    const report=await loadSalesReport({
      days:1,fromEpoch:access.fromEpoch,toEpoch:access.toEpoch,maximumPages:6
    });
    // Sem conversões individuais, identificadores de pedidos, dados pessoais ou credenciais.
    return Response.json({
      status:'ok',
      source:'Shopee Affiliate Open API / Ofertas da Vivi',
      timezone:'America/Sao_Paulo',
      from:report.from,to:report.to,
      generatedAt:new Date().toISOString(),
      expiresAt:new Date(access.expires*1000).toISOString(),
      orders:report.orders,
      conversions:report.conversions,
      itemsSold:report.itemsSold,
      estimatedOrderValue:report.estimatedOrderValue,
      commissionEstimated:report.commissionEstimated,
      sellerCommissionEstimated:report.sellerCommissionEstimated,
      shopeeCommissionEstimated:report.shopeeCommissionEstimated,
      statusCounts:report.statusCounts,
      topProducts:(report.topProducts||[]).slice(0,10).map(p=>({
        name:p.name,quantity:p.quantity,valueApprox:p.valueApprox,commission:p.commission
      })),
      pagesFetched:report.pagesFetched,
      partial:report.partial,
      warning:report.warning,
      note:'Valores estimados, sujeitos a atraso, cancelamento e validação pela Shopee. GMV não oficial.'
    },{headers});
  }catch{
    return Response.json({status:'upstream_error',error:'Não foi possível consultar a Shopee neste momento.'},{status:502,headers});
  }
}

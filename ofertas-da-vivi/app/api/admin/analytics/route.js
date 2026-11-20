import {isAdmin,forbidden} from '../../../../lib/auth';
import {hasShopeeCredentials} from '../../../../lib/shopee';
import {loadSalesReport} from '../../../../lib/shopee-reports';
import {getDB} from '../../../../lib/db';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=40;
const privateHeaders={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};

async function getSiteClicks(){
 try{
  const sql=await getDB();
  if(!sql)return {status:'not_configured',count:null,topOffers:[]};
  const rows=await sql`SELECT id,title,clicks FROM vivi_offers WHERE clicks > 0 ORDER BY clicks DESC LIMIT 15`;
  return {
    status:'ok',count:rows.reduce((sum,o)=>sum+Number(o.clicks||0),0),
    // A soma de top 15 não deve ser apresentada como total geral.
    topOffers:rows.map(o=>({id:o.id,title:o.title,clicks:Number(o.clicks||0)}))
  };
 }catch{
  return {status:'db_error',count:null,topOffers:[]};
 }
}

export async function GET(req){
 if(!await isAdmin())return forbidden();
 const days=Number(new URL(req.url).searchParams.get('days')||30);
 if(!hasShopeeCredentials())return Response.json({
  status:'not_configured',error:'Cadastre SHOPEE_APP_ID e SHOPEE_APP_SECRET em Production na Vercel.',
  siteClicks:await getSiteClicks()
 },{headers:privateHeaders,status:503});

 const [sales,clicks]=await Promise.allSettled([
  loadSalesReport({days,maximumPages:4}),
  getSiteClicks()
 ]);
 const siteClicks=clicks.status==='fulfilled'?clicks.value:{status:'db_error',count:null,topOffers:[]};
 if(sales.status==='rejected'){
  let message=String(sales.reason?.message||'Consulta de conversões indisponível.');
  for(const value of [process.env.SHOPEE_APP_SECRET,process.env.SHOPEE_APP_ID,process.env.DATABASE_URL]){
   if(value&&value.length>2)message=message.split(value).join('[protegido]');
  }
  return Response.json({
   status:'api_error',
   error:message.slice(0,340),
   siteClicks
  },{status:502,headers:privateHeaders});
 }
 return Response.json({...sales.value,siteClicks}, {headers:privateHeaders});
}

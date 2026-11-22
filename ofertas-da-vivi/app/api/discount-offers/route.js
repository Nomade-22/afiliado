import {getDB} from '../../../lib/db';
import {isShopeeLink} from '../../../lib/shopee-links';

export const dynamic='force-dynamic';
export const runtime='nodejs';
const headers={'Cache-Control':'public, s-maxage=120, stale-while-revalidate=120','X-Content-Type-Options':'nosniff'};

/**
 * Só os descontos efetivamente retornados na Affiliate Open API e
 * verificados nos últimos 72h são candidatos. Não equivale a Flash Sale.
 * URLs já convertidas na conta afiliada com Sub ID confirmado.
 */
export async function GET(){
 try{
  const sql=await getDB();
  if(!sql)return Response.json({offers:[],count:0,source:'shopee_verified_discounts',
   warning:'Banco de dados indisponível.'},{status:503,headers});
  const rows=await sql`SELECT id,title,image,url,price,price_discount_rate,
    discount_checked_at,internal_code,category
   FROM vivi_offers WHERE active=true
    AND affiliate_status='verified'
    AND price IS NOT NULL AND price>0
    AND price_discount_rate BETWEEN 1 AND 95
    AND discount_checked_at >= NOW() - INTERVAL '72 hours'
   ORDER BY price_discount_rate DESC,discount_checked_at DESC LIMIT 40`;
  const offers=rows.filter(row=>isShopeeLink(row.url)).slice(0,12).map(row=>({
   id:row.id,title:row.title,image:row.image,url:row.url,
   price:Number(row.price),discount:Math.round(Number(row.price_discount_rate)),
   checkedAt:row.discount_checked_at,category:row.category,
   internalCode:row.internal_code
  }));
  return Response.json({offers,count:offers.length,source:'affiliate_product_offer',
   label:'Produtos com descontos consultados na Shopee',
   isFlashSale:false,
   note:'Desconto informado pela API de Afiliados; não significa participação na Ofertas Relâmpago. Preços e condições devem ser verificados na Shopee.'
  },{headers});
 }catch(error){
  console.error('vivi_discount_offers_error',String(error?.code||'QUERY_FAILED'));
  return Response.json({offers:[],count:0,error:'Consulta de descontos temporariamente indisponível.'},
   {status:503,headers});
 }
}

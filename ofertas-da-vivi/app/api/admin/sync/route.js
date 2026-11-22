import {isAdmin,forbidden} from '../../../../lib/auth';
import {getDB} from '../../../../lib/db';
import {searchShopeePage,hasShopeeCredentials} from '../../../../lib/shopee';
import {generateProductAffiliateLink} from '../../../../lib/shopee-links';
import {allocateInternalCode} from '../../../../lib/product-codes';
import {knownOfferKeys,matchExisting,offerIdentityKeys,primaryOfferKey} from '../../../../lib/product-identity';

export const runtime='nodejs';
export const maxDuration=120;
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function POST(req){
 if(!await isAdmin())return forbidden();
 if(!hasShopeeCredentials())return Response.json({error:'A API Shopee não está configurada.'},{status:503,headers});
 const input=await req.json().catch(()=>({}));
 const ids=Array.isArray(input.ids)?[...new Set(input.ids.filter(x=>typeof x==='string'&&/^shopee-[0-9]+-[0-9]+$/.test(x)))]:[];
 if(!ids.length||ids.length>8)return Response.json({error:'Selecione entre 1 e 8 produtos por lote.'},{status:400,headers});
 let sql;
 try{sql=await getDB();if(!sql)throw Error('Neon')}
 catch{return Response.json({error:'O Neon não está conectado.'},{status:503,headers})}
 try{
  const page=await searchShopeePage(input.keyword,input.limit??24,input.page??1,{
   sortType:input.sortType,listType:input.listType,
   isAMSOffer:input.isAMSOffer===true,isKeySeller:input.isKeySeller===true
  });
  const chosen=page.offers.filter(x=>ids.includes(x.id));
  if(chosen.length!==ids.length)return Response.json({
   error:'A Shopee alterou os resultados da pesquisa. Atualize a página antes de importar.'
  },{status:409,headers});
  const known=knownOfferKeys(await sql`SELECT id,title,image,url,product_link,item_id,shop_id,dedupe_key FROM vivi_offers`);
  let imported=0,skipped=0;
  const errors=[];
  const processing=[];
  for(const offer of chosen){
   if(matchExisting(offer,known)){skipped++;continue}
   processing.push(offer);
   for(const k of offerIdentityKeys(offer))known.add(k);
  }
  for(let i=0;i<processing.length;i+=3){
   const group=processing.slice(i,i+3);
   const results=await Promise.all(group.map(async offer=>{
    try{
     const code=await allocateInternalCode(sql);
     const source=offer.productLink||offer.url;
     const link=await generateProductAffiliateLink(source,code,{shopId:offer.shopId,itemId:offer.itemId,fallbackUrl:offer.url});
     const identity=primaryOfferKey(offer);
     const inserted=await sql`INSERT INTO vivi_offers
      (id,title,category,price,old_price,image,url,featured,active,origin,
       item_id,shop_id,shop_name,shop_type,commission_rate,
       seller_commission_rate,shopee_commission_rate,commission_amount,product_cat_ids,
       offer_period_start,offer_period_end,price_max,price_discount_rate,discount_checked_at,
       product_link,sales,rating_star,affiliate_link_source,affiliate_sub_ids,
       affiliate_status,internal_code,imported_at,dedupe_key,updated_at)
      VALUES
      (${offer.id},${offer.title},${offer.category},${offer.price},${offer.oldPrice},
       ${offer.image},${link.shortLink},false,false,'shopee',
       ${offer.itemId},${offer.shopId},${offer.shopName},${offer.shopType},
       ${offer.commissionRate},${offer.sellerCommissionRate},${offer.shopeeCommissionRate},
       ${offer.commission},${JSON.stringify(offer.productCatIds||[])},
       ${offer.periodStartTime},${offer.periodEndTime},
       ${offer.priceMax},${offer.priceDiscountRate},NOW(),
       ${offer.productLink},${offer.sales},${offer.ratingStar},
       'generateShortLink',${link.usedSubId},'verified',${code},NOW(),${identity},NOW())
      ON CONFLICT DO NOTHING RETURNING id`;
     return inserted.length?{kind:'imported'}:{kind:'skipped'};
    }catch(e){return {kind:'error',id:offer.id,message:String(e?.message||'Falha').slice(0,155)}}
   }));
   for(const r of results){
    if(r.kind==='imported')imported++;
    else if(r.kind==='skipped')skipped++;
    else errors.push({id:r.id,message:r.message});
   }
  }
  return Response.json({ok:true,imported,count:imported,skipped,errors,
    message:imported+' novo(s) com link afiliado e Sub ID individual; '+skipped+' duplicado(s) ignorado(s).'+
    (errors.length?' '+errors.length+' conversão(ões) falharam; esses itens não foram importados.':'')
  },{headers});
 }catch(error){
  return Response.json({error:'Falha ao importar: '+String(error?.message||'Erro').slice(0,145)},{status:502,headers});
 }
}

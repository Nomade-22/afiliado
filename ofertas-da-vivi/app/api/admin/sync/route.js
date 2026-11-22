import {isAdmin,forbidden} from '../../../../lib/auth';
import {getDB} from '../../../../lib/db';
import {searchShopeePage,hasShopeeCredentials} from '../../../../lib/shopee';
import {resolveOfferAffiliateLink} from '../../../../lib/shopee-links';
import {knownOfferKeys,matchExisting,offerIdentityKeys,primaryOfferKey} from '../../../../lib/product-identity';

export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function POST(req){
 if(!await isAdmin())return forbidden();
 if(!hasShopeeCredentials())return Response.json({error:'A API Shopee não está configurada.'},{status:503,headers});
 let input={};
 try{input=await req.json()}catch{return Response.json({error:'JSON inválido.'},{status:400,headers})}
 const ids=Array.isArray(input.ids)?[...new Set(input.ids.filter(x=>typeof x==='string'&&/^shopee-[0-9]+-[0-9]+$/.test(x)))]:[];
 if(!ids.length)return Response.json({error:'Selecione pelo menos um produto.'},{status:400,headers});
 if(ids.length>8)return Response.json({error:'Envie até 8 produtos por lote; o painel divide automaticamente.'},{status:400,headers});

 let sql;
 try{sql=await getDB();if(!sql)throw Error('Neon não configurado')}
 catch{return Response.json({error:'O Neon ainda não está conectado para salvar as ofertas.'},{status:503,headers})}
 try{
  const page=await searchShopeePage(input.keyword,input.limit??24,input.page??1);
  const chosen=page.offers.filter(o=>ids.includes(o.id));
  if(chosen.length!==ids.length)return Response.json({
   error:'Alguns produtos mudaram nesta pesquisa. Atualize a lista para importar.'
  },{status:409,headers});
  const existing=await sql`SELECT id,url,product_link,item_id,shop_id,dedupe_key FROM vivi_offers`;
  const seen=knownOfferKeys(existing);
  let imported=0,skipped=0,withSubIds=0,fromOfferLink=0;
  const warnings=[];
  for(const offer of chosen){
   if(matchExisting(offer,seen)){skipped++;continue}
   const link=await resolveOfferAffiliateLink(offer);
   const identity=primaryOfferKey(offer);
   const inserted=await sql`INSERT INTO vivi_offers
    (id,title,category,price,old_price,image,url,featured,active,origin,
      item_id,shop_id,shop_name,commission_rate,price_max,price_discount_rate,
      product_link,sales,rating_star,affiliate_link_source,affiliate_sub_ids,
      dedupe_key,updated_at)
    VALUES
    (${offer.id},${offer.title},${offer.category},${offer.price},${offer.oldPrice},
     ${offer.image},${link.shortLink},false,false,'shopee',
     ${offer.itemId},${offer.shopId},${offer.shopName},
     ${offer.commissionRate},${offer.priceMax},${offer.priceDiscountRate},
     ${offer.productLink},${offer.sales},${offer.ratingStar},
     ${link.generatedBy},${link.subIds.join(',')},${identity},NOW())
    ON CONFLICT DO NOTHING RETURNING id`;
   if(!inserted.length){skipped++;continue}
   imported++;
   if(link.subIds.length)withSubIds++;
   if(link.generatedBy==='productOfferV2.offerLink')fromOfferLink++;
   if(link.warning)warnings.push({id:offer.id,note:link.warning});
   for(const key of offerIdentityKeys({...offer,dedupeKey:identity}))seen.add(key);
  }
  return Response.json({
   ok:true,count:imported,imported,skipped,withSubIds,fromOfferLink,warnings,
   message:imported+' produto(s) novos salvos como inativos; '+skipped+
     ' já cadastrado(s) ignorado(s). Revise na aba Ofertas.'
  },{headers});
 }catch(error){
  let msg=String(error?.message||'Erro ao importar');
  for(const secret of [process.env.SHOPEE_APP_SECRET,process.env.SHOPEE_APP_ID,process.env.DATABASE_URL]){
   if(secret&&secret.length>2)msg=msg.split(secret).join('[protegido]');
  }
  const db=/password authentication failed|28p01/i.test(msg);
  return Response.json({error:db?'Falha na senha da conexão Neon.':
    'A importação não foi concluída: '+msg.slice(0,150)},{status:502,headers});
 }
}

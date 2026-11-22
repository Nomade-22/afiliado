import {isAdmin,forbidden} from '../../../../lib/auth';
import {getDB} from '../../../../lib/db';
import {searchShopeePage,hasShopeeCredentials} from '../../../../lib/shopee';
import {resolveOfferAffiliateLink} from '../../../../lib/shopee-links';

export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function POST(req){
 if(!await isAdmin())return forbidden();
 if(!hasShopeeCredentials())return Response.json({error:'A API da Shopee não está configurada na Vercel.'},{status:503,headers});
 let input={};
 try{input=await req.json()}catch{return Response.json({error:'JSON inválido.'},{status:400,headers})}
 const ids=Array.isArray(input.ids)?[...new Set(input.ids.filter(x=>typeof x==='string'&&/^shopee-[0-9]+-[0-9]+$/.test(x)))]:[];
 if(!ids.length)return Response.json({error:'Selecione ao menos um produto.'},{status:400,headers});
 if(ids.length>8)return Response.json({error:'Importe até 8 produtos por vez.'},{status:400,headers});

 let sql;
 try{
  sql=await getDB();
  if(!sql)return Response.json({error:'A DATABASE_URL ainda não está configurada para salvar produtos.'},{status:503,headers});
 }catch(e){
  const invalid=/password authentication failed|28P01/i.test(String(e?.message));
  return Response.json({error:invalid?'O Neon rejeitou a senha configurada na Vercel.':'Não foi possível conectar ao Neon.'},{status:503,headers});
 }

 try {
  const page=await searchShopeePage(input.keyword,input.limit??24,input.page??1);
  const selected=page.offers.filter(offer=>ids.includes(offer.id));
  if(selected.length!==ids.length)return Response.json({
   error:'A lista de resultados mudou na Shopee. Faça a pesquisa novamente e selecione os produtos.'
  },{status:409,headers});

  // Cada URL é convertida na API de afiliados. Se a conversão falhar,
  // usa-se apenas offerLink já devolvido pela API de afiliados autenticada.
  const converted=[];
  for(let i=0;i<selected.length;i+=2){
   const batch=selected.slice(i,i+2);
   const prepared=await Promise.all(batch.map(async offer=>{
    const generated=await resolveOfferAffiliateLink(offer);
    return {...offer,url:generated.shortLink,affiliateLinkSource:generated.generatedBy,
     affiliateSubIds:generated.subIds,affiliateWarning:generated.warning};
   }));
   converted.push(...prepared);
  }
  let count=0;
  const warnings=[];
  let withSubIds=0;
  let fromOfferLink=0;
  for(const o of converted){
   await sql`INSERT INTO vivi_offers
    (id,title,category,price,old_price,image,url,featured,active,origin,
     item_id,shop_id,shop_name,commission_rate,price_max,price_discount_rate,
     product_link,sales,rating_star,affiliate_link_source,affiliate_sub_ids,updated_at)
    VALUES
    (${o.id},${o.title},${o.category},${o.price},${o.oldPrice},${o.image},${o.url},
     false,false,'shopee',${o.itemId},${o.shopId},${o.shopName},
     ${o.commissionRate},${o.priceMax},${o.priceDiscountRate},${o.productLink},
     ${o.sales},${o.ratingStar},${o.affiliateLinkSource},${o.affiliateSubIds.join(',')},NOW())
    ON CONFLICT(id) DO UPDATE SET
      title=EXCLUDED.title,price=EXCLUDED.price,old_price=EXCLUDED.old_price,
      image=EXCLUDED.image,url=EXCLUDED.url,
      item_id=EXCLUDED.item_id,shop_id=EXCLUDED.shop_id,shop_name=EXCLUDED.shop_name,
      commission_rate=EXCLUDED.commission_rate,price_max=EXCLUDED.price_max,
      price_discount_rate=EXCLUDED.price_discount_rate,product_link=EXCLUDED.product_link,
      sales=EXCLUDED.sales,rating_star=EXCLUDED.rating_star,
      affiliate_link_source=EXCLUDED.affiliate_link_source,
      affiliate_sub_ids=EXCLUDED.affiliate_sub_ids,updated_at=NOW()`;
   count++;
   if(o.affiliateWarning)warnings.push({id:o.id,note:o.affiliateWarning});
   if(o.affiliateSubIds.length)withSubIds++;
   if(o.affiliateLinkSource==='productOfferV2.offerLink')fromOfferLink++;
  }
  return Response.json({
   ok:true,count,withSubIds,fromOfferLink,warnings,
   message:count+' produto(s) salvo(s) como INATIVO(S) no Neon. '+
    withSubIds+' link(s) com Sub IDs aceitos. '+
    (count-withSubIds)+' sem Sub IDs personalizados. '+
    'Revise e ative na aba Ofertas.'
  },{headers});
 }catch(error){
  const msg=String(error?.message||'Erro na importação');
  const invalid=/password authentication failed|28p01/i.test(msg);
  const badSubId=/invalid\s*sub[\s_-]*id/i.test(msg);
  const message=invalid?'O Neon rejeitou a autenticação.':
   badSubId?'A Shopee rejeitou até a conversão sem Sub IDs; confira o link original e tente novamente.':
   'A importação não foi concluída. Detalhe: '+msg.slice(0,175);
  return Response.json({error:message},{status:502,headers});
 }
}

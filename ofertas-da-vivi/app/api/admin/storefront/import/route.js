import {isAdmin,forbidden} from '../../../../../lib/auth';
import {getStorefrontPage} from '../../../../../lib/storefront';
import {generateProductAffiliateLink,isShopeeLink} from '../../../../../lib/shopee-links';
import {allocateInternalCode} from '../../../../../lib/product-codes';
import {getDB} from '../../../../../lib/db';
import {knownOfferKeys,matchExisting,primaryOfferKey,offerIdentityKeys} from '../../../../../lib/product-identity';

export const runtime='nodejs';
export const maxDuration=120;
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const BATCH_SIZE=8;

export async function POST(req){
 if(!await isAdmin())return forbidden();
 const input=await req.json().catch(()=>({}));
 const ids=Array.isArray(input.linkIds)?
  [...new Set(input.linkIds.filter(x=>typeof x==='string'&&x.length<120))]:[];
 if(!ids.length||ids.length>BATCH_SIZE)return Response.json({
  error:'Envie de 1 a 8 itens por lote; o painel importa a página inteira automaticamente.'
 },{status:400,headers});
 let sql;
 try{sql=await getDB();if(!sql)throw Error('DATABASE_URL')}
 catch{return Response.json({error:'Não foi possível acessar o banco Neon.'},{status:503,headers})}
 try{
  const page=await getStorefrontPage(input.page);
  const chosen=page.items.filter(x=>ids.includes(x.linkId));
  if(chosen.length!==ids.length)return Response.json({error:'A página da vitrine mudou. Atualize antes de importar.'},{status:409,headers});
  const existing=await sql`SELECT id,title,image,url,product_link,item_id,shop_id,dedupe_key FROM vivi_offers`;
  const seen=knownOfferKeys(existing);
  let imported=0,skipped=0;
  const importedIds=[],skippedIds=[],errors=[];
  const processing=[];
  for(const item of chosen){
   if(matchExisting(item,seen)){
    skipped++;skippedIds.push(item.linkId);
    continue;
   }
   if(!item.affiliateLinkEligible||!isShopeeLink(item.url)){
    skipped++;skippedIds.push(item.linkId);
    errors.push({id:item.linkId,message:'O link não aponta para um endereço Shopee válido.'});
    continue;
   }
   for(const k of offerIdentityKeys(item))seen.add(k);
   processing.push(item);
  }
  // Duas a três conversões por vez evitam sobrecarga; cada uma envia
  // somente o Sub ID próprio no padrão 211126_0001.
  for(let i=0;i<processing.length;i+=3){
   const group=processing.slice(i,i+3);
   const result=await Promise.all(group.map(async item=>{
    let code;
    try{
     code=await allocateInternalCode(sql);
     const converted=await generateProductAffiliateLink(item.url,code);
     const identity=primaryOfferKey(item);
     const saved=await sql`INSERT INTO vivi_offers
      (id,title,category,price,old_price,image,url,featured,active,origin,
       affiliate_link_source,affiliate_sub_ids,affiliate_status,internal_code,
       imported_at,product_link,dedupe_key,updated_at)
      VALUES (${item.id},${item.title},${item.category},NULL,NULL,
       ${item.image||''},${converted.shortLink},false,false,'vitrine',
       'generateShortLink',${code},'verified',${code},NOW(),
       ${item.url},${identity},NOW())
      ON CONFLICT DO NOTHING RETURNING id`;
     return saved.length?{kind:'imported',id:item.linkId,code}:{kind:'skipped',id:item.linkId};
    }catch(e){return {kind:'error',id:item.linkId,message:String(e?.message||'Erro ao converter').slice(0,160)}}
   }));
   for(const r of result){
    if(r.kind==='imported'){imported++;importedIds.push(r.id)}
    else if(r.kind==='skipped'){skipped++;skippedIds.push(r.id)}
    else errors.push({id:r.id,message:r.message});
   }
  }
  return Response.json({
    ok:true,imported,skipped,importedIds,skippedIds,errors,
    message:imported+' novo(s) com código interno e Sub ID confirmado pela Shopee; '+skipped+
     ' ignorado(s). '+(errors.length?errors.length+' falha(s) de conversão (não publicados).':'')
  },{headers});
 }catch(error){
  return Response.json({error:'Não foi possível concluir a importação: '+String(error?.message||'erro').slice(0,140)},{status:502,headers});
 }
}

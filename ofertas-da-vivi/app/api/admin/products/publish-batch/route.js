import {isAdmin,forbidden} from '../../../../../lib/auth';
import {getDB} from '../../../../../lib/db';
import {isShopeeLink,generateProductAffiliateLink} from '../../../../../lib/shopee-links';
import {allocateInternalCode,internalCodeIsValid} from '../../../../../lib/product-codes';
import {knownOfferKeys,matchExisting,offerIdentityKeys} from '../../../../../lib/product-identity';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const BATCH=4;
function rowAsIdentity(row){
 return {id:row.id,title:row.title,image:row.image,url:row.url,
  productLink:row.product_link,shopId:row.shop_id,itemId:row.item_id,dedupeKey:row.dedupe_key};
}

export async function POST(request){
 if(!await isAdmin())return forbidden();
 const payload=await request.json().catch(()=>({}));
 const ids=Array.isArray(payload.ids)?[...new Set(payload.ids.filter(x=>typeof x==='string'&&x.length<=150))]:[];
 if(!ids.length||ids.length>BATCH)return Response.json({
  error:'É permitido ativar até 4 produtos por lote.'
 },{status:400,headers});
 let sql;
 try{sql=await getDB();if(!sql)throw Error('Neon ausente')}
 catch{return Response.json({error:'Não foi possível conectar ao Neon.'},{status:503,headers})}
 try{
  const active=await sql`SELECT id,title,image,url,product_link,shop_id,item_id,dedupe_key
   FROM vivi_offers WHERE active=true`;
  const existing=knownOfferKeys(active);
  const result={ok:true,processed:0,activated:0,alreadyActive:0,duplicates:0,
   invalidLinks:0,conversionErrors:0,errors:[]};
  for(const id of ids){
   const rows=await sql`SELECT * FROM vivi_offers WHERE id=${id} LIMIT 1`;
   result.processed++;
   if(!rows.length){result.invalidLinks++;result.errors.push({id,reason:'Produto não encontrado.'});continue}
   const row=rows[0];
   if(row.active){result.alreadyActive++;continue}
   const identity=rowAsIdentity(row);
   if(matchExisting(identity,existing)){result.duplicates++;continue}
   const source=String(row.product_link||row.url||'').trim();
   if(!isShopeeLink(source)){result.invalidLinks++;result.errors.push({id,reason:'Link de origem não é uma URL Shopee válida.'});continue}
   let code=row.internal_code;
   let url=row.url;
   const tracked=internalCodeIsValid(code)&&row.affiliate_status==='verified'&&
    String(row.affiliate_sub_ids||'').split(',').includes(code)&&isShopeeLink(url);
   if(!tracked){
    try{
     if(!internalCodeIsValid(code))code=await allocateInternalCode(sql);
     const link=await generateProductAffiliateLink(source,code);
     url=link.shortLink;
    }catch(error){
     result.conversionErrors++;
     result.errors.push({id,reason:'A Shopee não confirmou o Sub ID. '+String(error?.message||'Conversão recusada').slice(0,125)});
     continue;
    }
   }
   try{
    const updated=await sql`UPDATE vivi_offers SET
      active=true,url=${url},internal_code=${code},affiliate_sub_ids=${code},
      affiliate_status='verified',affiliate_link_source='generateShortLink',
      imported_at=COALESCE(imported_at,NOW()),updated_at=NOW()
      WHERE id=${id} AND active=false RETURNING id`;
    if(!updated.length){result.alreadyActive++;continue}
    result.activated++;
    for(const key of offerIdentityKeys(identity))existing.add(key);
   }catch{
    result.errors.push({id,reason:'Não foi possível salvar a publicação no Neon.'});
   }
  }
  return Response.json(result,{headers});
 }catch{
  return Response.json({error:'Não foi possível concluir o lote de ativação.'},{status:503,headers});
 }
}

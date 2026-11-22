import {isAdmin,forbidden} from '../../../../../lib/auth';
import {getStorefrontPage} from '../../../../../lib/storefront';
import {isShopeeLink,generateAffiliateLink,defaultSubIds} from '../../../../../lib/shopee-links';
import {getDB} from '../../../../../lib/db';
import {knownOfferKeys,matchExisting,primaryOfferKey,offerIdentityKeys} from '../../../../../lib/product-identity';

export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const BATCH_SIZE=8;

export async function POST(req){
 if(!await isAdmin())return forbidden();
 const input=await req.json().catch(()=>({}));
 const ids=Array.isArray(input.linkIds)?
  [...new Set(input.linkIds.filter(x=>typeof x==='string'&&x.length<120))]:[];
 if(!ids.length||ids.length>BATCH_SIZE){
  return Response.json({error:'Envie de 1 a 8 itens por lote. O painel processa páginas inteiras automaticamente.'},{status:400,headers});
 }
 let sql;
 try{sql=await getDB();if(!sql)throw Error('DATABASE_URL não configurada')}
 catch{return Response.json({error:'O Neon não está pronto para salvar os produtos.'},{status:503,headers})}

 try{
  const page=await getStorefrontPage(input.page);
  const selected=page.items.filter(item=>ids.includes(item.linkId));
  if(selected.length!==ids.length)return Response.json({
   error:'A página da vitrine mudou. Atualize a lista e tente novamente.'
  },{status:409,headers});

  const existing=await sql`SELECT id,title,image,url,product_link,item_id,shop_id,dedupe_key FROM vivi_offers`;
  const seen=knownOfferKeys(existing);
  let imported=0,skipped=0;
  const importedIds=[],skippedIds=[],warnings=[],errors=[];
  for(const item of selected){
   if(matchExisting(item,seen)){
    skipped++;skippedIds.push(item.linkId);
    continue;
   }
   if(!item.affiliateLinkEligible || !isShopeeLink(item.url)){
    skipped++;skippedIds.push(item.linkId);
    errors.push({id:item.linkId,message:'Link não reconhecido como destino Shopee.'});
    continue;
   }
   let generated;
   try{
    generated=await generateAffiliateLink(item.url,defaultSubIds({channel:'site'}));
   }catch{
    // O endereço foi selecionado pela dona da vitrine e não é substituído
    // por uma URL não relacionada. A origem do link permanece explícita.
    generated={
      shortLink:item.url,subIds:[],generatedBy:'collshp_original',
      warning:'O link da vitrine foi preservado. Não foi possível confirmar novos Sub IDs pela Open API.'
    };
   }
   const identity=primaryOfferKey(item);
   try{
    const inserted=await sql`INSERT INTO vivi_offers (
      id,title,category,price,old_price,image,url,featured,active,origin,
      affiliate_link_source,affiliate_sub_ids,product_link,dedupe_key,updated_at)
      VALUES (${item.id},${item.title},${item.category},NULL,NULL,${item.image||''},
       ${generated.shortLink},false,false,'vitrine',
       ${generated.generatedBy},${generated.subIds.join(',')},${item.url},${identity},NOW())
      ON CONFLICT DO NOTHING RETURNING id`;
    if(inserted.length){
     imported++;importedIds.push(item.linkId);
     for(const key of offerIdentityKeys({...item,productLink:item.url,dedupeKey:identity}))seen.add(key);
     if(generated.warning)warnings.push({id:item.linkId,message:generated.warning});
    }else{skipped++;skippedIds.push(item.linkId);}
   }catch(error){
    errors.push({id:item.linkId,message:'Não foi possível gravar este item no banco.'});
   }
  }
  return Response.json({
   ok:true,imported,skipped,importedIds,skippedIds,warnings,errors,
   message:`${imported} novo(s), ${skipped} já existente(s) ou ignorado(s).`+
     ' Produtos novos ficam inativos até revisão.'
  },{headers});
 }catch(error){
  const message=String(error?.message||'Erro inesperado').slice(0,160);
  return Response.json({error:'Falha na leitura/importação desta página: '+message},{status:502,headers});
 }
}

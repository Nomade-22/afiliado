import {isAdmin,forbidden} from '../../../../../lib/auth';
import {getStorefrontPage} from '../../../../../lib/storefront';
import {isShopeeLink,generateAffiliateLink,defaultSubIds} from '../../../../../lib/shopee-links';
import {getDB} from '../../../../../lib/db';

export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};

export async function POST(req){
 if(!await isAdmin())return forbidden();
 const input=await req.json().catch(()=>({}));
 const linkIds=Array.isArray(input.linkIds)?[...new Set(input.linkIds.filter(x=>typeof x==='string'&&x.length<120))].slice(0,9):[];
 if(!linkIds.length||linkIds.length>8)return Response.json({
  error:'Selecione entre 1 e 8 produtos da vitrine por vez.'
 },{status:400,headers});
 let sql;
 try{sql=await getDB();if(!sql)throw Error('DATABASE_URL não configurada')}
 catch{return Response.json({error:'O Neon não está pronto para salvar os produtos.'},{status:503,headers})}

 try{
  const page=await getStorefrontPage(input.page);
  const chosen=page.items.filter(x=>linkIds.includes(x.linkId));
  if(chosen.length!==linkIds.length)return Response.json({
   error:'Os itens mudaram na sua vitrine. Atualize a lista e selecione novamente.'
  },{status:409,headers});
  const invalid=chosen.filter(x=>!x.affiliateLinkEligible);
  if(invalid.length)return Response.json({
   error:'Alguns itens não apontam diretamente para a Shopee. Confira seus links originais na vitrine antes de importar.'
  },{status:422,headers});
  const prepared=[];
  for(let i=0;i<chosen.length;i+=2){
   const batch=chosen.slice(i,i+2);
   const result=await Promise.all(batch.map(async item=>{
    let generated;
    try{
      generated=await generateAffiliateLink(item.url,defaultSubIds({channel:'site'}));
    }catch{
      // Link já cadastrado pela pessoa dona desta vitrine pública.
      // Origem fica explícita para não alegar que houve conversão pela API.
      generated={
       shortLink:item.url,subIds:[],generatedBy:'collshp_original',
       warning:'Foi preservado o link público da sua vitrine, sem validação de conversão nem Sub IDs.'
      };
    }
    return {...item,link:generated};
   }));
   prepared.push(...result);
  }
  const warnings=[];
  for(const item of prepared){
   await sql`INSERT INTO vivi_offers (
    id,title,category,price,old_price,image,url,featured,active,origin,
    affiliate_link_source,affiliate_sub_ids,product_link,updated_at)
    VALUES (
     ${item.id},${item.title},${item.category},NULL,NULL,${item.image||''},${item.link.shortLink},
     false,false,'vitrine',${item.link.generatedBy},${item.link.subIds.join(',')},${item.url},NOW()
    )
    ON CONFLICT(id) DO UPDATE SET
      title=EXCLUDED.title,image=EXCLUDED.image,url=EXCLUDED.url,
      affiliate_link_source=EXCLUDED.affiliate_link_source,
      affiliate_sub_ids=EXCLUDED.affiliate_sub_ids,updated_at=NOW()`;
   if(item.link.warning)warnings.push({id:item.id,message:item.link.warning});
  }
  return Response.json({
   ok:true,count:prepared.length,warnings,
   message:prepared.length+' produto(s) da sua vitrine importado(s) como INATIVO(S). A vitrine não fornece preço: revise antes de publicar.'
  },{headers});
 }catch(error){
  return Response.json({
   error:'Falha ao importar itens da vitrine: '+String(error?.message||'erro desconhecido').slice(0,165)
  },{status:502,headers});
 }
}

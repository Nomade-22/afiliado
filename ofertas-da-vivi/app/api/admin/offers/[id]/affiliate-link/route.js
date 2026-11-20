import {isAdmin,forbidden} from '../../../../../../lib/auth';
import {getDB} from '../../../../../../lib/db';
import {generateAffiliateLink,defaultSubIds} from '../../../../../../lib/shopee-links';

export const runtime='nodejs';
export const maxDuration=30;
const headers={'Cache-Control':'private, no-store'};
export async function POST(req,{params}){
 if(!await isAdmin())return forbidden();
 let sql;
 try{sql=await getDB()}catch{return Response.json({error:'Não foi possível conectar ao Neon.'},{status:503,headers})}
 if(!sql)return Response.json({error:'O Neon precisa estar conectado para atualizar um produto salvo.'},{status:503,headers});
 const {id}=await params;
 if(typeof id!=='string'||id.length>150)return Response.json({error:'Identificador inválido'},{status:400,headers});
 const rows=await sql`SELECT id,url,product_link,item_id FROM vivi_offers WHERE id=${id} LIMIT 1`;
 if(!rows.length)return Response.json({error:'Oferta não encontrada.'},{status:404,headers});
 const row=rows[0];
 const source=row.product_link||row.url;
 const subIds=defaultSubIds({channel:'site',itemId:row.item_id||null,custom:row.item_id?[]:['manual']});
 let generated;
 try{generated=await generateAffiliateLink(source,subIds)}
 catch(error){return Response.json({error:'A Shopee não confirmou o novo link; o link anterior foi preservado: '+String(error?.message||'erro').slice(0,160)},{status:502,headers})}
 try{
  await sql`UPDATE vivi_offers SET url=${generated.shortLink},updated_at=NOW() WHERE id=${id}`;
  return Response.json({ok:true,link:generated.shortLink,subIds,message:'Link atualizado pela Shopee. O produto continua no mesmo estado de publicação.'},{headers});
 }catch{return Response.json({error:'A Shopee gerou o link, mas o banco não conseguiu gravá-lo. Nenhuma alteração foi aplicada.'},{status:503,headers})}
}

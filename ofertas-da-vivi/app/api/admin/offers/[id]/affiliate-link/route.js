import {isAdmin,forbidden} from '../../../../../../lib/auth';
import {getDB} from '../../../../../../lib/db';
import {allocateInternalCode} from '../../../../../../lib/product-codes';
import {generateProductAffiliateLink} from '../../../../../../lib/shopee-links';

export const runtime='nodejs';
export const maxDuration=30;
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function POST(req,{params}){
 if(!await isAdmin())return forbidden();
 let sql;
 try{sql=await getDB();if(!sql)throw Error('Neon')}
 catch{return Response.json({error:'Neon não conectado.'},{status:503,headers})}
 const {id}=await params;
 if(typeof id!=='string'||id.length>150)return Response.json({error:'Identificador inválido.'},{status:400,headers});
 try{
  const rows=await sql`SELECT id,url,product_link,internal_code,affiliate_sub_ids,affiliate_status
   FROM vivi_offers WHERE id=${id} LIMIT 1`;
  if(!rows.length)return Response.json({error:'Produto não encontrado.'},{status:404,headers});
  const offer=rows[0];
  const code=offer.internal_code||await allocateInternalCode(sql);
  const source=offer.product_link||offer.url;
  const generated=await generateProductAffiliateLink(source,code);
  const result=await sql`UPDATE vivi_offers
   SET internal_code=${code},imported_at=COALESCE(imported_at,NOW()),
    url=${generated.shortLink},affiliate_sub_ids=${code},
    affiliate_status='verified',affiliate_link_source='generateShortLink',updated_at=NOW()
   WHERE id=${id} RETURNING internal_code`;
  return Response.json({ok:true,id,link:generated.shortLink,subIds:[code],
   internalCode:code,message:'Link regenerado com Sub ID '+code+' e confirmado pela API Shopee.'},{headers});
 }catch(e){
  return Response.json({error:'O link antigo foi preservado; a nova conversão não foi confirmada: '+
    String(e?.message||'erro').slice(0,180)},{status:502,headers});
 }
}

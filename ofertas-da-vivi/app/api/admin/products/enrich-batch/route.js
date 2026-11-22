import {isAdmin,forbidden} from '../../../../../lib/auth';
import {getDB} from '../../../../../lib/db';
import {isShopeeLink} from '../../../../../lib/shopee-links';
import {enrichProducts} from '../../../../../lib/product-enrichment';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};

export async function POST(request){
 if(!await isAdmin())return forbidden();
 const payload=await request.json().catch(()=>({}));
 const ids=Array.isArray(payload.ids)?
  [...new Set(payload.ids.filter(x=>typeof x==='string'&&x.length<=150))]:[];
 if(!ids.length||ids.length>3)return Response.json({
  error:'Busque de 1 a 3 produtos por lote.'
 },{status:400,headers});
 const override=typeof payload.originalProductUrl==='string'?
  payload.originalProductUrl.trim():'';
 if(override&&ids.length!==1)return Response.json({
  error:'O link original só pode ser informado ao buscar um produto por vez.'
 },{status:400,headers});
 if(override&&!isShopeeLink(override))return Response.json({
  error:'Informe um link HTTPS da Shopee, sem links de outros sites.'
 },{status:400,headers});
 let sql;
 try{sql=await getDB();if(!sql)throw Error('Neon ausente')}
 catch{return Response.json({error:'Não foi possível acessar o Neon.'},{status:503,headers})}
 try{
  const report=await enrichProducts(sql,ids,override);
  return Response.json(report,{headers});
 }catch{
  return Response.json({error:'Falha ao consultar os dados Shopee.'},{status:502,headers});
 }
}

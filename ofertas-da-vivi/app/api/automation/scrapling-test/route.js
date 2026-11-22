import {verifyScraplingWorkflow} from '../../../../lib/github-scrapling-oidc';
import {getDB} from '../../../../lib/db';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=30;
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const reply=(body,status=200)=>Response.json(body,{status,headers});
function safeImages(raw){
 try{
  const arr=JSON.parse(raw||'[]');
  return Array.isArray(arr)?arr.filter(x=>typeof x==='string').slice(0,12):[];
 }catch{return []}
}
export async function GET(request){
 const who=await verifyScraplingWorkflow(request);
 if(!who)return reply({error:'Acesso não autorizado.'},401);
 try{
  const sql=await getDB();
  if(!sql)return reply({error:'Neon indisponível.'},503);
  const products=await sql`
   SELECT id,title,item_id,shop_id,image,product_images,
    CASE WHEN product_description IS NOT NULL THEN LENGTH(TRIM(product_description)) ELSE 0 END AS description_chars
   FROM vivi_offers WHERE active=TRUE
    AND item_id ~ '^[0-9]{1,24}$' AND shop_id ~ '^[0-9]{1,24}$'
   ORDER BY CASE WHEN LOWER(title) LIKE '%play & joy%' THEN 0 ELSE 1 END,
    updated_at DESC LIMIT 10`;
  return reply({runId:who.runId,products:products.map(p=>({
   id:p.id,title:p.title,
   shopId:p.shop_id,itemId:p.item_id,
   sourceUrl:'https://shopee.com.br/product/'+p.shop_id+'/'+p.item_id,
   existingDescriptionChars:Number(p.description_chars||0),
   existingImageCount:safeImages(p.product_images).length,
   cover:p.image||null
  }))});
 }catch(error){
  console.error('scrapling_test_candidates',String(error?.code||'DB_ERROR'));
  return reply({error:'Não foi possível carregar os produtos do teste.'},503);
 }
}
export async function POST(request){
 const who=await verifyScraplingWorkflow(request);
 if(!who)return reply({error:'Acesso não autorizado.'},401);
 if(Number(request.headers.get('content-length')||0)>120000)return reply({error:'Relatório muito grande.'},413);
 try{
  const payload=await request.json();
  if(payload.runId!==who.runId||!Array.isArray(payload.results)||
    payload.results.length>10||!['completed','failed'].includes(payload.status))return reply({error:'Formato inválido.'},400);
  const allowedStatus=new Set(['success','partial','unavailable','blocked','error','not_attempted']);
  const clean=payload.results.map(item=>{
   if(typeof item.id!=='string'||item.id.length>150||
      !allowedStatus.has(item.status))throw Error('Resultado inválido');
   const urls=Array.isArray(item.images)?item.images.filter(x=>{
    if(typeof x!=='string'||x.length>1100)return false;
    try{
     const u=new URL(x);
     return u.protocol==='https:'&&!u.username&&!u.password&&
      ['shopee.sg','shopee.com.br','susercontent.com','shopee.com'].some(d=>u.hostname===d||u.hostname.endsWith('.'+d));
    }catch{return false}
   }).slice(0,12):[];
   return {
    id:item.id,title:String(item.title||'').slice(0,220),
    status:item.status,sourceUrl:String(item.sourceUrl||'').slice(0,320),
    httpStatus:Number(item.httpStatus||0),
    description:String(item.description||'').slice(0,3500),
    descriptionSource:String(item.descriptionSource||'').slice(0,60),
    images:urls,duplicateImagesRemoved:Math.min(50,Math.max(0,Number(item.duplicateImagesRemoved||0))),
    titleMatched:Boolean(item.titleMatched),
    reason:String(item.reason||'').slice(0,260),
    runtimeSeconds:Math.max(0,Math.min(120,Number(item.runtimeSeconds||0)))
   };
  });
  // Um resultado precisa corresponder a um produto cadastrado na loja.
  const sql=await getDB();
  if(!sql)return reply({error:'Neon indisponível.'},503);
  const existing=await sql`SELECT id FROM vivi_offers WHERE id = ANY(${clean.map(x=>x.id)})`;
  const ids=new Set(existing.map(x=>x.id));
  if(clean.some(x=>!ids.has(x.id)))return reply({error:'Produto do teste não localizado.'},400);
  await sql`INSERT INTO vivi_scrapling_test_runs (run_id,status,finished_at,results_json,notes)
    VALUES (${who.runId},${payload.status},NOW(),${JSON.stringify(clean)},${String(payload.notes||'').slice(0,250)})
    ON CONFLICT (run_id) DO UPDATE
    SET status=EXCLUDED.status,finished_at=EXCLUDED.finished_at,
        results_json=EXCLUDED.results_json,notes=EXCLUDED.notes`;
  return reply({ok:true,stored:clean.length});
 }catch(error){
  console.error('scrapling_test_store',String(error?.code||'INVALID_REPORT'));
  return reply({error:'Não foi possível salvar o relatório.'},400);
 }
}

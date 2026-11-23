import {isAdmin,forbidden} from '../../../../lib/auth';
import {getDB} from '../../../../lib/db';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};

export async function GET(){
 if(!await isAdmin())return forbidden();
 try{
  const sql=await getDB();
  if(!sql)throw Error('Banco indisponível');
  const [products,runs,captures]=await Promise.all([
   sql`SELECT id,title,item_id,shop_id,image,product_images,
    COALESCE(LENGTH(TRIM(product_description)),0) AS description_chars
    FROM vivi_offers
    WHERE active=TRUE AND item_id ~ '^[0-9]{1,24}$'
      AND shop_id ~ '^[0-9]{1,24}$'
    ORDER BY CASE WHEN LOWER(title) LIKE '%play & joy%' THEN 0 ELSE 1 END,
     updated_at DESC LIMIT 10`,
   sql`SELECT run_id,status,started_at,finished_at,results_json,notes
    FROM vivi_scrapling_test_runs ORDER BY finished_at DESC LIMIT 2`,
   sql`SELECT offer_id,item_id,shop_id,title,description,images_json,source_url,
     duplicate_images_removed,captured_at
     FROM vivi_extension_test_captures ORDER BY captured_at DESC LIMIT 20`
  ]);
  function galleryCount(raw){
   try{const value=JSON.parse(raw||'[]');return Array.isArray(value)?value.length:0}
   catch{return 0}
  }
  const reports=runs.map(r=>({
   runId:r.run_id,status:r.status,startedAt:r.started_at,finishedAt:r.finished_at,
   notes:r.notes||'',results:(()=>{try{const v=JSON.parse(r.results_json||'[]');return Array.isArray(v)?v:[]}catch{return []}})()
  }));
  return Response.json({
   candidates:products.map(p=>({id:p.id,title:p.title,
    itemId:p.item_id,shopId:p.shop_id,
    sourceUrl:'https://shopee.com.br/product/'+p.shop_id+'/'+p.item_id,
    cover:p.image,descriptionChars:Number(p.description_chars||0),
    galleryCount:galleryCount(p.product_images)})),
   captures:captures.filter(c=>products.some(p=>p.id===c.offer_id)).map(c=>({
    offerId:c.offer_id,itemId:c.item_id,shopId:c.shop_id,title:c.title,
    description:c.description,images:(()=>{try{const v=JSON.parse(c.images_json||'[]');return Array.isArray(v)?v:[]}catch{return []}})(),
    sourceUrl:c.source_url,duplicatesRemoved:Number(c.duplicate_images_removed||0),
    capturedAt:c.captured_at
   })),
   reports
  },{headers});
 }catch(error){
  console.error('vivi_scrapling_admin',String(error?.code||'DB_ERROR'));
  return Response.json({error:'Não foi possível consultar o teste. Confira o banco Neon.'},{status:503,headers});
 }
}

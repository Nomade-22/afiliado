import {isAdmin,forbidden} from '../../../../../lib/auth';
import {getDB} from '../../../../../lib/db';
import {getShopeeProductMetadata} from '../../../../../lib/shopee-product';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const BATCH=3;
function safeImage(value){
 try{
  const u=new URL(String(value||''));
  return u.protocol==='https:'&&!u.username&&!u.password?u.toString():null;
 }catch{return null}
}
function existingImages(value){
 try{return Array.isArray(JSON.parse(value||'[]'))?JSON.parse(value||'[]'):[]}
 catch{return []}
}
export async function POST(request){
 if(!await isAdmin())return forbidden();
 const payload=await request.json().catch(()=>({}));
 const ids=Array.isArray(payload.ids)?[...new Set(payload.ids.filter(x=>typeof x==='string'&&x.length<=150))]:[];
 if(!ids.length||ids.length>BATCH)return Response.json({error:'Busque dados de até 3 produtos por lote.'},{status:400,headers});
 let sql;
 try{sql=await getDB();if(!sql)throw Error('Neon ausente')}
 catch{return Response.json({error:'Não foi possível acessar o Neon.'},{status:503,headers})}
 const report={ok:true,processed:0,matched:0,descriptionsAdded:0,
  newPhotos:0,mainPhotos:0,withoutExtraData:0,errors:[]};
 for(const id of ids){
  report.processed++;
  let row;
  try{
   const rows=await sql`SELECT * FROM vivi_offers WHERE id=${id} LIMIT 1`;
   row=rows[0];
  }catch{report.errors.push({id,reason:'Falha na leitura do produto.'});continue}
  if(!row){report.errors.push({id,reason:'Produto não encontrado.'});continue}
  let data;
  try{data=await getShopeeProductMetadata(row)}
  catch{report.errors.push({id,reason:'A consulta de dados adicionais falhou.'});continue}
  if(!data?.matched){
   report.withoutExtraData++;
   report.errors.push({id,reason:String(data?.warning||'Produto não localizado com segurança na API.').slice(0,150)});
   continue;
  }
  report.matched++;
  // Nunca substitui uma descrição escrita pelo administrador.
  const description=String(row.product_description||'').trim()?row.product_description:
   String(data.description||'').trim().slice(0,6000)||null;
  const wasMissing=!String(row.product_description||'').trim();
  const gotDescription=wasMissing&&Boolean(description);
  const galleryBefore=[...new Set(existingImages(row.product_images).map(safeImage).filter(Boolean))];
  const candidates=[...galleryBefore,...(Array.isArray(data.images)?data.images:[]),data.image,row.image]
   .map(safeImage).filter(Boolean);
  const gallery=[...new Set(candidates)].slice(0,12);
  const newlyAdded=gallery.filter(img=>!galleryBefore.includes(img));
  // Não altera imagens escolhidas no ADM, exceto ao preencher uma capa vazia.
  const image=safeImage(row.image)||safeImage(data.image)||gallery[0]||null;
  try{
   await sql`UPDATE vivi_offers SET
      image=${image},product_description=${description},product_images=${JSON.stringify(gallery)},
      shop_name=COALESCE(shop_name,${data.shopName||null}),
      item_id=COALESCE(item_id,${data.ids?.itemId||null}),
      shop_id=COALESCE(shop_id,${data.ids?.shopId||null}),
      sales=COALESCE(${data.sales??null},sales),
      rating_star=COALESCE(${data.ratingStar??null},rating_star),
      stock_quantity=COALESCE(${data.stockSource?data.stockQuantity:null},stock_quantity),
      updated_from_api_at=NOW(),updated_at=NOW()
      WHERE id=${id}`;
   if(gotDescription)report.descriptionsAdded++;
   if(newlyAdded.length)report.newPhotos+=newlyAdded.length;
   if(!safeImage(row.image)&&image)report.mainPhotos++;
  }catch{
   report.errors.push({id,reason:'Falha ao salvar informações retornadas pela Shopee.'});
  }
 }
 return Response.json(report,{headers});
}

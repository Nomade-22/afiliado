import {isAdmin,forbidden} from '../../../../../lib/auth';
import {getDB} from '../../../../../lib/db';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const reply=(payload,status=200)=>Response.json(payload,{status,headers});
const imgHosts=['susercontent.com','shopee.com.br','shopee.com','shopee.sg'];

function parsedImage(raw){
 if(typeof raw!=='string'||raw.length>1100)return null;
 try{
  const u=new URL(raw);
  if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
  const host=u.hostname.toLowerCase();
  if(!imgHosts.some(h=>host===h||host.endsWith('.'+h)))return null;
  if(!u.pathname||u.pathname==='/')return null;
  u.search='';u.hash='';
  return u.toString();
 }catch{return null}
}
function fingerprint(raw){
 const path=new URL(raw).pathname.toLowerCase();
 return path.replace(/(_tn|@resize_w\\d+_n[lq]|_\\d+x\\d+)(?=\\.|$)/g,'')
  .replace(/\\.(webp|jpg|jpeg|png)$/,'').split('/').pop();
}
function sourceMatches(url,shopId,itemId){
 try{
  const u=new URL(url);
  if(u.protocol!=='https:'||u.hostname!=='shopee.com.br'||u.username||u.password||u.port)return false;
  const path=decodeURIComponent(u.pathname);
  const pattern1=/\/product\/(\d+)\/(\d+)/i.exec(path);
  const pattern2=/(?:^|[-/])i\.(\d+)\.(\d+)(?:$|\/)/i.exec(path);
  const match=pattern1||pattern2;
  return Boolean(match&&match[1]===shopId&&match[2]===itemId);
 }catch{return false}
}

export async function POST(request){
 if(!await isAdmin())return forbidden();
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)return reply({error:'Origem não autorizada.'},403);
 const bytes=Number(request.headers.get('content-length')||0);
 if(bytes>70000)return reply({error:'Captura muito extensa para o ambiente de teste.'},413);
 let data;
 try{
  const text=await request.text();
  if(text.length>70000)return reply({error:'Dados muito extensos.'},413);
  data=JSON.parse(text);
 }catch{return reply({error:'Cole o JSON completo gerado pela extensão.'},400)}
 if(data?.type!=='vivi-shopee-capture-v1')return reply({error:'Formato incompatível com a extensão de teste.'},400);
 const {shopId,itemId}=data;
 if(!/^\d{1,24}$/.test(String(shopId||''))||!/^\d{1,24}$/.test(String(itemId||'')))return reply({error:'IDs do anúncio não identificados.'},400);
 if(!sourceMatches(String(data.sourceUrl||''),String(shopId),String(itemId)))return reply({error:'O link da captura não corresponde aos IDs do anúncio.'},400);
 const description=typeof data.description==='string'?data.description.trim().slice(0,12000):'';
 const images=Array.isArray(data.images)?data.images.slice(0,40):[];
 const valid=images.map(parsedImage).filter(Boolean);
 const unique=[];
 const seen=new Set();
 for(const url of valid){
  const fp=fingerprint(url);
  if(seen.has(fp))continue;
  seen.add(fp);unique.push(url);
  if(unique.length>=16)break;
 }
 if(description.length<25&&unique.length===0)return reply({error:'A extensão não conseguiu recuperar uma descrição válida ou imagem do anúncio. Não salvamos resultados vazios.'},422);
 try{
  const sql=await getDB();
  if(!sql)return reply({error:'Banco indisponível.'},503);
  const candidates=await sql`SELECT id,item_id,shop_id,title FROM vivi_offers WHERE active=TRUE
   AND item_id ~ '^[0-9]{1,24}$' AND shop_id ~ '^[0-9]{1,24}$'
   ORDER BY CASE WHEN LOWER(title) LIKE '%play & joy%' THEN 0 ELSE 1 END,
   updated_at DESC LIMIT 10`;
  const matched=candidates.find(x=>String(x.item_id)===String(itemId)&&String(x.shop_id)===String(shopId));
  if(!matched)return reply({error:'Esse produto não está entre os 10 anúncios do piloto. Abra um dos links da página de teste para capturá-lo.'},422);
  const duplicates=Number(data.duplicateImagesRemoved||0);
  const removed=Math.max(0,Math.min(99,Math.trunc(duplicates)+(valid.length-unique.length)));
  await sql`INSERT INTO vivi_extension_test_captures
   (offer_id,item_id,shop_id,title,description,images_json,source_url,duplicate_images_removed,captured_at)
   VALUES (${matched.id},${itemId},${shopId},${matched.title},${description},
    ${JSON.stringify(unique)},${data.sourceUrl},${removed},NOW())
   ON CONFLICT (offer_id) DO UPDATE SET
    description=EXCLUDED.description,images_json=EXCLUDED.images_json,
    source_url=EXCLUDED.source_url,
    duplicate_images_removed=EXCLUDED.duplicate_images_removed,captured_at=NOW()`;
  return reply({ok:true,offerId:matched.id,title:matched.title,descriptionChars:description.length,
   imageCount:unique.length,duplicatesRemoved:removed,publicStorefrontChanged:false});
 }catch(error){
  console.error('vivi_extension_test_save',String(error?.code||'ERROR'));
  return reply({error:'Não foi possível salvar a captura do teste.'},503);
 }
}

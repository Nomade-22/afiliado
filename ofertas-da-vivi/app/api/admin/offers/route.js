import {isAdmin,forbidden} from '../../../../lib/auth';
import {getDB,mapOffer} from '../../../../lib/db';
import {generateProductAffiliateLink,isShopeeLink} from '../../../../lib/shopee-links';
import {allocateInternalCode} from '../../../../lib/product-codes';
import {knownOfferKeys,matchExisting,primaryOfferKey} from '../../../../lib/product-identity';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=30;
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function GET(){
 if(!await isAdmin())return forbidden();
 try{
  const sql=await getDB();
  if(!sql)return Response.json({offers:[],db:false},{headers});
  const rows=await sql`SELECT * FROM vivi_offers ORDER BY updated_at DESC LIMIT 500`;
  return Response.json({offers:rows.map(mapOffer),db:true},{headers});
 }catch{return Response.json({offers:[],db:false,warning:'Neon indisponível.'},{headers})}
}
export async function POST(req){
 if(!await isAdmin())return forbidden();
 const d=await req.json().catch(()=>({}));
 const title=String(d.title||'').trim().slice(0,180);
 const origin=String(d.url||'').trim();
 const category=String(d.category||'Outros').slice(0,35);
 const image=String(d.image||'').trim().slice(0,1024);
 const price=d.price==null||d.price===''?null:Number(d.price);
 const oldPrice=d.oldPrice==null||d.oldPrice===''?null:Number(d.oldPrice);
 if(!title||!isShopeeLink(origin)||price!==null&&(!Number.isFinite(price)||price<0)||
  oldPrice!==null&&(!Number.isFinite(oldPrice)||oldPrice<0)||
  image&&!/^https:\/\//.test(image)){
  return Response.json({error:'Informe nome, link HTTPS Shopee e preços válidos.'},{status:400,headers});
 }
 let sql;
 try{sql=await getDB();if(!sql)throw Error('DB')}
 catch{return Response.json({error:'Neon indisponível para salvar o produto.'},{status:503,headers})}
 const offer={title,productLink:origin,url:origin,image};
 const seen=knownOfferKeys(await sql`SELECT id,title,image,url,product_link,item_id,shop_id,dedupe_key FROM vivi_offers`);
 if(matchExisting(offer,seen))return Response.json({error:'Este produto já existe no catálogo. Não foi duplicado.'},{status:409,headers});
 const id='manual-'+crypto.randomUUID();
 try{
  const internalCode=await allocateInternalCode(sql);
  const link=await generateProductAffiliateLink(origin,internalCode);
  const identity=primaryOfferKey(offer);
  const result=await sql`INSERT INTO vivi_offers (
   id,title,category,price,old_price,image,url,featured,active,origin,product_link,
   affiliate_link_source,affiliate_sub_ids,affiliate_status,internal_code,imported_at,dedupe_key)
   VALUES (${id},${title},${category},${price},${oldPrice},${image},
    ${link.shortLink},${Boolean(d.featured)},false,'manual',${origin},
    'generateShortLink',${internalCode},'verified',${internalCode},NOW(),${identity})
   ON CONFLICT DO NOTHING RETURNING id`;
  if(!result.length)return Response.json({error:'Produto já cadastrado; nenhum duplicado foi criado.'},{status:409,headers});
  return Response.json({ok:true,id,internalCode,link:link.shortLink,
   message:'Produto '+internalCode+' importado como inativo com Sub ID rastreável.'},{headers});
 }catch(e){return Response.json({error:'Produto não importado. Conversão de link obrigatória: '+String(e?.message||'Erro').slice(0,165)},{status:502,headers})}
}

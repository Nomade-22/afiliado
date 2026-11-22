import {isAdmin,forbidden} from '../../../../../lib/auth';
import {getDB} from '../../../../../lib/db';
import {isShopeeLink} from '../../../../../lib/shopee-links';
import {knownOfferKeys,matchExisting} from '../../../../../lib/product-identity';

export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const categories=['Casa','Beleza','Moda','Eletrônicos','Utilidades','Infantil','Outros'];

export async function PATCH(req,{params}){
 if(!await isAdmin())return forbidden();
 const {id}=await params;
 if(typeof id!=='string'||id.length>150)return Response.json({error:'Identificador inválido.'},{status:400,headers});
 const body=await req.json().catch(()=>null);
 if(!body||typeof body!=='object'||Array.isArray(body)){
  return Response.json({error:'Dados de edição inválidos.'},{status:400,headers});
 }
 let sql;
 try{sql=await getDB()}catch{return Response.json({error:'Falha de conexão Neon.'},{status:503,headers})}
 if(!sql)return Response.json({error:'Banco não configurado.'},{status:503,headers});
 const found=await sql`SELECT * FROM vivi_offers WHERE id=${id} LIMIT 1`;
 if(!found.length)return Response.json({error:'Produto não encontrado.'},{status:404,headers});
 const old=found[0],next={};
 if(Object.hasOwn(body,'title')){
  next.title=String(body.title||'').trim().slice(0,180);
  if(!next.title)return Response.json({error:'O nome do produto não pode ficar vazio.'},{status:400,headers});
 }
 if(Object.hasOwn(body,'category')){
  next.category=String(body.category||'');
  if(!categories.includes(next.category))return Response.json({error:'Categoria inválida.'},{status:400,headers});
 }
 for(const field of ['price','oldPrice']){
  if(!Object.hasOwn(body,field))continue;
  const value=body[field];
  if(value===null||value===''){next[field]=null;continue}
  const n=Number(value);
  if(!Number.isFinite(n)||n<0||n>1000000){
   return Response.json({error:'Preço inválido em '+field+'.'},{status:400,headers});
  }
  next[field]=n;
 }
 if(Object.hasOwn(body,'image')){
  next.image=String(body.image||'').trim().slice(0,1400);
  if(next.image){
   try{
    const u=new URL(next.image);
    if(u.protocol!=='https:'||u.username||u.password)throw Error('invalid');
   }catch{return Response.json({error:'A imagem deve ser um link HTTPS válido.'},{status:400,headers})}
  }
 }
 if(typeof body.active==='boolean'){
  if(body.active&&!isShopeeLink(old.url))return Response.json({error:'O produto não possui um link Shopee válido para ativação.'},{status:400,headers});
  next.active=body.active;
 }
 if(Object.hasOwn(body,'description')){
  next.description=String(body.description||'').trim().slice(0,6000);
 }
 if(Object.hasOwn(body,'images')){
  if(!Array.isArray(body.images)||body.images.length>12){
   return Response.json({error:'A galeria aceita até 12 imagens.'},{status:400,headers});
  }
  const unique=[...new Set(body.images.map(x=>String(x||'').trim()).filter(Boolean))];
  for(const value of unique){
   try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)throw Error('invalid')}
   catch{return Response.json({error:'A galeria precisa de URLs HTTPS válidas.'},{status:400,headers})}
  }
  next.images=JSON.stringify(unique);
 }
 if(typeof body.featured==='boolean')next.featured=body.featured;
 const wantsActive=Object.hasOwn(next,'active')?next.active:old.active;
 if(wantsActive){
  const activeRows=await sql`SELECT id,title,image,url,product_link,item_id,shop_id,dedupe_key
    FROM vivi_offers WHERE active=true AND id<>${id}`;
  if(matchExisting({
    id,title:next.title??old.title,image:Object.hasOwn(next,'image')?next.image:old.image,
    url:old.url,productLink:old.product_link,shopId:old.shop_id,itemId:old.item_id,
    dedupeKey:old.dedupe_key
   },knownOfferKeys(activeRows))){
   return Response.json({
    error:'Este produto já está publicado no site. Desative o anúncio duplicado antes de ativar outro.'
   },{status:409,headers});
  }
 }
 await sql`UPDATE vivi_offers SET
  title=${next.title??old.title},
  category=${next.category??old.category},
  price=${Object.hasOwn(next,'price')?next.price:old.price},
  old_price=${Object.hasOwn(next,'oldPrice')?next.oldPrice:old.old_price},
  image=${Object.hasOwn(next,'image')?next.image:old.image},
  active=${Object.hasOwn(next,'active')?next.active:old.active},
  featured=${Object.hasOwn(next,'featured')?next.featured:old.featured},
  product_description=${Object.hasOwn(next,'description')?next.description:old.product_description},
  product_images=${Object.hasOwn(next,'images')?next.images:old.product_images},
  updated_at=NOW()
  WHERE id=${id}`;
 return Response.json({ok:true,message:'Produto atualizado.'},{headers});
}

export async function DELETE(_req,{params}){
 if(!await isAdmin())return forbidden();
 const sql=await getDB();
 if(!sql)return Response.json({error:'Banco não configurado.'},{status:503,headers});
 const {id}=await params;
 if(typeof id!=='string'||id.length>150)return Response.json({error:'Identificador inválido.'},{status:400,headers});
 await sql`DELETE FROM vivi_offers WHERE id=${id}`;
 return Response.json({ok:true},{headers});
}

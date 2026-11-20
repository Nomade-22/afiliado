import {isAdmin,forbidden} from '../../../../lib/auth';
import {getDB,mapOffer} from '../../../../lib/db';
import {generateAffiliateLink,defaultSubIds,isShopeeLink} from '../../../../lib/shopee-links';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=30;

export async function GET(){
 if(!await isAdmin())return forbidden();
 try{
  const sql=await getDB();
  if(!sql)return Response.json({offers:[],db:false},{headers:{'Cache-Control':'private, no-store'}});
  const rows=await sql`SELECT * FROM vivi_offers ORDER BY updated_at DESC LIMIT 500`;
  return Response.json({offers:rows.map(mapOffer),db:true},{headers:{'Cache-Control':'private, no-store'}});
 }catch{
  return Response.json({offers:[],db:false,warning:'O Neon está indisponível; a pesquisa Shopee continua independente.'},{headers:{'Cache-Control':'private, no-store'}});
 }
}

export async function POST(req){
 if(!await isAdmin())return forbidden();
 let d;
 try{d=await req.json()}catch{return Response.json({error:'JSON inválido'},{status:400})}
 const title=String(d.title||'').trim().slice(0,160);
 const origin=String(d.url||'').trim();
 const category=String(d.category||'Outros').slice(0,35);
 const image=String(d.image||'').trim().slice(0,1024);
 const price=Number(d.price),oldPrice=d.oldPrice?Number(d.oldPrice):null;
 if(!title||!isShopeeLink(origin)||!Number.isFinite(price)||price<=0||price>1000000||image&&!/^https:\/\//.test(image)){
  return Response.json({error:'Informe nome, preço, imagem HTTPS (opcional) e link original da Shopee válido.'},{status:400});
 }
 let sql;
 try{sql=await getDB()}catch{return Response.json({error:'O Neon não está conectado. É possível gerar links sem banco na aba Links de Afiliado.'},{status:503})}
 if(!sql)return Response.json({error:'Configure DATABASE_URL para salvar e publicar as ofertas.'},{status:503});
 const id=`manual-${crypto.randomUUID()}`;
 let generated;
 try{
  generated=await generateAffiliateLink(origin,defaultSubIds({channel:'site',custom:['manual',id.slice(-8)]}));
 }catch(error){
  return Response.json({error:'A Shopee não confirmou um link rastreado. Oferta não cadastrada: '+String(error?.message||'falha').slice(0,170)},{status:502});
 }
 try{
  await sql`INSERT INTO vivi_offers(id,title,category,price,old_price,image,url,featured,active,origin,product_link)
   VALUES (${id},${title},${category},${price},${oldPrice},${image},${generated.shortLink},${Boolean(d.featured)},false,'manual',${origin})`;
 }catch{
  return Response.json({error:'Não foi possível salvar no Neon; o produto não foi publicado.'},{status:503});
 }
 return Response.json({id,ok:true,link:generated.shortLink,subIds:generated.subIds,message:'Produto salvo como inativo. Revise o link e ative a oferta.'});
}

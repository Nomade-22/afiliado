import {normalizeHeroSlides} from '../../../../lib/hero-slides';
import {isAdmin,forbidden} from '../../../../lib/auth';
import {getDB,getSettings} from '../../../../lib/db';
import {defaultSettings} from '../../../../lib/demo';
import {isShopeeLink} from '../../../../lib/shopee-links';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const maxLength={heroTitle:180,heroSubtitle:300,heroImage:1200,heroBadge:80,heroButtonLabel:55,heroButtonUrl:1200,heroProductId:150,heroSlides:18000,heroIntervalSeconds:2,flashSaleUrl:1000,couponUrl:1000,flashSaleLabel:65,couponLabel:65,telegram:650};
const trustedImage=value=>{
 if(!value)return true;
 try{
  const u=new URL(value);
  return u.protocol==='https:'&&!u.username&&!u.password;
 }catch{return false}
};
const trustedLink=value=>{
 if(!value||value==='#ofertas'||value==='#cupons')return true;
 try{
  const u=new URL(value);
  return u.protocol==='https:'&&!u.username&&!u.password;
 }catch{return false}
};

export async function GET(){
 if(!await isAdmin())return forbidden();
 let settings={};let sql=null;let databaseError=null;
 try{sql=await getDB();if(sql)settings=await getSettings(sql)}
 catch(e){databaseError=/password authentication failed|28P01/i.test(String(e?.message))?
  'Autenticação do Neon rejeitada. Verifique DATABASE_URL.':'Não foi possível consultar o Neon.'}
 return Response.json({
  settings:{...defaultSettings,...settings},
  shopeeConfigured:!!(process.env.SHOPEE_APP_ID?.trim()&&process.env.SHOPEE_APP_SECRET?.trim()),
  databaseConfigured:!!sql&&!databaseError,
  databaseError,adminConfigured:!!process.env.ADMIN_PASSWORD
 },{headers});
}

export async function POST(req){
 if(!await isAdmin())return forbidden();
 let sql;
 try{sql=await getDB()}catch{return Response.json({error:'Falha ao conectar ao Neon.'},{status:503,headers})}
 if(!sql)return Response.json({error:'Banco não configurado.'},{status:503,headers});
 const input=await req.json().catch(()=>({}));
 const updates={};
 for(const key of Object.keys(defaultSettings)){
  if(typeof input[key]!=='string')continue;
  updates[key]=input[key].trim().slice(0,maxLength[key]||300);
 }
 if(input.heroSlides&&typeof input.heroSlides==='string'&&input.heroSlides.length>18000){
  return Response.json({error:'O carrossel excede o limite de configuração.'},{status:413,headers});
 }
 if(updates.heroIntervalSeconds!==undefined){
  const n=Number(updates.heroIntervalSeconds);
  if(!Number.isInteger(n)||n<4||n>20)return Response.json({
   error:'Escolha um intervalo de 4 a 20 segundos.'
  },{status:400,headers});
 }
 if(updates.heroSlides!==undefined&&updates.heroSlides){
  let slides;
  try{slides=normalizeHeroSlides(JSON.parse(updates.heroSlides))}
  catch(e){return Response.json({error:String(e?.message||'Páginas inválidas').slice(0,170)},{status:400,headers})}
  for(const slide of slides){
   for(const photo of slide.images){
    if(photo&&!trustedImage(photo))return Response.json({
     error:'Todas as imagens do carrossel precisam ser URLs HTTPS válidas.'
    },{status:400,headers});
   }
   if(slide.buttonUrl&&!trustedLink(slide.buttonUrl)){
    return Response.json({error:'Destino inválido no botão de uma página do banner.'},{status:400,headers});
   }
   if(slide.type==='product'&&slide.enabled){
    if(!slide.productId)return Response.json({
     error:'Selecione um produto ativo na página de destaque.'
    },{status:400,headers});
    const found=await sql`SELECT id FROM vivi_offers WHERE id=${slide.productId} AND active=true LIMIT 1`;
    if(!found.length)return Response.json({
     error:'A página de destaque utiliza um produto indisponível.'
    },{status:400,headers});
   }
  }
  updates.heroSlides=JSON.stringify(slides);
 }
 if(updates.heroMode&&!['default','product','banner'].includes(updates.heroMode)){
  return Response.json({error:'Modo do banner inválido.'},{status:400,headers});
 }
 if(updates.heroTheme&&!['orange','pink','purple'].includes(updates.heroTheme)){
  return Response.json({error:'Cor do banner inválida.'},{status:400,headers});
 }
 if(updates.heroImage!==undefined&&!trustedImage(updates.heroImage)){
  return Response.json({error:'Imagem do banner deve ser uma URL HTTPS válida.'},{status:400,headers});
 }
 if(updates.heroButtonUrl!==undefined&&!trustedLink(updates.heroButtonUrl)){
  return Response.json({error:'Botão do banner deve apontar para HTTPS ou #ofertas.'},{status:400,headers});
 }
 for(const key of ['flashSaleUrl','couponUrl']){
  if(updates[key]!==undefined && updates[key] && !isShopeeLink(updates[key])){
   return Response.json({error:'A campanha '+key+' deve apontar para uma URL Shopee HTTPS válida.'},{status:400,headers});
  }
 }
 for(const key of ['campaignsEnabled','autoCampaigns']){
  if(updates[key]!==undefined&&!['on','off'].includes(updates[key])){
   return Response.json({error:'Opção de campanhas inválida.'},{status:400,headers});
  }
 }
 for(const key of ['whatsapp','instagram','tiktok','telegram']){
  if(updates[key]&&!trustedLink(updates[key])){
   return Response.json({error:'URL inválida em '+key+'.'},{status:400,headers});
  }
 }
 if(updates.telegram){
  try{
   const link=new URL(updates.telegram);
   const host=link.hostname.toLowerCase();
   if(link.protocol!=='https:'||link.username||link.password||
      !['t.me','telegram.me'].some(d=>host===d||host.endsWith('.'+d)))
    throw Error('invalid');
  }catch{
   return Response.json({error:'Informe um link HTTPS válido do Telegram, como https://t.me/seu_canal.'},{status:400,headers});
  }
 }
 if(updates.heroMode==='product'){
  const target=updates.heroProductId;
  if(!target)return Response.json({error:'Escolha um produto ativo para o destaque.'},{status:400,headers});
  const rows=await sql`SELECT id FROM vivi_offers WHERE id=${target} AND active=true LIMIT 1`;
  if(!rows.length)return Response.json({error:'O produto destacado precisa estar ativo no site.'},{status:400,headers});
 }
 if(updates.heroMode==='banner'&&!updates.heroImage){
  return Response.json({error:'Informe a URL HTTPS da imagem do banner.'},{status:400,headers});
 }
 for(const [key,value] of Object.entries(updates)){
  await sql`INSERT INTO vivi_settings(key,value) VALUES(${key},${value}) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value`;
 }
 return Response.json({ok:true,updated:Object.keys(updates)},{headers});
}

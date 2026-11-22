import {isAdmin,forbidden} from '../../../../../lib/auth';
import {getDB} from '../../../../../lib/db';
import {getShopeeProductMetadata} from '../../../../../lib/shopee-product';
import {isShopeeLink} from '../../../../../lib/shopee-links';
import {parseShopeeItemIds,canonicalShopeeItem,identifyShopeeLink} from '../../../../../lib/shopee-public-metadata';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
function safeImage(value){
 try{
  const u=new URL(String(value||''));
  return u.protocol==='https:'&&!u.username&&!u.password?u.toString():null;
 }catch{return null}
}
function existingImages(raw){
 try{
  const arr=JSON.parse(raw||'[]');
  return Array.isArray(arr)?arr:[];
 }catch{return []}
}
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

 const report={
  ok:true,processed:0,matched:0,identified:0,descriptionsAdded:0,
  newPhotos:0,mainPhotos:0,withoutExtraData:0,fromPublicPage:0,
  sourceBlocked:0,discountsFound:0,pricesUpdated:0,errors:[],updated:[]
 };
 for(const id of ids){
  report.processed++;
  let row;
  try{
   const found=await sql`SELECT * FROM vivi_offers WHERE id=${id} LIMIT 1`;
   row=found[0];
  }catch{
   report.errors.push({id,reason:'Falha na leitura do produto.'});continue
  }
  if(!row){report.errors.push({id,reason:'Produto não encontrado.'});continue}

  let preferredUrl=row.product_link;
  let overrideIds=null;
  if(override){
   const resolved=parseShopeeItemIds(override)?
    {ids:parseShopeeItemIds(override)}:
    await identifyShopeeLink(override);
   overrideIds=resolved.ids;
   if(!overrideIds){
    report.errors.push({id,reason:'O link informado não revelou o ID do produto. Abra o anúncio e copie o endereço completo com /product/ ou /opaanlp/.'});
    report.withoutExtraData++;
    continue;
   }
   if(row.item_id&&row.shop_id&&
      (String(row.item_id)!==overrideIds.itemId||String(row.shop_id)!==overrideIds.shopId)){
    report.errors.push({id,reason:'O link original informado aponta para IDs diferentes dos já cadastrados. Nenhuma informação foi alterada.'});
    report.withoutExtraData++;
    continue;
   }
   preferredUrl=canonicalShopeeItem(overrideIds);
  }
  let data;
  try{
   data=await getShopeeProductMetadata({
    ...row,product_link:preferredUrl,item_id:overrideIds?.itemId||row.item_id,
    shop_id:overrideIds?.shopId||row.shop_id
   });
  }catch{
   report.errors.push({id,reason:'A consulta dos dados adicionais falhou.'});
   report.withoutExtraData++;
   continue;
  }

  const fetchedIds=data?.ids||overrideIds;
  const identifiedNew=Boolean(fetchedIds?.itemId&&fetchedIds?.shopId&&
   (!row.item_id||!row.shop_id));
  if(fetchedIds?.itemId&&fetchedIds?.shopId){
   try{
    await sql`UPDATE vivi_offers
     SET item_id=COALESCE(item_id,${fetchedIds.itemId}),
      shop_id=COALESCE(shop_id,${fetchedIds.shopId}),
      product_link=${override&&overrideIds?canonicalShopeeItem(overrideIds):row.product_link},
      updated_at=NOW()
     WHERE id=${id}`;
    if(identifiedNew)report.identified++;
   }catch{
    report.errors.push({id,reason:'Não foi possível salvar o identificador do anúncio.'});
   }
  }
  if(!data?.matched){
   report.withoutExtraData++;
   if(/RESTRICTED|NETWORK_ERROR/.test(String(data?.reason||'')))report.sourceBlocked++;
   report.errors.push({id,reason:String(data?.warning||
    'Nem a API de Afiliados nem os metadados públicos trouxeram detalhes verificáveis.').slice(0,210)});
   continue;
  }

  report.matched++;
  if(data.sourcePublicPage)report.fromPublicPage++;
  const affiliateMatched=Boolean(data.sourceAffiliate);
  const apiPrice=affiliateMatched&&Number.isFinite(Number(data.priceMin))&&Number(data.priceMin)>0?
   Number(data.priceMin):null;
  const apiMax=affiliateMatched&&Number.isFinite(Number(data.priceMax))&&Number(data.priceMax)>0?
   Number(data.priceMax):null;
  const apiDiscount=affiliateMatched&&Number.isFinite(Number(data.discountRate))&&
    Number(data.discountRate)>=0&&Number(data.discountRate)<=95?
    Number(data.discountRate):null;
  const hasSale=apiDiscount!==null&&apiDiscount>=1;
  if(hasSale)report.discountsFound++;
  if(apiPrice!==null)report.pricesUpdated++;
  const oldDescription=String(row.product_description||'').trim();
  const description=oldDescription||String(data.description||'').trim().slice(0,6000)||null;
  const hasAddedDescription=!oldDescription&&Boolean(description);
  const before=[...new Set(existingImages(row.product_images).map(safeImage).filter(Boolean))];
  const gallery=[...new Set([...before,...(data.images||[]),data.image,row.image]
   .map(safeImage).filter(Boolean))].slice(0,12);
  const newPhotos=gallery.filter(x=>!before.includes(x));
  const image=safeImage(row.image)||safeImage(data.image)||gallery[0]||null;
  try{
   await sql`UPDATE vivi_offers SET
    image=${image},product_description=${description},
    product_images=${JSON.stringify(gallery)},
    shop_name=COALESCE(shop_name,${data.shopName||null}),
    price=COALESCE(${apiPrice},price),
    price_max=COALESCE(${apiMax},price_max),
    price_discount_rate=CASE WHEN ${affiliateMatched} THEN ${apiDiscount} ELSE price_discount_rate END,
    discount_checked_at=CASE WHEN ${affiliateMatched} THEN NOW() ELSE discount_checked_at END,
    sales=COALESCE(${data.sales??null},sales),
    rating_star=COALESCE(${data.ratingStar??null},rating_star),
    stock_quantity=COALESCE(${data.stockSource?data.stockQuantity:null},stock_quantity),
    updated_from_api_at=NOW(),updated_at=NOW()
    WHERE id=${id}`;
   if(hasAddedDescription)report.descriptionsAdded++;
   report.newPhotos+=newPhotos.length;
   if(!row.image&&image)report.mainPhotos++;
   report.updated.push({
    id,image,description,images:gallery,
    ids:fetchedIds||null,
    sourcePublicPage:Boolean(data.sourcePublicPage),
    saleDiscount:hasSale?apiDiscount:null,priceFromShopee:apiPrice,
    fromApi:{description:Boolean(data.description),photoCount:gallery.length,
     stock:Boolean(data.stockSource)}
   });
  }catch{
   report.errors.push({id,reason:'Falha ao gravar informações adicionais no Neon.'});
  }
 }
 return Response.json(report,{headers});
}

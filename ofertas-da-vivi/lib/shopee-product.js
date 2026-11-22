import {shopeeQuery,hasShopeeCredentials} from './shopee';
import {isShopeeLink} from './shopee-links';

// Descobre somente campos realmente expostos na conta do afiliado.
// A API de Afiliados normalmente NÃO expõe estoque ou descrição completa.
const optionalFields=[
 'itemId','shopId','productName','productLink','imageUrl','priceMin','priceMax',
 'priceDiscountRate','sales','ratingStar','shopName','shopType',
 'commissionRate','sellerCommissionRate','shopeeCommissionRate','commission',
 'periodStartTime','periodEndTime','productCatIds',
 'description','productDescription','stock','stockQuantity','availableStock',
 'images','imageUrls','galleryImages','productImages','brandName','brand'
];
let schemaCache=null;
const nameOf=t=>t?.name||t?.ofType?.name||t?.ofType?.ofType?.name||t?.ofType?.ofType?.ofType?.name||null;
const numeric=x=>x===null||x===undefined||x===''?null:Number.isFinite(Number(x))?Number(x):null;
const str=x=>x===null||x===undefined?null:String(x);

function getIdsFromUrl(raw){
 try{
  const u=new URL(String(raw||''));
  const path=decodeURIComponent(u.pathname);
  const m=path.match(/\/product\/(\d+)\/(\d+)/i)||path.match(/-i\.(\d+)\.(\d+)/i);
  if(m)return {shopId:m[1],itemId:m[2]};
  const shopId=u.searchParams.get('shopid'), itemId=u.searchParams.get('itemid');
  if(shopId&&itemId&&/^\d+$/.test(shopId)&&/^\d+$/.test(itemId))return {shopId,itemId};
 }catch{}
 return null;
}
async function resolveProductIds(offer){
 const known=(offer.item_id||offer.itemId) && (offer.shop_id||offer.shopId);
 if(known)return {itemId:String(offer.item_id||offer.itemId),shopId:String(offer.shop_id||offer.shopId)};
 for(const source of [offer.product_link||offer.productLink,offer.url]){
  const parsed=getIdsFromUrl(source);
  if(parsed)return parsed;
 }
 let url=String(offer.product_link||offer.url||'');
 for(let i=0;i<4&&isShopeeLink(url);i++){
  try{
   const response=await fetch(url,{
    method:'GET',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(3500),
    headers:{'User-Agent':'Mozilla/5.0'}
   });
   if(![301,302,303,307,308].includes(response.status))break;
   const loc=response.headers.get('location');
   if(!loc)break;
   const next=new URL(loc,url).toString();
   // Nunca segue redirecionamentos para domínios de terceiros.
   if(!isShopeeLink(next))break;
   const parsed=getIdsFromUrl(next);
   if(parsed)return parsed;
   url=next;
  }catch{break}
 }
 return null;
}

async function getSchema(){
 if(schemaCache&&Date.now()-schemaCache.at<21600000)return schemaCache.value;
 const query=`{ __schema {
  queryType { fields { name args { name type { kind name ofType { kind name ofType { kind name } } } } type { kind name ofType { kind name ofType { kind name } } } } }
  types { name fields { name type { kind name ofType {kind name ofType {kind name}} } } }
 } }`;
 const data=await shopeeQuery(query);
 const allTypes=data?.__schema?.types||[];
 const root=(data?.__schema?.queryType?.fields||[]).find(x=>x.name==='productOfferV2');
 if(!root)throw Error('A conta Shopee não expõe productOfferV2.');
 const connectionName=nameOf(root.type);
 const connection=allTypes.find(x=>x.name===connectionName);
 const nodes=connection?.fields?.find(x=>x.name==='nodes');
 const nodeName=nameOf(nodes?.type);
 const node=allTypes.find(x=>x.name===nodeName);
 const fields=new Set((node?.fields||[]).map(f=>f.name));
 const scalarTypes=new Set(['String','Int','Float','Boolean','ID','Long','BigInt','Decimal','DateTime']);
 // Evita consultar objetos complexos que exigiriam seleção adicional.
 const allowed=optionalFields.filter(f=>{
  const definition=node?.fields?.find(item=>item.name===f);
  return definition&&scalarTypes.has(nameOf(definition.type));
 });
 const args=new Map((root.args||[]).map(x=>[x.name,nameOf(x.type)]));
 const value={fields:allowed,args:[...args]};
 schemaCache={at:Date.now(),value};
 return value;
}
function queryArg(name,value,type){
 if(type==='Int'){
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<0||n>2147483647)return null;
  return name+':'+n;
 }
 if(['String','ID','Long','BigInt'].includes(type))return name+':'+JSON.stringify(String(value));
 return null;
}
export async function getShopeeProductMetadata(offer){
 const base={apiAvailable:false,matched:false,stockSource:false,descriptionSource:false,
  imagesSource:false,warning:null};
 if(!hasShopeeCredentials())return {...base,warning:'API de Afiliados não configurada.'};
 const ids=await resolveProductIds(offer);
 try{
  const schema=await getSchema();
  if(!schema.fields.includes('itemId')||!schema.fields.includes('shopId')){
   return {...base,warning:'Não foi possível confirmar os IDs do produto na API de Afiliados.'};
  }
  const args=new Map(schema.args);
  const selection=schema.fields.join(' ');
  const idFilter=ids&&args.has('itemId')?queryArg('itemId',ids.itemId,args.get('itemId')):null;
  const query=idFilter?
   `{ productOfferV2(${idFilter},page:1,limit:20){nodes{${selection}}} }`:
   `{ productOfferV2(keyword:${JSON.stringify(String(offer.title||'').slice(0,75))},page:1,limit:40){nodes{${selection}}} }`;
  const data=await shopeeQuery(query);
  const list=data?.productOfferV2?.nodes||[];
  // Se o encurtador não revelou IDs, só aceita correspondência forte:
  // mesma imagem de anúncio e título semelhante, sem escolher itens aleatórios.
  const imgTail=value=>{try{return new URL(value).pathname.split('/').pop()||''}catch{return ''}};
  const normalize=value=>String(value||'').normalize('NFKD').toLowerCase()
    .replace(/[^a-z0-9]+/g,' ').trim().split(' ').filter(Boolean).join(' ');
  const normalizedTitle=normalize(offer.title);
  const match=list.find(x=>{
    if(ids)return String(x.itemId)===ids.itemId&&String(x.shopId)===ids.shopId;
    const sameImage=imgTail(x.imageUrl)!==''&&imgTail(x.imageUrl)===imgTail(offer.image);
    const name=normalize(x.productName);
    return sameImage&&name.length>15&&normalizedTitle.length>15&&
      (name===normalizedTitle||name.startsWith(normalizedTitle.slice(0,35))||
       normalizedTitle.startsWith(name.slice(0,35)));
  });
  if(!match)return {...base,apiAvailable:true,warning:'Produto não localizado no catálogo de ofertas de afiliados no momento.'};
  const firstImage=str(match.imageUrl);
  const imageCandidates=[...(Array.isArray(match.imageUrls)?match.imageUrls:[]),
   ...(Array.isArray(match.images)?match.images:[]),
   ...(Array.isArray(match.productImages)?match.productImages:[]),
   ...(Array.isArray(match.galleryImages)?match.galleryImages:[]),firstImage,offer.image];
  const images=[...new Set(imageCandidates.filter(v=>{
   try{return new URL(v).protocol==='https:'}catch{return false}
  }))].slice(0,12);
  const rawStock=match.stockQuantity??match.availableStock??match.stock??null;
  const description=String(match.productDescription||match.description||'').trim()||null;
  return {
   apiAvailable:true,matched:true,ids:ids||{shopId:String(match.shopId),itemId:String(match.itemId)},
   title:match.productName||null,shopName:match.shopName||null,
   priceMin:numeric(match.priceMin),priceMax:numeric(match.priceMax),
   discountRate:numeric(match.priceDiscountRate),
   sales:numeric(match.sales),ratingStar:numeric(match.ratingStar),
   image:firstImage,images,
   stockQuantity:numeric(rawStock),description,
   stockSource:rawStock!==null,descriptionSource:!!description,
   imagesSource:images.length>1,
   periodStartTime:numeric(match.periodStartTime),
   periodEndTime:numeric(match.periodEndTime),
   warning:null,updatedAt:new Date().toISOString()
  };
 }catch(error){
  return {...base,ids,warning:'A consulta complementar da Shopee não está disponível: '+String(error?.message||'Erro').slice(0,125)};
 }
}

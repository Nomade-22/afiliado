import {shopeeQuery,hasShopeeCredentials,normalizeShopType} from './shopee';
import {parseShopeeItemIds,identifyShopeeLink,getPublicShopeeItemMetadata} from './shopee-public-metadata';

// productOfferV2 é uma API de afiliados. Descrição completa, galeria e estoque
// não devem ser presumidos: consultamos o schema e os dados disponíveis.
const wantedFields=[
 'itemId','shopId','productName','productLink','imageUrl','priceMin','priceMax',
 'priceDiscountRate','sales','ratingStar','shopName','shopType','commissionRate',
 'sellerCommissionRate','shopeeCommissionRate','commission',
 'periodStartTime','periodEndTime','description','productDescription',
 'images','imageUrls','productImages','galleryImages','stock','stockQuantity',
 'availableStock','brand','brandName'
];
const fallbackFields=['itemId','shopId','productName','imageUrl',
 'priceMin','priceMax','priceDiscountRate','sales','ratingStar','shopName'];
let schemaCache;
function typename(type){
 for(let i=0;i<6&&type;i++,type=type.ofType)if(type.name)return type.name;
 return null;
}
function fieldIsScalar(type){
 let current=type;
 for(let i=0;i<6&&current;i++,current=current.ofType){
  if(current.kind==='OBJECT'||current.kind==='INPUT_OBJECT')return false;
  if(current.kind==='SCALAR'||current.kind==='ENUM')return true;
 }
 return false;
}
function numberOrNull(value){
 if(value===null||value===undefined||value==='')return null;
 const n=Number(value);return Number.isFinite(n)?n:null;
}
function normalized(value){
 return String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}
function imageFingerprint(url){
 try{
  const u=new URL(String(url||''));
  return u.pathname.split('/').pop()||'';
 }catch{return ''}
}
function strongMatch(node,offer,ids){
 if(ids)return String(node.itemId)===String(ids.itemId)&&String(node.shopId)===String(ids.shopId);
 const fingerprint=imageFingerprint(offer.image);
 if(!fingerprint||fingerprint!==imageFingerprint(node.imageUrl))return false;
 const expected=normalized(offer.title),received=normalized(node.productName);
 if(!expected||!received)return false;
 const words=expected.split(' ').filter(t=>t.length>3).slice(0,8);
 const actual=new Set(received.split(' '));
 return words.length>=2&&words.filter(t=>actual.has(t)).length>=Math.min(3,words.length);
}
async function getOfferFields(){
 if(schemaCache&&Date.now()-schemaCache.at<3600000)return schemaCache.fields;
 const query=`{ __type(name:"ProductOfferV2"){
  fields {name type{kind name ofType{kind name ofType{kind name ofType{kind name}}}}}}
 } `;
 try{
  const data=await shopeeQuery(query);
  const supported=new Map((data?.__type?.fields||[]).map(f=>[f.name,f]));
  const fields=wantedFields.filter(name=>supported.has(name)&&fieldIsScalar(supported.get(name).type));
  if(fields.includes('itemId')&&fields.includes('shopId')){
   schemaCache={at:Date.now(),fields};
   return fields;
  }
 }catch{}
 schemaCache={at:Date.now(),fields:fallbackFields};
 return fallbackFields;
}
function cleanImages(values){
 const all=values.flatMap(v=>Array.isArray(v)?v:[v]);
 const valid=all.map(v=>v&&typeof v==='object'?v.url||v.contentUrl:v).filter(x=>{
  try{const u=new URL(String(x||''));return u.protocol==='https:'&&!u.username&&!u.password}catch{return false}
 });
 return [...new Set(valid)].slice(0,12);
}
function shortKeywords(title){
 const words=String(title||'').trim().split(/\s+/).filter(Boolean);
 return [...new Set([words.slice(0,7).join(' ').slice(0,75),
  words.slice(0,4).join(' ').slice(0,55)].filter(Boolean))];
}
async function findExactAffiliateOffer(offer,ids){
 if(!hasShopeeCredentials())return {matched:false,reason:'AFFILIATE_CREDENTIALS_MISSING'};
 const fields=await getOfferFields();
 const selection=fields.join(' ');
 const terms=shortKeywords(offer.title);
 for(const term of terms){
  try{
   const query=`{productOfferV2(keyword:${JSON.stringify(term)},page:1,limit:50){nodes{${selection}}}}`;
   const data=await shopeeQuery(query);
   const matched=(data?.productOfferV2?.nodes||[]).find(n=>strongMatch(n,offer,ids));
   if(matched)return {matched:true,item:matched};
  }catch(error){
   return {matched:false,reason:'AFFILIATE_QUERY_UNAVAILABLE',
    warning:'A consulta de ofertas Shopee falhou: '+String(error?.message||'Erro').slice(0,95)};
  }
 }
 return {matched:false,reason:ids?'PRODUCT_NOT_IN_AFFILIATE_RESULTS':'AFFILIATE_ITEM_NOT_IDENTIFIED'};
}
function identifyWarning(reason){
 const messages={
  INVALID_SHOPEE_URL:'O endereço salvo não é uma URL Shopee válida.',
  SHOPEE_ACCESS_RESTRICTED:'A Shopee restringiu a resolução automática do link curto.',
  SHORT_LINK_NOT_RESOLVED:'O link curto não revelou o ID da loja e do produto.',
  REDIRECT_OUTSIDE_SHOPEE:'O link direciona para fora da Shopee.',
  SHORT_LINK_NETWORK_ERROR:'Não foi possível seguir o redirecionamento da Shopee.',
  TOO_MANY_REDIRECTS:'O link possui redirecionamentos demais.',
  PUBLIC_PRODUCT_METADATA_NOT_AVAILABLE:'A página pública não trouxe descrição ou galeria identificáveis.',
  PRODUCT_PAGE_ACCESS_RESTRICTED:'A Shopee bloqueou a leitura dos metadados públicos.',
  PRODUCT_PAGE_NETWORK_ERROR:'A página pública não respondeu à consulta.',
  PRODUCT_TITLE_MISMATCH:'A página retornou outro título; dados ignorados para evitar troca de produtos.',
  PRODUCT_NOT_IN_AFFILIATE_RESULTS:'O item não apareceu nos resultados de afiliados pesquisados.',
  AFFILIATE_ITEM_NOT_IDENTIFIED:'A oferta não pôde ser identificada com segurança nos resultados da API.'
 };
 return messages[reason]||null;
}
export async function getShopeeProductMetadata(offer){
 const knownId=offer.item_id||offer.itemId;
 const knownShop=offer.shop_id||offer.shopId;
 let ids=knownId&&knownShop?{itemId:String(knownId),shopId:String(knownShop)}:null;
 let identified={reason:ids?'SAVED_PRODUCT_IDS':'UNRESOLVED'};
 if(!ids){
  for(const raw of [offer.product_link||offer.productLink,offer.url]){
   if(!raw)continue;
   const direct=parseShopeeItemIds(raw);
   if(direct){ids=direct;identified={reason:'RESOLVED_FROM_PRODUCT_LINK'};break}
   identified=await identifyShopeeLink(raw);
   if(identified.ids){ids=identified.ids;break}
  }
 }
 const affiliate=await findExactAffiliateOffer(offer,ids);
 const a=affiliate.matched?affiliate.item:null;
 if(!ids&&a?.itemId&&a?.shopId)ids={itemId:String(a.itemId),shopId:String(a.shopId)};
 const publicData=ids?await getPublicShopeeItemMetadata(ids,offer.title):null;
 const matched=Boolean(a||publicData?.matched);
 if(!matched){
  const reason=publicData?.reason||affiliate.reason||identified.reason||'PRODUCT_DETAILS_UNAVAILABLE';
  return {apiAvailable:hasShopeeCredentials(),matched:false,ids,reason,
   identificationReason:identified.reason,
   warning:[identifyWarning(identified.reason),identifyWarning(reason),affiliate.warning]
    .filter(Boolean).join(' ')||'A fonte não disponibilizou detalhes verificáveis.',
   descriptionSource:null,imagesSource:false,stockSource:false};
 }
 const image=publicData?.image||a?.imageUrl||offer.image||null;
 const images=cleanImages([publicData?.images,a?.images,a?.imageUrls,a?.galleryImages,
  a?.productImages,a?.imageUrl,offer.image]);
 const description=String(publicData?.description||a?.productDescription||a?.description||'').trim()||null;
 const stock=a?.stockQuantity??a?.availableStock??a?.stock??null;
 return {
  apiAvailable:hasShopeeCredentials(),
  matched:true,
  ids,reason:null,
  identificationReason:identified.reason,
  sourcePublicPage:Boolean(publicData?.matched),
  sourceAffiliate:Boolean(a),
  title:a?.productName||offer.title,
  shopName:a?.shopName||null,
  shopType:normalizeShopType(a?.shopType),
  priceMin:numberOrNull(a?.priceMin),
  priceMax:numberOrNull(a?.priceMax),
  discountRate:numberOrNull(a?.priceDiscountRate),
  sales:numberOrNull(a?.sales),
  ratingStar:numberOrNull(a?.ratingStar),
  image,images,description,
  stockQuantity:numberOrNull(stock),stockSource:stock!==null,
  descriptionSource:description?(publicData?.description?'public_html_metadata':'affiliate_api'):null,
  imagesSource:images.length>1,
  warning:images.length<=1&&!description?
   'A fonte acessível oferece apenas a foto principal, sem descrição detalhada.':
   null,
  updatedAt:new Date().toISOString()
 };
}

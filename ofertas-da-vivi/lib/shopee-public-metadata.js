import {isShopeeLink} from './shopee-links';

export function parseShopeeItemIds(input){
 try{
  const u=new URL(String(input||''));
  if(!isShopeeLink(u.toString()))return null;
  const path=decodeURIComponent(u.pathname);
  const m=path.match(/\/product\/(\d+)\/(\d+)/i)||
   path.match(/\/opaanlp\/(\d+)\/(\d+)/i)||
   path.match(/-i\.(\d+)\.(\d+)/i);
  const shopId=m?.[1]||u.searchParams.get('shopid')||u.searchParams.get('shopId');
  const itemId=m?.[2]||u.searchParams.get('itemid')||u.searchParams.get('itemId');
  if(!/^\d{1,24}$/.test(String(shopId||''))||!/^\d{1,24}$/.test(String(itemId||'')))return null;
  return {shopId:String(shopId),itemId:String(itemId)};
 }catch{return null}
}
export function canonicalShopeeItem(ids){
 if(!ids?.itemId||!ids?.shopId)return null;
 return 'https://shopee.com.br/product/'+ids.shopId+'/'+ids.itemId;
}
/**
 * Segue apenas redirecionamentos públicos HTTPS da Shopee; nunca consulta
 * endpoints internos, usa cookies, ou tenta contornar proteções.
 */
export async function identifyShopeeLink(input){
 let url=String(input||'').trim();
 if(!isShopeeLink(url))return {ids:null,reason:'INVALID_SHOPEE_URL'};
 for(let i=0;i<5;i++){
  const ids=parseShopeeItemIds(url);
  if(ids)return {ids,canonicalUrl:canonicalShopeeItem(ids),reason:'RESOLVED',redirectCount:i};
  try{
   const response=await fetch(url,{
    method:'GET',redirect:'manual',cache:'no-store',
    signal:AbortSignal.timeout(4500),
    headers:{'Accept':'text/html,application/xhtml+xml'}
   });
   if(![301,302,303,307,308].includes(response.status)){
    return {ids:null,reason:response.status===403||response.status===429?
     'SHOPEE_ACCESS_RESTRICTED':'SHORT_LINK_NOT_RESOLVED',httpStatus:response.status};
   }
   const location=response.headers.get('location');
   if(!location)return {ids:null,reason:'REDIRECT_WITHOUT_LOCATION'};
   const next=new URL(location,url).toString();
   if(!isShopeeLink(next))return {ids:null,reason:'REDIRECT_OUTSIDE_SHOPEE'};
   url=next;
  }catch{return {ids:null,reason:'SHORT_LINK_NETWORK_ERROR'}}
 }
 return {ids:null,reason:'TOO_MANY_REDIRECTS'};
}
function decodeHtmlText(value){
 return String(value||'').replace(/&(#(?:x[0-9a-f]+|[0-9]+)|amp|quot|apos|lt|gt|nbsp);/gi,(m,x)=>{
  const map={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '};
  const v=x.toLowerCase();
  if(map[v])return map[v];
  if(v[0]==='#'){
   const hex=v.startsWith('#x');
   const code=Number.parseInt(v.slice(hex?2:1),hex?16:10);
   return code>0&&code<0x110000?String.fromCodePoint(code):m;
  }
  return m;
 });
}
function textContent(value,max=6000){
 return decodeHtmlText(value).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
}
function validImage(value){
 try{
  const url=new URL(String(value||''));
  if(url.protocol==='https:'&&!url.username&&!url.password)return url.toString();
 }catch{}
 return null;
}
function walkProduct(root){
 if(!root||typeof root!=='object')return null;
 if(Array.isArray(root)){for(const item of root){const found=walkProduct(item);if(found)return found}return null}
 const type=root['@type'];
 const types=Array.isArray(type)?type:[type];
 if(types.some(t=>String(t||'').toLowerCase()==='product'))return root;
 if(root['@graph'])return walkProduct(root['@graph']);
 return null;
}
function getMeta(content,key){
 const tags=content.match(/<meta\b[^>]{0,1500}>/gi)||[];
 for(const tag of tags){
  const attrs={};
  const pattern=/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  for(const m of tag.matchAll(pattern))attrs[m[1].toLowerCase()]=m[2]??m[3]??m[4];
  if((attrs.property||attrs.name||'').toLowerCase()===key)return decodeHtmlText(attrs.content||'');
 }
 return '';
}
function titleMatches(expected,actual){
 const norm=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const x=norm(expected),y=norm(actual);
 if(!x||!y||y.includes('verificacao de seguranca')||y.includes('captcha'))return false;
 const tokens=x.split(' ').filter(t=>t.length>=4).slice(0,9);
 if(tokens.length===0)return false;
 const overlap=tokens.filter(t=>y.split(' ').includes(t)).length;
 return overlap>=Math.min(2,tokens.length);
}
/**
 * Lê somente metadados públicos padrão (JSON-LD / Open Graph) do HTML
 * retornado pela própria página de anúncio, quando acessível.
 * Não chama APIs privadas de loja/vendedor e não garante galeria/descrição.
 */
export async function getPublicShopeeItemMetadata(ids,expectedTitle){
 const url=canonicalShopeeItem(ids);
 if(!url)return {matched:false,reason:'PRODUCT_IDS_MISSING'};
 let response;
 try{
  response=await fetch(url,{method:'GET',cache:'no-store',redirect:'manual',
   signal:AbortSignal.timeout(6500),
   headers:{'Accept':'text/html,application/xhtml+xml','Accept-Language':'pt-BR,pt;q=0.9'}
  });
 }catch{return {matched:false,reason:'PRODUCT_PAGE_NETWORK_ERROR'}}
 if(!response.ok){
  return {matched:false,reason:response.status===403||response.status===429?
   'PRODUCT_PAGE_ACCESS_RESTRICTED':'PRODUCT_PAGE_UNAVAILABLE',httpStatus:response.status};
 }
 if(!String(response.headers.get('content-type')||'').toLowerCase().includes('text/html')){
  return {matched:false,reason:'PRODUCT_PAGE_NOT_HTML'};
 }
 const declaredSize=Number(response.headers.get('content-length')||0);
 if(declaredSize>2400000)return {matched:false,reason:'PRODUCT_PAGE_TOO_LARGE'};
 const html=(await response.text()).slice(0,2400000);
 let product=null;
 for(const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  try{product=walkProduct(JSON.parse(match[1]));if(product)break}catch{}
 }
 const rawTitle=String(product?.name||getMeta(html,'og:title')||'').trim();
 // A identidade tem de estar sustentada pela página e também pelo título
 // para impedir que uma página genérica ou de login seja usada como anúncio.
 if(!titleMatches(expectedTitle,rawTitle))return {
  matched:false,reason:product?'PRODUCT_TITLE_MISMATCH':'PUBLIC_PRODUCT_METADATA_NOT_AVAILABLE'
 };
 const publicDescription=product?.description||getMeta(html,'og:description');
 const descriptionCandidate=textContent(publicDescription);
 // Muitos anúncios têm metadados genéricos de marketing, não a descrição do
 // produto. Não usamos slogans genéricos como ficha técnica.
 const description=/^(compre online|encontre (os )?melhores|compre na shopee|descubra ofertas)/i
  .test(descriptionCandidate)?'':descriptionCandidate;
 const description=description.length>=25?description:'';
 const inputs=[...(Array.isArray(product?.image)?product.image:[product?.image]),
  getMeta(html,'og:image')];
 const images=[...new Set(inputs.map(v=>typeof v==='object'?v?.url||v?.contentUrl:v)
  .map(validImage).filter(Boolean))].slice(0,12);
 if(!description&&!images.length)return {matched:false,reason:'PUBLIC_PRODUCT_METADATA_NOT_AVAILABLE'};
 return {matched:true,source:'public_html_metadata',description:description||null,images,
  image:images[0]||null,ids,checkedAt:new Date().toISOString()};
}

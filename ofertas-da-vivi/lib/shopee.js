import {createHash} from 'node:crypto';

const ENDPOINT='https://open-api.affiliate.shopee.com.br/graphql';
export function hasShopeeCredentials(){
 return Boolean(process.env.SHOPEE_APP_ID?.trim() && process.env.SHOPEE_APP_SECRET?.trim());
}
const intInRange=(v,min,max,fallback)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Math.trunc(Number(v)))):fallback;
const validAffiliateUrl=(value)=>{
 try {
  const url=new URL(value);
  return url.protocol==='https:' && ['shopee.com.br','shopee.com','shopee.ee','s.shopee.com.br'].some(domain=>url.hostname===domain||url.hostname.endsWith('.'+domain));
 }catch{return false;}
};
const finite=(value)=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))?Number(value):null;

export async function shopeeQuery(query){
 if(!hasShopeeCredentials())throw Error('Credenciais da API Shopee não configuradas no servidor.');
 const appId=process.env.SHOPEE_APP_ID.trim();
 const secret=process.env.SHOPEE_APP_SECRET.trim();
 const body=JSON.stringify({query});
 const ts=Math.floor(Date.now()/1000);
 const sig=createHash('sha256').update(appId+ts+body+secret).digest('hex');
 const resp=await fetch(ENDPOINT,{
  method:'POST',headers:{
   'Content-Type':'application/json',
   'Authorization':`SHA256 Credential=${appId}, Timestamp=${ts}, Signature=${sig}`
  },
  body,cache:'no-store',signal:AbortSignal.timeout(16000)
 });
 if(!resp.ok)throw Error(`API Shopee retornou HTTP ${resp.status}`);
 const result=await resp.json();
 if(result.errors?.length)throw Error(String(result.errors[0]?.message||'Erro GraphQL da Shopee').slice(0,250));
 return result.data;
}

export async function searchShopeePage(keyword='',limit=24,page=1){
 const text=JSON.stringify(String(keyword||'').trim().slice(0,80));
 const size=intInRange(limit,1,40,24);
 const number=intInRange(page,1,100,1);
 const query=`{ productOfferV2(keyword:${text},page:${number},limit:${size}) { nodes {itemId shopId productName imageUrl priceMin priceMax priceDiscountRate offerLink productLink commissionRate shopName sales ratingStar} pageInfo{hasNextPage} } }`;
 const data=await shopeeQuery(query);
 const nodes=data?.productOfferV2?.nodes||[];
 const offers=nodes.map(n=>({
  id:`shopee-${String(n.shopId)}-${String(n.itemId)}`,
  itemId:String(n.itemId??''),
  shopId:String(n.shopId??''),
  title:String(n.productName??'').slice(0,220),
  category:'Outros',
  price:finite(n.priceMin),
  priceMax:finite(n.priceMax),
  oldPrice:null,
  priceDiscountRate:finite(n.priceDiscountRate),
  image:String(n.imageUrl??''),
  url:String(n.offerLink??''),
  productLink:String(n.productLink??''),
  shopName:String(n.shopName??'').slice(0,160),
  commissionRate:finite(n.commissionRate),
  sales:finite(n.sales),
  ratingStar:finite(n.ratingStar),
  featured:false,
  active:false,
  origin:'shopee'
 })).filter(o=>o.itemId&&o.shopId&&o.title&&o.price>0&&validAffiliateUrl(o.url));
 return {
  offers,
  page:number,
  limit:size,
  hasNextPage:Boolean(data?.productOfferV2?.pageInfo?.hasNextPage),
  receivedCount:nodes.length,
  validCount:offers.length
 };
}
export async function searchShopee(keyword='',limit=24){
 return (await searchShopeePage(keyword,limit,1)).offers;
}

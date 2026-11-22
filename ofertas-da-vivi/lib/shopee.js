import {inferCategory} from './categories';
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

// A classificação vem exclusivamente do shopType retornado pela API.
// Nome, imagem ou título da loja nunca são usados para inventar selo oficial.
export function normalizeShopType(raw){
 const values=Array.isArray(raw)?raw:[raw];
 const codes=values.map(x=>String(x??'').trim().toUpperCase());
 if(codes.some(v=>['1','OFFICIAL_SHOP','SHOPEE_MALL_CB','SHOPEE_MALL_NON_CB','SHOPEE_MALL','MALL'].includes(v)))return 'MALL';
 if(codes.some(v=>['4','PREFERRED_PLUS_SHOP','STAR_PLUS','STAR+'].includes(v)))return 'STAR_PLUS';
 if(codes.some(v=>['2','PREFERRED_SHOP','STAR'].includes(v)))return 'STAR';
 return null;
}
export function percentFromRate(rate){
 const number=finite(rate);
 return number===null||number<0?null:(number<=1?number*100:number);
}
const limitedInteger=(value,options,fallback)=>options.includes(Number(value))?Number(value):fallback;
const FIELD_SETS=[
 'itemId shopId productName imageUrl priceMin priceMax priceDiscountRate offerLink productLink commissionRate shopName sales ratingStar sellerCommissionRate shopeeCommissionRate commission shopType productCatIds periodStartTime periodEndTime',
 'itemId shopId productName imageUrl priceMin priceMax priceDiscountRate offerLink productLink commissionRate shopName sales ratingStar sellerCommissionRate shopeeCommissionRate commission shopType',
 'itemId shopId productName imageUrl priceMin priceMax priceDiscountRate offerLink productLink commissionRate shopName sales ratingStar sellerCommissionRate shopeeCommissionRate shopType',
 'itemId shopId productName imageUrl priceMin priceMax priceDiscountRate offerLink productLink commissionRate shopName sales ratingStar sellerCommissionRate shopeeCommissionRate commission',
 'itemId shopId productName imageUrl priceMin priceMax priceDiscountRate offerLink productLink commissionRate shopName sales ratingStar shopType',
 'itemId shopId productName imageUrl priceMin priceMax priceDiscountRate offerLink productLink commissionRate shopName sales ratingStar'
];
const unsupportedField=e=>/cannot query field|unknown field|does not exist|field .*not found|cannot select|undefined field/i.test(String(e?.message||''));
export async function searchShopeePage(keyword='',limit=24,page=1,options={}){
 const searchText=String(keyword||'').trim().slice(0,80);
 const size=intInRange(limit,1,40,24);
 const number=intInRange(page,1,100,1);
 const sortType=limitedInteger(options?.sortType,[1,2,3,4,5],1);
 const listType=limitedInteger(options?.listType,[0,1,2],0);
 const args=[...(searchText?[`keyword:${JSON.stringify(searchText)}`]:[]),
  `page:${number}`,`limit:${size}`];
 if(options?.sortType!==undefined)args.push(`sortType:${sortType}`);
 if(options?.listType!==undefined)args.push(`listType:${listType}`);
 if(options?.isAMSOffer===true)args.push('isAMSOffer:true');
 if(options?.isKeySeller===true)args.push('isKeySeller:true');
 let data=null;
 let fieldsUsed='';
 // Fallback para contas com versões diferentes do schema. Não significa que
 // um campo inexistente virou dado: ele segue como null e sem selo na vitrine.
 for(const fields of FIELD_SETS){
  try{
   const query=`{ productOfferV2(${args.join(',')}) { nodes {${fields}} pageInfo{hasNextPage} } }`;
   data=await shopeeQuery(query);
   fieldsUsed=fields;
   break;
  }catch(error){
   if(!unsupportedField(error)||fields===FIELD_SETS[FIELD_SETS.length-1])throw error;
  }
 }
 const nodes=data?.productOfferV2?.nodes||[];
 const offers=nodes.map(n=>({
  id:`shopee-${String(n.shopId)}-${String(n.itemId)}`,
  itemId:String(n.itemId??''),
  shopId:String(n.shopId??''),
  title:String(n.productName??'').slice(0,220),
  category:inferCategory(n.productName),
  categorySource:'inferida_pelo_titulo',
  productCatIds:Array.isArray(n.productCatIds)?n.productCatIds.map(String).slice(0,8):[],
  price:finite(n.priceMin),
  priceMax:finite(n.priceMax),
  oldPrice:null,
  priceDiscountRate:finite(n.priceDiscountRate),
  image:String(n.imageUrl??''),
  url:String(n.offerLink??''),
  productLink:String(n.productLink??''),
  shopName:String(n.shopName??'').slice(0,160),
  shopType:normalizeShopType(n.shopType),
  shopTypeSource:n.shopType!==null&&n.shopType!==undefined?'shopee_api':null,
  isOfficialShop:normalizeShopType(n.shopType)==='MALL',
  commissionRate:finite(n.commissionRate),
  sellerCommissionRate:finite(n.sellerCommissionRate),
  shopeeCommissionRate:finite(n.shopeeCommissionRate),
  commission:finite(n.commission),
  commissionPercent:percentFromRate(n.commissionRate),
  sales:finite(n.sales),
  ratingStar:finite(n.ratingStar),
  periodStartTime:finite(n.periodStartTime),
  periodEndTime:finite(n.periodEndTime),
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
  validCount:offers.length,
  officialShopFieldAvailable:fieldsUsed.includes('shopType'),
  commissionBreakdownAvailable:fieldsUsed.includes('sellerCommissionRate'),
  source:'shopee_affiliate_productOfferV2'
 };
}
export async function searchShopee(keyword='',limit=24){
 return (await searchShopeePage(keyword,limit,1)).offers;
}

import {createHash} from 'node:crypto';
const ENDPOINT='https://open-api.affiliate.shopee.com.br/graphql';
export function hasShopeeCredentials(){return Boolean(process.env.SHOPEE_APP_ID&&process.env.SHOPEE_APP_SECRET)}
export async function shopeeQuery(query){
 if(!hasShopeeCredentials()) throw Error('Credenciais da API Shopee não configuradas.');
 const body=JSON.stringify({query}); const ts=Math.floor(Date.now()/1000);
 const sig=createHash('sha256').update(`${process.env.SHOPEE_APP_ID}${ts}${body}${process.env.SHOPEE_APP_SECRET}`).digest('hex');
 const resp=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`SHA256 Credential=${process.env.SHOPEE_APP_ID}, Timestamp=${ts}, Signature=${sig}`},body,cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!resp.ok)throw Error(`API Shopee retornou HTTP ${resp.status}`);
 const result=await resp.json();if(result.errors?.length)throw Error(result.errors[0]?.message||'Erro API Shopee');return result.data;
}
export async function searchShopee(keyword='',limit=24){
 const safe=JSON.stringify(String(keyword).slice(0,80));
 const data=await shopeeQuery(`{productOfferV2(keyword:${safe},page:1,limit:${Math.min(50,Math.max(1,limit))}){nodes{itemId shopId productName imageUrl priceMin priceMax priceDiscountRate offerLink productLink}pageInfo{hasNextPage}}}`);
 return (data?.productOfferV2?.nodes||[]).map(n=>({id:`shopee-${n.shopId}-${n.itemId}`,title:n.productName,category:'Outros',price:Number(n.priceMin),oldPrice:Number(n.priceMax)>Number(n.priceMin)?Number(n.priceMax):null,image:n.imageUrl,url:n.offerLink,featured:false,active:true,origin:'shopee'})).filter(o=>o.title&&o.url&&Number.isFinite(o.price));
}

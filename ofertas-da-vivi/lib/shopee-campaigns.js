import {shopeeQuery,hasShopeeCredentials} from './shopee';
import {isShopeeLink} from './shopee-links';

const safe=(value)=>typeof value==='string'?value.trim().slice(0,300):'';
const number=(v)=>v===null||v===undefined||!Number.isFinite(Number(v))?null:Number(v);
const translations={'health':'Saúde e bem-estar','fashion accessories':'Acessórios de moda'};
function campaignTitle(value){
 const cleaned=safe(value).replace(/^[\s\-–—]+/u,'').trim();
 return translations[cleaned.toLowerCase()]||cleaned||'Campanha Shopee';
}
function plausibleCampaignEnd(value){
 const seconds=number(value);
 if(seconds===null||seconds<=0)return null;
 const year=new Date(seconds*1000).getUTCFullYear();
 return year>=2020&&year<=2099?seconds:null;
}

export async function getShopeeCampaigns(limit=12){
 if(!hasShopeeCredentials())return {offers:[],warning:'A API Shopee não está configurada.'};
 const query=`{ shopeeOfferV2(page:1,limit:12){ nodes {
  offerName imageUrl offerLink originalLink offerType categoryId collectionId
  commissionRate periodStartTime periodEndTime
 } pageInfo { hasNextPage } } }`;
 try{
  const data=await shopeeQuery(query);
  const now=Date.now()/1000;
  const seen=new Set();
  const offers=(data?.shopeeOfferV2?.nodes||[]).filter(x=>{
   const start=number(x.periodStartTime),end=number(x.periodEndTime);
   return isShopeeLink(x.offerLink)&&(!start||start<=now)&&(!end||end>=now);
  }).map((x,i)=>({
   id:'campanha-'+i,
   title:campaignTitle(x.offerName),
   image:safe(x.imageUrl),
   link:safe(x.offerLink),
   start:number(x.periodStartTime),end:plausibleCampaignEnd(x.periodEndTime),
   commissionRate:number(x.commissionRate),
   offerType:x.offerType??null,
   source:'Shopee Affiliate Open API'
  })).filter(x=>{
   if(seen.has(x.link))return false;
   seen.add(x.link);return true;
  }).slice(0,Math.max(1,Math.min(12,limit)));
  return {offers,warning:null};
 }catch(e){
  return {offers:[],warning:'A consulta de campanhas da Shopee está indisponível nesta conexão. Os links configurados continuam utilizáveis.'};
 }
}

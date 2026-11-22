import {createHash} from 'node:crypto';

// Reconhece ID canônico de anúncios Shopee quando há informação suficiente.
// Para links curtos, mantém uma identidade baseada no endereço exato,
// pois links diferentes podem apontar para o mesmo anúncio.
export function shopeeProductId({shopId,itemId,url,productLink}={}){
 if(/^\d+$/.test(String(shopId||''))&&/^\d+$/.test(String(itemId||''))){
  return 'product:'+shopId+':'+itemId;
 }
 for(const raw of [productLink,url]){
  try{
   const u=new URL(String(raw||''));
   const path=decodeURIComponent(u.pathname);
   const matches=path.match(/\/product\/(\d+)\/(\d+)/i)
     ||path.match(/-i\.(\d+)\.(\d+)/i);
   if(matches)return 'product:'+matches[1]+':'+matches[2];
  }catch{}
 }
 return null;
}
export function canonicalSourceUrl(value){
 try{
  const u=new URL(String(value||'').trim());
  if(u.protocol!=='https:')return '';
  const host=u.hostname.toLowerCase();
  const path=decodeURIComponent(u.pathname).replace(/\/+$/,'');
  return 'https://'+host+(path||'/');
 }catch{return ''}
}
function urlKey(raw){
 const url=canonicalSourceUrl(raw);
 return url?'url:'+createHash('sha256').update(url).digest('hex').slice(0,28):null;
}
export function offerIdentityKeys({id,shopId,itemId,url,productLink,dedupeKey}={}){
 const keys=[shopeeProductId({shopId,itemId,url,productLink}),
  urlKey(productLink),urlKey(url),dedupeKey||null];
 if(id&&/^vitrine-|^shopee-/.test(String(id)))keys.push('internal:'+id);
 return [...new Set(keys.filter(Boolean))];
}
export function primaryOfferKey(offer){
 const keys=offerIdentityKeys(offer);
 return keys.find(k=>k.startsWith('product:'))||keys.find(k=>k.startsWith('url:'))||keys[0]||null;
}
export function knownOfferKeys(rows=[]){
 const seen=new Set();
 for(const row of rows){
  for(const key of offerIdentityKeys({
    id:row.id,shopId:row.shop_id??row.shopId,itemId:row.item_id??row.itemId,
    productLink:row.product_link??row.productLink,url:row.url,
    dedupeKey:row.dedupe_key??row.dedupeKey
  }))seen.add(key);
 }
 return seen;
}
export function matchExisting(offer,seen){
 return offerIdentityKeys(offer).some(key=>seen.has(key));
}

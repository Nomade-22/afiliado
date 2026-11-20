import {shopeeQuery} from './shopee';

/**
 * A API de afiliados associa o resultado da mutation às credenciais do
 * servidor. URLs comuns não são consideradas rastreadas até a Shopee
 * confirmar o shortLink na resposta.
 */
const allowedHostnames=['shopee.com.br','shopee.com','s.shopee.com.br','shopee.ee','shope.ee','s.shopee.com','shopee.com.my'];
export function isShopeeLink(value) {
 try{
   const u=new URL(String(value||''));
   return u.protocol==='https:' && !u.username && !u.password && !u.port &&
     allowedHostnames.some(host=>u.hostname===host || u.hostname.endsWith('.'+host));
 }catch{return false}
}
export function validateSubIds(values) {
 if(!Array.isArray(values))throw Error('Informe os Sub IDs em uma lista.');
 if(values.length>5)throw Error('São permitidos até 5 Sub IDs.');
 const ids=values.map(s=>String(s??'').trim()).filter(Boolean);
 if(ids.length>5)throw Error('São permitidos até 5 Sub IDs.');
 if(ids.some(x=>x.length>40 || !/^[a-zA-Z0-9_-]+$/.test(x))){
  throw Error('Cada Sub ID deve ter até 40 caracteres, usando letras, números, _ ou -.');
 }
 return ids;
}
export function defaultSubIds({channel='site',itemId=null,custom=[]}={}) {
 const validChannel=['site','whatsapp','instagram','tiktok','telegram','outros'].includes(String(channel))
  ? String(channel) : 'site';
 const uniqueId=itemId&&/^\d{1,25}$/.test(String(itemId))?'produto_'+itemId:null;
 const extra=Array.isArray(custom)?custom:[];
 return validateSubIds(['vivi',validChannel,uniqueId,...extra].filter(Boolean).slice(0,5));
}
export async function generateAffiliateLink(originUrl,subIds=[]) {
 const original=String(originUrl??'').trim();
 if(!isShopeeLink(original)) throw Error('Informe uma URL HTTPS válida de produto ou loja Shopee.');
 const ids=validateSubIds(subIds);
 const query=`mutation { generateShortLink(input: { originUrl: ${JSON.stringify(original)}, subIds: ${JSON.stringify(ids)} }) { shortLink } }`;
 const data=await shopeeQuery(query);
 const shortLink=String(data?.generateShortLink?.shortLink||'').trim();
 if(!isShopeeLink(shortLink)) throw Error('Shopee não retornou um link de afiliado válido. Nada foi publicado.');
 return {shortLink,subIds:ids,originUrl:original,generatedBy:'shopee_api'};
}

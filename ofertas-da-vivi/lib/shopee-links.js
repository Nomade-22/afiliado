import {shopeeQuery} from './shopee';
import {subIdCandidates} from './subid-format';

/**
 * A Shopee pode rejeitar alguns Sub IDs com error 11001.
 * Não substitua URLs comuns por links de afiliado sem confirmação da API.
 */
const allowedHostnames=['shopee.com.br','shopee.com','s.shopee.com.br','shopee.ee','shope.ee','s.shopee.com'];
export function isShopeeLink(value) {
 try{
  const u=new URL(String(value||'').trim());
  return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&
   allowedHostnames.some(host=>u.hostname===host||u.hostname.endsWith('.'+host));
 }catch{return false}
}

export function validateSubIds(values) {
 if(!Array.isArray(values))throw Error('Informe os Sub IDs em uma lista.');
 if(values.length>5)throw Error('São permitidos até 5 Sub IDs.');
 const ids=values.map(s=>String(s??'').trim()).filter(Boolean);
 if(ids.some(x=>x.length>40||!/^[a-zA-Z0-9_-]+$/.test(x))){
  throw Error('Cada Sub ID deve usar letras, números, _ ou -, com no máximo 40 caracteres.');
 }
 return ids;
}

export function defaultSubIds({channel='site',itemId=null,custom=[]}={}) {
 const allowed=['site','whatsapp','instagram','tiktok','telegram','outros'];
 const safeChannel=allowed.includes(String(channel))?String(channel):'site';
 // IDs compactos, alfanuméricos, evitando o texto longo "produto_16986492180"
 // que a Shopee rejeitou na importação.
 let productTag=null;
 if(itemId&&/^\d{1,24}$/.test(String(itemId))){
  try{productTag='p'+BigInt(itemId).toString(36)}catch{}
 }
 const extra=Array.isArray(custom)?custom:[];
 return validateSubIds(['vivi',safeChannel,productTag,...extra].filter(Boolean).slice(0,5));
}

const invalidSubId=error=>/invalid\s*sub[\s_-]*id|sub[\s_-]*id.*invalid/i.test(String(error?.message||error));

/** Converte na Shopee; se 11001 invalid sub id, tenta Sub ID mínimo e depois sem Sub ID.
 * Nunca remove rastreamento silenciosamente: o retorno informa usedSubIds e warning.
 */
export async function generateAffiliateLink(originUrl,subIds=[]) {
 const original=String(originUrl??'').trim();
 if(!isShopeeLink(original))throw Error('Informe um link HTTPS de produto ou loja Shopee.');
 const requested=validateSubIds(subIds);
 const candidates=[requested];
 if(requested.length && !(requested.length===1&&requested[0]==='site'))candidates.push(['site']);
 if(requested.length)candidates.push([]);
 let lastError;
 for(let i=0;i<candidates.length;i++){
  const ids=candidates[i];
  const arg=ids.length?', subIds: '+JSON.stringify(ids):'';
  const query=`mutation { generateShortLink(input: { originUrl: ${JSON.stringify(original)}${arg} }) { shortLink } }`;
  try{
   const data=await shopeeQuery(query);
   const shortLink=String(data?.generateShortLink?.shortLink||'').trim();
   if(!isShopeeLink(shortLink))throw Error('Shopee não retornou um link válido.');
   return {
    shortLink,originUrl:original,subIds:ids,generatedBy:'generateShortLink',
    warning:i>0?
      (ids.length?'A Shopee rejeitou os Sub IDs originais. O link foi gerado apenas com o Sub ID site.':
       'A Shopee rejeitou os Sub IDs. O link foi gerado sem Sub IDs personalizados.') :null
   };
  }catch(error){
   lastError=error;
   // Só repetir se a Shopee indicou claramente problemas de Sub ID.
   if(!invalidSubId(error))throw error;
  }
 }
 throw lastError||Error('Não foi possível converter o link pela Shopee.');
}

/** Se a conversão for recusada, usa exclusivamente o offerLink obtido
 * de productOfferV2 com credenciais de afiliado; nunca usa productLink bruto.
 */
export async function resolveOfferAffiliateLink(offer){
 try{
  return await generateAffiliateLink(offer.productLink||offer.url,
    defaultSubIds({channel:'site',itemId:offer.itemId}));
 }catch(error){
  if(isShopeeLink(offer.url) && /^shopee-[0-9]+-[0-9]+$/.test(String(offer.id||''))){
   return {
    shortLink:offer.url,
    subIds:[],
    generatedBy:'productOfferV2.offerLink',
    warning:'A geração de Sub IDs falhou; foi usado o offerLink fornecido pela própria API de afiliados da Shopee. Sem Sub IDs personalizados.'
   };
  }
  throw error;
 }
}

/**
 * Converte cada produto com seu código interno, sem alterar o link anterior
 * caso a Shopee não confirme a operação.
 *
 * Se a Shopee recusar o formato DDMMYY_NNNN, testa vDDMMYYNNNN.
 * O código da Vivi permanece intacto; retorna usedSubId realmente aceito.
 */
export async function generateProductAffiliateLink(originUrl,internalCode,options={}) {
 const candidates=subIdCandidates(internalCode);
 const origin=String(originUrl||'').trim();
 if(!isShopeeLink(origin))throw Error('A origem não é uma URL HTTPS da Shopee.');

 const sources=[];
 const pushSource=url=>{
  if(isShopeeLink(url)&&!sources.includes(url))sources.push(url);
 };
 const canonical=(shopId,itemId)=>{
  const s=String(shopId||''),p=String(itemId||'');
  return /^\d{1,24}$/.test(s)&&/^\d{1,24}$/.test(p)?
   'https://shopee.com.br/product/'+s+'/'+p:null;
 };
 const fromUrl=raw=>{
  try{
   const u=new URL(raw);
   const m=u.pathname.match(/\/product\/(\d+)\/(\d+)/i)||
    u.pathname.match(/-i\.(\d+)\.(\d+)/i);
   return m?canonical(m[1],m[2]):null;
  }catch{return null}
 };

 pushSource(canonical(options.shopId,options.itemId));
 pushSource(fromUrl(origin));
 pushSource(fromUrl(options.fallbackUrl));
 pushSource(origin);
 pushSource(options.fallbackUrl);

 // Não compartilhamos segredos nem URLs completas em mensagens de erro.
 const invalidSub=error=>/invalid\s*sub[\s_-]*id|sub[\s_-]*id.*invalid/i.test(String(error?.message||error));
 const invalidOrigin=error=>/invalid\s*(origin|url|link)|unsupported\s*(url|link)/i.test(String(error?.message||error));
 const issues=[];
 for(const source of sources.slice(0,3)){
  for(const id of candidates){
   const mutation='mutation { generateShortLink(input: { originUrl: '+
     JSON.stringify(source)+', subIds: '+JSON.stringify([id])+
     ' }) { shortLink } }';
   try{
    const data=await shopeeQuery(mutation);
    const url=String(data?.generateShortLink?.shortLink||'').trim();
    if(!isShopeeLink(url))throw Error('A Shopee não retornou uma URL válida.');
    return {
     shortLink:url,originUrl:source,subIds:[id],
     usedSubId:id,internalCode,verified:true,generatedBy:'generateShortLink',
     alternativeFormat:id!==internalCode
    };
   }catch(error){
    if(invalidSub(error)){
     issues.push('Sub ID recusado: '+id);
     continue;
    }
    if(invalidOrigin(error)){
     issues.push('Endereço de origem recusado pela Shopee.');
     break;
    }
    // Não repete erros de autenticação, cota, rede, servidor ou assinatura.
    throw Error('A conversão não foi confirmada: '+String(error?.message||error).slice(0,120));
   }
  }
 }
 throw Error('A Shopee não aceitou os formatos de Sub ID testados ou o link de origem. '+
   issues.slice(0,3).join(' | ')+'. Link anterior preservado.');
}

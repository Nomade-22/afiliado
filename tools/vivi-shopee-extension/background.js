/* Vivi · modo contínuo opcional. Nenhum acesso a outras páginas, cookies ou senhas. */
const VIVI_SHOPEE_ORIGINS=['https://shopee.com.br/*','https://www.shopee.com.br/*'];
const VIVI_CAPTURE_BRIDGE='https://ofertas-da-vivi.vercel.app/captura-vivi#vivi-capture=';
const MAX_PER_SESSION=20;
const inflightTabs=new Map();

function productKeyFromUrl(raw){
 try{
  const url=new URL(raw);
  if(url.protocol!=='https:'||!['shopee.com.br','www.shopee.com.br'].includes(url.hostname))return '';
  const p=url.pathname;
  const match=p.match(/\/(?:product|opaanlp)\/(\d+)\/(\d+)(?:\/|$)/i)||
   p.match(/(?:^|[-/])i\.(\d+)\.(\d+)(?:$|\/)/i);
  return match?match[1]+':'+match[2]:'';
 }catch{return ''}
}
function validCapture(data,key){
 return data?.type==='vivi-shopee-capture-v1'&&
  [String(data.shopId||''),String(data.itemId||'')].join(':')===key&&
  typeof data.title==='string'&&data.title.trim().length>=5&&
  !/Shopee Brasil|Ofertas incríveis|^Anúncio Shopee \d+$/i.test(data.title)&&
  typeof data.description==='string'&&data.description.trim().length>=50&&
  Array.isArray(data.images)&&data.images.length>0;
}
function bridgeUrl(payload){
 const encoded=encodeURIComponent(JSON.stringify(payload));
 const url=VIVI_CAPTURE_BRIDGE+encoded;
 return url.length<=24000?url:'';
}
const sleep=duration=>new Promise(resolve=>setTimeout(resolve,duration));
async function recordAutoStatus(status){
 await chrome.storage.local.set({viviAutoLast:{...status,at:Date.now()}});
}
async function scanAutoTab(tabId){
 let ownsLock=false;
 try{
  if(inflightTabs.has(tabId))return;
  const prefs=await chrome.storage.local.get('viviAutoEnabled');
  if(prefs.viviAutoEnabled!==true)return;
  const permission=await chrome.permissions.contains({origins:VIVI_SHOPEE_ORIGINS});
  if(!permission){
   await chrome.storage.local.set({viviAutoEnabled:false});
   return;
  }
  const tab=await chrome.tabs.get(tabId);
  const key=productKeyFromUrl(tab?.url);
  if(!tab?.active||!key)return;
  if(inflightTabs.has(tabId))return;
  inflightTabs.set(tabId,key);ownsLock=true;
  const prior=await chrome.storage.session.get('viviAutoProcessed');
  const processed=prior.viviAutoProcessed||{};
  if(processed[key])return;
  if(Object.keys(processed).length>=MAX_PER_SESSION){
   await chrome.storage.local.set({viviAutoEnabled:false});
   await recordAutoStatus({type:'limit',text:'Limite de 20 capturas desta sessão. Modo contínuo pausado.'});
   return;
  }
  // Espera que a galeria/descrição sejam renderizadas, sem recarregar páginas ou fazer fetch na Shopee.
  for(const delay of [1400,1800,2400]){
   await sleep(delay);
   const current=await chrome.tabs.get(tabId);
   const enabled=(await chrome.storage.local.get('viviAutoEnabled')).viviAutoEnabled===true;
   if(!enabled||!current?.active||productKeyFromUrl(current?.url)!==key)return;
   let payload;
   try{
    const result=await chrome.scripting.executeScript({
     target:{tabId},files:['capture-page.js']
    });
    payload=result?.[0]?.result;
   }catch{
    continue;
   }
   if(!validCapture(payload,key))continue;
   const url=bridgeUrl(payload);
   if(!url){
    await recordAutoStatus({type:'manual',key,text:'Captura grande demais. Use o botão da extensão para revisar e copiar JSON.'});
    return;
   }
   // Gravar deduplicação ANTES de criar a aba para evitar múltiplos envios concorrentes.
   const latest=(await chrome.storage.session.get('viviAutoProcessed')).viviAutoProcessed||{};
   if(latest[key])return;
   if(Object.keys(latest).length>=MAX_PER_SESSION)return;
   latest[key]={at:Date.now(),title:payload.title.slice(0,90),images:payload.images.length};
   await chrome.storage.session.set({viviAutoProcessed:latest});
   try{
    // Não tirar o usuário do anúncio. O ADM faz a validação/autenticação e grava apenas no piloto.
    await chrome.tabs.create({url,active:false});
   }catch{
    delete latest[key];
    await chrome.storage.session.set({viviAutoProcessed:latest});
    throw Error('Não foi possível abrir a aba da Vivi.');
   }
   await recordAutoStatus({type:'sent',key,text:'Enviada ao teste: '+payload.title.slice(0,75)});
   return;
  }
  await recordAutoStatus({type:'partial',key,text:'Dados insuficientes. Abra a galeria/descrição e use Capturar novamente na extensão.'});
 }catch{
  await recordAutoStatus({type:'error',text:'Falha no envio automático. Use o botão da extensão para tentar manualmente.'});
 }finally{
  if(ownsLock)inflightTabs.delete(tabId);
 }
}
// Eventos registrados no escopo principal para acordar o service worker MV3.
chrome.tabs.onUpdated.addListener((tabId,changeInfo)=>{
 if(changeInfo.status==='complete'||typeof changeInfo.url==='string'){
  void scanAutoTab(tabId);
 }
});
chrome.tabs.onActivated.addListener(info=>{
 void scanAutoTab(info.tabId);
});
chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
 if(message?.type==='viviAutoScanActive'){
  chrome.tabs.query({active:true,currentWindow:true})
   .then(tabs=>{if(tabs?.[0]?.id)void scanAutoTab(tabs[0].id)})
   .catch(()=>{});
  sendResponse({ok:true});
 }
});

// Operação de lote iniciada explicitamente pelo administrador na aba Vivi.
importScripts('batch.js');

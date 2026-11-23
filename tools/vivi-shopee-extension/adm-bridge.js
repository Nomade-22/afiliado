/* Ponte local entre o ADM Ofertas da Vivi e a extensão instalada.
 * Sem ID fixo da extensão: comunicação pelo content script restrito ao ADM.
 * O painel nunca executa código no domínio Shopee por conta própria.
 */
(()=>{
 'use strict';
 if(location.origin!=='https://ofertas-da-vivi.vercel.app'||location.pathname!=='/adm')return;
 const REQUEST='vivi:card:capture:start:v1';
 const START_RESULT='vivi:card:capture:start-result:v1';
 const STATUS_REQUEST='vivi:card:capture:status-request:v1';
 const STATUS_RESULT='vivi:card:capture:status-result:v1';
 const READY_REQUEST='vivi:card:capture:ping:v1';
 const READY='vivi:card:capture:ready:v1';
 const FINISHED='vivi:card:capture:finished:v1';
 const num=v=>/^\d{1,24}$/.test(String(v||''));
 const boundedId=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{8,100}$/.test(v);
 const post=data=>window.postMessage(data,location.origin);
 const fail=error=>String(error?.message||error||'Sem resposta da extensão.').slice(0,200);

 window.addEventListener('message',event=>{
  if(event.source!==window||event.origin!==location.origin)return;
  const data=event.data;
  if(!data||typeof data!=='object')return;
  if(data.type===READY_REQUEST){post({type:READY});return;}
  if(data.type===REQUEST){
   if(!boundedId(data.requestId)||!num(data.shopId)||!num(data.itemId))return;
   // ACK imediato: diferencia extensão ausente da captura em andamento.
   post({type:START_RESULT,requestId:data.requestId,phase:'received'});
   chrome.runtime.sendMessage({
    type:'viviCardCaptureStart',
    requestId:data.requestId,
    shopId:String(data.shopId),
    itemId:String(data.itemId)
   }).then(result=>post({
    type:START_RESULT,requestId:data.requestId,
    phase:result?.ok?'started':'error',
    error:result?.ok?'':String(result?.error||'Não foi possível iniciar a captura.').slice(0,200)
   })).catch(error=>post({type:START_RESULT,requestId:data.requestId,phase:'error',error:fail(error)}));
  }
  if(data.type===STATUS_REQUEST&&boundedId(data.requestId)){
   chrome.runtime.sendMessage({type:'viviBatchGet'}).then(reply=>{
    const info=reply?.info;
    if(info?.origin!=='card'||info.requestId!==data.requestId)return;
    const last=info.results?.[info.results.length-1];
    post({type:STATUS_RESULT,requestId:data.requestId,
     status:info.status,step:info.message||'',
     result:last?{status:last.status,reason:last.reason||'',photos:last.photos||0,chars:last.chars||0}:null});
   }).catch(()=>{});
  }
 });

 chrome.runtime.onMessage.addListener((message,_sender,sendResponse)=>{
  if(message?.type==='viviAdminCheckTab'){
   // O navegador pode ocultar chrome.tabs.get(tabId).url ao service worker.
   // Esta resposta vem do content script que roda somente no ADM da Vivi.
   sendResponse({
    ok:location.origin==='https://ofertas-da-vivi.vercel.app'&&location.pathname==='/adm',
    origin:location.origin,pathname:location.pathname
   });
   return;
  }
  if(message?.type==='viviAdminValidateProduct'){
   (async()=>{
    if(!num(message.shopId)||!num(message.itemId))return {error:'IDs de produto inválidos.'};
    const r=await fetch('/api/admin/scrapling-test',{credentials:'same-origin',cache:'no-store'});
    if(!r.ok)return {error:r.status===401?'Faça login novamente na Vivi.':'Não foi possível consultar os produtos autorizados.'};
    const data=await r.json();
    const candidate=(data.candidates||[]).find(p=>
     String(p.shopId)===String(message.shopId)&&String(p.itemId)===String(message.itemId));
    if(!candidate)return {error:'Produto fora dos vinte anúncios do piloto.'};
    return {item:{
     shopId:String(candidate.shopId),itemId:String(candidate.itemId),
     title:String(candidate.title||'Produto Shopee').slice(0,200),
     sourceUrl:'https://shopee.com.br/product/'+candidate.shopId+'/'+candidate.itemId
    }};
   })().then(sendResponse).catch(error=>sendResponse({error:fail(error)}));
   return true;
  }
  if(message?.type==='viviAdminSavePayload'){
   (async()=>{
    const data=message.payload;
    if(data?.type!=='vivi-shopee-capture-v1'||!num(data.shopId)||!num(data.itemId))
     return {ok:false,status:400,error:'Formato inválido.'};
    const body=JSON.stringify(data);
    if(body.length>70000)return {ok:false,status:413,error:'Captura muito grande.'};
    const r=await fetch('/api/admin/scrapling-test/extension',{
     method:'POST',credentials:'same-origin',cache:'no-store',
     headers:{'Content-Type':'application/json'},body
    });
    let output={};try{output=await r.json()}catch{}
    return {ok:r.ok&&output.ok===true,status:r.status,
     error:output.error||'',imageCount:output.imageCount||0,descriptionChars:output.descriptionChars||0,
     publicStorefrontChanged:output.publicStorefrontChanged===true,descriptionPending:output.descriptionPending===true};
   })().then(sendResponse).catch(error=>sendResponse({ok:false,status:0,error:fail(error)}));
   return true;
  }
  if(message?.type==='viviCardCaptureFinished'){
   if(boundedId(message.requestId)){
    const result=message.result||{};
    post({type:FINISHED,requestId:message.requestId,
     status:result.status||'error',photos:result.photos||0,chars:result.chars||0,
     reason:String(result.reason||'').slice(0,200)});
   }
  }
 });

 post({type:READY});
})();

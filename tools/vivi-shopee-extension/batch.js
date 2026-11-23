/* Captura pendentes Vivi · Chrome MV3.
 * Acionado explicitamente pelo administrador no popup da extensão.
 * Só navega nos links autenticados retornados pelo próprio painel ADM.
 */
(()=>{
 'use strict';
 const ADMIN_ORIGIN='https://ofertas-da-vivi.vercel.app';
 const KEY='viviPilotBatch';
 const MAX_ITEMS=10;
 let processing=false;
 const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const numeric=value=>/^\d{1,24}$/.test(String(value||''));
 const productKey=p=>String(p.shopId)+':'+String(p.itemId);
 function validItem(p){
  if(!p||!numeric(p.shopId)||!numeric(p.itemId))return false;
  const expected='https://shopee.com.br/product/'+p.shopId+'/'+p.itemId;
  return p.sourceUrl===expected&&typeof p.title==='string'&&p.title.length>0;
 }
 function validCapture(data,item){
  return data?.type==='vivi-shopee-capture-v1'&&
   String(data.shopId)===String(item.shopId)&&
   String(data.itemId)===String(item.itemId)&&
   typeof data.title==='string'&&data.title.trim().length>=5&&
   !/Shopee Brasil|Ofertas incríveis|^Anúncio Shopee \d+$/i.test(data.title)&&
   typeof data.description==='string'&&data.description.trim().length>=50&&
   Array.isArray(data.images)&&data.images.length>0;
 }
 async function state(){
  const stored=await chrome.storage.session.get(KEY);
  return stored[KEY]||null;
 }
 async function store(info){await chrome.storage.session.set({[KEY]:info});}
 async function verifyAdminTab(tabId){
  if(!Number.isInteger(tabId)){
   throw Error('A aba administrativa da Vivi não foi identificada.');
  }
  // Chrome MV3 pode omitir tab.url quando o evento vem do content script,
  // mesmo que o usuário esteja na página /adm. A ponte instalada na própria
  // aba verifica a origem real, sem solicitar permissão tabs para todos os sites.
  if(typeof chrome.tabs.sendMessage==='function'){
   try{
    const reply=await chrome.tabs.sendMessage(tabId,{type:'viviAdminCheckTab'});
    if(reply){
     if(reply.ok===true&&reply.origin===ADMIN_ORIGIN&&reply.pathname==='/adm')return;
     throw Error('Abra o painel administrativo original da Vivi em /adm.');
    }
   }catch(error){
    // A mensagem pode falhar em extensões antigas. Nesse caso, usar apenas
    // o URL quando realmente estiver disponível; nunca aceitar aba desconhecida.
    if(error?.message==='Abra o painel administrativo original da Vivi em /adm.')throw error;
   }
  }
  const tab=await chrome.tabs.get(tabId);
  if(typeof tab?.url!=='string'||!tab.url.trim()){
   throw Error('Não foi possível confirmar a aba da Vivi. Recarregue o ADM após atualizar a extensão.');
  }
  let u;
  try{u=new URL(tab.url)}catch{
   throw Error('O endereço da aba ADM está inválido. Reabra o painel da Vivi e tente novamente.');
  }
  if(u.origin!==ADMIN_ORIGIN||u.pathname!=='/adm'){
   throw Error('Mantenha aberta a aba autenticada da Vivi /adm para salvar o lote.');
  }
 }
 async function waitPage(tabId){
  for(let attempts=0;attempts<35;attempts++){
   const tab=await chrome.tabs.get(tabId);
   if(tab.status==='complete')return;
   await delay(400);
  }
 }
 async function readProduct(tabId,item){
  // A Shopee pode renderizar a galeria após o document.readyState.
  for(const ms of [1200,1800,2200]){
   await delay(ms);
   const current=await state();
   if(current?.status!=='running')return {error:'Interrompido pelo usuário.'};
   const tab=await chrome.tabs.get(tabId);
   if(!tab||!tab.url?.startsWith('https://shopee.com.br/')&&!tab.url?.startsWith('https://www.shopee.com.br/')){
    return {error:'A página deixou de ser um anúncio da Shopee.'};
   }
   try{
    const results=await chrome.scripting.executeScript({target:{tabId},files:['capture-page.js']});
    const captured=results?.[0]?.result;
    if(validCapture(captured,item))return {payload:captured};
   }catch{
    // Modo manual permanece disponível quando o site bloqueia a injeção.
   }
  }
  return {error:'Fotos ou descrição insuficientes; anúncio não foi salvo.'};
 }
 async function sendToAdmin(tabId,payload){
  await verifyAdminTab(tabId);
  // Preferir a ponte instalada dentro da aba ADM. Sem expor credenciais a Shopee.
  if(typeof chrome.tabs.sendMessage==='function'){
   try{
    const response=await chrome.tabs.sendMessage(tabId,{type:'viviAdminSavePayload',payload});
    if(response&&typeof response.ok==='boolean')return response;
   }catch{}
  }
  // Same-origin fetch dentro da aba ADM onde o usuário já iniciou sessão.
  // Não lê cookies ou senhas; a API existente faz autenticação e limita ao piloto.
  const result=await chrome.scripting.executeScript({
   target:{tabId},
   func:async capture=>{
    try{
     const response=await fetch('/api/admin/scrapling-test/extension',{
      method:'POST',credentials:'same-origin',cache:'no-store',
      headers:{'Content-Type':'application/json'},body:JSON.stringify(capture)
     });
     let body={};
     try{body=await response.json()}catch{}
     return {ok:response.ok&&body.ok===true,status:response.status,
      error:body.error||'',imageCount:body.imageCount||0,descriptionChars:body.descriptionChars||0};
    }catch{
     return {ok:false,status:0,error:'Erro de rede ou sessão indisponível.'};
    }
   },
   args:[payload]
  });
  return result?.[0]?.result||{ok:false,status:0,error:'Sem resposta do painel Vivi.'};
 }
 async function execute(){
  if(processing)return;
  processing=true;
  try{
   let batch=await state();
   if(!batch||batch.status!=='running')return;
   for(let i=batch.index;i<batch.items.length;i++){
    batch=await state();
    if(!batch||batch.status!=='running')break;
    const item=batch.items[i];
    let productTabId=null;
    let result=null;
    let pauseForLogin=false;
    try{
     await verifyAdminTab(batch.adminTabId);
     const productTab=await chrome.tabs.create({url:item.sourceUrl,active:true});
     productTabId=productTab.id;
     await waitPage(productTabId);
     const read=await readProduct(productTabId,item);
     if(!read.payload){
      result={shopId:item.shopId,itemId:item.itemId,title:item.title,status:'partial',reason:read.error};
     }else{
      // Não confundir solicitação de captura com confirmação de gravação.
      const current=await state();
      if(current?.status!=='running')break;
      const saved=await sendToAdmin(batch.adminTabId,read.payload);
      if(saved.ok){
       result={shopId:item.shopId,itemId:item.itemId,title:item.title,status:'saved',
        photos:saved.imageCount,chars:saved.descriptionChars};
      }else{
       result={shopId:item.shopId,itemId:item.itemId,title:item.title,
        status:'error',reason:saved.error||('Falha HTTP '+saved.status)};
       pauseForLogin=saved.status===401||saved.status===403;
      }
     }
    }catch(error){
     result={shopId:item.shopId,itemId:item.itemId,title:item.title,status:'error',
      reason:String(error?.message||'Falha no anúncio').slice(0,220)};
     if(/autenticada|sessão/i.test(result.reason))pauseForLogin=true;
    }finally{
     if(productTabId!==null){
      try{await chrome.tabs.remove(productTabId)}catch{}
     }
    }
    batch=await state();
    if(!batch)break;
    if(result){
     batch.results=[...(batch.results||[]),result];
     batch.index=i+1;
     batch.message=result.status==='saved'?'Salvo: '+item.title:'Revisar: '+item.title;
    }
    if(pauseForLogin){
     batch.status='paused';
     batch.message='Login administrativo necessário. Abra a Vivi, entre e reinicie o lote.';
    }
    await store(batch);
    if(batch.origin==='card'&&result&&typeof chrome.tabs.sendMessage==='function'){
     try{
      await chrome.tabs.sendMessage(batch.adminTabId,{
       type:'viviCardCaptureFinished',requestId:batch.requestId,result
      });
     }catch{}
    }
    if(batch.status!=='running')break;
   }
   batch=await state();
   if(batch&&batch.status==='running'){
    batch.status='completed';
    batch.finishedAt=Date.now();
    batch.message='Lote concluído. Confira a lista de resultados.';
    await store(batch);
   }
   // Devolver o foco à página administrativa quando possível.
   if(batch?.adminTabId){
    try{await chrome.tabs.update(batch.adminTabId,{active:true})}catch{}
   }
  }finally{processing=false;}
 }
 chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
  if(message?.type==='viviCardCaptureStart'){
   (async()=>{
    const tabId=sender?.tab?.id;
    if(!Number.isInteger(tabId))return {ok:false,error:'A captura deve ser solicitada no painel Vivi aberto no Chrome.'};
    if(!numeric(message.shopId)||!numeric(message.itemId)||
       typeof message.requestId!=='string'||!/^[a-zA-Z0-9_-]{8,100}$/.test(message.requestId)){
     return {ok:false,error:'Identificação do produto inválida.'};
    }
    await verifyAdminTab(tabId);
    const allowed=await chrome.permissions.contains({
     origins:['https://shopee.com.br/*','https://www.shopee.com.br/*']
    });
    if(!allowed){
     return {ok:false,error:'Autorize a Shopee uma vez: abra a extensão Vivi, clique em Ativar captura contínua e depois em Pausar. Volte ao painel e tente novamente.'};
    }
    if(typeof chrome.tabs.sendMessage!=='function'){
     return {ok:false,error:'Ponte da extensão indisponível. Atualize a extensão e recarregue o ADM.'};
    }
    const check=await chrome.tabs.sendMessage(tabId,{
     type:'viviAdminValidateProduct',shopId:String(message.shopId),itemId:String(message.itemId)
    });
    if(!check?.item||!validItem(check.item)){
     return {ok:false,error:check?.error||'Produto não identificado no piloto da Vivi.'};
    }
    const previous=await state();
    if(previous?.status==='running'){
     return {ok:false,error:'Outra captura está em andamento. Confira o status antes de iniciar outra.'};
    }
    await chrome.storage.local.set({viviAutoEnabled:false});
    await store({status:'running',adminTabId:tabId,items:[check.item],
     index:0,results:[],origin:'card',requestId:message.requestId,
     startedAt:Date.now(),message:'Abrindo anúncio Shopee e coletando informações…'});
    void execute();
    return {ok:true,requestId:message.requestId};
   })().then(sendResponse).catch(e=>sendResponse({ok:false,error:String(e?.message||e)}));
   return true;
  }
  if(message?.type==='viviBatchStart'){
   (async()=>{
    const {items,adminTabId}=message;
    if(!Number.isInteger(adminTabId)||!Array.isArray(items)||items.length<1||items.length>MAX_ITEMS||
       !items.every(validItem)||new Set(items.map(productKey)).size!==items.length){
     return {ok:false,error:'Lista de produtos inválida ou fora do piloto.'};
    }
    await verifyAdminTab(adminTabId);
    const existing=await state();
    if(existing?.status==='running')return {ok:false,error:'Já existe um lote em execução.'};
    // O modo contínuo é desligado para evitar capturas duplicadas.
    await chrome.storage.local.set({viviAutoEnabled:false});
    await store({status:'running',adminTabId,items,index:0,results:[],
     startedAt:Date.now(),message:'Iniciando captura dos anúncios pendentes…'});
    void execute();
    return {ok:true,count:items.length};
   })().then(sendResponse).catch(e=>sendResponse({ok:false,error:String(e?.message||e)}));
   return true;
  }
  if(message?.type==='viviBatchStop'){
   (async()=>{
    const current=await state();
    if(current?.status==='running'){
     current.status='paused';
     current.message='Lote pausado pelo usuário.';
     await store(current);
    }
    return {ok:true};
   })().then(sendResponse).catch(e=>sendResponse({ok:false,error:String(e?.message||e)}));
   return true;
  }
  if(message?.type==='viviBatchGet'){
   state().then(info=>sendResponse({ok:true,info})).catch(e=>
    sendResponse({ok:false,error:String(e?.message||e)}));
   return true;
  }
 });
})();

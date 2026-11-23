/* Vivi Captura Shopee · piloto: só conteúdo da aba ativa, sem rede ou cookies */
let lastPayload=null;
const el=id=>document.getElementById(id);
const msg=(value,error=false)=>{el('status').textContent=value;el('status').className=error?'error':'';};

// O clique no ícone da extensão concede activeTab. A leitura começa ao abrir o popup.
// O conteúdo só sai da aba Shopee depois da ação explícita do usuário.
const VIVI_BRIDGE='https://ofertas-da-vivi.vercel.app/captura-vivi#vivi-capture=';
let scanning=false;

function autoSaveEligible(payload){
 return typeof payload?.title==='string'&&payload.title.trim().length>=5&&
  !/Shopee Brasil|Ofertas incríveis|^Anúncio Shopee \d+$/i.test(payload.title)&&
  typeof payload.description==='string'&&payload.description.trim().length>=50&&
  Array.isArray(payload.images)&&payload.images.length>0;
}
function captureLink(payload){
 const link=VIVI_BRIDGE+encodeURIComponent(JSON.stringify(payload));
 if(link.length>24000)throw Error('Captura muito grande para envio automático. Use Copiar JSON e cole no painel de teste.');
 return link;
}
async function openTestPage(payload){
 const url=captureLink(payload);
 // Abre uma nova aba, preservando o anúncio da Shopee para continuar a navegação.
 await chrome.tabs.create({url,active:true});
}
async function scanActiveProduct(){
 if(scanning)return;
 scanning=true;
 lastPayload=null;
 el('result').style.display='none';
 el('scan').disabled=true;
 el('send').hidden=true;
 msg('Lendo automaticamente o anúncio da Shopee...');
 try{
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(!tab?.id||!/^https:\/\/(?:www\.)?shopee\.com\.br\//i.test(tab.url||'')){
   throw Error('Abra um produto completo em shopee.com.br e clique novamente na extensão Vivi.');
  }
  const results=await chrome.scripting.executeScript({target:{tabId:tab.id},files:['capture-page.js']});
  const captured=results?.[0]?.result;
  if(!captured||captured.error)throw Error(captured?.error||'O anúncio não disponibilizou os dados.');
  lastPayload=captured;
  el('title').textContent=captured.title;
  el('imgs').textContent=captured.images.length;
  el('chars').textContent=captured.description.length;
  el('removed').textContent=captured.duplicateImagesRemoved;
  el('result').style.display='block';
  if(autoSaveEligible(captured)){
   msg('Captura completa. Abrindo o ambiente de teste para salvar automaticamente...');
   try{
    await openTestPage(captured);
    msg('Captura enviada ao teste. Aguarde a confirmação de salvamento na aba Vivi.');
   }catch(error){
    msg(error?.message||'Não foi possível abrir a Vivi. Use Copiar JSON.',true);
   }
  }else{
   el('send').hidden=false;
   msg('Captura parcial: fotos, título ou descrição insuficientes. Abra todos os detalhes do anúncio e clique em Capturar novamente; ou envie para revisão manual.');
  }
 }catch(error){
  msg(error?.message||'Não foi possível ler a página.',true);
 }finally{
  scanning=false;
  el('scan').disabled=false;
 }
}

el('scan').addEventListener('click',scanActiveProduct);
el('send').addEventListener('click',async()=>{
 if(!lastPayload)return;
 el('send').disabled=true;
 try{
  await openTestPage(lastPayload);
  msg('Enviado para revisão no painel Vivi. Capturas parciais não são salvas automaticamente.');
 }catch(error){
  msg(error?.message||'Não foi possível enviar. Use Copiar JSON.',true);
 }finally{
  el('send').disabled=false;
 }
});
el('copy').addEventListener('click',async()=>{
 if(!lastPayload)return;
 try{
  await navigator.clipboard.writeText(JSON.stringify(lastPayload));
  msg('JSON copiado! Use ADM → Teste de importação → Salvar manualmente no teste.');
 }catch{
  msg('Não foi possível copiar. Confira a permissão da área de transferência.',true);
 }
});

const VIVI_AUTO_ORIGINS=['https://shopee.com.br/*','https://www.shopee.com.br/*'];
let autoEnabled=false;
async function refreshAutoUI(){
 try{
  const [prefs,history]=await Promise.all([
   chrome.storage.local.get(['viviAutoEnabled','viviAutoLast']),
   chrome.storage.session.get('viviAutoProcessed')
  ]);
  autoEnabled=prefs.viviAutoEnabled===true;
  const used=Object.keys(history.viviAutoProcessed||{}).length;
  el('autoSwitch').textContent=autoEnabled?'Pausar captura contínua':'Ativar captura contínua';
  el('autoSwitch').className=autoEnabled?'secondary':'';
  el('autoState').textContent=(autoEnabled?'Ativo':'Desligado')+' · '+used+'/20 anúncios nesta sessão.';
  el('autoLast').textContent=prefs.viviAutoLast?.text||'Abra um produto Shopee para iniciar a captura.';
 }catch(error){
  el('autoState').textContent='Não foi possível consultar o modo contínuo.';
 }
}
el('autoSwitch').addEventListener('click',async()=>{
 // A autorização deve ser solicitada diretamente no clique do usuário.
 const activate=!autoEnabled;
 el('autoSwitch').disabled=true;
 try{
  if(activate){
   const granted=await chrome.permissions.request({origins:VIVI_AUTO_ORIGINS});
   if(!granted){
    el('autoState').textContent='Permissão não concedida: modo contínuo desligado.';
    return;
   }
  }
  await chrome.storage.local.set({viviAutoEnabled:activate});
  autoEnabled=activate;
  await refreshAutoUI();
  if(activate)msg('Modo contínuo ativado! Abra o próximo anúncio Shopee e ele será capturado sem clicar na extensão.');
  else msg('Modo contínuo pausado. O botão de captura manual continua funcionando.');
 }catch(error){
  msg('Não foi possível alterar o modo contínuo. Confira as permissões do Chrome.',true);
 }finally{el('autoSwitch').disabled=false;}
});
el('resetAuto').addEventListener('click',async()=>{
 try{
  await chrome.storage.session.remove('viviAutoProcessed');
  await refreshAutoUI();
  msg('Histórico desta sessão reiniciado. Os registros já gravados no piloto Vivi não são apagados.');
 }catch{
  msg('Não foi possível reiniciar o histórico.',true);
 }
});
// Processa somente os produtos que ainda estão sem captura completa no ambiente de teste.
async function pendingPilotItems(){
 const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
 if(!tab?.id||!/^https:\/\/ofertas-da-vivi\.vercel\.app\/adm(?:[?#]|$)/i.test(tab.url||'')){
  throw Error('Primeiro abra a aba ADM da Vivi e faça login. Depois clique no ícone da extensão.');
 }
 const response=await chrome.scripting.executeScript({
  target:{tabId:tab.id},
  func:async()=>{
   try{
    const response=await fetch('/api/admin/scrapling-test',{
     credentials:'same-origin',cache:'no-store'
    });
    if(!response.ok)return {error:response.status===401?
     'Sessão expirada: entre novamente no ADM.':'Não foi possível consultar os produtos do piloto.'};
    const data=await response.json();
    const captures=new Map((data.captures||[]).map(c=>[c.offerId,c]));
    const pending=(data.candidates||[]).filter(p=>{
     const c=captures.get(p.id);
     const hasDescription=Number(p.descriptionChars||0)>=25||String(c?.description||'').trim().length>=25;
     const hasPhotos=Number(p.galleryCount||0)>=1||(Array.isArray(c?.images)&&c.images.length>0);
     return !hasDescription||!hasPhotos;
    }).map(p=>({
     title:String(p.title||'Produto Shopee').slice(0,200),
     shopId:String(p.shopId),itemId:String(p.itemId),
     sourceUrl:'https://shopee.com.br/product/'+p.shopId+'/'+p.itemId
    }));
    return {items:pending,all:data.candidates?.length||0};
   }catch{return {error:'Falha ao consultar o painel ADM.'}}
  }
 });
 const data=response?.[0]?.result;
 if(!data||data.error)throw Error(data?.error||'Sem resposta da aba Vivi.');
 return {adminTabId:tab.id,...data};
}
async function refreshBatchUI(){
 try{
  const answer=await chrome.runtime.sendMessage({type:'viviBatchGet'});
  const batch=answer?.info;
  if(!batch){
   el('batchState').textContent='Abra o painel ADM e inicie a captura dos anúncios pendentes.';
   el('batchPause').hidden=true;
   return;
  }
  const saved=(batch.results||[]).filter(x=>x.status==='saved').length;
  const failed=(batch.results||[]).filter(x=>x.status!=='saved').length;
  el('batchState').textContent='Status: '+batch.status+' · '+(batch.index||0)+'/'+batch.items.length+
   ' verificados · '+saved+' salvos · '+failed+' para revisar. '+(batch.message||'');
  el('batchPause').hidden=batch.status!=='running';
  el('batchRun').disabled=batch.status==='running';
  const details=(batch.results||[]).slice(-5);
  el('batchDetails').textContent=details.map(r=>
   (r.status==='saved'?'✓ ':'! ')+r.title+
   (r.status==='saved'?' ('+r.photos+' fotos, '+r.chars+' caracteres)':' — '+(r.reason||r.status))
  ).join('\n');
 }catch{
  el('batchState').textContent='Não foi possível consultar o andamento do lote.';
 }
}
el('batchRun').addEventListener('click',async()=>{
 el('batchRun').disabled=true;
 el('batchState').textContent='Preparando lista do piloto…';
 try{
  // Deve ser solicitado diretamente pelo clique: permissão restrita à Shopee.
  const granted=await chrome.permissions.request({origins:VIVI_AUTO_ORIGINS});
  if(!granted)throw Error('O Chrome não concedeu acesso às páginas Shopee.');
  const plan=await pendingPilotItems();
  if(plan.items.length===0){
   el('batchState').textContent='Todos os '+plan.all+' produtos do piloto já têm fotos e descrição de teste.';
   return;
  }
  const answer=await chrome.runtime.sendMessage({
   type:'viviBatchStart',adminTabId:plan.adminTabId,items:plan.items
  });
  if(!answer?.ok)throw Error(answer?.error||'Não foi possível iniciar o lote.');
  el('batchState').textContent='Iniciado: '+answer.count+
   ' anúncios pendentes. O Chrome abrirá cada produto e tentará salvar na Vivi.';
  await refreshBatchUI();
 }catch(error){
  el('batchState').textContent=String(error?.message||error);
 }finally{el('batchRun').disabled=false;}
});
el('batchPause').addEventListener('click',async()=>{
 await chrome.runtime.sendMessage({type:'viviBatchStop'});
 await refreshBatchUI();
});
refreshBatchUI();
setInterval(refreshBatchUI,1200);
// Manter o fluxo manual somente se o usuário clicou na extensão sobre uma aba Shopee.
refreshAutoUI().then(async()=>{
 if(autoEnabled)return;
 try{
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(/^https:\/\/(?:www\.)?shopee\.com\.br\//i.test(tab?.url||'')){
   await scanActiveProduct();
  }else{
   msg('Abra um produto Shopee para captura individual ou use o lote na aba ADM.');
  }
 }catch{}
});



'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {FlaskConical,RefreshCw,ExternalLink,Images,FileText,
 CheckCircle2,AlertTriangle,Clock3,ShieldCheck,Eye,Info,Smartphone,Copy} from 'lucide-react';
import {VIVI_MOBILE_BOOKMARKLET} from '../lib/vivi-mobile-bookmarklet';
import {viviShopeeProductUrl} from '../lib/vivi-chrome-product-link';

const ACTIONS='https://github.com/Nomade-22/afiliado/actions/workflows/vivi-scrapling-test.yml';
const states={
 success:['Completo','good'],
 partial:['Parcial','warning'],
 unavailable:['Anúncio não carregado','warning'],
 blocked:['Acesso restrito','danger'],
 error:['Erro de consulta','danger'],
 not_attempted:['Não consultado','muted']
};
const displayDate=value=>value?new Date(value).toLocaleString('pt-BR',{
 timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',
 year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';

export default function ScraplingTestPanel(){
 const [data,setData]=useState(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [expanded,setExpanded]=useState({});
 const [captureJson,setCaptureJson]=useState('');
 const [sending,setSending]=useState(false);
 const automaticSaveStarted=useRef(false);
 const [captureMessage,setCaptureMessage]=useState(null);
 const [mobileCopyMessage,setMobileCopyMessage]=useState('');
 const [isAndroid,setIsAndroid]=useState(false);
 const [openLinkMessage,setOpenLinkMessage]=useState('');
 const [copyingId,setCopyingId]=useState('');
 const [cardCaptures,setCardCaptures]=useState({});
 const cardCaptureRequests=useRef({});
 function captureFromCard(item){
  const shopId=String(item.shopId||''),itemId=String(item.itemId||'');
  if(!/^\d{1,24}$/.test(shopId)||!/^\d{1,24}$/.test(itemId))return;
  if(Object.values(cardCaptureRequests.current).some(job=>job.active))return;
  const key=shopId+':'+itemId;
  const requestId='vivi-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12);
  cardCaptureRequests.current[requestId]={key,acknowledged:false,active:true};
  setCardCaptures(prev=>({...prev,[key]:{status:'starting',text:'Conectando à extensão Vivi…'}}));
  window.postMessage({type:'vivi:card:capture:start:v1',requestId,shopId,itemId},window.location.origin);
  window.setTimeout(()=>{
   const pending=cardCaptureRequests.current[requestId];
   if(pending?.active&&!pending.acknowledged){
    delete cardCaptureRequests.current[requestId];
    setCardCaptures(prev=>({...prev,[key]:{status:'error',
     text:'Extensão Vivi não detectada. Atualize a extensão para a versão 0.5, recarregue o painel e tente novamente.'}}));
   }
  },3000);
 }
 useEffect(()=>{setIsAndroid(/Android/i.test(navigator.userAgent||''))},[]);
 async function copyShopeeUrl(url,itemId){
  setCopyingId('');
  if(!url)return;
  try{
   if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(url);
   else{
    const input=document.createElement('textarea');
    input.value=url;input.style.position='fixed';input.style.left='-9999px';
    document.body.appendChild(input);input.focus();input.select();
    const ok=document.execCommand('copy');
    input.remove();
    if(!ok)throw Error('clipboard');
   }
   setCopyingId(String(itemId||''));
   setOpenLinkMessage('Link copiado! Agora abra o aplicativo Chrome, toque na barra de endereço e escolha Colar e acessar. Não toque no link em outra mensagem, pois o Android poderá abrir a Shopee.');
  }catch{
   setOpenLinkMessage('Seu navegador não autorizou a cópia automática. Pressione e copie o endereço abaixo, depois cole na barra do Chrome: '+url);
  }
 }
 const load=useCallback(async()=>{
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/admin/scrapling-test',{cache:'no-store'});
   if(response.status===401){location.href='/adm/login';return}
   const result=await response.json();
   if(!response.ok)throw Error(result.error||'Erro ao consultar teste.');
   setData(result);
  }catch(e){setError(String(e?.message||e))}
  finally{setBusy(false)}
 },[]);
 useEffect(()=>{load();const interval=setInterval(load,45000);
  return ()=>clearInterval(interval)},[load]);

 useEffect(()=>{
  const done=(requestId,result)=>{
   const request=cardCaptureRequests.current[requestId];
   if(!request?.active)return;
   delete cardCaptureRequests.current[requestId];
   const status=result.status==='saved'?'saved':result.status==='partial'?'partial':'error';
   const text=status==='saved'?'Captura conferida na loja: '+(result.photos||0)+
     ' fotos e '+(result.chars||0)+' caracteres.':
     status==='partial'?String(result.reason||'Fotos capturadas, descrição ainda pendente. Tente novamente.').slice(0,210):
     String(result.reason||'Não foi possível salvar a captura.').slice(0,210);
   setCardCaptures(prev=>({...prev,[request.key]:{status,text}}));
   if(status==='saved'||status==='partial')void load();
  };
  const onMessage=event=>{
   if(event.source!==window||event.origin!==window.location.origin)return;
   const data=event.data;
   if(!data||typeof data!=='object')return;
   const request=cardCaptureRequests.current[data.requestId];
   if(!request?.active)return;
   if(data.type==='vivi:card:capture:start-result:v1'){
    request.acknowledged=true;
    if(data.phase==='error'){
     done(data.requestId,{status:'error',reason:data.error});return;
    }
    if(data.phase==='started'){
     request.started=true;
     setCardCaptures(prev=>({...prev,[request.key]:{
      status:'running',text:'Abrindo Shopee, extraindo fotos e descrição e enviando à Vivi…'}}));
    }
   }else if(data.type==='vivi:card:capture:finished:v1'){
    done(data.requestId,data);
   }else if(data.type==='vivi:card:capture:status-result:v1'){
    if(data.result&&(data.status==='completed'||data.status==='paused')){
     done(data.requestId,{...data.result,reason:data.result.reason||data.step});
    }else if(data.status==='running'){
     setCardCaptures(prev=>({...prev,[request.key]:{
      status:'running',text:data.step||'Capturando anúncio Shopee…'}}));
    }
   }
  };
  window.addEventListener('message',onMessage);
  const poll=window.setInterval(()=>{
   for(const [requestId,job] of Object.entries(cardCaptureRequests.current)){
    if(job.active&&job.started){
     window.postMessage({type:'vivi:card:capture:status-request:v1',requestId},window.location.origin);
    }
   }
  },1500);
  return ()=>{window.removeEventListener('message',onMessage);window.clearInterval(poll)};
 },[load]);
 useEffect(()=>{
  // O favorito novo guarda o JSON na sessão antes de abrir a área protegida.
  // Assim, quando o login for necessário, o payload sobrevive ao redirecionamento.
  const key='vivi-pending-capture-v1';
  const hash=window.location.hash||'';
  const marker='&vivi-capture=';
  const index=hash.startsWith('#teste-importacao')?hash.indexOf(marker):-1;
  let raw=null;
  if(index>=0){
   const encoded=hash.slice(index+marker.length);
   window.history.replaceState(null,'',window.location.pathname+window.location.search+'#teste-importacao');
   if(encoded.length>45000||!encoded){
    setCaptureMessage({success:false,text:'Captura muito grande ou ausente. Use Copiar dados no anúncio.'});
    return;
   }
   try{raw=decodeURIComponent(encoded)}catch{
    setCaptureMessage({success:false,text:'A captura recebida pela URL está incompleta.'});
    return;
   }
  }else{
   try{raw=sessionStorage.getItem(key)}catch{}
  }
  if(!raw)return;
  try{
   const parsed=JSON.parse(raw);
   if(parsed?.type!=='vivi-shopee-capture-v1'||
      !/^\d{1,24}$/.test(String(parsed.shopId||''))||
      !/^\d{1,24}$/.test(String(parsed.itemId||''))){
    throw Error('IDs inválidos');
   }
   const serialized=JSON.stringify(parsed);
   sessionStorage.setItem(key,serialized);
   setCaptureJson(serialized);
   let autoSaveRequested=false;
   try{autoSaveRequested=sessionStorage.getItem('vivi-pending-capture-auto-save-v1')==='1'}catch{}
   setCaptureMessage({
    success:true,
    text:autoSaveRequested?'Captura recebida! Conferindo os dados e atualizando fotos/descrição válidas na loja…':
     'Captura recuperada com segurança: '+(Array.isArray(parsed.images)?parsed.images.length:0)+
     ' fotos e '+String(parsed.description||'').length+
     ' caracteres. Confira e toque em Aplicar captura na loja.'
   });
   if(autoSaveRequested&&!automaticSaveStarted.current){
    automaticSaveStarted.current=true;
    // O usuário já pediu o envio no favorito. Mantemos validação de IDs e sessão no servidor.
    // Agendar fora da execução direta do efeito, evitando atualizações de estado síncronas.
    window.setTimeout(()=>{void saveCapturedData(serialized,true)},0);
   }
   window.requestAnimationFrame(()=>{
    document.getElementById('vivi-capture-import-panel')?.scrollIntoView({behavior:'smooth',block:'start'});
   });
  }catch{
   try{sessionStorage.removeItem(key)}catch{}
   setCaptureMessage({success:false,text:'Não foi possível ler os dados recebidos. Volte à Shopee e use Copiar dados.'});
  }
 },[]);

 const report=data?.reports?.[0]||null;
 const extensionById=useMemo(()=>new Map((data?.captures||[]).map(x=>[x.offerId,x])),[data]);
 const byId=useMemo(()=>new Map((report?.results||[]).map(x=>[x.id,x])),[report]);
 const incomingPreview=useMemo(()=>{
  if(!captureJson.trim())return null;
  try{
   const payload=JSON.parse(captureJson);
   if(payload?.type!=='vivi-shopee-capture-v1')return {error:'Formato inválido para a captura da Vivi.'};
   const matched=data?.candidates?.find(p=>
    String(p.shopId)===String(payload.shopId)&&String(p.itemId)===String(payload.itemId));
   const photos=Array.isArray(payload.images)?payload.images.filter(raw=>{
    if(typeof raw!=='string')return false;
    try{
     const u=new URL(raw);
     const host=u.hostname.toLowerCase();
     return u.protocol==='https:'&&
      ['susercontent.com','shopee.com.br','shopee.sg'].some(x=>host===x||host.endsWith('.'+x));
    }catch{return false}
   }).slice(0,6):[];
   return {name:matched?.title||String(payload.title||'Produto não identificado').slice(0,200),
    matched:!!matched,description:String(payload.description||''),
    images:photos,number:payload.images?.length||0,
    loading:!data,shopId:String(payload.shopId||''),itemId:String(payload.itemId||'')};
  }catch{return {error:'Os dados não são um JSON válido.'}}
 },[captureJson,data]);

 const extensionStats=useMemo(()=>({
  count:(data?.captures||[]).length,
  descriptions:(data?.captures||[]).filter(x=>x.description?.trim()).length,
  photos:(data?.captures||[]).reduce((n,x)=>n+(x.images?.length||0),0)
 }),[data]);
 async function copyMobileBookmarklet(){
  setMobileCopyMessage('');
  try{
   if(navigator.clipboard?.writeText){
    await navigator.clipboard.writeText(VIVI_MOBILE_BOOKMARKLET);
   }else{
    const element=document.createElement('textarea');
    element.value=VIVI_MOBILE_BOOKMARKLET;
    element.style.position='fixed';element.style.left='-9999px';
    document.body.appendChild(element);element.focus();element.select();
    const copied=document.execCommand('copy');element.remove();
    if(!copied)throw Error('clipboard');
   }
   setMobileCopyMessage('Código de captura automática copiado! Substitua a URL do favorito Capturar Vivi. Ao executar, ele enviará a captura completa sem pedir mais cliques.');
  }catch{
   setMobileCopyMessage('O navegador não permitiu copiar automaticamente. Abra o painel no Chrome e tente novamente.');
  }
 }
 async function saveCapturedData(rawJson,automatic=false){
  if(sending)return;
  setSending(true);
  setCaptureMessage(automatic?{success:true,text:'Validando dados e atualizando fotos/descrição na loja…'}:null);
  try{
   let parsed;
   try{parsed=JSON.parse(typeof rawJson==='string'?rawJson:captureJson)}catch{throw Error('O conteúdo não é JSON válido. Use Copiar captura na extensão.')}
   const response=await fetch('/api/admin/scrapling-test/extension',{
    method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',
    body:JSON.stringify(parsed)
   });
   if(response.status===401){location.href='/adm/login';return}
   const result=await response.json();
   if(!response.ok)throw Error(result.error||'Não foi possível salvar a captura.');
   try{sessionStorage.removeItem('vivi-pending-capture-v1');sessionStorage.removeItem('vivi-pending-capture-auto-save-v1')}catch{}
   setCaptureJson('');
   setCaptureMessage({success:true,text:'Captura de '+result.title+(automatic?' recebida automaticamente':' recebida')+': '+result.imageCount+' fotos e '+result.descriptionChars+' caracteres. '+(result.publicStorefrontChanged?'Informações novas aplicadas à loja.':'As informações já existentes foram preservadas; nenhum conteúdo melhor foi substituído.')});
   await load();
  }catch(error){
   // Se houver erro de rede ou validação, evitar repetições automáticas; permitir revisão manual.
   try{sessionStorage.removeItem('vivi-pending-capture-auto-save-v1')}catch{}
   setCaptureMessage({success:false,text:(automatic?'Não foi possível salvar automaticamente. Confira a captura e salve manualmente. ':'')+String(error?.message||error)});
  }
  finally{setSending(false)}
 }
 const totals=useMemo(()=>{
  const items=report?.results||[];
  return {count:items.length,full:items.filter(x=>x.status==='success').length,
   partial:items.filter(x=>x.status==='partial').length,
   blocked:items.filter(x=>x.status==='blocked').length,
   generic:items.filter(x=>x.status==='unavailable'&&/página genérica/i.test(x.reason||'')).length,
   useful:items.filter(x=>x.titleMatched&&(x.description?.trim()||(x.images||[]).length)).length,
   photos:items.reduce((n,x)=>n+(x.images||[]).length,0),
   described:items.filter(x=>x.description?.trim()).length};
 },[report]);
 return <div className="vivi-scrapling-test">
  <section className="admin-card vivi-scrapling-intro">
   <div className="admin-card-title">
    <h2><FlaskConical size={22}/> Teste de importação Shopee — 20 produtos</h2>
   </div>
   <p>O piloto agora reúne <b>20 produtos ativos da loja</b> para capturar fotos e descrições diretamente dos anúncios públicos da Shopee.</p>
   <p className="muted-text">As capturas anteriores foram incorporadas ao catálogo. As novas capturas agora completam automaticamente as fotos e descrições dos mesmos anúncios, preservando informações melhores.</p>
   <div className="vivi-scrapling-safety">
    <ShieldCheck size={19}/> <span><b>Captura protegida.</b> O histórico fica separado. Só as fotos e descrições válidas são sincronizadas com o produto existente. Preços, links de afiliado, comissões e capas não são alterados.</span>
   </div>
   <div className="vivi-scrapling-actions">
    <button type="button" className="btn btn-outline" onClick={load} disabled={busy}>
     <RefreshCw size={17}/> {busy?'Consultando…':'Atualizar resultados'}
    </button>
    <a className="btn btn-primary" href={ACTIONS} target="_blank" rel="noopener noreferrer">
     <FlaskConical size={17}/> Ver execuções no GitHub <ExternalLink size={14}/>
    </a>
   </div>
   <p className="vivi-scrapling-hint">O relatório é atualizado automaticamente. A execução do GitHub só indica que o coletor rodou, não que a Shopee liberou as fotos e descrições. Repetir a mesma coleta sem mudar a estratégia provavelmente produzirá o mesmo resultado.</p>
  </section>
  {error&&<div className="vivi-notice vivi-notice-error" role="alert"><AlertTriangle size={19}/>{error}</div>}
  <section className="admin-card vivi-mobile-capture-card">
   <div className="admin-card-title"><h2><Smartphone size={22}/> Capturar pelo celular Android</h2></div>
   <p className="muted-text">O favorito atualizado captura <b>fotos e descrição</b> e envia automaticamente para o teste ao ser acionado no anúncio carregado. O sistema registra a captura e usa informações válidas para completar automaticamente fotos e descrição do produto correspondente.</p>
   <button className="btn btn-outline" type="button" onClick={copyMobileBookmarklet}>
    <Copy size={17}/> Copiar código leve para Android
   </button>
   {mobileCopyMessage&&<p className="vivi-mobile-capture-feedback" role="status">{mobileCopyMessage}</p>}
   <ol className="vivi-mobile-capture-steps">
    <li>No <b>Chrome do celular</b>, salve esta página como favorito pelo menu <b>⋮ → Adicionar aos favoritos</b>.</li>
    <li>Abra <b>⋮ → Favoritos</b>, encontre o favorito salvo e escolha <b>Editar</b>. Dê o nome <b>Capturar Vivi</b> e substitua a URL pelo código copiado acima.</li>
    <li>Abra um dos <b>20 anúncios completos</b> da Shopee que aparecem abaixo e espere as fotos e a descrição carregarem. O capturador também reconhece endereços <b>/opaanlp/</b>, comuns no celular.</li>
    <li>Toque na barra de endereço, digite <b>Capturar Vivi</b> e toque na <b>sugestão com estrela</b> (não faça uma pesquisa comum).</li>
    <li>Ao executar o favorito atualizado, uma captura com fotos e descrição será <b>enviada e salva automaticamente no teste</b>. Se a sessão tiver expirado, faça login uma vez; o envio será retomado. Para capturas incompletas, você poderá revisar e usar <b>Enviar ao teste da Vivi</b>.</li>
   </ol>
   <div className="vivi-mobile-open-note">
    <strong>Etapa 1 — Abrir no Chrome sem chamar o app Shopee</strong>
    <p>Como o Android está interceptando os links da Shopee, a opção mais confiável é <b>Copiar para o Chrome</b> no produto desejado, abrir o aplicativo Chrome e <b>colar na barra de endereços</b>. Não abra o link pelo gerenciador de apps ou outra mensagem.</p>
    <p>Para voltar a usar o botão direto: <b>Configurações → Apps → Apps padrão → Abrir links → Shopee → desativar Abrir links compatíveis</b>. Depois disso, teste <b>Abrir link direto</b>.</p>
    <small>Por segurança do Android, um site não consegue obrigar o Chrome a ignorar as associações de links de outro aplicativo, nem executar automaticamente seu favorito no site da Shopee.</small>
   </div>
   {openLinkMessage&&<p className="vivi-mobile-capture-feedback" role="status">{openLinkMessage}</p>}
   <p className="vivi-scrapling-hint">No envio automático, o resultado aparece na comparação abaixo. Caso faltem fotos ou descrição, o favorito mantém a janela para tentar novamente ou enviar manualmente. A vitrine recebe somente fotos e descrições novas validadas por ID do anúncio.</p>
  </section>
  <section id="vivi-capture-import-panel" className="admin-card vivi-extension-test-card">
   <div className="admin-card-title"><h2><Images size={22}/> Comparar dados capturados</h2></div>
   <p className="muted-text">Os dados enviados pelo celular aparecem automaticamente abaixo. Confira antes de salvar. Também é possível colar o resultado da extensão no computador.</p>
   <div className="vivi-extension-test-stats">
    <span><b>{extensionStats.count}/{data?.candidates?.length||20}</b> capturados</span>
    <span><b>{extensionStats.descriptions}</b> com descrição</span>
    <span><b>{extensionStats.photos}</b> fotos encontradas</span>
   </div>
   {incomingPreview&&<div className="vivi-incoming-capture-preview">
    {incomingPreview.error?<p className="vivi-extension-test-message error">{incomingPreview.error}</p>:<>
     <div className="vivi-extension-capture-heading"><CheckCircle2 size={17}/>
      <strong>Prévia do anúncio recebido</strong>
     </div>
     <p><b>{incomingPreview.name}</b></p>
     <p className="vivi-incoming-preview-meta">
      Loja {incomingPreview.shopId} · Produto {incomingPreview.itemId} ·
      {incomingPreview.number} imagem(ns) · {incomingPreview.description.length} caracteres
     </p>
     {data&&!incomingPreview.matched&&<p className="vivi-extension-test-message error">
      Este anúncio não faz parte dos 20 produtos do piloto. Nenhum dado será salvo.
     </p>}
     {incomingPreview.images.length>0&&<div className="vivi-scrapling-photo-grid">
      {incomingPreview.images.map((u,i)=><a key={u+i} href={u} target="_blank" rel="noopener noreferrer">
       <img src={u} alt={'Prévia da imagem '+(i+1)} loading="lazy"/>
      </a>)}
     </div>}
     {incomingPreview.description&&<p className="vivi-incoming-preview-description">
      {incomingPreview.description.slice(0,420)}
      {incomingPreview.description.length>420?'…':''}
     </p>}
    </>}
   </div>}
   <label className="vivi-extension-test-label" htmlFor="vivi-extension-json">Dados recebidos (opcional editar)</label>
   <textarea id="vivi-extension-json" value={captureJson} onChange={e=>setCaptureJson(e.target.value)}
    rows={4} placeholder="Os dados do anúncio chegam automaticamente aqui, ou podem ser colados manualmente..." spellCheck={false}/>
   <div className="vivi-scrapling-actions">
    <button className="btn btn-primary" type="button" disabled={sending||!captureJson.trim()||!!incomingPreview?.error||(!!data&&!incomingPreview?.matched)} onClick={()=>saveCapturedData()}>
     <Images size={17}/>{sending?'Salvando captura…':'Aplicar captura na loja'}
    </button>
   </div>
   {captureMessage&&<p className={'vivi-extension-test-message '+(captureMessage.success?'success':'error')} role="status">{captureMessage.text}</p>}
   <p className="vivi-scrapling-hint">Se a sessão de administração estiver expirada, será necessário entrar novamente; a captura permanecerá salva temporariamente nesta aba até você confirmar a importação. Cookies de afiliado e links dos produtos não são modificados.</p>
  </section>
  {report?<section className="admin-card">
    <div className="vivi-scrapling-report-header">
     <div><h3>Último teste registrado</h3>
      <p><Clock3 size={15}/> {displayDate(report.finishedAt)} · Execução #{report.runId}</p>
     </div>
     <span className={'vivi-scrapling-status'+(report.status==='completed'&&!totals.useful?' vivi-scrapling-status-no-data':'')}>{report.status!=='completed'?'Execução interrompida':totals.useful?'Dados encontrados':'Executado · sem dados extraídos'}</span>
    </div>
    <div className="vivi-scrapling-stats">
     <div><strong>{totals.count}</strong><small>Consultados</small></div>
     <div><strong>{totals.full}</strong><small>Completos</small></div>
     <div><strong>{totals.partial}</strong><small>Parciais</small></div>
     <div><strong>{totals.described}</strong><small>Com descrição</small></div>
     <div><strong>{totals.photos}</strong><small>Imagens distintas</small></div>
     <div><strong>{totals.generic}</strong><small>Páginas genéricas</small></div>
    </div>
    {report.status==='completed'&&!totals.useful&&<div className="vivi-scrapling-diagnosis" role="status">
     <AlertTriangle size={20}/>
     <span><b>O teste executou, mas não conseguiu acessar os anúncios individuais.</b> {totals.generic===totals.count?'As 10 URLs devolveram a página genérica da Shopee, apesar do HTTP 200.':'As páginas consultadas não forneceram fotos ou descrições verificáveis.'} Isso não significa que os produtos não existem ou que foram excluídos. Não vamos importar conteúdo incompleto para a vitrine.</span>
    </div>}
    <p className="vivi-scrapling-hint">{report.notes}</p>
   </section>:<section className="admin-card vivi-scrapling-empty">
    <Clock3 size={32}/><h3>Aguardando o primeiro relatório</h3>
    <p>Os 20 anúncios disponíveis para captura aparecem abaixo. Nenhum dado novo será publicado automaticamente na loja.</p>
   </section>}
  <section className="admin-card">
   <div className="admin-card-title"><h2><Images size={21}/> Comparação dos 20 produtos</h2></div>
   {!data?.candidates?.length&&<p className="muted-text">Não foi possível identificar os anúncios elegíveis no banco.</p>}
   <div className="vivi-scrapling-grid">
    {(data?.candidates||[]).map((item,index)=>{
     const result=byId.get(item.id);
     const captured=extensionById.get(item.id);
     const hasPublishedDescription=Number(item.descriptionChars||0)>=25;
     const hasPublishedGallery=Number(item.galleryCount||0)>=3;
     const status=hasPublishedDescription&&hasPublishedGallery?['Dados na loja','good']:
      hasPublishedGallery?['Fotos na loja','good']:
      hasPublishedDescription?['Descrição na loja','good']:
      captured?.description?.trim()&&captured?.images?.length?['Capturado no teste','good']:
      captured?.images?.length?['Fotos capturadas','warning']:
      result?(result.status==='unavailable'&&/página genérica/i.test(result.reason||'')?['Página genérica','warning']:states[result.status]||states.error):null;
     const photos=result?.images||[];
     const description=result?.description||'';
     const showDescription=Boolean(expanded[item.id]);
     return <article key={item.id} className="vivi-scrapling-product">
      <header className="vivi-scrapling-product-head">
       <span className="vivi-scrapling-number">{index+1}/{data?.candidates?.length||20}</span>
       <span className={'vivi-scrapling-pill '+(status?.[1]||'muted')}>
        {status?status[0]:'Pendente'}
       </span>
      </header>
      <div className="vivi-scrapling-product-summary">
       <img src={item.cover||'/images/produto-1.webp'} alt="" loading="lazy"
        onError={e=>{e.currentTarget.src='/images/produto-1.webp'}}/>
       <div><h3>{item.title}</h3>
        <p>Na loja: {item.descriptionChars} caracteres de descrição · {item.galleryCount} imagem(ns) cadastrada(s)</p>
        {viviShopeeProductUrl(item.shopId,item.itemId)&&<div className="vivi-scrapling-open-actions">
         {isAndroid&&<button className="vivi-scrapling-chrome-btn" type="button"
          onClick={()=>copyShopeeUrl(viviShopeeProductUrl(item.shopId,item.itemId),item.itemId)}
          title="Copiar o endereço para colar manualmente na barra do Google Chrome">
          <Copy size={14}/>{copyingId===String(item.itemId)?'Copiado para Chrome':'Copiar para Chrome'}
         </button>}
         <a className={isAndroid?'vivi-scrapling-copy-url':'vivi-scrapling-chrome-btn'}
          href={viviShopeeProductUrl(item.shopId,item.itemId)}
          target="_blank" rel="noopener noreferrer nofollow"
          title={isAndroid?'Somente se a Shopee estiver impedida de abrir links por padrão':'Abrir o anúncio no navegador'}>
          <ExternalLink size={13}/>{isAndroid?'Abrir link direto':'Abrir anúncio'}
         </a>
         {!isAndroid&&<button type="button"
          className="vivi-scrapling-chrome-btn vivi-capture-card-btn"
          disabled={cardCaptures[String(item.shopId)+':'+String(item.itemId)]?.status==='starting'||
           cardCaptures[String(item.shopId)+':'+String(item.itemId)]?.status==='running'}
          onClick={()=>captureFromCard(item)}
          title="Abre a Shopee no Chrome, usa a extensão Vivi e salva a captura no teste">
          <Images size={14}/>
          {['starting','running'].includes(cardCaptures[String(item.shopId)+':'+String(item.itemId)]?.status)
           ?'Capturando…':'Capturar com a Vivi'}
         </button>}
        </div>}
        {!isAndroid&&cardCaptures[String(item.shopId)+':'+String(item.itemId)]&&
         <p className={'vivi-card-capture-feedback '+cardCaptures[String(item.shopId)+':'+String(item.itemId)].status}
          role="status">
          {cardCaptures[String(item.shopId)+':'+String(item.itemId)].text}
         </p>}
       </div>
      </div>
      {captured&&<div className="vivi-extension-capture-result">
       <div className="vivi-extension-capture-heading"><CheckCircle2 size={17}/> <strong>Capturado no Chrome</strong><small>{displayDate(captured.capturedAt)}</small></div>
       <div className="vivi-scrapling-findings">
        <span><FileText size={15}/> Descrição: <b>{captured.description?.length||0} caracteres</b></span>
        <span><Images size={15}/> Fotos distintas: <b>{captured.images?.length||0}</b></span>
        <span>Duplicatas removidas: <b>{captured.duplicatesRemoved||0}</b></span>
       </div>
       {!!captured.images?.length&&<div className="vivi-scrapling-photo-grid">{captured.images.map((url,i)=><a key={url} href={url} target="_blank" rel="noopener noreferrer"><img src={url} loading="lazy" alt={'Foto '+(i+1)+' capturada do anúncio'}/></a>)}</div>}
       {!!captured.description&&<div className="vivi-scrapling-description"><strong>Descrição capturada</strong><p>{expanded['ext-'+item.id]?captured.description:captured.description.slice(0,370)+(captured.description.length>370?'…':'')}</p>
        {captured.description.length>370&&<button type="button" className="vivi-scrapling-expand" onClick={()=>setExpanded(prev=>({...prev,['ext-'+item.id]:!prev['ext-'+item.id]}))}>{expanded['ext-'+item.id]?'Recolher':'Ler descrição completa'}</button>}
       </div>}
      </div>}
      {result?<>
       {result.reason&&<p className="vivi-scrapling-reason"><Info size={15}/>{result.reason}</p>}
       <div className="vivi-scrapling-findings">
        <span><FileText size={15}/> Descrição: <b>{description.length} caracteres</b></span>
        <span><Images size={15}/> Fotos diferentes: <b>{photos.length}</b></span>
        <span>Duplicatas eliminadas: <b>{result.duplicateImagesRemoved||0}</b></span>
        <span>Correspondência do título: <b>{result.titleMatched?'Sim':'Não confirmada'}</b></span>
       </div>
       {photos.length>0&&<div className="vivi-scrapling-photo-grid">
        {photos.map((url,i)=><a href={url} target="_blank" rel="noopener noreferrer" key={url}>
         <img src={url} alt={'Imagem '+(i+1)+' de '+item.title} loading="lazy"/>
        </a>)}
       </div>}
       {description&&<div className="vivi-scrapling-description">
        <strong>Descrição recuperada <small>({result.descriptionSource||'fonte não informada'})</small></strong>
        <p>{showDescription?description:description.slice(0,320)+(description.length>320?'…':'')}</p>
        {description.length>320&&<button className="vivi-scrapling-expand" type="button"
         onClick={()=>setExpanded(prev=>({...prev,[item.id]:!prev[item.id]}))}>
         <Eye size={15}/>{showDescription?'Recolher':'Ver descrição inteira'}
        </button>}
       </div>}
       <small className="vivi-scrapling-technical">
        HTTP {result.httpStatus||'—'} · {result.runtimeSeconds||0}s · Somente leitura
       </small>
      </>:<p className="vivi-scrapling-pending">Sem resultado da execução mais recente.</p>}
     </article>
    })}
   </div>
  </section>
 </div>;
}

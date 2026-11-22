'use client';
import {useEffect,useRef,useState} from 'react';
import {CheckCircle2,AlertCircle,Globe2,Images,BookOpen,PauseCircle,ShieldCheck,Clock3,RefreshCw} from 'lucide-react';

const MAX_ERRORS=5;

export default function CatalogActionsPanel({offers=[],onCompleted}){
 const [running,setRunning]=useState(null),[progress,setProgress]=useState(null),
  [notice,setNotice]=useState(null);
 const stopRef=useRef(false);
 const [syncHistory,setSyncHistory]=useState(null),[statusBusy,setStatusBusy]=useState(false);
 const inactive=offers.filter(item=>!item.active);
 const needsDetails=offers.filter(item=>
  !item.description||!Array.isArray(item.images)||item.images.length<2||
  !item.discountCheckedAt||Date.now()-new Date(item.discountCheckedAt).getTime()>24*3600*1000
 );
 async function refreshSyncHistory(){
  try{
   const response=await fetch('/api/admin/products/sync',{cache:'no-store'});
   if(response.status===401){window.location.href='/adm/login';return}
   if(!response.ok)throw Error('Não foi possível consultar o histórico.');
   setSyncHistory(await response.json());
  }catch{}
 }
 useEffect(()=>{
  refreshSyncHistory();
  const timer=setInterval(refreshSyncHistory,30000);
  return ()=>clearInterval(timer);
 },[]);
 const formatDate=value=>value?new Date(value).toLocaleString('pt-BR',{
  timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',
  hour:'2-digit',minute:'2-digit'
 }):'Ainda não realizada';
 const syncLabel=value=>value==='success'?'Concluída':
  value==='partial'?'Concluída com avisos':
  value==='error'?'Falhou':'Em andamento';
 async function syncRequest(body){
  const response=await fetch('/api/admin/products/sync',{
   method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',
   body:JSON.stringify(body)
  });
  if(response.status===401){window.location.href='/adm/login';throw Error('Sessão expirada.')}
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||'Falha na sincronização.');
  return data;
 }
 async function forceSyncNow(){
  if(running)return;
  stopRef.current=false;setRunning('sync');setNotice(null);
  setProgress({processed:0,total:offers.length});
  try{
   let state=await syncRequest({action:'start'});
   if(state.alreadyRunning&&state.origin==='scheduled'){
    setNotice({kind:'warning',message:'Já existe uma sincronização automática em andamento. O painel acompanhará o resultado.'});
    return;
   }
   let busyAttempts=0;
   while(state.status==='running'){
    if(stopRef.current){
     state=await syncRequest({action:'stop',id:state.id});
     break;
    }
    const next=await syncRequest({action:'batch',id:state.id});
    if(next.busy){
     if(++busyAttempts>40)throw Error('A sincronização permaneceu ocupada por muito tempo.');
     await new Promise(resolve=>setTimeout(resolve,1500));
     continue;
    }
    busyAttempts=0;state=next;
    setProgress({processed:state.processed,total:state.total});
   }
   setNotice({kind:state.status==='success'?'success':'warning',
    message:syncLabel(state.status)+': '+state.processed+' de '+state.total+
     ' produtos consultados, '+state.pricesUpdated+' preços, '+
     state.discountsFound+' descontos e '+state.newPhotos+
     ' fotos adicionadas.'+(state.errors?.length?' Avisos: '+state.errors.slice(0,2).join(' | '):'')});
   await onCompleted?.();
  }catch(error){
   setNotice({kind:'warning',message:String(error?.message||error)+
    ' Consulte o histórico para verificar os produtos que já foram atualizados.'});
  }finally{
   setRunning(null);setProgress(null);await refreshSyncHistory();
  }
 }

 async function execute(mode){
  if(running)return;
  const selected=mode==='publish'?inactive:needsDetails;
  if(!selected.length){
   setNotice({kind:'success',message:mode==='publish'?'Todos os produtos já estão ativos.':
     'Todos os produtos já possuem descrição e galeria com pelo menos duas imagens.'});
   return;
  }
  if(mode==='publish'&&!window.confirm(
    'Ativar '+selected.length+' produtos no site? Links sem Sub ID confirmado serão convertidos pela Shopee antes da publicação. Produtos duplicados ou com conversão recusada não serão ativados.'
  ))return;
  stopRef.current=false;
  setRunning(mode);setNotice(null);
  const stats={processed:0,total:selected.length,activated:0,alreadyActive:0,
   duplicates:0,invalidLinks:0,conversionErrors:0,
   matched:0,identified:0,fromPublicPage:0,sourceBlocked:0,
   descriptionsAdded:0,newPhotos:0,discountsFound:0,pricesUpdated:0,withoutExtraData:0,failed:0};
  let errors=[];
  const path=mode==='publish'?'/api/admin/products/publish-batch':'/api/admin/products/enrich-batch';
  const chunkSize=mode==='publish'?4:3;
  setProgress({...stats});
  for(let start=0;start<selected.length;start+=chunkSize){
   if(stopRef.current)break;
   const batch=selected.slice(start,start+chunkSize);
   try{
    const response=await fetch(path,{
     method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',
     body:JSON.stringify({ids:batch.map(item=>item.id)})
    });
    if(response.status===401){window.location.href='/adm/login';return}
    const data=await response.json();
    if(!response.ok)throw Error(data.error||'Falha ao processar lote.');
    stats.processed+=batch.length;
    for(const key of ['activated','alreadyActive','duplicates','invalidLinks','conversionErrors',
      'matched','identified','fromPublicPage','sourceBlocked',
      'descriptionsAdded','newPhotos','discountsFound','pricesUpdated','withoutExtraData']){
     stats[key]+=Number(data[key]||0);
    }
    errors.push(...(data.errors||[]).map(e=>e.reason||'Falha ao consultar o item.'));
   }catch(error){
    stats.failed+=batch.length;
    stats.processed+=batch.length;
    errors.push('Falha no lote: '+String(error?.message||'Erro'));
    // Pare em falhas de infraestrutura para evitar chamadas repetidas sem sucesso.
    setProgress({...stats});
    break;
   }
   setProgress({...stats});
  }
  setRunning(null);
  try{await onCompleted?.()}catch{}
  const terminated=stopRef.current;
  const headline=mode==='publish'?
   stats.activated+' produto(s) ativado(s) no site. '+
    (stats.duplicates+' duplicado(s), '+stats.conversionErrors+' conversão(ões) não confirmada(s).'):
   stats.identified+' ID(s) de anúncio identificado(s), '+stats.matched+
    ' produto(s) com dados adicionais encontrados ('+stats.fromPublicPage+
    ' via página pública); '+stats.descriptionsAdded+' descrição(ões) e '+
    stats.newPhotos+' foto(s) adicionada(s). '+stats.discountsFound+
    ' descontos confirmados e '+stats.pricesUpdated+' preços atualizados. '+
    stats.withoutExtraData+' anúncio(s) sem detalhes adicionais disponíveis.';
  setNotice({
   kind:errors.length||stats.failed?'warning':'success',
   message:headline+(terminated?' Interrompido após o lote atual.':'')+
    (errors.length?' Observações: '+[...new Set(errors)].slice(0,MAX_ERRORS).join(' | '):'')
  });
 }
 return <section className="vivi-catalog-bulk">
  <div className="vivi-catalog-bulk-head">
   <div><h3><ShieldCheck size={20}/> Publicação e informações dos produtos</h3>
    <p>Ative os produtos elegíveis e consulte preços, descontos, imagens e descrições disponíveis. Percentuais só são exibidos quando confirmados pela API.</p>
   </div>
   <div className="vivi-catalog-counts">
    <span><b>{offers.length}</b> cadastrados</span>
    <span><b>{inactive.length}</b> inativos</span>
   </div>
  </div>
  <div className="vivi-catalog-bulk-actions">
   <button type="button" className="btn btn-primary" disabled={Boolean(running)||!inactive.length}
    onClick={()=>execute('publish')}><Globe2 size={18}/> Ativar todos no site ({inactive.length})</button>
   <button type="button" className="btn btn-outline" disabled={Boolean(running)||!offers.length}
    onClick={forceSyncNow}><RefreshCw size={18}/> Forçar sincronização agora ({offers.length})</button>
   {running&&<button type="button" className="btn btn-outline" onClick={()=>{stopRef.current=true}}>
    <PauseCircle size={17}/> Parar após o lote
   </button>}
  </div>
  <div className="vivi-product-sync-status">
   <div className="vivi-product-sync-status-head">
    <strong><Clock3 size={18}/> Sincronização automática</strong>
    <button type="button" className="vivi-product-sync-status-refresh" onClick={async()=>{setStatusBusy(true);await refreshSyncHistory();setStatusBusy(false)}}
     disabled={statusBusy||Boolean(running)}><RefreshCw size={15}/> Atualizar status</button>
   </div>
   <p>Programada todos os dias às <b>08:00</b> e <b>20:00</b> (horário de Brasília).</p>
   {syncHistory?.running?<p className="vivi-product-sync-running">
    <RefreshCw size={15}/> Em andamento: {syncHistory.running.processed} de {syncHistory.running.total} produtos.
    Iniciada em {formatDate(syncHistory.running.startedAt)}.
   </p>:null}
   {syncHistory?.last?<div className="vivi-product-sync-summary">
    <span>Última execução: <b>{formatDate(syncHistory.last.finishedAt||syncHistory.last.startedAt)}</b></span>
    <span>Origem: <b>{syncHistory.last.origin==='scheduled'?'Automática':'Manual'}</b></span>
    <span>Resultado: <b>{syncLabel(syncHistory.last.status)}</b></span>
    <span>Produtos: <b>{syncHistory.last.processed}/{syncHistory.last.total}</b></span>
    <span>Preços atualizados: <b>{syncHistory.last.pricesUpdated}</b></span>
    <span>Descontos confirmados: <b>{syncHistory.last.discountsFound}</b></span>
    <span>Novas fotos: <b>{syncHistory.last.newPhotos}</b></span>
    {syncHistory.last.failed>0&&<span>Avisos: <b>{syncHistory.last.failed}</b></span>}
   </div>:<p className="vivi-product-sync-no-history">Ainda não há sincronização concluída registrada.</p>}
  </div>
  {running&&progress&&<div className="vivi-catalog-bulk-progress" role="status">
   <div><strong>{running==='publish'?'Publicando produtos':'Consultando a Shopee'}</strong>
    <span>{progress.processed} de {progress.total}</span></div>
   <progress value={progress.processed} max={progress.total||1}/>
  </div>}
  {notice&&<div role={notice.kind==='warning'?'alert':'status'}
   className={'vivi-notice '+(notice.kind==='warning'?'vivi-notice-error':'vivi-notice-success')}>
   {notice.kind==='warning'?<AlertCircle size={19}/>:<CheckCircle2 size={19}/>}
   <span>{notice.message}</span>
  </div>}
  <p className="vivi-catalog-bulk-note"><BookOpen size={15}/> A API de Afiliados geralmente oferece somente a imagem principal. Para obter uma descrição ou galeria ausente, abra o produto em Editar e informe o link original completo do anúncio. Não garantimos dados que a Shopee não disponibiliza; conteúdo manual não é apagado.</p>
 </section>;
}

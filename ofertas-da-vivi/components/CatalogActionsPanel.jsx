'use client';
import {useRef,useState} from 'react';
import {CheckCircle2,AlertCircle,Globe2,Images,BookOpen,PauseCircle,ShieldCheck} from 'lucide-react';

const MAX_ERRORS=5;

export default function CatalogActionsPanel({offers=[],onCompleted}){
 const [running,setRunning]=useState(null),[progress,setProgress]=useState(null),
  [notice,setNotice]=useState(null);
 const stopRef=useRef(false);
 const inactive=offers.filter(item=>!item.active);
 const needsDetails=offers.filter(item=>
  !item.description||!Array.isArray(item.images)||item.images.length<2||
  !item.discountCheckedAt||Date.now()-new Date(item.discountCheckedAt).getTime()>24*3600*1000
 );
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
   <button type="button" className="btn btn-outline" disabled={Boolean(running)||!needsDetails.length}
    onClick={()=>execute('enrich')}><Images size={18}/> Atualizar preços, descontos e fotos ({needsDetails.length})</button>
   {running&&<button type="button" className="btn btn-outline" onClick={()=>{stopRef.current=true}}>
    <PauseCircle size={17}/> Parar após o lote
   </button>}
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

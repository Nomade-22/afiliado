'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {FlaskConical,RefreshCw,ExternalLink,Images,FileText,
 CheckCircle2,AlertTriangle,Clock3,ShieldCheck,Eye,Info} from 'lucide-react';

const ACTIONS='https://github.com/Nomade-22/afiliado/actions/workflows/vivi-scrapling-test.yml';
const states={
 success:['Completo','good'],
 partial:['Parcial','warning'],
 unavailable:['Não encontrado','muted'],
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
 const report=data?.reports?.[0]||null;
 const byId=useMemo(()=>new Map((report?.results||[]).map(x=>[x.id,x])),[report]);
 const totals=useMemo(()=>{
  const items=report?.results||[];
  return {count:items.length,full:items.filter(x=>x.status==='success').length,
   partial:items.filter(x=>x.status==='partial').length,
   blocked:items.filter(x=>x.status==='blocked').length,
   photos:items.reduce((n,x)=>n+(x.images||[]).length,0),
   described:items.filter(x=>x.description?.trim()).length};
 },[report]);
 return <div className="vivi-scrapling-test">
  <section className="admin-card vivi-scrapling-intro">
   <div className="admin-card-title">
    <h2><FlaskConical size={22}/> Teste de importação Shopee — 10 produtos</h2>
   </div>
   <p>Testamos o <b>Scrapling com navegador Chromium</b> para tentar recuperar a descrição e fotos distintas diretamente dos anúncios públicos da Shopee.</p>
   <div className="vivi-scrapling-safety">
    <ShieldCheck size={19}/> <span><b>Ambiente de teste.</b> Os resultados ficam em uma tabela separada. Nenhum produto, foto, descrição, preço ou link de afiliado da loja é alterado.</span>
   </div>
   <div className="vivi-scrapling-actions">
    <button type="button" className="btn btn-outline" onClick={load} disabled={busy}>
     <RefreshCw size={17}/> {busy?'Consultando…':'Atualizar resultados'}
    </button>
    <a className="btn btn-primary" href={ACTIONS} target="_blank" rel="noopener noreferrer">
     <FlaskConical size={17}/> Executar novo teste no GitHub <ExternalLink size={14}/>
    </a>
   </div>
   <p className="vivi-scrapling-hint">Para repetir, abra o GitHub Actions, escolha <b>Run workflow</b> na branch principal e depois volte para atualizar os resultados. O primeiro teste também é disparado quando o workflow é publicado na branch principal.</p>
  </section>
  {error&&<div className="vivi-notice vivi-notice-error" role="alert"><AlertTriangle size={19}/>{error}</div>}
  {report?<section className="admin-card">
    <div className="vivi-scrapling-report-header">
     <div><h3>Último teste registrado</h3>
      <p><Clock3 size={15}/> {displayDate(report.finishedAt)} · Execução #{report.runId}</p>
     </div>
     <span className="vivi-scrapling-status">{report.status==='completed'?'Teste concluído':'Teste interrompido'}</span>
    </div>
    <div className="vivi-scrapling-stats">
     <div><strong>{totals.count}</strong><small>Consultados</small></div>
     <div><strong>{totals.full}</strong><small>Completos</small></div>
     <div><strong>{totals.partial}</strong><small>Parciais</small></div>
     <div><strong>{totals.described}</strong><small>Com descrição</small></div>
     <div><strong>{totals.photos}</strong><small>Imagens distintas</small></div>
     <div><strong>{totals.blocked}</strong><small>Bloqueados</small></div>
    </div>
    <p className="vivi-scrapling-hint">{report.notes}</p>
   </section>:<section className="admin-card vivi-scrapling-empty">
    <Clock3 size={32}/><h3>Aguardando o primeiro relatório</h3>
    <p>Os 10 anúncios aparecem abaixo. Quando a execução do GitHub Actions terminar, veja a comparação aqui. Nenhum dado será importado automaticamente.</p>
   </section>}
  <section className="admin-card">
   <div className="admin-card-title"><h2><Images size={21}/> Comparação dos 10 produtos</h2></div>
   {!data?.candidates?.length&&<p className="muted-text">Não foi possível identificar os anúncios elegíveis no banco.</p>}
   <div className="vivi-scrapling-grid">
    {(data?.candidates||[]).map((item,index)=>{
     const result=byId.get(item.id);
     const status=result?states[result.status]||states.error:null;
     const photos=result?.images||[];
     const description=result?.description||'';
     const showDescription=Boolean(expanded[item.id]);
     return <article key={item.id} className="vivi-scrapling-product">
      <header className="vivi-scrapling-product-head">
       <span className="vivi-scrapling-number">{index+1}/10</span>
       <span className={'vivi-scrapling-pill '+(status?.[1]||'muted')}>
        {status?status[0]:'Pendente'}
       </span>
      </header>
      <div className="vivi-scrapling-product-summary">
       <img src={item.cover||'/images/produto-1.webp'} alt="" loading="lazy"
        onError={e=>{e.currentTarget.src='/images/produto-1.webp'}}/>
       <div><h3>{item.title}</h3>
        <p>Antes: {item.descriptionChars} caracteres de descrição · {item.galleryCount} imagem(ns) cadastrada(s)</p>
       </div>
      </div>
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

'use client';

import {useEffect,useRef,useState} from 'react';
import {RefreshCw,Package,ExternalLink,AlertCircle,CheckCircle2,ChevronRight,ChevronLeft,CheckSquare,XCircle} from 'lucide-react';

const card={background:'#fff',border:'1px solid #eaeaf0',borderRadius:15,padding:'clamp(15px,3vw,23px)',marginBottom:16};
const orange={background:'#ff662f',color:'#fff',border:'none',borderRadius:10,padding:'12px 15px',fontWeight:750,cursor:'pointer',minHeight:43};
const outline={...orange,background:'#fff',border:'1px solid #e1e1e6',color:'#353547'};
const details={fontSize:13,color:'#717987',lineHeight:1.55};

export default function StorefrontPanel(){
 const [items,setItems]=useState([]);
 const [selected,setSelected]=useState([]);
 const [page,setPage]=useState(1);
 const [info,setInfo]=useState(null);
 const [busy,setBusy]=useState(false);
 const [importing,setImporting]=useState(false);
 const [progress,setProgress]=useState(null);
 const [message,setMessage]=useState(null);
 const [search,setSearch]=useState('');
 const cancelRef=useRef(false);

 async function fetchPage(next=1,{quiet=false}={}){
  setBusy(true);
  if(!quiet)setMessage(null);
  try{
   const response=await fetch('/api/admin/storefront?page='+next,{cache:'no-store'});
   if(response.status===401){window.location.href='/adm/login';return}
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'A vitrine não retornou produtos.');
   setItems(data.items||[]);
   setInfo(data);setPage(data.page||next);setSelected([]);
  }catch(error){
   if(!quiet){setInfo(null);setItems([]);setSelected([])}
   setMessage({error:true,text:String(error?.message||'Não foi possível carregar a vitrine.')});
  }finally{setBusy(false)}
 }
 useEffect(()=>{fetchPage(1)},[]);

 async function importItems(ids){
  const unique=[...new Set(ids)].filter(id=>{
   const item=items.find(x=>x.linkId===id);
   return item&&item.affiliateLinkEligible&&!item.imported;
  });
  if(!unique.length){setMessage({error:false,text:'Não há itens novos para importar nesta página.'});return}
  setImporting(true);cancelRef.current=false;setMessage(null);
  let added=0,skipped=0,failures=0,finished=0,partialError='';
  setProgress({done:0,total:unique.length,added:0,skipped:0});
  for(let i=0;i<unique.length;i+=8){
   if(cancelRef.current)break;
   const part=unique.slice(i,i+8);
   try{
    const response=await fetch('/api/admin/storefront/import',{
     method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({page,linkIds:part}),cache:'no-store'
    });
    if(response.status===401){window.location.href='/adm/login';return}
    const data=await response.json();
    if(!response.ok)throw Error(data.error||'Erro ao importar lote');
    added+=data.imported||0;
    skipped+=data.skipped||0;
    failures+=(data.errors||[]).length;
    const handled=new Set([...(data.importedIds||[]),...(data.skippedIds||[])]);
    setItems(current=>current.map(item=>handled.has(item.linkId)?{...item,imported:true}:item));
    setSelected(current=>current.filter(id=>!handled.has(id)));
    finished+=part.length;
    setProgress({done:finished,total:unique.length,added,skipped});
   }catch(error){
    partialError=String(error?.message||'Erro no processamento');
    break;
   }
  }
  setImporting(false);
  // Revalida no banco o que foi salvo, inclusive quando houve falha parcial.
  await fetchPage(page,{quiet:true});
  setMessage({
   error:!!partialError,
   text:`Importação finalizada: ${added} novo(s), ${skipped} já cadastrado(s)/ignorado(s).`+
    (failures?` ${failures} alerta(s) de link.`:'')+
    (cancelRef.current?' Operação interrompida após os lotes concluídos.':'')+
    (partialError?' Erro no lote seguinte: '+partialError:'')+
    ' Revise e ative os produtos na aba Ofertas.'
  });
 }
 function toggle(id,checked){setSelected(old=>checked?[...new Set([...old,id])]:old.filter(x=>x!==id))}
 const eligible=items.filter(x=>x.affiliateLinkEligible&&!x.imported);
 const already=items.filter(x=>x.imported).length;
 const filtered=items.filter(x=>x.title.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
 const selectedAvailable=selected.filter(id=>eligible.some(x=>x.linkId===id));

 return <div className="vivi-storefront">
  <section style={card}>
   <h2 className="vivi-storefront-title">🛍️ Minha Vitrine Shopee</h2>
   <p style={details}>Produtos da coleção pública <a href="https://collshp.com/perf.jaqueporto?view=storefront" target="_blank" rel="noopener noreferrer">perf.jaqueporto</a>. Os links são da vitrine da Vivi e os valores podem ser diferentes dos praticados na Shopee.</p>
   <div className="vivi-storefront-toolbar">
    <button style={orange} disabled={busy||importing} onClick={()=>fetchPage(page)}><RefreshCw size={16}/> {busy?'Buscando…':'Atualizar vitrine'}</button>
    {info&&<span style={details}><b>{info.profileName}</b> · {info.totalCount} links públicos</span>}
   </div>
   {info&&<p style={details}>{info.warning}</p>}
   {message&&<div role={message.error?'alert':'status'} className={'vivi-notice '+(message.error?'vivi-notice-error':'vivi-notice-success')}>
    {message.error?<AlertCircle size={19}/>:<CheckCircle2 size={19}/>} <span>{message.text}</span>
   </div>}
  </section>

  {info&&<section style={card}>
   <div className="vivi-storefront-heading">
    <h3>Produtos da vitrine · página {page}</h3>
    <span style={details}>{items.length} itens · {already} já cadastrados · {eligible.length} disponíveis</span>
   </div>
   <input className="vivi-storefront-search" value={search} onChange={e=>setSearch(e.target.value)}
    placeholder="Buscar nesta página..." aria-label="Pesquisar produtos da vitrine"/>
   <div className="vivi-storefront-toolbar">
    <button style={orange} disabled={busy||importing||!eligible.length} onClick={()=>importItems(eligible.map(x=>x.linkId))}>
     <Package size={17}/> Importar todos desta página ({eligible.length})
    </button>
    <button style={outline} disabled={busy||importing} onClick={()=>setSelected(eligible.map(x=>x.linkId))}>
     <CheckSquare size={17}/> Selecionar todos
    </button>
    <button style={outline} disabled={busy||importing||!selectedAvailable.length} onClick={()=>importItems(selectedAvailable)}>
     Importar selecionados ({selectedAvailable.length})
    </button>
    <button style={outline} disabled={importing||!selected.length} onClick={()=>setSelected([])}>Limpar</button>
   </div>
   {progress&&<div className="vivi-progress" role="status">
    <div className="vivi-progress-row"><strong>Importação: {progress.done} de {progress.total}</strong><span>{progress.added} novos · {progress.skipped} ignorados</span></div>
    <progress value={progress.done} max={progress.total||1}/>
    {importing&&<button style={{...outline,padding:8,fontSize:12}} onClick={()=>{cancelRef.current=true}}><XCircle size={15}/> Parar após o lote atual</button>}
   </div>}
   <p style={details}>A importação é feita automaticamente em lotes de 8. Produtos repetidos são ignorados, e os novos entram <b>inativos</b> para revisão. Os que a vitrine não informa preço continuam sem valor cadastrado.</p>
   {info.importedStatusAvailable===false&&<p className="vivi-notice vivi-notice-error">Não foi possível conferir duplicatas antecipadamente. O servidor ainda tentará impedir a inclusão de produtos já cadastrados.</p>}
   <div className="vivi-storefront-list">
    {filtered.map(item=><div key={item.id} className={'vivi-storefront-item '+(item.imported?'vivi-item-imported':'')}>
      <input type="checkbox" aria-label={'Selecionar '+item.title}
       disabled={importing||item.imported||!item.affiliateLinkEligible}
       checked={selected.includes(item.linkId)}
       onChange={e=>toggle(item.linkId,e.target.checked)}/>
      <img src={item.image||'/images/produto-1.webp'} alt="" loading="lazy"
       onError={e=>{e.currentTarget.src='/images/produto-1.webp'}}/>
      <div className="vivi-storefront-item-text">
       <strong>{item.title}</strong>
       <small>{item.category} · Preço na Shopee</small>
       {item.imported&&<span className="vivi-stored-badge"><CheckCircle2 size={13}/> Já cadastrado</span>}
       {!item.affiliateLinkEligible&&<span className="vivi-stored-badge vivi-warning-badge">Link não reconhecido</span>}
      </div>
      {item.affiliateLinkEligible&&<a href={item.url} target="_blank" rel="noopener noreferrer nofollow sponsored" aria-label={'Abrir '+item.title}><ExternalLink size={19}/></a>}
    </div>)}
    {filtered.length===0&&<p style={details}>Nenhum item encontrado nesta página.</p>}
   </div>
   <div className="vivi-storefront-pages">
    <button style={outline} disabled={busy||importing||page<=1} onClick={()=>{setSearch('');setProgress(null);fetchPage(page-1)}}><ChevronLeft size={16}/> Anterior</button>
    <b>Página {page} de {Math.max(1,Math.ceil((info.totalCount||0)/(info.pageSize||24)))}</b>
    <button style={outline} disabled={busy||importing||!info.hasNextPage} onClick={()=>{setSearch('');setProgress(null);fetchPage(page+1)}}>Próxima <ChevronRight size={16}/></button>
   </div>
  </section>}
 </div>;
}

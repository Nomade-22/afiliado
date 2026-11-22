'use client';

import {useEffect,useState} from 'react';
import {RefreshCw,Package,ExternalLink,AlertCircle,CheckCircle2,ChevronRight,ChevronLeft} from 'lucide-react';

const card={background:'#fff',border:'1px solid #eaeaf0',borderRadius:14,padding:18,marginBottom:16};
const orange={background:'#ff662f',color:'#fff',border:'none',borderRadius:9,padding:'12px 14px',fontWeight:700,cursor:'pointer'};
const outline={...orange,background:'#fff',border:'1px solid #dfdfdf',color:'#353547'};
const details={fontSize:13,color:'#777',lineHeight:1.55};

export default function StorefrontPanel(){
 const [items,setItems]=useState([]);
 const [selected,setSelected]=useState([]);
 const [page,setPage]=useState(1);
 const [info,setInfo]=useState(null);
 const [busy,setBusy]=useState(false);
 const [importing,setImporting]=useState(false);
 const [message,setMessage]=useState(null);
 const [search,setSearch]=useState('');

 async function fetchPage(next=1){
  setBusy(true);setMessage(null);
  try{
   const response=await fetch('/api/admin/storefront?page='+next,{cache:'no-store'});
   if(response.status===401){window.location.href='/adm/login';return}
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'A vitrine não retornou produtos.');
   setItems(data.items||[]);
   setInfo(data);
   setPage(data.page||next);
   setSelected([]);
  }catch(error){
   setInfo(null);setItems([]);setSelected([]);
   setMessage({error:true,text:String(error?.message||'Não foi possível carregar a vitrine.')});
  }finally{setBusy(false)}
 }
 useEffect(()=>{fetchPage(1)},[]);
 async function importSelected(){
  if(!selected.length||selected.length>8)return;
  setImporting(true);setMessage(null);
  try{
   const response=await fetch('/api/admin/storefront/import',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({page,linkIds:selected}),cache:'no-store'
   });
   if(response.status===401){window.location.href='/adm/login';return}
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'A importação da vitrine falhou.');
   setMessage({error:false,text:data.message+(data.warnings?.length?' Atenção: '+data.warnings.length+' link(s) mantidos sem conversão completa.':'')});
   setSelected([]);
  }catch(error){setMessage({error:true,text:String(error?.message||error)})}
  finally{setImporting(false)}
 }
 function toggle(id,checked){setSelected(old=>checked?[...old,id]:old.filter(x=>x!==id))}
 const filtered=items.filter(x=>x.title.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
 const ready=filtered.filter(x=>x.affiliateLinkEligible);
 return <div>
  <section style={card}>
   <h2 style={{fontSize:23,margin:'0 0 9px'}}>🛍️ Minha Vitrine Shopee</h2>
   <p style={details}>Tentativa de leitura da coleção pública <a href="https://collshp.com/perf.jaqueporto?view=storefront" target="_blank" rel="noopener noreferrer">perf.jaqueporto</a>. É uma API diferente da Open API de Afiliados e pode mudar sem aviso.</p>
   <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginTop:14}}>
    <button style={orange} disabled={busy} onClick={()=>fetchPage(page)}><RefreshCw size={16} style={{verticalAlign:'middle'}}/> {busy?'Buscando…':'Atualizar minha vitrine'}</button>
    {info&&<span style={details}>Perfil: <b>{info.profileName}</b> · Links públicos: <b>{info.totalCount}</b></span>}
   </div>
   {info&&<p style={details}>{info.warning}</p>}
   {message&&<div role={message.error?'alert':undefined} style={{marginTop:15,padding:14,borderRadius:10,background:message.error?'#fff0eb':'#edf8f0',color:message.error?'#ac381f':'#126f42',lineHeight:1.5}}>
     {message.error?<AlertCircle size={18} style={{verticalAlign:'middle'}}/>:<CheckCircle2 size={18} style={{verticalAlign:'middle'}}/>} {message.text}
   </div>}
  </section>
  {info&&<section style={card}>
   <div style={{display:'flex',justifyContent:'space-between',gap:9,alignItems:'center',flexWrap:'wrap'}}>
    <h3 style={{fontSize:19,margin:0}}>Produtos da vitrine · página {page}</h3>
    <span style={details}>{selected.length} selecionado(s) de no máximo 8</span>
   </div>
   <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar nesta página..." aria-label="Pesquisar produtos da vitrine" style={{border:'1px solid #ddd',borderRadius:9,padding:12,width:'100%',boxSizing:'border-box',margin:'14px 0'}}/>
   <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',marginBottom:12}}>
    <button disabled={importing||selected.length===0||selected.length>8} style={{...orange,opacity:selected.length===0?0.55:1}} onClick={importSelected}><Package size={16} style={{verticalAlign:'middle'}}/> Importar {selected.length} da vitrine</button>
    <button style={outline} onClick={()=>setSelected(ready.slice(0,8).map(x=>x.linkId))}>Selecionar até 8 válidos</button>
    <button style={outline} onClick={()=>setSelected([])}>Limpar</button>
   </div>
   <p style={{...details,marginBottom:14}}>Os produtos serão importados como <b>inativos</b>, sem inventar preços. Você poderá revisar e ativar no catálogo depois.</p>
   <div style={{display:'grid',gap:10}}>
    {filtered.map(item=><div key={item.id} style={{border:'1px solid #eaeaea',borderRadius:12,padding:12,display:'flex',alignItems:'center',gap:12}}>
      <input type="checkbox" aria-label={'Selecionar '+item.title} disabled={!item.affiliateLinkEligible} checked={selected.includes(item.linkId)} onChange={e=>toggle(item.linkId,e.target.checked)}/>
      <img src={item.image||'/images/produto-1.webp'} alt="" loading="lazy" style={{width:74,height:74,objectFit:'contain',background:'#f7f7f7',borderRadius:8}}/>
      <div style={{minWidth:0,flex:1}}>
       <strong style={{fontSize:14,overflowWrap:'anywhere'}}>{item.title}</strong>
       <p style={{...details,margin:'5px 0'}}>{item.category} · Preço não informado pela vitrine</p>
       {!item.affiliateLinkEligible&&<small style={{color:'#aa462b'}}>Link não reconhecido como URL da Shopee</small>}
      </div>
      {item.affiliateLinkEligible&&<a href={item.url} target="_blank" rel="noopener noreferrer nofollow sponsored" aria-label={'Abrir '+item.title}><ExternalLink size={18}/></a>}
    </div>)}
    {filtered.length===0&&<p style={{color:'#777'}}>Nenhum item nesta página ou filtro.</p>}
   </div>
   <div style={{display:'flex',gap:12,alignItems:'center',justifyContent:'center',flexWrap:'wrap',marginTop:18}}>
     <button style={outline} disabled={busy||page<=1} onClick={()=>{setSearch('');fetchPage(page-1)}}><ChevronLeft size={16} style={{verticalAlign:'middle'}}/> Anterior</button>
     <b>Página {page}</b>
     <button style={outline} disabled={busy||!info.hasNextPage} onClick={()=>{setSearch('');fetchPage(page+1)}}>Próxima <ChevronRight size={16} style={{verticalAlign:'middle'}}/></button>
   </div>
  </section>}
 </div>;
}

'use client';
import {useMemo,useState} from 'react';
import {Link2,ClipboardCopy,ExternalLink,ShieldCheck,AlertCircle,CheckCircle2,RotateCcw} from 'lucide-react';

const channels=[
 ['site','Site Ofertas da Vivi'],
 ['whatsapp','WhatsApp'],
 ['instagram','Instagram'],
 ['tiktok','TikTok'],
 ['telegram','Telegram'],
 ['outros','Outros']
];
const cont={background:'#fff',border:'1px solid #eee',borderRadius:16,padding:22,maxWidth:840,boxShadow:'0 4px 16px #00000008'};
const input={border:'1px solid #dedee4',borderRadius:9,padding:'12px 13px',fontSize:15,width:'100%',boxSizing:'border-box'};
const btn={border:0,borderRadius:9,padding:'12px 17px',fontSize:15,fontWeight:700,color:'#fff',background:'#f25d26',cursor:'pointer'};

const parseItemId=url=>{
 try{
  const u=new URL(url), a=u.pathname.match(/\/product\/\d+\/(\d+)/),
    b=u.pathname.match(/-i\.\d+\.(\d+)/);
  return (a||b)?.[1]||'';
 }catch{return ''}
};
export default function AffiliateLinksPanel({initialUrl='',initialItemId=''}) {
 const [originUrl,setOriginUrl]=useState(initialUrl);
 const [channel,setChannel]=useState('site');
 const [custom,setCustom]=useState(['','']);
 const [useDefaults,setUseDefaults]=useState(true);
 const [customMode,setCustomMode]=useState(false);
 const [manualSubIds,setManualSubIds]=useState(['vivi','site','','','']);
 const [result,setResult]=useState(null);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const [copied,setCopied]=useState(false);
 const itemId=useMemo(()=>initialItemId||parseItemId(originUrl),[initialItemId,originUrl]);
 const autoIds=useMemo(()=>['vivi',channel,itemId?'produto_'+itemId:null,...custom.filter(Boolean)].filter(Boolean).slice(0,5),[channel,itemId,custom]);
 const ids=customMode?manualSubIds.filter(Boolean):autoIds;

 async function generate(){
  setBusy(true);setError('');setResult(null);setCopied(false);
  try{
   const response=await fetch('/api/admin/shopee/link',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({originUrl,subIds:ids}),cache:'no-store'
   });
   if(response.status===401){window.location.href='/adm/login';return}
   const json=await response.json();
   if(!response.ok)throw Error(json.error||'Falha ao gerar link de afiliado');
   setResult(json);
  }catch(e){setError(e?.message||'Falha ao gerar link')}
  finally{setBusy(false)}
 }
 async function copy(){
  if(!result)return;
  try{await navigator.clipboard.writeText(result.link);setCopied(true)}
  catch{setError('Não foi possível copiar automaticamente. Segure o link abaixo para copiar.')}
 }
 return <section style={cont}>
  <div style={{display:'flex',alignItems:'center',gap:9}}>
    <Link2 size={24} color="#e95922"/><h2 style={{fontSize:24,margin:'0'}}>Gerador de links Shopee</h2>
  </div>
  <p style={{color:'#747986',lineHeight:1.65}}>Converta uma URL de produto ou loja em um link da <b>sua conta de afiliado</b> usando a Open API. Você pode gerar um link diferente para cada canal e comparar as conversões por Sub ID.</p>
  <label style={{fontWeight:700,fontSize:14}}>Link original da Shopee</label>
  <input style={{...input,margin:'9px 0 17px'}} type="url" value={originUrl}
   onChange={e=>{setOriginUrl(e.target.value);setResult(null)}} placeholder="https://shopee.com.br/product/..." autoComplete="off"/>
  <label style={{fontWeight:700,fontSize:14}}>Canal onde será compartilhado</label>
  <select style={{...input,margin:'9px 0 17px'}} value={channel} onChange={e=>{setChannel(e.target.value);setResult(null)}} disabled={customMode}>
   {channels.map(([value,label])=><option key={value} value={value}>{label}</option>)}
  </select>
  <label style={{display:'flex',alignItems:'center',gap:8,fontWeight:700,fontSize:14,marginBottom:12}}>
   <input type="checkbox" checked={customMode} onChange={e=>setCustomMode(e.target.checked)}/>
   Personalizar os 5 Sub IDs manualmente
  </label>
  {customMode?<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10,marginBottom:14}}>
    {manualSubIds.map((value,i)=><label key={i} style={{fontSize:12,color:'#777'}}>Sub ID {i+1}<input style={{...input,marginTop:4,padding:10}} maxLength={40} value={value} onChange={e=>setManualSubIds(prev=>prev.map((v,j)=>j===i?e.target.value:v))}/></label>)}
   </div>:
   <div style={{marginBottom:14}}>
     <label style={{fontWeight:700,fontSize:14}}>Identificadores adicionais (opcionais)</label>
     <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,marginTop:8}}>
      {custom.map((value,i)=><input key={i} style={input} maxLength={40} placeholder={i===0?'Ex.: campanha_blackfriday':'Ex.: banner_home'} value={value} onChange={e=>setCustom(prev=>prev.map((v,j)=>j===i?e.target.value:v))}/>)}
     </div>
   </div>}
  <div style={{background:'#fff7f2',borderRadius:10,padding:14,marginBottom:17}}>
   <b style={{fontSize:13}}>Sub IDs enviados à Shopee</b>
   <div style={{display:'flex',flexWrap:'wrap',gap:7,marginTop:9}}>
    {ids.length?ids.map((id,i)=><code key={i} style={{background:'#fff',border:'1px solid #ffd8c2',borderRadius:7,padding:'7px 9px',fontSize:12,overflowWrap:'anywhere'}}>{id}</code>):<small>Nenhum Sub ID</small>}
   </div>
  </div>
  <button style={{...btn,opacity:busy?.5:1}} onClick={generate} disabled={busy||!originUrl.trim()}>{busy?'Gerando link…':'Gerar meu link de afiliado'}</button>
  {error&&<p role="alert" style={{color:'#a83b28',marginTop:12}}><AlertCircle size={16} style={{verticalAlign:'middle'}}/> {error}</p>}
  {result&&<div style={{marginTop:19,background:'#edf9ef',border:'1px solid #b4e3c0',borderRadius:12,padding:16}}>
    <p style={{marginTop:0,color:'#157644',fontWeight:800}}><CheckCircle2 size={18} style={{verticalAlign:'middle'}}/> Link criado pela API Shopee</p>
    <a href={result.link} target="_blank" rel="noopener noreferrer nofollow sponsored" style={{display:'block',wordBreak:'break-all',color:'#19764a',marginBottom:14}}>{result.link}</a>
    <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
      <button style={{...btn,background:'#159b55'}} onClick={copy}><ClipboardCopy size={16} style={{verticalAlign:'middle'}}/> {copied?'Copiado!':'Copiar link'}</button>
      <a href={result.link} target="_blank" rel="noopener noreferrer nofollow sponsored" style={{...btn,background:'#344359',textDecoration:'none'}}><ExternalLink size={16} style={{verticalAlign:'middle'}}/> Abrir link</a>
    </div>
   </div>}
  <p style={{fontSize:12,color:'#888',lineHeight:1.6,marginTop:18}}><ShieldCheck size={14} style={{verticalAlign:'middle'}}/> Sua chave secreta não sai do servidor. Links gerados nesta tela podem ser compartilhados imediatamente, sem depender do Neon. Sub IDs não garantem que uma venda seja atribuída; a Shopee faz a apuração oficial.</p>
 </section>;
}

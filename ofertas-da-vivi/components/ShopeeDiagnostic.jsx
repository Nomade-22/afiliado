'use client';

import {useState} from 'react';

const panel={maxWidth:800,margin:'24px auto',padding:'0 16px',fontFamily:'Arial, sans-serif',color:'#252536'};
const card={background:'#fff',padding:24,border:'1px solid #eee',borderRadius:16,boxShadow:'0 5px 20px #0000000c'};
const input={display:'block',width:'100%',boxSizing:'border-box',fontSize:16,padding:'14px 12px',margin:'12px 0',borderRadius:10,border:'1px solid #ddd'};
const button={border:0,borderRadius:10,background:'#f45a27',color:'#fff',fontWeight:700,padding:'13px 20px',cursor:'pointer',fontSize:15};
const secondary={...button,background:'#333b4a'};

export default function ShopeeDiagnostic() {
  const [keyword,setKeyword]=useState('sandalia feminina');
  const [busy,setBusy]=useState(false);
  const [report,setReport]=useState(null);
  const [copied,setCopied]=useState(false);
  const [err,setErr]=useState('');

  async function test() {
    setBusy(true);setReport(null);setErr('');setCopied(false);
    try {
      const response=await fetch('/api/admin/shopee/diagnostic',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({keyword}),cache:'no-store'
      });
      if(response.status===401){window.location.href='/adm/login';return}
      const json=await response.json();
      setReport(json);
    } catch(error) {
      setErr('Falha ao executar o teste: '+(error?.message||'erro desconhecido'));
    } finally {setBusy(false)}
  }
  async function copyReport() {
    if(!report) return;
    const text=JSON.stringify(report,null,2);
    try {await navigator.clipboard.writeText(text);setCopied(true)}
    catch {setErr('Não foi possível copiar automaticamente. Selecione o relatório abaixo e copie pelo navegador.')}
  }

  return <main style={panel}>
    <p><a href="/adm" style={{color:'#dc4e25',fontWeight:700,textDecoration:'none'}}>← Voltar ao painel ADM</a></p>
    <section style={card}>
      <div style={{fontSize:13,color:'#888'}}>Ofertas da Vivi · Área protegida</div>
      <h1 style={{fontSize:27,margin:'12px 0'}}>🔌 Teste da API Shopee</h1>
      <p style={{lineHeight:1.6}}>Teste a busca de até 3 produtos diretamente na API de afiliados. <strong>Não depende do banco Neon</strong> e não envia App ID, Secret ou DATABASE_URL ao navegador.</p>
      <label htmlFor="keyword" style={{fontWeight:700}}>Produto para pesquisar</label>
      <input id="keyword" style={input} value={keyword} onChange={e=>setKeyword(e.target.value)} maxLength={70} placeholder="Ex.: sandalia feminina"/>
      <button onClick={test} disabled={busy} style={{...button,opacity:busy?.6:1}}>{busy?'Consultando…':'Testar API e buscar produtos'}</button>
      {err&&<p role="alert" style={{color:'#c23925'}}>{err}</p>}
      {report&&<>
        <div style={{marginTop:20,padding:14,borderRadius:10,background:report.status==='ok'?'#eaf7ee':'#fff2e9'}}>
          <strong>Resultado: {report.status==='ok'?'✅ Conexão realizada':report.status==='not_configured'?'⚠️ Faltam credenciais na Vercel':'⚠️ '+report.status}</strong>
          <p style={{marginBottom:0}}>{report.message}</p>
          {typeof report.returnedCount==='number'&&<p>Produtos encontrados nesta página: <strong>{report.returnedCount}</strong></p>}
        </div>
        {Array.isArray(report.sampleProducts)&&report.sampleProducts.length>0&&<div style={{display:'grid',gap:10,marginTop:14}}>
          {report.sampleProducts.map((p,i)=><div key={i} style={{border:'1px solid #eee',borderRadius:10,padding:12}}>
            <b>{p.productName||'Produto sem nome'}</b>
            <p style={{fontSize:14}}>Preço: {p.priceMin||'—'} · Loja: {p.shopName||'—'}</p>
            {p.imageUrl&&<img alt={p.productName||'Produto'} src={p.imageUrl} loading="lazy" style={{width:100,height:100,objectFit:'contain'}}/>}
          </div>)}
        </div>}
        <h2 style={{fontSize:20,marginTop:20}}>Relatório para análise</h2>
        <p style={{lineHeight:1.6}}>Use o botão abaixo e cole o texto na nossa conversa. O relatório inclui somente dados de produtos e erros da consulta, <strong>sem as chaves secretas</strong>.</p>
        <button onClick={copyReport} style={secondary}>{copied?'✓ Copiado!':'📋 Copiar relatório para o ChatGPT'}</button>
        <pre style={{background:'#111827',color:'#e5e7eb',padding:16,borderRadius:10,whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:12,lineHeight:1.5,marginTop:12}}>{JSON.stringify(report,null,2)}</pre>
      </>}
    </section>
    <p style={{fontSize:13,color:'#757580',lineHeight:1.5,marginTop:18}}>Teste restrito ao login administrativo. Se a Shopee retornar um erro de autorização, confirme que o App ID e o Secret pertencem à Open API de Afiliados.</p>
  </main>;
}

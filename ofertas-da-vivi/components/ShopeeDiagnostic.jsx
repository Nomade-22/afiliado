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
  const [schemaReport,setSchemaReport]=useState(null);
  const [schemaBusy,setSchemaBusy]=useState(false);
  const [schemaError,setSchemaError]=useState('');
  const [schemaCopied,setSchemaCopied]=useState(false);
  const [feedDetails,setFeedDetails]=useState(null);
  const [feedBusy,setFeedBusy]=useState(false);
  const [feedError,setFeedError]=useState('');
  const [feedCopied,setFeedCopied]=useState(false);

  async function inspectStorefront(){
    setSchemaBusy(true);setSchemaReport(null);setSchemaError('');setSchemaCopied(false);
    try {
      const response=await fetch('/api/admin/shopee/storefront-schema',{
        method:'POST',cache:'no-store'
      });
      if(response.status===401){window.location.href='/adm/login';return;}
      const payload=await response.json();
      setSchemaReport(payload);
    }catch(error){setSchemaError('Falha no teste: '+String(error?.message||'erro de conexão'));}
    finally{setSchemaBusy(false);}
  }
  async function inspectFeeds(){
    setFeedBusy(true);setFeedDetails(null);setFeedError('');setFeedCopied(false);
    try{
      const response=await fetch('/api/admin/shopee/storefront-details',{method:'POST',cache:'no-store'});
      if(response.status===401){window.location.href='/adm/login';return}
      const json=await response.json();
      setFeedDetails(json);
    }catch(error){setFeedError(String(error?.message||'Erro ao consultar estrutura dos feeds'))}
    finally{setFeedBusy(false)}
  }
  async function copyFeedDetails(){
    if(!feedDetails)return;
    try{
      await navigator.clipboard.writeText(JSON.stringify(feedDetails,null,2));
      setFeedCopied(true);
    }catch{setFeedError('Selecione o texto do relatório para copiar manualmente.')}
  }
  async function copySchema(){
    if(!schemaReport)return;
    try{
      await navigator.clipboard.writeText(JSON.stringify(schemaReport,null,2));
      setSchemaCopied(true);
    }catch{setSchemaError('Selecione e copie o relatório exibido abaixo.');}
  }

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
    <section style={{...card,marginTop:20}}>
      <h2 style={{fontSize:22,marginTop:0}}>🛍️ Minha Vitrine Shopee — verificar API</h2>
      <p style={{lineHeight:1.5}}>Perfil informado: <a href="https://collshp.com/perf.jaqueporto?view=storefront" target="_blank" rel="noopener noreferrer" style={{color:'#d9511f'}}>collshp.com/perf.jaqueporto</a></p>
      <p style={{lineHeight:1.6}}>A busca comum de produtos não acessa sua seleção da Vitrine do Afiliado. Este teste consulta somente os nomes das operações GraphQL disponíveis em sua conexão, para descobrir se há alguma operação de vitrine ou coleção. Não depende do Neon.</p>
      <button onClick={inspectStorefront} disabled={schemaBusy} style={button}>{schemaBusy?'Consultando operações…':'Verificar operações de vitrine'}</button>
      {schemaError&&<p role="alert" style={{color:'#c23925'}}>{schemaError}</p>}
      {schemaReport&&<>
       <p style={{color:schemaReport.status==='ok'?'#176b43':'#b14825',fontWeight:700}}>{schemaReport.message}</p>
       <p style={{lineHeight:1.55}}>{schemaReport.interpretation||'A API não disponibilizou o catálogo de operações nesta consulta.'}</p>
       {Array.isArray(schemaReport.possibleStorefrontQueries)&&<p><b>Possíveis operações relacionadas:</b> {schemaReport.possibleStorefrontQueries.length?schemaReport.possibleStorefrontQueries.join(', '):'Nenhuma identificada'}</p>}
       <button onClick={copySchema} style={secondary}>{schemaCopied?'✓ Relatório copiado':'📋 Copiar relatório de operações'}</button>
       <pre style={{background:'#111827',color:'#e5e7eb',padding:16,borderRadius:10,whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:12,lineHeight:1.5,marginTop:12}}>{JSON.stringify(schemaReport,null,2)}</pre>
      </>}
      <hr style={{border:0,borderTop:'1px solid #eee',margin:'23px 0'}}/>
      <h3 style={{fontSize:18,margin:'0 0 10px'}}>Investigar listItemFeeds e getItemFeedData</h3>
      <p style={{lineHeight:1.6}}>Seu primeiro relatório encontrou essas duas consultas. Agora podemos ver quais parâmetros exigem e quais tipos retornam. Isso não significa que elas consultem a vitrine personalizada.</p>
      <button onClick={inspectFeeds} disabled={feedBusy} style={button}>{feedBusy?'Analisando estrutura…':'Ver parâmetros dos feeds'}</button>
      {feedError&&<p role="alert" style={{color:'#bb4325'}}>{feedError}</p>}
      {feedDetails&&<>
        <p style={{color:feedDetails.status==='ok'?'#167544':'#ab492c',fontWeight:700}}>{feedDetails.message}</p>
        {Array.isArray(feedDetails.operations)&&<div style={{display:'grid',gap:10,marginBottom:14}}>
          {feedDetails.operations.map(op=><div key={op.name} style={{border:'1px solid #eee',padding:12,borderRadius:10}}>
            <b>{op.name}</b><p style={{color:'#666',fontSize:13}}>{op.description||'Sem descrição disponibilizada'}</p>
            <small>Argumentos: {(op.args||[]).map(arg=>arg.name+': '+(arg.type?.name||'desconhecido')).join(', ')||'Nenhum'}</small>
          </div>)}
        </div>}
        <button onClick={copyFeedDetails} style={secondary}>{feedCopied?'✓ Copiado':'📋 Copiar detalhes da API'}</button>
        <pre style={{background:'#111827',color:'#e5e7eb',padding:16,borderRadius:10,whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:12,lineHeight:1.5,marginTop:12}}>{JSON.stringify(feedDetails,null,2)}</pre>
      </>}
    </section>
    <p style={{fontSize:13,color:'#757580',lineHeight:1.5,marginTop:18}}>Testes restritos ao login administrativo. A consulta de operações não confirma acesso à vitrine até validarmos uma operação específica.</p>
  </main>;
}

'use client';

import {useEffect,useState} from 'react';

const card={background:'#fff',padding:24,border:'1px solid #e8e8e8',borderRadius:16,maxWidth:780,margin:'20px auto',color:'#2b2935'};
const list={display:'flex',justifyContent:'space-between',gap:15,padding:'12px 0',borderBottom:'1px solid #eee'};

export default function DatabaseDiagnostic(){
 const [report,setReport]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function test(){
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/admin/database-health',{cache:'no-store'});
   if(response.status===401){window.location.href='/adm/login';return}
   const payload=await response.json();
   if(!response.ok)throw Error(payload.error||'Não foi possível consultar o banco.');
   setReport(payload);
  }catch(e){setReport(null);setError(String(e.message||e))}
  finally{setBusy(false)}
 }
 useEffect(()=>{test()},[]);
 const checks=report?.checks||{};
 const items=[
  ['DATABASE_URL presente',checks.present],
  ['Endereço do Neon',checks.looksLikeNeon],
  ['Usuário neondb_owner',checks.roleMatches],
  ['Banco neondb',checks.databaseMatches],
  ['URL de conexão válida',checks.urlFormatValid],
  ['Conexão com pooler',checks.pooled]
 ];
 return <main style={{padding:'20px 14px',background:'#f7f7f9',minHeight:'100vh',fontFamily:'Arial,sans-serif'}}>
  <div style={card}>
   <a href="/adm" style={{textDecoration:'none',color:'#e65c28',fontWeight:700}}>← Voltar ao ADM</a>
   <h1 style={{fontSize:25,marginTop:22}}>Diagnóstico da conexão Neon</h1>
   <p style={{lineHeight:1.6,color:'#666'}}>Teste somente leitura. Os valores de senha, endereço completo, tokens e segredos não aparecem neste relatório.</p>
   <button onClick={test} disabled={busy} style={{background:'#ed5c29',color:'white',border:0,borderRadius:10,padding:'12px 18px',fontWeight:700,cursor:'pointer'}}>{busy?'Verificando conexão…':'Testar novamente'}</button>
   {error&&<p role="alert" style={{color:'#b53421'}}>{error}</p>}
   {report&&<>
    <div style={{marginTop:18,padding:16,background:report.connected?'#e8f6ed':'#fff0e8',borderRadius:12}}>
     <b style={{fontSize:18}}>{report.connected?'✅ Conexão OK':'⚠️ Falha identificada: '+report.code}</b>
     <p style={{lineHeight:1.6,marginBottom:0}}>{report.message}</p>
    </div>
    <h2 style={{fontSize:18,marginTop:23}}>Verificações seguras</h2>
    {items.map(([name,value])=><div key={name} style={list}>
     <span>{name}</span><strong style={{color:value===true?'#168248':value===false?'#b44932':'#7a7a7a'}}>{value===true?'✓ Sim':value===false?'✕ Não':'Não avaliado'}</strong>
    </div>)}
    {checks.passwordPlaceholder&&<p style={{fontWeight:700,color:'#ba3d25'}}>A senha cadastrada parece conter asteriscos em vez da senha real!</p>}
    {typeof report.count==='number'&&<p><b>Ofertas cadastradas:</b> {report.count}</p>}
    <p style={{color:'#777',fontSize:13,lineHeight:1.6}}>Se houver falha de autenticação, acesse Neon → Connect e obtenha a conexão completa; atualize a variável DATABASE_URL na Vercel para Production e publique novamente.</p>
    <button onClick={()=>navigator.clipboard.writeText(JSON.stringify({connected:report.connected,code:report.code,checks:report.checks,message:report.message,count:report.count??null},null,2))} style={{border:'1px solid #ccc',borderRadius:9,background:'#fff',padding:'11px 15px',cursor:'pointer'}}>Copiar diagnóstico sem senhas</button>
   </>}
  </div>
 </main>;
}

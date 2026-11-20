'use client';
import {useEffect,useState} from 'react';
import {RefreshCw,ShoppingBag,ReceiptText,MousePointerClick,Wallet,ChartNoAxesCombined,AlertCircle,FileDown,CheckCircle2,ExternalLink} from 'lucide-react';

const brl=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const date=s=>s?new Date(Number(s)*1000).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}):'—';
const panel={background:'#fff',padding:'22px',borderRadius:16,border:'1px solid #e9e9e9',marginBottom:16};
const action={border:'1px solid #e6602d',padding:'11px 15px',borderRadius:10,background:'#fff',color:'#df4a15',cursor:'pointer',fontWeight:700};
const dataBox={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginBottom:17};
const metric={borderRadius:12,background:'#fbf6f3',padding:15,display:'flex',flexDirection:'column',gap:8};
const btn={...action,background:'#f45b24',color:'white',border:0};
const statusNames={UNPAID:'Não pago',PENDING:'Pendente',COMPLETED:'Concluído',CANCELLED:'Cancelado',OTHER:'Outros'};
function KeyValue({name,value,small}){return <div style={metric}><span style={{color:'#7b7e88',fontSize:13}}>{name}</span><b style={{fontSize:small?18:23}}>{value}</b></div>}
function CsvDownload({report}){
 function download(){
  const rows=[['Conversão','Pedido','Data','Status','Produto','Qtd.','Valor aproximado','Comissão estimada','Sub ID','Dispositivo']];
  for(const o of report.conversionsList||[]) rows.push([o.conversionId,o.orderId,date(o.purchaseTime),o.status,o.firstProduct,o.itemsCount,o.valueApprox,o.commission,o.source,o.device]);
  const csv='\uFEFF'+rows.map(row=>row.map(value=>'"'+String(value??'').replaceAll('"','""')+'"').join(';')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='ofertas-da-vivi-conversoes.csv';a.click();URL.revokeObjectURL(url);
 }
 return <button onClick={download} style={action}><FileDown size={16} style={{verticalAlign:'middle'}}/> Exportar CSV</button>;
}

export default function SalesPanel(){
 const [days,setDays]=useState(30),[busy,setBusy]=useState(false);
 const [report,setReport]=useState(null),[error,setError]=useState('');
 const [validationId,setValidationId]=useState(''),[validated,setValidated]=useState(null),[valBusy,setValBusy]=useState(false),[valError,setValError]=useState('');
 async function load(period=days){
  setBusy(true);setError('');
  try{
   const r=await fetch('/api/admin/analytics?days='+encodeURIComponent(period),{cache:'no-store'});
   if(r.status===401){window.location.href='/adm/login';return}
   const d=await r.json();
   if(!r.ok)throw Error(d.error||'Falha ao consultar o relatório.');
   setReport(d);
  }catch(err){setReport(null);setError(err.message)}
  finally{setBusy(false)}
 }
 useEffect(()=>{load(30)},[]);
 async function getValidated(){
  setValBusy(true);setValError('');setValidated(null);
  try{
   const r=await fetch('/api/admin/analytics/validated',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({validationId})});
   if(r.status===401){window.location.href='/adm/login';return}
   const d=await r.json();
   if(!r.ok)throw Error(d.error||'Erro na consulta de validação');
   setValidated(d.report);
  }catch(e){setValError(e.message)}finally{setValBusy(false)}
 }
 const summary=report||{};
 const st=summary.statusCounts||{};
 return <div style={{maxWidth:1140}}>
  <section style={panel}>
   <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:14,flexWrap:'wrap'}}>
    <div><div style={{fontSize:13,color:'#888'}}>Dados da conta de afiliado · Shopee Open API</div><h2 style={{fontSize:23,margin:'7px 0 3px'}}>Vendas e comissões</h2></div>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
     <select aria-label="Período de vendas" style={{...action,color:'#222'}} value={days} onChange={e=>{const n=Number(e.target.value);setDays(n);load(n)}}>
      <option value={7}>Últimos 7 dias</option>
      <option value={30}>Últimos 30 dias</option>
      <option value={60}>Últimos 60 dias</option>
      <option value={89}>Últimos 89 dias</option>
     </select>
     <button style={btn} disabled={busy} onClick={()=>load()}><RefreshCw size={16} style={{verticalAlign:'middle'}}/> {busy?'Consultando…':'Atualizar'}</button>
     {report&&<CsvDownload report={report}/>}
    </div>
   </div>
   <p style={{fontSize:13,color:'#84858d',lineHeight:1.5}}>Conversões consultadas diretamente na Shopee. Os dados podem sofrer atraso, cancelamento e validação posterior. Não há necessidade do banco Neon para consultar vendas.</p>
   {error&&<div role="alert" style={{borderRadius:10,background:'#fff1ea',color:'#a63213',padding:14,marginTop:15}}>
    <AlertCircle size={18} style={{verticalAlign:'middle'}}/> {error}
    <p style={{fontSize:13,marginBottom:0}}>Se a Shopee rejeitar algum campo GraphQL, copie essa mensagem para ajustarmos o formato da consulta.</p>
   </div>}
   {busy&&!report&&<p style={{padding:20,color:'#666'}}>Consultando a Shopee...</p>}
   {report&&<>
    <div style={dataBox}>
     <KeyValue name="Pedidos no período" value={summary.orders??0}/>
     <KeyValue name="Itens vendidos" value={summary.itemsSold??0}/>
     <KeyValue name="Valor estimado dos itens" value={brl(summary.estimatedOrderValue)}/>
     <KeyValue name="Comissão estimada" value={brl(summary.commissionEstimated)}/>
    </div>
    <div style={dataBox}>
     <KeyValue small name="Comissão do vendedor (estimada)" value={brl(summary.sellerCommissionEstimated)}/>
     <KeyValue small name="Comissão Shopee (estimada)" value={brl(summary.shopeeCommissionEstimated)}/>
     <KeyValue small name="Novos compradores identificados" value={summary.newBuyers??0}/>
     <KeyValue small name="Conversões" value={summary.conversions??0}/>
    </div>
    <div style={{display:'flex',gap:9,flexWrap:'wrap',alignItems:'center'}}>
     {Object.entries(statusNames).map(([status,label])=><span key={status} style={{padding:'8px 11px',border:'1px solid #eee',borderRadius:999,fontSize:13}}>{label}: <b>{st[status]||0}</b></span>)}
    </div>
    <p style={{fontSize:12,color:'#85858f',marginTop:15}}>
     Consultadas {summary.pagesFetched??0} páginas. {summary.partial?'Atenção: amostra parcial, totais não representam todo o período.':'Fim da paginação recebido da Shopee.'} O valor de itens é uma estimativa (quantidade × preço), não o GMV oficial consolidado.
    </p>
    {summary.warning&&<p style={{color:'#a63e20',fontSize:13}}>⚠️ {summary.warning}</p>}
   </>}
  </section>
  <section style={panel}>
    <h2 style={{fontSize:20,marginTop:0}}><MousePointerClick size={20} style={{verticalAlign:'middle'}}/> Cliques nos links do nosso site</h2>
    <p style={{fontSize:13,color:'#777',lineHeight:1.6}}>Estes números são somente cliques feitos nos botões de compra do Ofertas da Vivi, registrados no Neon. <b>Não são os cliques totais contabilizados pela Shopee</b> em WhatsApp, TikTok, Instagram e outros canais.</p>
    <div style={dataBox}>
      <KeyValue name="Cliques no site" value={summary.siteClicks?.status==='ok'?(summary.siteClicks.count??0).toLocaleString('pt-BR'):'—'}/>
      <KeyValue name="Fonte" value="Ofertas da Vivi" small/>
      <KeyValue name="Status do contador" value={summary.siteClicks?.status==='ok'?'Conectado':'Neon pendente'} small/>
    </div>
    {(summary.siteClicks?.topOffers||[]).length>0&&<div style={{marginTop:12}}>
      {summary.siteClicks.topOffers.map(o=><div key={o.id} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid #eee',gap:10}}><span style={{fontSize:13}}>{o.title}</span><b>{o.clicks}</b></div>)}
    </div>}
    <p style={{fontSize:13,lineHeight:1.6}}>
      Para conferir os cliques oficiais em todos os canais, use o <a style={{color:'#e45a20'}} href="https://affiliate.shopee.com.br/" target="_blank" rel="noopener noreferrer">Portal do Afiliado Shopee</a> → Relatório → Relatório de cliques → Exportar.
    </p>
  </section>
  {report&&<section style={panel}>
    <h2 style={{fontSize:20,marginTop:0}}>Conversões por pedido</h2>
    {(summary.conversionsList||[]).length===0?<p style={{color:'#777'}}>Nenhuma conversão retornada pela API nesse período.</p>:
    <div style={{overflowX:'auto'}}>
     <table className="admin-table"><thead><tr><th>Data</th><th>Pedido / Produto</th><th>Status</th><th>Itens</th><th>Valor aprox.</th><th>Comissão est.</th><th>Origem</th></tr></thead>
      <tbody>{summary.conversionsList.map((o,i)=><tr key={(o.conversionId||o.orderId)+'-'+i}>
       <td>{date(o.purchaseTime)}</td>
       <td><b>{o.orderId||o.conversionId||'—'}</b><small style={{display:'block',color:'#777'}}>{o.firstProduct||'—'}</small></td>
       <td>{statusNames[o.status]||o.status}</td><td>{o.itemsCount}</td><td>{brl(o.valueApprox)}</td>
       <td>{brl(o.commission)}</td><td>{o.source||'—'}</td></tr>)}</tbody>
     </table>
    </div>}
   </section>}
   {report&&(report.topProducts||[]).length>0&&<section style={panel}>
    <h2 style={{fontSize:20,marginTop:0}}>Produtos com mais itens vendidos (nas conversões carregadas)</h2>
    <div style={{overflowX:'auto'}}><table className="admin-table"><thead><tr><th>Produto</th><th>Qtd.</th><th>Valor aprox.</th><th>Comissão item</th></tr></thead>
      <tbody>{report.topProducts.map((p,i)=><tr key={i}><td>{p.name||p.itemId||'—'}</td><td>{p.quantity}</td><td>{brl(p.valueApprox)}</td><td>{brl(p.commission)}</td></tr>)}</tbody>
    </table></div>
   </section>}
   <section style={panel}>
    <h2 style={{fontSize:20,marginTop:0}}>Comissões validadas pela Shopee</h2>
    <p style={{fontSize:13,color:'#777',lineHeight:1.6}}>Se você tiver um <b>ID de validação</b> no extrato da Shopee, consulte os valores validados. Isso não equivale a confirmação de depósito bancário.</p>
    <div style={{display:'flex',gap:9,flexWrap:'wrap',alignItems:'center'}}>
      <input value={validationId} onChange={e=>setValidationId(e.target.value)} placeholder="ID numérico de validação" inputMode="numeric" style={{minWidth:200,flex:'1 1 200px',border:'1px solid #ddd',padding:'12px',borderRadius:10}}/>
      <button style={btn} disabled={valBusy||!validationId} onClick={getValidated}>{valBusy?'Consultando…':'Consultar validação'}</button>
    </div>
    {valError&&<p style={{color:'#b83d20'}}>{valError}</p>}
    {validated&&<div style={{marginTop:14}}>
      <div style={dataBox}><KeyValue name="Registros" value={validated.totalRecords}/><KeyValue name="Comissão líquida" value={brl(validated.netCommission)}/><KeyValue name="Comissão bruta" value={brl(validated.grossCommission)}/></div>
      {validated.hasMore&&<p style={{color:'#a44323'}}>A validação possui mais páginas; os valores mostrados são parciais.</p>}
    </div>}
   </section>
 </div>;
}

'use client';
import {useEffect,useState} from 'react';
import {TicketPercent,Flame,Save,RefreshCw,ExternalLink,CheckCircle2,AlertCircle} from 'lucide-react';

const input={padding:'12px',border:'1px solid #dfe1e6',borderRadius:9,width:'100%',fontSize:15};
export default function CampaignAdminPanel({settings={},onSaved}){
 const [draft,setDraft]=useState({
  flashSaleUrl:settings.flashSaleUrl||'',
  couponUrl:settings.couponUrl||'',
  flashSaleLabel:settings.flashSaleLabel||'Ofertas relâmpago',
  couponLabel:settings.couponLabel||'Cupons da Shopee',
  campaignsEnabled:settings.campaignsEnabled||'on',
  autoCampaigns:settings.autoCampaigns||'on'
 });
 const [busy,setBusy]=useState(false),[testBusy,setTestBusy]=useState(false);
 const [report,setReport]=useState(null),[message,setMessage]=useState(null);
 useEffect(()=>{setDraft({
  flashSaleUrl:settings.flashSaleUrl||'',couponUrl:settings.couponUrl||'',
  flashSaleLabel:settings.flashSaleLabel||'Ofertas relâmpago',
  couponLabel:settings.couponLabel||'Cupons da Shopee',
  campaignsEnabled:settings.campaignsEnabled||'on',
  autoCampaigns:settings.autoCampaigns||'on'
 })},[settings]);
 const set=(key,val)=>setDraft(old=>({...old,[key]:val}));
 async function save(e){
  e.preventDefault();setBusy(true);setMessage(null);
  try{
   const res=await fetch('/api/admin/settings',{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify(draft)});
   if(res.status===401){window.location.href='/adm/login';return}
   const d=await res.json();if(!res.ok)throw Error(d.error||'Falha ao salvar campanhas');
   setMessage({type:'ok',text:'Campanhas salvas. Atualize o site para conferir os botões.'});
   await onSaved?.();
  }catch(e){setMessage({type:'error',text:String(e?.message||'Erro')})}
  finally{setBusy(false)}
 }
 async function test(){
  setTestBusy(true);setReport(null);
  try{
   const res=await fetch('/api/campaigns?check='+Date.now(),{cache:'no-store'});
   const d=await res.json();if(!res.ok)throw Error(d.error||'Falha ao buscar campanhas');
   setReport(d);
  }catch(e){setMessage({type:'error',text:String(e?.message||e)})}
  finally{setTestBusy(false)}
 }
 return <div className="admin-two-col">
  <section className="admin-card">
   <h2><TicketPercent size={20}/> Ofertas relâmpago e cupons</h2>
   <p className="muted-text">Os dois links enviados já estão cadastrados como destinos sugeridos. A API de afiliados pode trazer campanhas gerais, mas não garante listar cupons individuais nem seu estoque.</p>
   <form className="admin-form" onSubmit={save}>
    <label>Ativar seção no site
     <select value={draft.campaignsEnabled} onChange={e=>set('campaignsEnabled',e.target.value)}>
      <option value="on">Sim, exibir</option><option value="off">Não, ocultar</option>
     </select>
    </label>
    <label>Ofertas via API
     <select value={draft.autoCampaigns} onChange={e=>set('autoCampaigns',e.target.value)}>
      <option value="on">Buscar campanhas automaticamente</option><option value="off">Mostrar somente links configurados</option>
     </select>
    </label>
    <label>Título do botão relâmpago
     <input maxLength={65} value={draft.flashSaleLabel} onChange={e=>set('flashSaleLabel',e.target.value)}/>
    </label>
    <label>Link da campanha de ofertas relâmpago
     <input type="url" value={draft.flashSaleUrl} onChange={e=>set('flashSaleUrl',e.target.value)}/>
    </label>
    <label>Título do botão de cupons
     <input maxLength={65} value={draft.couponLabel} onChange={e=>set('couponLabel',e.target.value)}/>
    </label>
    <label>Link da área de cupons Shopee
     <input type="url" value={draft.couponUrl} onChange={e=>set('couponUrl',e.target.value)}/>
    </label>
    <button className="btn btn-primary btn-wide" disabled={busy}><Save size={17}/>{busy?'Salvando…':'Salvar campanhas no site'}</button>
    {message&&<p role={message.type==='error'?'alert':'status'}
      className={'vivi-notice '+(message.type==='error'?'vivi-notice-error':'vivi-notice-success')}>
     {message.type==='error'?<AlertCircle size={18}/>:<CheckCircle2 size={18}/>} {message.text}</p>}
   </form>
  </section>
  <section className="admin-card">
   <h2><Flame size={20}/> Campanhas de marcas e categorias</h2>
   <p className="muted-text">Busca autenticada via API Shopee, com cache para não sobrecarregar suas credenciais. As campanhas podem mudar ou não estar disponíveis para a conta.</p>
   <button className="btn btn-outline btn-wide" type="button" onClick={test} disabled={testBusy}>
    <RefreshCw size={17}/>{testBusy?'Consultando…':'Testar campanhas via API'}
   </button>
   {report&&<>
    <p className="muted-text">{(report.offers||[]).length} campanha(s) disponíveis no momento.</p>
    {report.warning&&<p className="vivi-notice vivi-notice-error">{report.warning}</p>}
    {(report.offers||[]).map(item=><div key={item.link} className="vivi-campaign-admin-result">
      {item.image&&<img src={item.image} alt=""/>}
      <div><b>{item.title}</b><a href={item.link} rel="noopener noreferrer" target="_blank">
       Abrir na Shopee <ExternalLink size={14}/></a></div>
    </div>)}
    {(report.offers||[]).length===0&&<p className="footnote">Sem campanhas compatíveis no retorno atual; os links configurados continuam disponíveis.</p>}
   </>}
   <p className="footnote">Um link de campanha não comprova que a API forneça a lista de cupons ou os produtos de uma oferta relâmpago.</p>
  </section>
 </div>;
}

'use client';
import {useEffect,useState} from 'react';
import {Image as ImageIcon,Package,Palette,Save,CheckCircle2,AlertCircle,ExternalLink} from 'lucide-react';

const defaults={
 heroMode:'default',heroTheme:'orange',heroBadge:'Seu cantinho de achadinhos',
 heroTitle:'Achadinhos, cupons e ofertas selecionadas pela Vivi ♡',
 heroSubtitle:'Uma seleção especial de achadinhos para você economizar!',
 heroImage:'',heroProductId:'',heroButtonLabel:'Ver ofertas',heroButtonUrl:'#ofertas'
};
const modeOptions=[
 {value:'default',title:'Apresentação padrão',description:'Texto e visual da Vivi'},
 {value:'product',title:'Produto em destaque',description:'Mostra foto e botão do produto'},
 {value:'banner',title:'Banner personalizado',description:'Imagem, título e botão editáveis'}
];
const label={fontSize:13,fontWeight:750,color:'#3a3b48',display:'flex',flexDirection:'column',gap:6};
const input={width:'100%',padding:'12px',border:'1px solid #dfe0e8',borderRadius:9,fontSize:15,color:'#2b2b37',background:'#fff'};
const submit={display:'inline-flex',alignItems:'center',justifyContent:'center',gap:8,border:0,
 background:'#ff6326',borderRadius:10,padding:'13px 19px',fontWeight:800,color:'#fff',cursor:'pointer'};
const themes={orange:'linear-gradient(105deg,#f4441c,#ff982a)',pink:'linear-gradient(105deg,#da3e7d,#ff8a9b)',purple:'linear-gradient(105deg,#6f48c2,#b07cff)'};
const priceBRL=x=>x==null?'Preço na Shopee':Number(x).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

export default function BannerPanel({settings={},offers=[],onSaved,onManageOffers}){
 const [form,setForm]=useState({...defaults,...settings});
 const [saving,setSaving]=useState(false),[message,setMessage]=useState(null);
 useEffect(()=>{setForm({...defaults,...settings})},[settings]);
 const activeOffers=offers.filter(o=>o.active&&o.url);
 const chosen=activeOffers.find(o=>o.id===form.heroProductId);
 const image=form.heroMode==='product'?chosen?.image:form.heroMode==='banner'?form.heroImage:null;
 const heroTitle=form.heroMode==='product'&&chosen?chosen.title:form.heroTitle;
 const heroUrl=form.heroMode==='product'&&chosen?'/api/go/'+encodeURIComponent(chosen.id):form.heroButtonUrl;
 const btnLabel=form.heroMode==='product'?'Ver produto':form.heroButtonLabel||'Ver ofertas';
 const set=(key,value)=>setForm(s=>({...s,[key]:value}));
 async function save(event){
  event.preventDefault();setSaving(true);setMessage(null);
  try{
   const response=await fetch('/api/admin/settings',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(form)
   });
   if(response.status===401){window.location.href='/adm/login';return}
   const result=await response.json();
   if(!response.ok)throw Error(result.error||'Não foi possível salvar o banner.');
   setMessage({error:false,text:'Banner atualizado. A nova apresentação está disponível no site.'});
   await onSaved?.();
  }catch(e){setMessage({error:true,text:String(e?.message||'Erro ao salvar')})}
  finally{setSaving(false)}
 }
 return <div className="vivi-banner-admin">
   <div className="admin-card">
    <div className="admin-card-title"><h2><Palette size={21}/> Banners e destaques</h2>
      <button type="button" className="btn btn-outline btn-small" onClick={onManageOffers}>Gerenciar ofertas</button>
    </div>
    <p className="muted-text">Escolha o banner ou produto em destaque e defina a identidade visual da Vivi. A paleta escolhida também altera as cores dos botões, ícones, cupons, categorias e destaques do site.</p>
    <div className="vivi-mode-grid" role="group" aria-label="Tipo do banner">
     {modeOptions.map(option=><button key={option.value} type="button"
       className={'vivi-mode-card '+(form.heroMode===option.value?'active':'')}
       onClick={()=>set('heroMode',option.value)}>
      <strong>{option.title}</strong><span>{option.description}</span>
     </button>)}
    </div>
   </div>
   <form onSubmit={save} className="vivi-banner-admin-grid">
    <section className="admin-card vivi-banner-form">
     <h2><ImageIcon size={20}/> Conteúdo principal</h2>
     <label style={label}>Paleta de cores do site
      <select style={input} value={form.heroTheme||'orange'} onChange={e=>set('heroTheme',e.target.value)}>
       <option value="orange">Laranja Vivi</option>
       <option value="pink">Rosa</option>
       <option value="purple">Roxo</option>
      </select>
      <small style={{fontWeight:400,color:"#7c8590"}}>A cor do banner também acompanha o site inteiro; Ofertas Relâmpago fica sempre em vermelho e o WhatsApp em verde.</small>
     </label>
     {form.heroMode==='product'&&<label style={label}>Produto em destaque
      <select style={input} required value={form.heroProductId||''} onChange={e=>set('heroProductId',e.target.value)}>
       <option value="">Selecione uma oferta ativa</option>
       {activeOffers.map(o=><option key={o.id} value={o.id}>{o.title.slice(0,95)}</option>)}
      </select>
      <small style={{fontWeight:400,color:'#7c8590'}}>O produto precisa estar ativo na aba Ofertas.</small>
     </label>}
     {form.heroMode==='banner'&&<label style={label}>Imagem do banner (URL HTTPS)
      <input type="url" style={input} value={form.heroImage||''} required placeholder="https://exemplo.com/banner.webp" onChange={e=>set('heroImage',e.target.value)}/>
      <small style={{fontWeight:400,color:'#7c8590'}}>Prefira imagens horizontais com boa qualidade. Aceita imagens hospedadas em HTTPS.</small>
     </label>}
     <label style={label}>Etiqueta acima do título
      <input style={input} value={form.heroBadge||''} maxLength={80} onChange={e=>set('heroBadge',e.target.value)} placeholder="Achadinhos da Vivi"/>
     </label>
     <label style={label}>Título do banner
      <textarea style={{...input,minHeight:89,resize:'vertical'}} maxLength={180} value={form.heroTitle||''} onChange={e=>set('heroTitle',e.target.value)}/>
     </label>
     <label style={label}>Texto de apoio
      <textarea style={{...input,minHeight:85,resize:'vertical'}} maxLength={300} value={form.heroSubtitle||''} onChange={e=>set('heroSubtitle',e.target.value)}/>
     </label>
     {form.heroMode!=='product'&&<>
      <label style={label}>Texto do botão principal
       <input style={input} maxLength={55} value={form.heroButtonLabel||''} onChange={e=>set('heroButtonLabel',e.target.value)} placeholder="Ver ofertas"/>
      </label>
      <label style={label}>Destino do botão
       <input style={input} value={form.heroButtonUrl||''} onChange={e=>set('heroButtonUrl',e.target.value)} placeholder="#ofertas ou https://..."/>
       <small style={{fontWeight:400,color:'#7c8590'}}>Use #ofertas para abrir os produtos da página ou cole um link HTTPS.</small>
      </label>
     </>}
     <button type="submit" style={submit} disabled={saving||form.heroMode==='product'&&!chosen}>
      <Save size={18}/> {saving?'Salvando…':'Salvar e publicar banner'}
     </button>
     {message&&<div className={'vivi-notice '+(message.error?'vivi-notice-error':'vivi-notice-success')} role={message.error?'alert':'status'}>
      {message.error?<AlertCircle size={17}/>:<CheckCircle2 size={17}/>} {message.text}
     </div>}
    </section>
    <aside className="admin-card">
      <h2>Prévia do banner</h2>
      <p className="muted-text">Visualização aproximada para computador e celular.</p>
      <div className="vivi-banner-preview" style={{background:themes[form.heroTheme]||themes.orange}}>
       <div className="vivi-preview-copy">
        <span>{form.heroBadge||'Achadinhos da Vivi'}</span>
        <h3>{heroTitle||'Seu destaque começa aqui'}</h3>
        <p>{form.heroSubtitle||''}</p>
        <strong>{btnLabel} ↗</strong>
       </div>
       {image&&<img src={image} alt="Prévia do banner" onError={e=>{e.currentTarget.style.display='none'}}/>}
      </div>
      {form.heroMode==='product'&&chosen&&<div className="vivi-banner-preview-product">
       <img src={chosen.image||'/images/produto-1.webp'} alt=""/>
       <div><b>{chosen.title}</b><small>{priceBRL(chosen.price)}</small><span>Link: {heroUrl}</span></div>
      </div>}
      <p className="footnote">A publicação é imediata após salvar. O conteúdo pode levar alguns segundos para aparecer ao atualizar o site.</p>
      <a href="/" target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-wide"><ExternalLink size={16}/> Abrir site público</a>
    </aside>
   </form>
 </div>;
}

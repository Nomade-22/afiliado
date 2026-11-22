'use client';
import {useEffect,useState} from 'react';
import {Image as ImageIcon,Palette,Save,CheckCircle2,AlertCircle,ExternalLink,
 Plus,Trash2,ArrowUp,ArrowDown,Timer,Flame,Images,FileText,Package} from 'lucide-react';
import {readHeroSlides,getHeroInterval,newHeroSlide,MAX_HERO_SLIDES,MIN_HERO_SLIDES} from '../lib/hero-slides';

const input={width:'100%',minWidth:0,padding:'12px',border:'1px solid #dfe0e8',
 borderRadius:9,fontSize:14,color:'#2b2b37',background:'#fff'};
const label={fontSize:13,fontWeight:700,color:'#3a3b48',display:'flex',flexDirection:'column',gap:6};
const themes={orange:'linear-gradient(115deg,#f4441c,#ff982a)',
 pink:'linear-gradient(115deg,#c7356e,#f16a94)',
 purple:'linear-gradient(115deg,#6340ac,#a579d9)'};
const TYPE_LABEL={intro:'Texto e apresentação',images:'Galeria de imagens',flash:'Ofertas relâmpago',product:'Produto em destaque'};
const TYPE_ICONS={intro:FileText,images:Images,flash:Flame,product:Package};

export default function BannerPanel({settings={},offers=[],onSaved,onManageOffers}){
 const [slides,setSlides]=useState(()=>readHeroSlides(settings));
 const [selected,setSelected]=useState(0);
 const [theme,setTheme]=useState(settings.heroTheme||'orange');
 const [seconds,setSeconds]=useState(getHeroInterval(settings));
 const [imageDrafts,setImageDrafts]=useState({});
 const [saving,setSaving]=useState(false),[notice,setNotice]=useState(null);
 useEffect(()=>{
  setSlides(readHeroSlides(settings));
  setTheme(settings.heroTheme||'orange');
  setSeconds(getHeroInterval(settings));
  setImageDrafts({});
 },[settings]);
 const current=slides[selected]||slides[0];
 const activeOffers=offers.filter(o=>o.active&&o.url);
 function updateSlide(field,value){
  setSlides(old=>old.map((s,i)=>i===selected?{...s,[field]:value}:s));
  setNotice(null);
 }
 function setImages(text){
  setImageDrafts(old=>({...old,[current.id]:text}));
  updateSlide('images',text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).slice(0,4));
 }
 function add(type){
  if(slides.length>=MAX_HERO_SLIDES)return;
  const id='slide-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6);
  const next=newHeroSlide(type,id);
  setSlides(old=>[...old,next]);
  setSelected(slides.length);
 }
 function move(delta){
  const target=selected+delta;
  if(target<0||target>=slides.length)return;
  const next=[...slides];
  [next[selected],next[target]]=[next[target],next[selected]];
  setSlides(next);setSelected(target);
 }
 function remove(){
  if(slides.length<=MIN_HERO_SLIDES)return;
  setSlides(old=>old.filter((_,i)=>i!==selected));
  setSelected(i=>Math.max(0,Math.min(i,slides.length-2)));
 }
 async function save(event){
  event.preventDefault();
  if(slides.filter(x=>x.enabled).length===0){
   setNotice({error:true,text:'Ative pelo menos uma página do banner.'});return;
  }
  setSaving(true);setNotice(null);
  try{
   const configured=slides.map(s=>({
    ...s,images:(imageDrafts[s.id]??(s.images||[]).join('\n'))
      .split(/\r?\n/).map(v=>v.trim()).filter(Boolean).slice(0,4)
   }));
   const response=await fetch('/api/admin/settings',{
    method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',
    body:JSON.stringify({
     heroTheme:theme,heroSlides:JSON.stringify(configured),
     heroIntervalSeconds:String(seconds)
    })
   });
   if(response.status===401){window.location.href='/adm/login';return}
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'Não foi possível salvar o carrossel.');
   setNotice({error:false,text:configured.length+' páginas salvas. O carrossel alternará a cada '+seconds+' segundos.'});
   await onSaved?.();
  }catch(e){setNotice({error:true,text:String(e?.message||'Falha ao salvar')})}
  finally{setSaving(false)}
 }
 if(!current)return null;
 const currentPhotos=(current.images||[]).length?current.images:
  current.type==='images'?activeOffers.filter(x=>x.image).slice(0,4).map(x=>x.image):[];
 const chosen=activeOffers.find(x=>x.id===current.productId);
 const previewImages=current.type==='product'&&chosen?.image?[chosen.image]:currentPhotos;
 return <div className="vivi-carousel-admin">
  <div className="admin-card">
   <div className="admin-card-title">
    <h2><Palette size={22}/> Carrossel de banners</h2>
    <button className="btn btn-outline btn-small" onClick={onManageOffers} type="button">Gerenciar ofertas</button>
   </div>
   <p className="muted-text">Crie páginas com texto, fotos, produtos ou campanhas. O banner troca sozinho, e os visitantes também podem navegar pelas setas e indicadores.</p>
   <div className="vivi-carousel-global">
    <label style={label}>Paleta de cores do site
     <select value={theme} style={input} onChange={e=>setTheme(e.target.value)}>
      <option value="orange">Laranja Vivi</option>
      <option value="pink">Rosa</option>
      <option value="purple">Roxo</option>
     </select>
    </label>
    <label style={label}>Intervalo de troca
     <select value={seconds} style={input} onChange={e=>setSeconds(Number(e.target.value))}>
      {[4,5,6,7,8,10,12,15,20].map(n=><option key={n} value={n}>{n} segundos</option>)}
     </select>
    </label>
   </div>
   <div className="vivi-carousel-slidebar">
    {slides.map((slide,i)=>{
     const Icon=TYPE_ICONS[slide.type]||FileText;
     return <button type="button" key={slide.id} className={'vivi-carousel-slide-tab '+
      (i===selected?'chosen ':'')+(!slide.enabled?'disabled':'')}
      onClick={()=>setSelected(i)}>
      <Icon size={18}/><span>{i+1}. {TYPE_LABEL[slide.type]}</span>
     </button>;
    })}
   </div>
   <div className="vivi-carousel-slide-tools">
    <button type="button" className="btn btn-outline btn-small" disabled={selected===0} onClick={()=>move(-1)}>
     <ArrowUp size={16}/> Anterior</button>
    <button type="button" className="btn btn-outline btn-small" disabled={selected===slides.length-1} onClick={()=>move(1)}>
     <ArrowDown size={16}/> Próxima</button>
    <button type="button" className="btn btn-outline btn-small" disabled={slides.length<=MIN_HERO_SLIDES} onClick={remove}>
     <Trash2 size={16}/> Remover página</button>
   </div>
   <div className="vivi-carousel-add">
    <span>Adicionar página:</span>
    {['intro','images','flash','product'].map(type=><button type="button" key={type}
      disabled={slides.length>=MAX_HERO_SLIDES}
      onClick={()=>add(type)}><Plus size={13}/>{TYPE_LABEL[type]}</button>)}
   </div>
  </div>
  <form className="vivi-banner-admin-grid" onSubmit={save}>
   <section className="admin-card vivi-banner-form">
    <h2><ImageIcon size={21}/> Editar página {selected+1}</h2>
    <label className="vivi-carousel-active"><input type="checkbox" checked={current.enabled}
     onChange={e=>updateSlide('enabled',e.target.checked)}/> Exibir esta página no site</label>
    <label style={label}>Tipo de página
     <select style={input} value={current.type} onChange={e=>updateSlide('type',e.target.value)}>
      {Object.entries(TYPE_LABEL).map(([value,name])=><option key={value} value={value}>{name}</option>)}
     </select>
    </label>
    {current.type==='product'&&<label style={label}>Produto em destaque
     <select value={current.productId||''} style={input} onChange={e=>updateSlide('productId',e.target.value)}>
      <option value="">Selecionar produto ativo</option>
      {activeOffers.map(o=><option key={o.id} value={o.id}>{o.title.slice(0,110)}</option>)}
     </select>
    </label>}
    <label style={label}>Etiqueta superior
     <input value={current.badge||''} maxLength={85} style={input}
      onChange={e=>updateSlide('badge',e.target.value)}/>
    </label>
    <label style={label}>Título da página
     <textarea value={current.title||''} maxLength={170}
      style={{...input,minHeight:90,resize:'vertical'}}
      onChange={e=>updateSlide('title',e.target.value)}/>
    </label>
    <label style={label}>Texto de apoio
     <textarea value={current.subtitle||''} maxLength={300}
      style={{...input,minHeight:80,resize:'vertical'}}
      onChange={e=>updateSlide('subtitle',e.target.value)}/>
    </label>
    {current.type==='images'&&<label style={label}>Imagens (uma URL HTTPS por linha, até 4)
     <textarea value={imageDrafts[current.id]??current.images.join('\n')}
      style={{...input,minHeight:116,resize:'vertical'}}
      placeholder={'https://exemplo.com/foto1.webp\nhttps://exemplo.com/foto2.webp'}
      onChange={e=>setImages(e.target.value)}/>
     <small style={{fontWeight:400,color:'#78808c'}}>Deixe vazio para usar automaticamente fotos dos produtos ativos da Vivi.</small>
    </label>}
    {current.type==='intro'&&<label style={label}>Imagem lateral (opcional)
     <input type="url" style={input} value={current.images?.[0]||''}
      onChange={e=>updateSlide('images',e.target.value?[e.target.value]:[])}
      placeholder="https://.../banner.webp"/>
    </label>}
    {current.type==='flash'&&<p className="vivi-carousel-tip"><Flame size={17}/>
     Esta página fica vermelha e usa o link de Ofertas Relâmpago configurado na aba Promoções e cupons. Não anunciamos porcentagens ou prazos não confirmados.</p>}
    <label style={label}>Texto do botão
     <input value={current.buttonLabel||''} maxLength={55} style={input}
      onChange={e=>updateSlide('buttonLabel',e.target.value)}/>
    </label>
    {current.type!=='flash'&&current.type!=='product'&&<label style={label}>Destino do botão
     <input value={current.buttonUrl||''} style={input}
      placeholder="#ofertas ou https://..." onChange={e=>updateSlide('buttonUrl',e.target.value)}/>
    </label>}
    <button type="submit" className="btn btn-primary btn-wide" disabled={saving}>
     <Save size={17}/>{saving?'Salvando…':'Salvar todas as páginas e publicar'}
    </button>
    {notice&&<div role={notice.error?'alert':'status'} className={'vivi-notice '+(notice.error?'vivi-notice-error':'vivi-notice-success')}>
     {notice.error?<AlertCircle size={17}/>:<CheckCircle2 size={17}/>} {notice.text}
    </div>}
   </section>
   <aside className="admin-card">
    <h2>Prévia da página {selected+1}</h2>
    <p className="muted-text">A prévia acompanha o tipo da página e a paleta selecionada.</p>
    <div className={'vivi-banner-preview vivi-carousel-admin-preview'+(current.type==='flash'?' flash':'')}
     style={{background:current.type==='flash'?
      'linear-gradient(105deg,#ab1730,#f33736)':(themes[theme]||themes.orange)}}>
     <div className="vivi-preview-copy">
      <span>{current.badge||'Destaques da Vivi'}</span>
      <h3>{current.type==='product'&&chosen?chosen.title:current.title}</h3>
      <p>{current.subtitle}</p>
      <strong>{current.buttonLabel||'Ver ofertas'} ↗</strong>
     </div>
     {current.type==='images'&&previewImages.length>0?
      <div className="vivi-carousel-admin-gallery">{previewImages.slice(0,4).map((img,i)=>
       <img key={img+i} src={img} alt="" onError={e=>{e.currentTarget.style.display='none'}}/>)}</div>:
      previewImages[0]&&current.type!=='flash'?<img src={previewImages[0]} alt="Prévia do destaque"/>:
      current.type==='flash'?<Flame size={76} color="white"/>:<span className="vivi-carousel-preview-heart">♡</span>}
    </div>
    <p className="footnote">Página {selected+1} de {slides.length}. A troca automática ocorre a cada {seconds} segundos. Também há navegação manual e pausa.</p>
    <a href="/" target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-wide">
     <ExternalLink size={16}/> Abrir site público
    </a>
   </aside>
  </form>
 </div>;
}

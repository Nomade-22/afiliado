'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowRight,ChevronLeft,ChevronRight,Flame,Pause,Play,
 Sparkles,Tag,ShoppingBag,Heart} from 'lucide-react';
import {getHeroInterval,readHeroSlides} from '../lib/hero-slides';
import {isHeroImage} from '../lib/site-theme';

const safeDestination=value=>{
 if(value==='#ofertas'||value==='#cupons'||/^\/produto\/[a-zA-Z0-9_-]+$/.test(String(value||'')))return true;
 try{
  const u=new URL(String(value||''));
  return u.protocol==='https:'&&!u.username&&!u.password;
 }catch{return false}
};

export default function HeroCarousel({settings={},offers=[]}){
 const slides=useMemo(()=>readHeroSlides(settings).filter(s=>s.enabled!==false),[settings]);
 const [active,setActive]=useState(0);
 const [hovered,setHovered]=useState(false);
 const [manualPause,setManualPause]=useState(false);
 const touchX=useRef(null);
 const current=slides[active%Math.max(1,slides.length)];
 const period=getHeroInterval(settings)*1000;
 useEffect(()=>{
  if(slides.length<=1||hovered||manualPause)return;
  const interval=setInterval(()=>{
   if(typeof document==='undefined'||!document.hidden)setActive(i=>(i+1)%slides.length);
  },period);
  return ()=>clearInterval(interval);
 },[slides.length,period,hovered,manualPause]);
 useEffect(()=>setActive(i=>Math.min(i,Math.max(0,slides.length-1))),[slides.length]);
 if(!current)return null;
 const navigate=delta=>setActive(i=>(i+delta+slides.length)%slides.length);
 // Apenas fotos escolhidas pelo administrador. Nada de quatro produtos
 // aleatórios cobrindo a chamada principal da campanha.
 const gallery=(current.images||[]).filter(isHeroImage).slice(0,4);
 const offer=offers.find(x=>x.id===current.productId&&x.active);
 const product=current.type==='product'&&offer;
 const flash=current.type==='flash';
 const images=current.type==='images';
 const mainImage=product&&isHeroImage(offer.image)?offer.image:
   (current.type==='intro'||flash)&&gallery.length?gallery[0]:null;
 const href=product?'/produto/'+encodeURIComponent(offer.id):
  flash?settings.flashSaleUrl:current.buttonUrl||'#ofertas';
 const destination=safeDestination(href)?href:'#ofertas';
 const external=destination.startsWith('https://');
 const title=product?offer.title:current.title;
 const buttonLabel=product?'Ver produto':current.buttonLabel||'Ver ofertas';
 const decorative=images&&gallery.length===0;
 return <section className={'vivi-hero-slider vivi-slide-type-'+current.type+(flash?' vivi-hero-flash':'')}
    aria-label="Destaques da Vivi"
    onMouseEnter={()=>setHovered(true)}
    onMouseLeave={()=>setHovered(false)}
    onFocusCapture={()=>setHovered(true)}
    onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))setHovered(false)}}
    onTouchStart={e=>{touchX.current=e.touches[0]?.clientX??null}}
    onTouchEnd={e=>{
     if(touchX.current===null)return;
     const diff=e.changedTouches[0]?.clientX-touchX.current;
     if(Math.abs(diff)>45)navigate(diff<0?1:-1);
     touchX.current=null;
    }}>
   <div key={current.id} className={'vivi-hero-current'+(images&&gallery.length?' vivi-hero-with-gallery':'')}>
    <div className="vivi-hero-content">
     <span className="vivi-hero-eyebrow">{flash?<Flame size={16}/>:<Sparkles size={16}/>}
      {current.badge||'Destaques da Vivi'}</span>
     <h1>{title||'Ofertas escolhidas para você'}</h1>
     <p>{current.subtitle||'Confira as novidades selecionadas pela Vivi.'}</p>
     <div className="vivi-hero-buttons">
      <a href={destination} className="vivi-hero-cta"
       target={external||product?'_blank':undefined}
       rel={external||product?'noopener noreferrer nofollow sponsored':undefined}>
       <Tag size={17}/>{buttonLabel}<ArrowRight size={17}/>
      </a>
     </div>
    </div>
    <div className={'vivi-hero-visual'+(images&&gallery.length?' has-photos':'')} aria-hidden="true">
     {images&&gallery.length>0?
      <div className={'vivi-hero-photo-grid count-'+gallery.length}>
       {gallery.map((src,i)=><div key={src+i} className="vivi-hero-photo">
        <img src={src} alt="" loading="eager"/>
       </div>)}
      </div>:
      mainImage?<div className="vivi-hero-main-photo"><img src={mainImage} alt="" loading="eager"/></div>:
      flash?<div className="vivi-hero-flash-icon"><Flame size={76} strokeWidth={1.5}/><span>OFERTAS DA SEMANA</span></div>:
      <div className={'vivi-hero-default-art'+(decorative?' decorative':'')}>
       <div className="vivi-hero-art-ring"><ShoppingBag size={58} strokeWidth={1.5}/></div>
       <Heart className="vivi-hero-art-heart" size={33} fill="currentColor"/>
       <Sparkles className="vivi-hero-art-sparkles" size={31}/>
      </div>}
    </div>
   </div>
   {slides.length>1&&<div className="vivi-hero-controls">
    <button className="vivi-hero-control" type="button"
     aria-label="Voltar ao banner anterior" onClick={()=>navigate(-1)}>
     <ChevronLeft size={19}/></button>
    <div className="vivi-hero-dots" role="group" aria-label="Escolher página do banner">
     {slides.map((s,i)=><button key={s.id} type="button"
      className={i===active?'active':''}
      aria-label={'Banner '+(i+1)+': '+(s.title||'Destaque')}
      aria-current={i===active?'true':undefined}
      onClick={()=>setActive(i)}/>)}
    </div>
    <span className="vivi-hero-count">{active+1} / {slides.length}</span>
    <button className="vivi-hero-control" type="button"
     aria-label="Avançar para o próximo banner" onClick={()=>navigate(1)}>
     <ChevronRight size={19}/></button>
    <button className="vivi-hero-control vivi-hero-pause" type="button"
     aria-label={manualPause?'Retomar banners automáticos':'Pausar banners automáticos'}
     onClick={()=>setManualPause(x=>!x)}>
     {manualPause?<Play size={16}/>:<Pause size={16}/>}</button>
   </div>}
  </section>;
}

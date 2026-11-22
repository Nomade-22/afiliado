'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowRight,ChevronLeft,ChevronRight,Flame,Pause,Play,Sparkles,Tag} from 'lucide-react';
import {getHeroInterval,readHeroSlides} from '../lib/hero-slides';

const safeImage=value=>{
 try{
  const u=new URL(String(value||''));
  return u.protocol==='https:'&&!u.username&&!u.password;
 }catch{return false}
};
const safeDestination=value=>{
 if(value==='#ofertas'||value==='#cupons')return true;
 try{
  const u=new URL(String(value||''));
  return u.protocol==='https:'&&!u.username&&!u.password;
 }catch{return false}
};
export default function HeroCarousel({settings={},offers=[]}){
 const slides=useMemo(()=>readHeroSlides(settings).filter(s=>s.enabled!==false),[settings]);
 const [active,setActive]=useState(0),[paused,setPaused]=useState(false);
 const [manualPause,setManualPause]=useState(false);
 const touchX=useRef(null);
 const current=slides[active%Math.max(1,slides.length)];
 const period=getHeroInterval(settings)*1000;
 useEffect(()=>{
  if(slides.length<=1||paused||manualPause)return;
  const interval=setInterval(()=>{
   if(typeof document==='undefined'||!document.hidden)setActive(i=>(i+1)%slides.length)
  },period);
  return ()=>clearInterval(interval);
 },[slides.length,period,paused,manualPause]);
 useEffect(()=>setActive(i=>Math.min(i,Math.max(0,slides.length-1))),[slides.length]);
 if(!current)return null;
 const navigate=delta=>setActive(i=>(i+delta+slides.length)%slides.length);
 const usedImages=(current.images||[]).filter(safeImage);
 const activeOffer=offers.find(x=>x.id===current.productId&&x.active);
 const gallery=usedImages.length?usedImages:
  (current.type==='images'?offers.filter(x=>x.active&&safeImage(x.image)).slice(0,4).map(x=>x.image):[]);
 const slideImage=current.type==='product'&&safeImage(activeOffer?.image)?activeOffer.image:
  current.type==='intro'&&usedImages.length?usedImages[0]:null;
 const flash=current.type==='flash';
 const product=current.type==='product'&&activeOffer;
 const href=product?'/produto/'+encodeURIComponent(activeOffer.id):
  flash?settings.flashSaleUrl:current.buttonUrl||'#ofertas';
 const destination=safeDestination(href)?href:'#ofertas';
 const external=destination.startsWith('https://');
 const title=product?activeOffer.title:current.title;
 const buttonLabel=product?'Ver produto':current.buttonLabel||'Ver ofertas';
 return <section className={'vivi-hero-slider vivi-slide-type-'+current.type+' '+(flash?'vivi-hero-flash':'')}
    aria-label="Destaques da Vivi"
    onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)}
    onFocusCapture={()=>setPaused(true)} onBlurCapture={e=>{
      if(!e.currentTarget.contains(e.relatedTarget))setPaused(false)
    }}
    onTouchStart={e=>{touchX.current=e.touches[0]?.clientX??null}}
    onTouchEnd={e=>{
      if(touchX.current===null)return;
      const delta=e.changedTouches[0]?.clientX-touchX.current;
      if(Math.abs(delta)>45)navigate(delta<0?1:-1);
      touchX.current=null;
    }}>
   <div key={current.id} className="vivi-hero-current">
    <div className="vivi-hero-content">
     <span className="vivi-hero-eyebrow">{flash?<Flame size={16}/>:<Sparkles size={16}/>}
      {current.badge||'Seleção da Vivi'}</span>
     <h1>{title||'Ofertas especiais para você'}</h1>
     <p>{current.subtitle||'Confira os produtos e promoções escolhidos pela Vivi.'}</p>
     <div className="vivi-hero-buttons">
      <a href={destination} className="vivi-hero-cta" target={external||product?'_blank':undefined}
       rel={external||product?'noopener noreferrer nofollow sponsored':undefined}>
       <Tag size={17}/>{buttonLabel}<ArrowRight size={17}/>
      </a>
     </div>
    </div>
    <div className={'vivi-hero-visual '+(gallery.length?'has-photos':'')} aria-hidden="true">
     {current.type==='images'&&gallery.length>0?
      <div className="vivi-hero-photo-grid">{gallery.slice(0,4).map((img,i)=>
       <div key={img+i} className="vivi-hero-photo"><img src={img} alt="" loading="eager"/></div>)}</div>:
      slideImage?<div className="vivi-hero-main-photo"><img src={slideImage} alt=""/></div>:
      flash?<div className="vivi-hero-flash-icon"><Flame size={92} strokeWidth={1.3}/><span>OFERTAS</span></div>:
      <div className="vivi-hero-default-art"><Sparkles size={64} strokeWidth={1.2}/><span>♡</span></div>}
    </div>
   </div>
   {slides.length>1&&<div className="vivi-hero-controls">
    <button className="vivi-hero-control" type="button" aria-label="Banner anterior" onClick={()=>navigate(-1)}><ChevronLeft size={19}/></button>
    <div className="vivi-hero-dots" role="group" aria-label="Selecionar destaque">
     {slides.map((slide,i)=><button key={slide.id} type="button"
      className={i===active?'active':''}
      aria-label={'Ver página '+(i+1)+': '+(slide.title||'Destaque')}
      aria-current={i===active?'true':undefined}
      onClick={()=>setActive(i)}/>)}
    </div>
    <button className="vivi-hero-control" type="button" aria-label="Próximo banner" onClick={()=>navigate(1)}><ChevronRight size={19}/></button>
    <span className="vivi-hero-count">{active+1} / {slides.length}</span>
    <button className="vivi-hero-control vivi-hero-pause" type="button"
     aria-label={manualPause?'Retomar rotação automática':'Pausar rotação automática'}
     onClick={()=>setManualPause(x=>!x)}>{manualPause?<Play size={16}/>:<Pause size={16}/>}</button>
   </div>}
  </section>;
}

'use client';
import {useEffect,useRef} from 'react';

// Poucos nós temporários, sem impedir clique/rolagem e sem bibliotecas pesadas.
export default function SiteInteractionEffects({theme='normal',mode='lively'}){
 const layerRef=useRef(null);
 useEffect(()=>{
  if(mode==='off'||typeof window==='undefined'||
     window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const root=document.querySelector('.site-shell');
  const layer=layerRef.current;
  if(!root||!layer)return;
  const pointers=new Map();
  const timers=new Set();
  const particle=theme==='christmas'?'❄':theme==='black-friday'?'✦':'✧';
  function spawn(x,y,kind){
   if(document.hidden||layer.childElementCount>=36)return;
   const node=document.createElement('span');
   const isRing=kind==='tap';
   node.className='vivi-fx-particle '+(isRing?'vivi-fx-tap':'vivi-fx-trail')+' vivi-fx-theme-'+theme;
   node.textContent=isRing?'':particle;
   node.style.left=x+'px';
   node.style.top=y+'px';
   const theta=((Math.round(x+y)%5)-2)*.7;
   node.style.setProperty('--vivi-fx-dx',theta*13+'px');
   node.style.setProperty('--vivi-fx-dy',(-12-Math.abs(theta)*8)+'px');
   layer.appendChild(node);
   const timer=setTimeout(()=>{node.remove();timers.delete(timer)},isRing?650:850);
   timers.add(timer);
  }
  const tapTargets='a,button,.category-item,.vivi-modern-product,.vivi-discount-card,.vivi-hero-slider';
  function down(e){
   if(e.pointerType==='mouse'&&e.button!==0)return;
   const target=e.target instanceof Element?e.target:null;
   if(!target)return;
   const inSite=root.contains(target);
   if(!inSite)return;
   const canDrag=!!target.closest('.vivi-hero-slider,.vivi-discounts-scroll,.vivi-discount-card');
   pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,last:0,canDrag});
   if(target.closest(tapTargets))spawn(e.clientX,e.clientY,'tap');
  }
  function move(e){
   const pointer=pointers.get(e.pointerId);
   if(!pointer||!pointer.canDrag)return;
   const distance=Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y);
   if(distance<11)return;
   const now=performance.now();
   if(now-pointer.last<(mode==='soft'?145:75))return;
   pointer.last=now;
   spawn(e.clientX,e.clientY,'trail');
  }
  function end(e){pointers.delete(e.pointerId)}
  root.addEventListener('pointerdown',down,{passive:true});
  window.addEventListener('pointermove',move,{passive:true});
  window.addEventListener('pointerup',end,{passive:true});
  window.addEventListener('pointercancel',end,{passive:true});
  return ()=>{
   root.removeEventListener('pointerdown',down);
   window.removeEventListener('pointermove',move);
   window.removeEventListener('pointerup',end);
   window.removeEventListener('pointercancel',end);
   for(const timer of timers)clearTimeout(timer);
   layer.replaceChildren();
  };
 },[theme,mode]);
 if(mode==='off')return null;
 return <div className="vivi-interaction-layer" ref={layerRef} aria-hidden="true"/>;
}

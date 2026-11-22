'use client';
import {useEffect,useState} from 'react';
import {TicketPercent,Flame,ArrowUpRight,CalendarDays,ShieldCheck} from 'lucide-react';

const safe=(u)=>{try{return new URL(u).protocol==='https:'}catch{return false}};
export default function CampaignsSection(){
 const [data,setData]=useState(null);
 useEffect(()=>{
  let live=true;
  fetch('/api/campaigns').then(r=>r.json()).then(d=>{if(live)setData(d)}).catch(()=>{});
  return ()=>{live=false};
 },[]);
 if(!data||data.enabled===false)return null;
 const links=data.links||[],offers=data.offers||[];
 if(!links.length&&!offers.length)return null;
 return <section className="vivi-campaigns" id="cupons">
  <div className="section-heading"><h2><TicketPercent size={25}/> Promoções e cupons</h2></div>
  <p className="vivi-campaigns-intro">Veja os destaques e confira condições, prazos e descontos diretamente na Shopee.</p>
  <div className="vivi-campaign-quicklinks">
   {links.map(link=><a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer nofollow sponsored"
    className={'vivi-campaign-quick vivi-quick-'+link.id}>
    {link.id==='flash'?<Flame size={25}/>:<TicketPercent size={25}/>}
    <span><b>{link.title}</b><small>{link.description}</small></span>
    <ArrowUpRight size={20}/>
   </a>)}
  </div>
  {offers.length>0&&<>
   <div className="vivi-campaign-secondary"><ShieldCheck size={17}/> Campanhas de marcas e categorias</div>
   <div className="vivi-campaign-offers">
    {offers.map(offer=><a key={offer.link} className="vivi-campaign-offer" href={offer.link}
      target="_blank" rel="noopener noreferrer nofollow sponsored">
     {safe(offer.image)&&<img src={offer.image} alt="" loading="lazy"/>}
     <b>{offer.title}</b>
     {offer.end&&<small><CalendarDays size={13}/> Até {new Date(offer.end*1000).toLocaleDateString('pt-BR')}</small>}
     <span>Ver campanha <ArrowUpRight size={15}/></span>
    </a>)}
   </div>
  </>}
  <p className="vivi-campaigns-note">Cupons e ofertas estão sujeitos à disponibilidade e regras da Shopee. Os links de acesso não representam garantia de desconto.</p>
 </section>;
}

'use client';
import {useEffect,useState} from 'react';
import {TicketPercent,Flame,ArrowUpRight,CalendarDays,ShieldCheck} from 'lucide-react';

const safe=(u)=>{try{return new URL(u).protocol==='https:'}catch{return false}};
export default function CampaignsSection(){
 const [data,setData]=useState(null);
 const [discounts,setDiscounts]=useState([]);
 useEffect(()=>{
  let live=true;
  fetch('/api/campaigns').then(r=>r.json()).then(d=>{if(live)setData(d)}).catch(()=>{});
  fetch('/api/discount-offers',{cache:'no-store'})
   .then(r=>r.ok?r.json():null)
   .then(d=>{if(live&&Array.isArray(d?.offers))setDiscounts(d.offers);})
   .catch(()=>{});
  return ()=>{live=false};
 },[]);
 if(data?.enabled===false)return null;
 const links=data?.links||[],offers=data?.offers||[],flashOffers=data?.flashOffers||[];
 if(!links.length&&!offers.length&&!flashOffers.length&&!discounts.length)return null;
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
  {discounts.length>0&&<div className="vivi-discounts-section" id="descontos">
   <div className="vivi-discounts-heading">
    <ShieldCheck size={19}/>
    <div><h3>Produtos com desconto na Shopee</h3>
     <p>Seleção da Vivi com preços e percentuais encontrados na API.</p></div>
   </div>
   <div className="vivi-discounts-scroll">
    {discounts.slice(0,8).map(item=><a key={item.id}
     className="vivi-discount-card" href={'/produto/'+encodeURIComponent(item.id)}
     target="_blank" rel="noopener noreferrer">
     <div className="vivi-discount-image">
      {safe(item.image)?<img src={item.image} alt="" loading="lazy"/>:null}
      <span>-{item.discount}%</span>
     </div>
     <strong>{item.title}</strong>
     <b>{Number(item.price).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</b>
     <small>Ver produto <ArrowUpRight size={13}/></small>
    </a>)}
   </div>
   <p className="vivi-discounts-note">
    Descontos consultados na API de Afiliados, não necessariamente na seção Ofertas Relâmpago. Confirme preços e condições na loja.
   </p>
  </div>}
  {flashOffers.length>0&&<div className="vivi-live-flash-section">
   <div className="vivi-live-flash-heading">
    <Flame size={19}/>
    <div><h3>Campanhas relâmpago da Shopee</h3>
    <p>Identificadas pelo nome na API de Afiliados. Confira o preço e a validade na Shopee.</p></div>
   </div>
   <div className="vivi-live-flash-grid">
    {flashOffers.map((offer,i)=><a key={offer.link||i}
      href={offer.link} target="_blank"
      rel="noopener noreferrer nofollow sponsored"
      className="vivi-live-flash-card">
      {safe(offer.image)&&<img src={offer.image} loading="lazy" alt=""/>}
      <span className="vivi-live-flash-card-copy">
       <strong>{offer.title}</strong>
       {offer.end&&<small><CalendarDays size={13}/> Até {new Date(offer.end*1000).toLocaleDateString('pt-BR')}</small>}
       <em>Ver campanha <ArrowUpRight size={15}/></em>
      </span>
    </a>)}
   </div>
  </div>}
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

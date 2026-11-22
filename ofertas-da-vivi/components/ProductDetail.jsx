'use client';
import {useEffect,useMemo,useState} from 'react';
import {ArrowLeft,ArrowUpRight,ShoppingBag,ShieldCheck,Images,Star,Store,PackageCheck,Info,ExternalLink,Tag} from 'lucide-react';
import {getThemeCssVars} from '../lib/site-theme';

const money=value=>Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const number=n=>Number(n).toLocaleString('pt-BR');
const onlyHTTPS=value=>{try{const u=new URL(value);return u.protocol==='https:'}catch{return false}};
export default function ProductDetail({offer,themeSettings={}}){
 const [live,setLive]=useState(null),[warning,setWarning]=useState('');
 const [loading,setLoading]=useState(true),[selected,setSelected]=useState(0);
 useEffect(()=>{
  let valid=true;
  fetch('/api/product-info/'+encodeURIComponent(offer.id),{cache:'no-store'})
   .then(async r=>{if(!r.ok)throw Error('Consulta complementar indisponível.');return r.json()})
   .then(d=>{if(!valid)return;setLive(d.live||null);setWarning(d.live?.warning||'')})
   .catch(()=>{if(valid)setWarning('Não foi possível consultar dados adicionais agora.')})
   .finally(()=>{if(valid)setLoading(false)});
  return ()=>{valid=false};
 },[offer.id]);
 const photos=useMemo(()=>[...new Set([...(live?.images||[]),...(offer.images||[]),live?.image,offer.image]
  .filter(onlyHTTPS))].slice(0,12),[live,offer.images,offer.image]);
 const price=live?.matched&&live.priceMin!=null?live.priceMin:offer.price;
 const priceMax=live?.matched&&live.priceMax!=null?live.priceMax:null;
 const description=live?.description||offer.description;
 const stock=live?.stockSource?live.stockQuantity:offer.stockQuantity;
 const sales=live?.matched?live.sales:offer.sales;
 const rating=live?.matched?live.ratingStar:offer.ratingStar;
 const shop=live?.matched?live.shopName:offer.shopName;
 const discount=live?.matched&&live.discountRate!=null?
   (Number(live.discountRate)<=1?Number(live.discountRate)*100:Number(live.discountRate)):
   offer.discount;
 const code=offer.internalCode||'Não atribuído';
 return <main className="vivi-product-page" data-vivi-theme={themeSettings.heroTheme||"orange"} style={getThemeCssVars(themeSettings)}>
  <div className="vivi-product-top">
   <a href="/" aria-label="Voltar para ofertas"><ArrowLeft size={19}/> Voltar às ofertas</a>
   <strong>♡ Ofertas da <em>Vivi</em></strong>
  </div>
  <div className="vivi-product-layout">
   <section className="vivi-product-gallery">
    <div className="vivi-product-main-image"><img src={photos[selected]||photos[0]||'/images/produto-1.webp'} alt={offer.title}
      onError={e=>{e.currentTarget.src='/images/produto-1.webp'}}/></div>
    {photos.length>1&&<div className="vivi-product-thumbs">{photos.map((p,i)=><button key={p} type="button"
      className={selected===i?'selected':''} onClick={()=>setSelected(i)} aria-label={'Foto '+(i+1)}>
      <img src={p} alt="" loading="lazy"/></button>)}</div>}
    <div className="vivi-product-photo-caption"><Images size={16}/>{photos.length} foto(s) disponível(is) · Galeria conforme os dados recebidos</div>
   </section>
   <section className="vivi-product-info">
    <span className="vivi-product-eyebrow"><ShieldCheck size={15}/> Selecionado pela Vivi</span>
    <h1>{offer.title}</h1>
    <p className="vivi-product-code">Código da Vivi: <b>{code}</b></p>
    <div className="vivi-product-price">{price==null?<strong className="vivi-product-no-price">Confira o preço na Shopee</strong>:
      <strong>{money(price)}{priceMax!=null&&priceMax>price&&<small> até {money(priceMax)}</small>}</strong>}
     {Number(discount)>0&&<span>Desconto informado: {Number(discount).toFixed(0)}%</span>}
    </div>
    <div className="vivi-product-stats">
     <div><Store size={18}/><small>Loja</small><b>{shop||'Consulte a Shopee'}</b></div>
     <div><Star size={18}/><small>Avaliação</small><b>{rating!=null&&rating>0?Number(rating).toFixed(1):'Não informada'}</b></div>
     <div><ShoppingBag size={18}/><small>Vendas na Shopee</small><b>{sales!=null?number(sales):'Não informadas'}</b></div>
     <div><PackageCheck size={18}/><small>Estoque</small><b>{stock!=null?number(stock)+' un.':'Consultar na Shopee'}</b></div>
    </div>
    <a className="vivi-product-buy" href={'/api/go/'+encodeURIComponent(offer.id)}
      target="_blank" rel="noopener noreferrer nofollow sponsored">Comprar na Shopee <ArrowUpRight size={20}/></a>
    <p className="vivi-product-disclaimer">Você será direcionado para a Shopee. Preço, estoque, frete, pagamento e disponibilidade são confirmados pela loja.</p>
    {loading&&<p className="vivi-product-api-status">Consultando informações adicionais da API Shopee…</p>}
    {!loading&&<p className="vivi-product-api-status"><Info size={15}/> {live?.matched?
      'Dados comerciais atualizados pela API de Afiliados.' :
      'Informações exibidas conforme o cadastro da Vivi.'} {warning}</p>}
   </section>
  </div>
  <section className="vivi-product-description">
   <h2>Descrição e informações do produto</h2>
   {description?<p style={{whiteSpace:'pre-wrap'}}>{description}</p>:
    <p>A descrição completa e as especificações do anúncio não foram disponibilizadas pela API de Afiliados. Consulte a página da Shopee para conferir características, tamanhos, variações e condições de entrega.</p>}
   <div className="vivi-product-sourced">
    <Tag size={17}/> {offer.category||'Outros'} <span>·</span> <ShieldCheck size={17}/> Link de afiliado
   </div>
  </section>
 </main>;
}

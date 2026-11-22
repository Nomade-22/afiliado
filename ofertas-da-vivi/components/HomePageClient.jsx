'use client';
import {useEffect,useMemo,useState} from 'react';
import {Search,Flame,TicketPercent,House,ShoppingBag,Heart,Menu,X,ArrowRight,ChevronRight,Star,Headphones,Shirt,Sparkles,Laptop,Utensils,Gamepad2,Copy,Check,PawPrint,HeartPulse,Dumbbell,Car,Package,SlidersHorizontal,Instagram,ShieldCheck,Clock,Gift,Tag,ExternalLink,MessageCircle,Truck,Shield,ArrowUpRight} from 'lucide-react';
import {categories,defaultSettings} from '../lib/demo';
import CampaignsSection from '../components/CampaignsSection';
import HeroCarousel from '../components/HeroCarousel';
import InteriorBanners from '../components/InteriorBanners';
import {getPublicThemeCssVars} from '../lib/site-theme';
import {ChristmasAnnouncement,ChristmasLights,ChristmasSnow} from '../components/ChristmasDecor';
import {BlackFridayAnnouncement,BlackFridayAtmosphere} from '../components/BlackFridayDecor';
import SiteInteractionEffects from '../components/SiteInteractionEffects';
import FooterSocials from '../components/FooterSocials';
const brl=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const catIcons={'Todos':<Sparkles size={24}/>,'Casa':<House size={25}/>,'Beleza':<Sparkles size={25}/>,'Moda':<Shirt size={25}/>,'Eletrônicos':<Laptop size={25}/>,'Utilidades':<Utensils size={25}/>,'Infantil':<Gift size={25}/>,'Saúde':<HeartPulse size={25}/>,'Pets':<PawPrint size={25}/>,'Esportes':<Dumbbell size={25}/>,'Automotivo':<Car size={25}/>,'Outros':<Package size={25}/>};
function Logo(){return <a href="/" className="brand"><span className="logo-mark"><Heart size={18} fill="white" strokeWidth={2.5}/></span><span>Ofertas da <em>Vivi</em><b className="brand-heart">♡</b></span></a>}
function ProductCard({offer,mode}){
 const active=mode==='live'&&offer.url&&!offer.isDemo;
 const link=active?'/produto/'+encodeURIComponent(offer.id):'#ofertas';
 const price=Number(offer.price);
 const hasPrice=offer.price!==null&&offer.price!==undefined&&Number.isFinite(price)&&price>0;
 const maxPrice=Number(offer.priceMax);
 const hasRange=hasPrice&&Number.isFinite(maxPrice)&&maxPrice>price;
 const oldPrice=Number(offer.oldPrice);
 const manualReference=hasPrice&&Number.isFinite(oldPrice)&&oldPrice>price&&
  offer.discountSource==='manual';
 const lastCheck=offer.discountCheckedAt?Date.parse(offer.discountCheckedAt):0;
 const refreshed=Number.isFinite(lastCheck)&&lastCheck>0&&
  Date.now()-lastCheck>=0&&Date.now()-lastCheck<=72*3600*1000;
 const discount=Number(offer.verifiedDiscount||0);
 const confirmed=refreshed&&Number.isFinite(discount)&&discount>=1&&discount<=95;
 const numericDiscount=confirmed?Math.round(discount):
   manualReference&&offer.discount>0?Math.round(offer.discount):0;
 return <article className="product-card vivi-modern-product">
  <a href={link} className="vivi-card-link"
   target={active?'_blank':undefined} rel={active?'noopener noreferrer':undefined}
   aria-label={'Ver detalhes de '+offer.title}>
   <div className="product-media">
    <img alt={offer.title} src={offer.image||'/images/produto-1.webp'} loading="lazy"
     onError={e=>{if(!e.currentTarget.src.endsWith('/images/produto-1.webp'))
      e.currentTarget.src='/images/produto-1.webp';}}/>
    {numericDiscount>0&&<span className="sale-badge" title={confirmed?
      'Percentual informado pela API Shopee':'Comparação com preço de referência cadastrado'}>
      <Tag size={13}/> -{numericDiscount}%
     </span>}
    {offer.isOfficialShop===true&&<span className="vivi-official-store-badge"
      title="Loja classificada como Shopee Mall nos dados da API de Afiliados">
      <ShieldCheck size={13}/> Loja oficial
     </span>}
   </div>
   <div className="product-content">
    <div className="vivi-card-strap">
     <ShieldCheck size={13}/>
     <span>{confirmed?'Desconto Shopee':
       refreshed?'Preço consultado na Shopee':'Selecionado pela Vivi'}</span>
    </div>
    <h3>{offer.title}</h3>
    <div className="price-zone vivi-card-price">
     {manualReference&&<del>{brl(oldPrice)}</del>}
     {hasPrice?<>
      {hasRange&&<small className="vivi-price-caption">A partir de</small>}
      <strong>{brl(price)}</strong>
      <small className="vivi-price-foot">{refreshed?
       'Preço consultado · confirme na loja':'Confira o valor atualizado na loja'}</small>
     </>:<>
      <strong className="price-unavailable">Ver preço na Shopee</strong>
      <small className="vivi-price-foot">Valor e descontos na loja</small>
     </>}
    </div>
    <span className={'offer-button '+(active?'':'disabled-offer')}>
     {active?'Ver detalhes':'Em preparação'}
     {active?<ArrowRight size={16}/>:<Clock size={16}/>}
    </span>
   </div>
  </a>
 </article>;
}
export default function HomePageClient({initialOffers=[],initialSettings=defaultSettings,initialMode='live',initialError=''}){
 const [offers,setOffers]=useState(initialOffers),[settings,setSettings]=useState(initialSettings),[mode,setMode]=useState(initialMode),[loading,setLoading]=useState(false),[retryCount,setRetryCount]=useState(0),[loadError,setLoadError]=useState(initialError),[q,setQ]=useState(''),[activeCat,setActiveCat]=useState('Todos'),[sort,setSort]=useState('destaques'),[menuOpen,setMenuOpen]=useState(false),[favorites,setFavorites]=useState([]),[showFavorites,setShowFavorites]=useState(false);
 const [campaignData,setCampaignData]=useState(null);
 useEffect(()=>{
  let alive=true;
  fetch('/api/campaigns')
   .then(r=>r.ok?r.json():null)
   .then(d=>{if(alive)setCampaignData(d)})
   .catch(()=>{});
  return ()=>{alive=false};
 },[]);

 useEffect(()=>{
  // O catálogo inicial já veio do servidor. Buscar novamente somente ao clicar em Tentar novamente.
  if(retryCount===0)return;
  const controller=new AbortController();
  setLoading(true);setLoadError('');setMode('loading');
  fetch('/api/offers',{cache:'no-store',signal:controller.signal})
   .then(async r=>{
    const data=await r.json();
    if(!r.ok||data?.error||!Array.isArray(data?.offers)){
     throw Error('Falha temporária ao consultar o catálogo.');
    }
    return data;
   })
   .then(data=>{
    if(controller.signal.aborted)return;
    setOffers(data.offers);
    setSettings(data.settings||defaultSettings);
    setMode(data.mode==='demo'?'demo':'live');
   })
   .catch(error=>{
    if(controller.signal.aborted)return;
    setOffers([]);setMode('error');
    setLoadError('As ofertas não foram carregadas. Tente novamente.');
   })
   .finally(()=>{if(!controller.signal.aborted)setLoading(false)});
  return ()=>controller.abort();
 },[retryCount]);
 useEffect(()=>{
  try{setFavorites(JSON.parse(localStorage.getItem('vivi-favorites')||'[]'))}catch{}
 },[]);
 const shownCategories=useMemo(()=>categories.filter(c=>c==='Todos'||offers.some(o=>o.category===c)),[offers]);
 const filtered=useMemo(()=>{let arr=offers.filter(o=>(activeCat==='Todos'||o.category===activeCat)&&(!q||o.title.toLowerCase().includes(q.toLowerCase()))&&(!showFavorites||favorites.includes(o.id)));if(sort==='preco-crescente')arr.sort((a,b)=>(a.price==null?Infinity:a.price)-(b.price==null?Infinity:b.price));else if(sort==='preco-decrescente')arr.sort((a,b)=>(b.price==null?-1:b.price)-(a.price==null?-1:a.price));else if(sort==='desconto')arr.sort((a,b)=>(b.discount||0)-(a.discount||0));else arr.sort((a,b)=>Number(b.featured)-Number(a.featured));return arr},[offers,q,activeCat,sort,showFavorites,favorites]);
 function setCat(c){setActiveCat(prev=>prev===c?'Todos':c);setMenuOpen(false);document.getElementById('ofertas')?.scrollIntoView({behavior:'smooth'})}
 const whatsappOK=Boolean(settings.whatsapp&&settings.whatsapp.startsWith('https://'));const channel=whatsappOK?settings.whatsapp:null;
 const blackFriday=settings.blackFridayTheme==='on';
 const christmas=!blackFriday&&settings.christmasTheme==='on';
 const effectsMode=['off','soft','lively'].includes(settings.effectsMode)?settings.effectsMode:'lively';
 const theme=blackFriday?'black-friday':christmas?'christmas':'normal';
  // Mostra os dois acessos promocionais desde o primeiro carregamento, com
  // links já cadastrados. A API atualiza os links quando responde.
  const quickCampaignData={
   enabled:settings.campaignsEnabled!=='off'&&campaignData?.enabled!==false,
   links:Array.isArray(campaignData?.links)&&campaignData.links.length
    ?campaignData.links
    :[
     {id:'flash',title:settings.flashSaleLabel||'Ofertas relâmpago',
      url:settings.flashSaleUrl,description:'Confira as ofertas disponíveis na Shopee.'},
     {id:'coupon',title:settings.couponLabel||'Cupons da Shopee',
      url:settings.couponUrl,description:'Consulte os cupons disponíveis e suas regras na Shopee.'}
    ]
  };
 return <div className={'site-shell'+(christmas?' vivi-christmas':'')+(blackFriday?' vivi-black-friday':'')} data-vivi-theme={settings.heroTheme||"orange"} data-vivi-effects={effectsMode} style={getPublicThemeCssVars(settings)}>
  <SiteInteractionEffects theme={theme} mode={effectsMode}/>
  {christmas&&<ChristmasAnnouncement/>}
  {blackFriday&&<BlackFridayAnnouncement/>}
  <header className="site-header"><div className="header-top container"><Logo/><form className="searchbox" onSubmit={e=>{e.preventDefault();document.getElementById('ofertas')?.scrollIntoView({behavior:'smooth'})}}><Search size={19} color="#777"/><input aria-label="Buscar produtos" value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar produtos, ofertas e cupons..."/><button aria-label="Pesquisar" type="submit"><Search size={20}/></button></form><div className="header-side"><span className="header-side-label"><span>🛍️</span><strong>Achadinhos</strong><small>Selecionados com carinho</small></span><button className="mobile-menu" onClick={()=>setMenuOpen(!menuOpen)} aria-label="Abrir menu">{menuOpen?<X/>:<Menu/>}</button></div></div><nav className={'main-nav '+(menuOpen?'nav-open':'')}><div className="container nav-content"><button onClick={()=>{setCat('Todos');window.scrollTo({top:0,behavior:'smooth'})}}><House size={19}/> Início</button><button onClick={()=>{setCat('Todos');setSort('desconto')}}><Flame size={19}/> Ofertas do Dia</button><button onClick={()=>document.getElementById('cupons')?.scrollIntoView({behavior:'smooth'})}><TicketPercent size={19}/> Cupons</button><button onClick={()=>document.getElementById('categorias')?.scrollIntoView({behavior:'smooth'})}><Menu size={18}/> Categorias</button>{channel?<a href={channel} target="_blank" rel="noopener noreferrer" className="nav-whatsapp"><MessageCircle size={19}/> Canal VIP da Vivi</a>:<span className="nav-whatsapp nav-placeholder"><MessageCircle size={19}/> Canal VIP em breve</span>}</div></nav>{christmas&&<ChristmasLights/>}</header>
  <main className="container vivi-main">
   {christmas&&effectsMode!=='off'&&<ChristmasSnow/>}
   {blackFriday&&effectsMode!=='off'&&<BlackFridayAtmosphere/>}
   {loading?<section className="vivi-home-loading" role="status" aria-live="polite">
     <div className="vivi-home-loading-line"/><span>Carregando os achadinhos da Vivi…</span>
     <small>Consultando as ofertas publicadas.</small>
    </section>:mode==='error'?<section className="vivi-home-load-error" role="alert">
     <strong>Não conseguimos carregar as ofertas agora.</strong>
     <p>{loadError}</p>
     <button className="btn btn-primary" onClick={()=>setRetryCount(x=>x+1)}>Tentar novamente</button>
    </section>:<>
   <HeroCarousel settings={settings} offers={offers}/>
   <CampaignsSection part="quick" data={quickCampaignData}/>
   {mode==='demo'&&<div className="demo-alert"><Sparkles size={16}/><span><strong>Prévia do site:</strong> imagens e preços abaixo são ilustrativos. As ofertas reais aparecerão quando conectarmos a Shopee e ativarmos os produtos.</span></div>}
   <section className="categories-section" id="categorias"><div className="section-heading"><h2>Categorias</h2><button onClick={()=>setCat('Todos')} className="text-action">Todas as categorias <ChevronRight size={17}/></button></div><div className="category-grid">{shownCategories.map(c=><button key={c} className={'category-item '+(activeCat===c?'category-active':'')} onClick={()=>setCat(c)}>{catIcons[c]}<span>{c}</span></button>)}</div></section>
   <InteriorBanners settings={settings} placement="after-categories"/>
   <section className="offers-section" id="ofertas"><div className="section-heading offers-header"><div><h2><Star size={23} fill="#ff9515" color="#ff9515"/> Ofertas em destaque</h2><p>Os achadinhos que a Vivi separou para você</p></div><div className="filter-controls"><button className={'favorite-filter '+(showFavorites?'selected':'')} onClick={()=>setShowFavorites(!showFavorites)} aria-pressed={showFavorites}><Heart size={17} fill={showFavorites?'currentColor':'none'}/> Favoritos</button><select aria-label="Ordenar ofertas" value={sort} onChange={e=>setSort(e.target.value)}><option value="destaques">Destaques</option><option value="preco-crescente">Menor preço</option><option value="preco-decrescente">Maior preço</option><option value="desconto">Maior desconto</option></select></div></div>{filtered.length?<div className="product-grid">{filtered.map(o=><div className="product-wrap" key={o.id}><ProductCard offer={o} mode={mode}/><button className={'heart-btn '+(favorites.includes(o.id)?'favorited':'')} aria-label="Salvar nos favoritos" onClick={()=>{let next=favorites.includes(o.id)?favorites.filter(id=>id!==o.id):[...favorites,o.id];setFavorites(next);localStorage.setItem('vivi-favorites',JSON.stringify(next))}}><Heart size={16} fill={favorites.includes(o.id)?'currentColor':'none'}/></button></div>)}</div>:<div className="empty-offers"><Search size={28}/><strong>Nenhuma oferta encontrada</strong><p>Tente outra palavra ou escolha uma categoria diferente.</p><button className="btn btn-primary" onClick={()=>{setQ('');setActiveCat('Todos');setShowFavorites(false)}}>Limpar filtros</button></div>}</section>
   <InteriorBanners settings={settings} placement="after-offers"/>
   </>}
   <CampaignsSection part="details" data={campaignData}/>
   <section className="whatsapp-banner" id="whatsapp"><div className="whatsapp-graphic"><MessageCircle size={43} strokeWidth={2.8}/></div><div className="whatsapp-message"><span className="whatsapp-kicker">NOVIDADES EM PRIMEIRA MÃO</span><h2>Entre no Canal VIP da Vivi</h2><p>Receba achadinhos, cupons e promoções diretamente no seu WhatsApp.</p></div>{channel?<a className="btn btn-green whatsapp-cta" href={channel} rel="noopener noreferrer" target="_blank"><MessageCircle size={20}/> Entrar no Canal VIP <ArrowRight size={18}/></a>:<span className="btn btn-green whatsapp-cta disabled-cta"><MessageCircle size={20}/> Canal em preparação</span>}</section>
   {mode!=='loading'&&mode!=='error'&&<InteriorBanners settings={settings} placement="bottom"/>}
  </main>
  <footer className="site-footer">
  <div className="container footer-grid">
   <div className="footer-intro">
    <Logo/>
    <p>Uma seleção de achadinhos e oportunidades feita com carinho pela Vivi.</p>
    <small>Este site pode receber comissões pelas compras efetuadas por links de afiliados, sem custo adicional para você. Preços e disponibilidade podem mudar.</small>
   </div>
   <FooterSocials settings={settings}/>
   <div className="vivi-footer-help">
    <h3>Ajuda</h3>
    <span>Confira valores e entrega na loja</span>
    <span>Produtos e pagamentos são gerenciados pela loja de destino</span>
   </div>
  </div>
  <div className="footer-bottom container">
   <span>© {new Date().getFullYear()} Ofertas da Vivi</span>
   <div className="vivi-footer-legal">
    <a href="/privacidade">Privacidade</a>
    <a href="/termos">Termos de uso</a>
   </div>
   <span>Não é loja oficial da Shopee.</span>
  </div>
 </footer>
 </div>
}

'use client';
import {useEffect,useMemo,useState} from 'react';
import {Search,Flame,TicketPercent,House,ShoppingBag,Heart,Menu,X,ArrowRight,ChevronRight,Star,Headphones,Shirt,Sparkles,Laptop,Utensils,Gamepad2,Copy,Check,PawPrint,HeartPulse,Dumbbell,Car,Package,SlidersHorizontal,Instagram,ShieldCheck,Clock,Gift,Tag,ExternalLink,MessageCircle,Truck,Shield,ArrowUpRight} from 'lucide-react';
import {categories,demoOffers,defaultSettings} from '../lib/demo';
import CampaignsSection from '../components/CampaignsSection';
import HeroCarousel from '../components/HeroCarousel';
const brl=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const catIcons={'Todos':<Sparkles size={24}/>,'Casa':<House size={25}/>,'Beleza':<Sparkles size={25}/>,'Moda':<Shirt size={25}/>,'Eletrônicos':<Laptop size={25}/>,'Utilidades':<Utensils size={25}/>,'Infantil':<Gift size={25}/>,'Saúde':<HeartPulse size={25}/>,'Pets':<PawPrint size={25}/>,'Esportes':<Dumbbell size={25}/>,'Automotivo':<Car size={25}/>,'Outros':<Package size={25}/>};
function Logo(){return <a href="/" className="brand"><span className="logo-mark"><Heart size={18} fill="white" strokeWidth={2.5}/></span><span>Ofertas da <em>Vivi</em><b className="brand-heart">♡</b></span></a>}
function ProductCard({offer,mode}){
 const active=mode==='live'&&offer.url&&!offer.isDemo;
 const link=active?'/produto/'+encodeURIComponent(offer.id):'#ofertas';
 return <article className="product-card"><a href={link}
   target={active?'_blank':undefined} rel={active?'noopener noreferrer':undefined}
   className="vivi-card-link" aria-label={'Ver detalhes: '+offer.title}>
   <div className="product-media">
    <img alt={offer.title} src={offer.image||'/images/produto-1.webp'} loading="lazy"
     onError={e=>{e.currentTarget.src='/images/produto-1.webp'}}/>
    {offer.discount>0&&<div className="sale-badge">-{offer.discount}%</div>}
   </div>
   <div className="product-content">
    <div className={'verified-label '+(active?'':'sample-label')}>
     <ShieldCheck size={13}/> {active?'Oferta selecionada':'Produto ilustrativo'}
    </div>
    <h3>{offer.title}</h3>
    <div className="price-zone">
     {offer.price!=null&&offer.oldPrice>offer.price&&<del>{brl(offer.oldPrice)}</del>}
     <strong className={offer.price==null?'price-unavailable':''}>{offer.price==null?'Ver preço na Shopee':brl(offer.price)}</strong>
    </div>
    <span className={'offer-button '+(active?'':'disabled-offer')}>
     {active?'Ver detalhes':'Em preparação'} {active?<ArrowRight size={15}/>:<Clock size={15}/>}
    </span>
   </div>
  </a></article>;
}
export default function HomePage(){
 const [offers,setOffers]=useState(demoOffers),[settings,setSettings]=useState(defaultSettings),[mode,setMode]=useState('demo'),[loading,setLoading]=useState(true),[q,setQ]=useState(''),[activeCat,setActiveCat]=useState('Todos'),[sort,setSort]=useState('destaques'),[menuOpen,setMenuOpen]=useState(false),[favorites,setFavorites]=useState([]),[showFavorites,setShowFavorites]=useState(false);
 useEffect(()=>{fetch('/api/offers',{cache:'no-store'}).then(r=>r.json()).then(d=>{if(d.offers){setOffers(d.offers);setSettings(d.settings||defaultSettings);setMode(d.mode||'demo')}}).catch(()=>{}).finally(()=>setLoading(false));try{setFavorites(JSON.parse(localStorage.getItem('vivi-favorites')||'[]'))}catch{}},[]);
 const shownCategories=useMemo(()=>categories.filter(c=>c==='Todos'||offers.some(o=>o.category===c)),[offers]);
 const filtered=useMemo(()=>{let arr=offers.filter(o=>(activeCat==='Todos'||o.category===activeCat)&&(!q||o.title.toLowerCase().includes(q.toLowerCase()))&&(!showFavorites||favorites.includes(o.id)));if(sort==='preco-crescente')arr.sort((a,b)=>(a.price==null?Infinity:a.price)-(b.price==null?Infinity:b.price));else if(sort==='preco-decrescente')arr.sort((a,b)=>(b.price==null?-1:b.price)-(a.price==null?-1:a.price));else if(sort==='desconto')arr.sort((a,b)=>(b.discount||0)-(a.discount||0));else arr.sort((a,b)=>Number(b.featured)-Number(a.featured));return arr},[offers,q,activeCat,sort,showFavorites,favorites]);
 function setCat(c){setActiveCat(prev=>prev===c?'Todos':c);setMenuOpen(false);document.getElementById('ofertas')?.scrollIntoView({behavior:'smooth'})}
 const whatsappOK=Boolean(settings.whatsapp&&settings.whatsapp.startsWith('https://'));const channel=whatsappOK?settings.whatsapp:null;
 const heroProduct=offers.find(offer=>offer.id===settings.heroProductId && offer.active&&offer.url);
 const chosenHeroMode=settings.heroMode==='product'&&heroProduct?'product':
    settings.heroMode==='banner'&&settings.heroImage?'banner':'default';
 const heroImage=chosenHeroMode==='product'?heroProduct?.image:
    chosenHeroMode==='banner'?settings.heroImage:null;
 const heroTitle=chosenHeroMode==='product'?heroProduct.title:
    settings.heroTitle||defaultSettings.heroTitle;
 const heroButtonUrl=chosenHeroMode==='product'?
    '/produto/'+encodeURIComponent(heroProduct.id):
    settings.heroButtonUrl||'#ofertas';
 const heroButtonLabel=chosenHeroMode==='product'?'Ver produto':
    settings.heroButtonLabel||'Ver ofertas';
 const isHeroExternal=heroButtonUrl.startsWith('https://');
 return <div className="site-shell" data-vivi-theme={["orange","pink","purple"].includes(settings.heroTheme)?settings.heroTheme:"orange"}>
  <header className="site-header"><div className="header-top container"><Logo/><form className="searchbox" onSubmit={e=>{e.preventDefault();document.getElementById('ofertas')?.scrollIntoView({behavior:'smooth'})}}><Search size={19} color="#777"/><input aria-label="Buscar produtos" value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar produtos, ofertas e cupons..."/><button aria-label="Pesquisar" type="submit"><Search size={20}/></button></form><div className="header-side"><span className="header-side-label"><span>🛍️</span><strong>Achadinhos</strong><small>Selecionados com carinho</small></span><button className="mobile-menu" onClick={()=>setMenuOpen(!menuOpen)} aria-label="Abrir menu">{menuOpen?<X/>:<Menu/>}</button></div></div><nav className={'main-nav '+(menuOpen?'nav-open':'')}><div className="container nav-content"><button onClick={()=>{setCat('Todos');window.scrollTo({top:0,behavior:'smooth'})}}><House size={19}/> Início</button><button onClick={()=>{setCat('Todos');setSort('desconto')}}><Flame size={19}/> Ofertas do Dia</button><button onClick={()=>document.getElementById('cupons')?.scrollIntoView({behavior:'smooth'})}><TicketPercent size={19}/> Cupons</button><button onClick={()=>document.getElementById('categorias')?.scrollIntoView({behavior:'smooth'})}><Menu size={18}/> Categorias</button>{channel?<a href={channel} target="_blank" rel="noopener noreferrer" className="nav-whatsapp"><MessageCircle size={19}/> Canal VIP da Vivi</a>:<span className="nav-whatsapp nav-placeholder"><MessageCircle size={19}/> Canal VIP em breve</span>}</div></nav></header>
  <main className="container">
   <HeroCarousel settings={settings} offers={offers}/>
   {mode==='demo'&&<div className="demo-alert"><Sparkles size={16}/><span><strong>Prévia do site:</strong> imagens e preços abaixo são ilustrativos. As ofertas reais aparecerão quando conectarmos a Shopee e ativarmos os produtos.</span></div>}
   <section className="categories-section" id="categorias"><div className="section-heading"><h2>Categorias</h2><button onClick={()=>setCat('Todos')} className="text-action">Todas as categorias <ChevronRight size={17}/></button></div><div className="category-grid">{shownCategories.map(c=><button key={c} className={'category-item '+(activeCat===c?'category-active':'')} onClick={()=>setCat(c)}>{catIcons[c]}<span>{c}</span></button>)}</div></section>
   <section className="offers-section" id="ofertas"><div className="section-heading offers-header"><div><h2><Star size={23} fill="#ff9515" color="#ff9515"/> Ofertas em destaque</h2><p>Os achadinhos que a Vivi separou para você</p></div><div className="filter-controls"><button className={'favorite-filter '+(showFavorites?'selected':'')} onClick={()=>setShowFavorites(!showFavorites)} aria-pressed={showFavorites}><Heart size={17} fill={showFavorites?'currentColor':'none'}/> Favoritos</button><select aria-label="Ordenar ofertas" value={sort} onChange={e=>setSort(e.target.value)}><option value="destaques">Destaques</option><option value="preco-crescente">Menor preço</option><option value="preco-decrescente">Maior preço</option><option value="desconto">Maior desconto</option></select></div></div>{filtered.length?<div className="product-grid">{filtered.map(o=><div className="product-wrap" key={o.id}><ProductCard offer={o} mode={mode}/><button className={'heart-btn '+(favorites.includes(o.id)?'favorited':'')} aria-label="Salvar nos favoritos" onClick={()=>{let next=favorites.includes(o.id)?favorites.filter(id=>id!==o.id):[...favorites,o.id];setFavorites(next);localStorage.setItem('vivi-favorites',JSON.stringify(next))}}><Heart size={16} fill={favorites.includes(o.id)?'currentColor':'none'}/></button></div>)}</div>:<div className="empty-offers"><Search size={28}/><strong>Nenhuma oferta encontrada</strong><p>Tente outra palavra ou escolha uma categoria diferente.</p><button className="btn btn-primary" onClick={()=>{setQ('');setActiveCat('Todos');setShowFavorites(false)}}>Limpar filtros</button></div>}</section>
   <CampaignsSection/>
   <section className="whatsapp-banner" id="whatsapp"><div className="whatsapp-graphic"><MessageCircle size={43} strokeWidth={2.8}/></div><div className="whatsapp-message"><span className="whatsapp-kicker">NOVIDADES EM PRIMEIRA MÃO</span><h2>Entre no Canal VIP da Vivi</h2><p>Receba achadinhos, cupons e promoções diretamente no seu WhatsApp.</p></div>{channel?<a className="btn btn-green whatsapp-cta" href={channel} rel="noopener noreferrer" target="_blank"><MessageCircle size={20}/> Entrar no Canal VIP <ArrowRight size={18}/></a>:<span className="btn btn-green whatsapp-cta disabled-cta"><MessageCircle size={20}/> Canal em preparação</span>}</section>
  </main>
  <footer className="site-footer"><div className="container footer-grid"><div className="footer-intro"><Logo/><p>Uma seleção de achadinhos e oportunidades feita com carinho pela Vivi.</p><small>Este site pode receber comissões pelas compras efetuadas por links de afiliados, sem custo adicional para você. Preços e disponibilidade podem mudar.</small></div><div><h3>Institucional</h3><a href="#ofertas">Como funciona</a><a href="#categorias">Categorias</a><a href="/privacidade">Política de privacidade</a><a href="/termos">Termos de uso</a><span>Divulgação independente de afiliados</span></div><div><h3>Ajuda</h3><span>Confira valores e entrega na loja</span><span>Produtos e pagamentos são gerenciados pela loja de destino</span></div><div><h3>Siga a Vivi</h3><div className="social-buttons">{settings.instagram&&<a title="Instagram" href={settings.instagram} target="_blank" rel="noopener noreferrer"><Instagram size={21}/></a>}{settings.tiktok&&<a title="TikTok" href={settings.tiktok} target="_blank" rel="noopener noreferrer">♪</a>}</div><small>Feito com ♥ para quem ama economizar.</small></div></div><div className="footer-bottom container"><span>© {new Date().getFullYear()} Ofertas da Vivi</span><span>Não é loja oficial da Shopee.</span></div></footer>
 </div>
}

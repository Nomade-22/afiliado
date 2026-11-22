'use client';
import {useMemo,useState} from 'react';
import {Search,Compass,ArrowRight,ChevronLeft,ChevronRight,Star,ShoppingBag,
 BadgeCheck,CheckCircle2,AlertCircle,LoaderCircle,ExternalLink,Filter,Tag,
 TrendingUp,SlidersHorizontal} from 'lucide-react';
import {categories} from '../lib/categories';

const money=value=>Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const number=value=>Number(value).toLocaleString('pt-BR');
const pct=value=>value===null||value===undefined?'—':Number(value).toLocaleString('pt-BR',{maximumFractionDigits:2})+'%';
const percentRate=rate=>rate===null||rate===undefined?null:(Number(rate)<=1?Number(rate)*100:Number(rate));
const dateOf=value=>{
 if(value===null||value===undefined)return '—';
 const raw=Number(value);
 const d=new Date(raw>1e12?raw:raw*1000);
 return Number.isFinite(d.getTime())?d.toLocaleDateString('pt-BR'):'—';
};
const safeUrl=value=>{
 try{const u=new URL(value);return u.protocol==='https:'&&
  ['shopee.com.br','shopee.com','s.shopee.com.br','shopee.ee'].some(d=>u.hostname===d||u.hostname.endsWith('.'+d))?u.toString():null}
 catch{return null}
};
const initial={keyword:'',sortType:'5',listType:'1',category:'Todos',minCommission:'',
 minRating:'',minSales:'',maxPrice:'',minPrice:'',shopType:'all',amsOnly:false,keySeller:false};
const serverQuery=f=>({
 keyword:f.keyword.trim(),sortType:Number(f.sortType),listType:Number(f.listType),
 isAMSOffer:f.amsOnly,isKeySeller:f.keySeller
});
function ShopBadge({type}){
 if(type==='MALL')return <span className="vivi-discover-shop-badge official"><BadgeCheck size={14}/> Loja oficial · Shopee Mall</span>;
 if(type==='STAR_PLUS')return <span className="vivi-discover-shop-badge preferred">Star+</span>;
 if(type==='STAR')return <span className="vivi-discover-shop-badge preferred">Star</span>;
 return <span className="vivi-discover-shop-badge unknown">Classificação não informada</span>;
}
export default function DiscoverProductsPanel({offers=[],onImported}){
 const [filters,setFilters]=useState(initial);
 const [query,setQuery]=useState(null);
 const [results,setResults]=useState(null);
 const [selected,setSelected]=useState([]);
 const [busy,setBusy]=useState(false);
 const [importing,setImporting]=useState(false);
 const [feedback,setFeedback]=useState(null);
 function change(name,value){setFilters(old=>({...old,[name]:value}))}
 function alreadyImported(item){
  return offers.some(o=>o.id===item.id||
   (o.itemId&&o.shopId&&o.itemId===item.itemId&&o.shopId===item.shopId));
 }
 async function fetchPage(page=1,originalQuery=null){
  if(busy||importing)return;
  const selectedQuery=originalQuery||serverQuery(filters);
  setBusy(true);setFeedback(null);
  try{
   const response=await fetch('/api/admin/shopee/discover',{
    method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',
    body:JSON.stringify({...selectedQuery,page})
   });
   if(response.status===401){window.location.href='/adm/login';return}
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'Não foi possível descobrir produtos.');
   setQuery(selectedQuery);
   setResults(data);
   setSelected([]);
  }catch(error){
   setFeedback({kind:'error',text:String(error.message||error)});
  }finally{setBusy(false)}
 }
 const displayed=useMemo(()=>{
  if(!results)return [];
  const minCommission=filters.minCommission===''?null:Number(filters.minCommission);
  const minRating=filters.minRating===''?null:Number(filters.minRating);
  const minSales=filters.minSales===''?null:Number(filters.minSales);
  const minPrice=filters.minPrice===''?null:Number(filters.minPrice);
  const maxPrice=filters.maxPrice===''?null:Number(filters.maxPrice);
  return results.offers.filter(item=>{
   if(filters.category!=='Todos'&&item.category!==filters.category)return false;
   if(filters.shopType!=='all'&&
    (filters.shopType==='official'?item.shopType!=='MALL':
     filters.shopType==='preferred'?!['STAR','STAR_PLUS'].includes(item.shopType):
     item.shopType!==null))return false;
   if(minCommission!==null&&(item.commissionPercent===null||item.commissionPercent<minCommission))return false;
   if(minRating!==null&&(item.ratingStar===null||item.ratingStar<minRating))return false;
   if(minSales!==null&&(item.sales===null||item.sales<minSales))return false;
   if(minPrice!==null&&(item.price===null||item.price<minPrice))return false;
   if(maxPrice!==null&&(item.price===null||item.price>maxPrice))return false;
   return true;
  });
 },[results,filters.category,filters.shopType,filters.minCommission,
   filters.minRating,filters.minSales,filters.minPrice,filters.maxPrice]);
 const eligible=displayed.filter(p=>!alreadyImported(p));
 const selectedEligible=selected.filter(id=>eligible.some(x=>x.id===id));
 function toggle(id){
  setSelected(old=>old.includes(id)?old.filter(k=>k!==id):[...old,id]);
 }
 async function importSelected(){
  if(importing||busy||!selectedEligible.length||!query||!results)return;
  setImporting(true);setFeedback(null);
  let imported=0,skipped=0;
  const errors=[];
  try{
   for(let i=0;i<selectedEligible.length;i+=8){
    const resp=await fetch('/api/admin/sync',{
     method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',
     body:JSON.stringify({...query,limit:24,page:results.page,ids:selectedEligible.slice(i,i+8)})
    });
    if(resp.status===401){window.location.href='/adm/login';return}
    const d=await resp.json();
    if(!resp.ok)throw Error(d.error||'Não foi possível importar.');
    imported+=Number(d.imported||0);
    skipped+=Number(d.skipped||0);
    for(const error of d.errors||[])errors.push(error.message||'Erro de importação');
   }
   await onImported?.();
   setSelected([]);
   setFeedback({kind:errors.length?'error':'success',text:
    imported+' produto(s) cadastrado(s) como inativo(s), com Sub ID individual. '+
    skipped+' duplicado(s) ignorado(s). '+(errors.length?'Falhas: '+errors.slice(0,2).join(' | '):'Para aparecer no site, publique na aba Produtos.')});
  }catch(error){setFeedback({kind:'error',text:String(error?.message||'Falha ao importar. Atualize a pesquisa.')+
   (imported?' Já importados: '+imported+'.':'')});await onImported?.()}
  finally{setImporting(false)}
 }
 return <div className="vivi-discover">
  <section className="admin-card vivi-discover-intro">
   <div className="admin-card-title"><h2><Compass size={23}/> Descobrir produtos na Shopee</h2></div>
   <p className="muted-text">Explore produtos de toda a busca de afiliados, não apenas os que estão na sua vitrine. Compare comissões, lojas, avaliações e vendas; escolha o que vale a pena cadastrar.</p>
   <div className="vivi-discover-top-controls">
    <label className="vivi-discover-field vivi-discover-keyword"><span>Buscar por nome ou tipo de produto</span>
     <input value={filters.keyword} onChange={e=>change('keyword',e.target.value)} maxLength={80}
      placeholder="Ex.: vestido, air fryer, sandália, relógio" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();fetchPage(1)}}}/>
    </label>
    <label className="vivi-discover-field"><span>Ordenar pela API</span>
     <select value={filters.sortType} onChange={e=>change('sortType',e.target.value)}>
      <option value="5">Maior comissão</option><option value="2">Mais vendidos</option>
      <option value="1">Relevância</option><option value="4">Menor preço</option>
      <option value="3">Maior preço</option>
     </select>
    </label>
    <label className="vivi-discover-field"><span>Tipo de lista Shopee</span>
     <select value={filters.listType} onChange={e=>change('listType',e.target.value)}>
      <option value="1">Maior comissão</option><option value="0">Recomendados</option>
      <option value="2">Melhor desempenho</option>
     </select>
    </label>
   </div>
   <div className="vivi-discover-checks">
    <label><input type="checkbox" checked={filters.amsOnly} onChange={e=>change('amsOnly',e.target.checked)}/> Comissão extra do vendedor (AMS)</label>
    <label><input type="checkbox" checked={filters.keySeller} onChange={e=>change('keySeller',e.target.checked)}/> Key Sellers</label>
   </div>
   <button className="btn btn-primary" type="button" disabled={busy||importing} onClick={()=>fetchPage(1)}>
    {busy?<LoaderCircle size={18} className="vivi-discover-spin"/>:<Search size={18}/>}
    {busy?'Consultando Shopee…':'Buscar produtos'}
   </button>
  </section>
  <section className="admin-card vivi-discover-filters">
   <div className="admin-card-title"><h2><SlidersHorizontal size={20}/> Filtrar resultados</h2>
    <button type="button" className="btn btn-outline btn-small"
     onClick={()=>setFilters(f=>({...f,category:'Todos',minCommission:'',minRating:'',minSales:'',maxPrice:'',minPrice:'',shopType:'all'}))}>
     Limpar filtros
    </button></div>
   <div className="vivi-discover-filter-grid">
    <label className="vivi-discover-field"><span>Categoria estimada</span>
     <select value={filters.category} onChange={e=>change('category',e.target.value)}>
      {categories.map(c=><option value={c} key={c}>{c}</option>)}
     </select>
    </label>
    <label className="vivi-discover-field"><span>Tipo de loja</span>
     <select value={filters.shopType} onChange={e=>change('shopType',e.target.value)}>
      <option value="all">Todas as lojas</option><option value="official">Somente lojas oficiais (Mall)</option>
      <option value="preferred">Star e Star+</option><option value="unknown">Sem classificação</option>
     </select>
    </label>
    <label className="vivi-discover-field"><span>Comissão mínima (%)</span>
     <input type="number" min="0" max="100" step=".5" placeholder="Ex.: 10"
      value={filters.minCommission} onChange={e=>change('minCommission',e.target.value)}/>
    </label>
    <label className="vivi-discover-field"><span>Avaliação mínima (0–5)</span>
     <input type="number" min="0" max="5" step=".1" placeholder="Ex.: 4.5"
      value={filters.minRating} onChange={e=>change('minRating',e.target.value)}/>
    </label>
    <label className="vivi-discover-field"><span>Vendas mínimas</span>
     <input type="number" min="0" step="1" placeholder="Ex.: 500"
      value={filters.minSales} onChange={e=>change('minSales',e.target.value)}/>
    </label>
    <label className="vivi-discover-field"><span>Preço mínimo (R$)</span>
     <input type="number" min="0" step="1" placeholder="Ex.: 20"
      value={filters.minPrice} onChange={e=>change('minPrice',e.target.value)}/>
    </label>
    <label className="vivi-discover-field"><span>Preço máximo (R$)</span>
     <input type="number" min="0" step="1" placeholder="Ex.: 150"
      value={filters.maxPrice} onChange={e=>change('maxPrice',e.target.value)}/>
    </label>
   </div>
   <p className="vivi-discover-note"><Filter size={15}/> Comissão, avaliação, preço, categoria e tipo de loja são filtrados nos resultados carregados desta página. Para pesquisar mais produtos, avance as páginas ou altere a busca. Categorias são estimadas pelo título, não classificações oficiais da Shopee.</p>
  </section>
  {feedback&&<div className={'vivi-discover-feedback '+(feedback.kind==='error'?'error':'success')} role="status">
   {feedback.kind==='error'?<AlertCircle size={20}/>:<CheckCircle2 size={20}/>}<span>{feedback.text}</span>
  </div>}
  {results&&<section className="admin-card vivi-discover-results">
   <div className="vivi-discover-summary">
    <div><h2><TrendingUp size={21}/> Produtos encontrados</h2>
     <p>{displayed.length} exibido(s) de {results.validCount} válido(s) na página {results.page}. {results.receivedCount} retornado(s) pela API.</p>
    </div>
    <div className="vivi-discover-summary-actions">
     <button type="button" className="btn btn-outline btn-small" disabled={busy||importing||!eligible.length}
      onClick={()=>setSelected(eligible.map(o=>o.id))}>Selecionar disponíveis</button>
     <button type="button" className="btn btn-primary btn-small" disabled={busy||importing||!selectedEligible.length}
      onClick={importSelected}>
      {importing?<LoaderCircle size={16} className="vivi-discover-spin"/>:<ShoppingBag size={16}/>}
      Importar ({selectedEligible.length})
     </button>
    </div>
   </div>
   {!results.officialShopFieldAvailable&&<p className="vivi-discover-warning">A API desta conta não confirmou o campo de tipo de loja nesta consulta. O selo oficial não será exibido sem essa informação.</p>}
   <div className="vivi-discover-grid">
    {displayed.map(item=>{
     const exists=alreadyImported(item);
     const checked=selectedEligible.includes(item.id);
     const previewLink=safeUrl(item.productLink)||safeUrl(item.url);
     return <article key={item.id} className={'vivi-discover-card'+(checked?' selected':'')}>
      <div className="vivi-discover-image-wrap">
       <img src={item.image||'/images/produto-1.webp'} alt={item.title} loading="lazy"
        onError={e=>{e.currentTarget.src='/images/produto-1.webp'}}/>
       {item.priceDiscountRate>0&&<span className="vivi-discover-sale-tag"><Tag size={13}/> {Number(item.priceDiscountRate).toLocaleString('pt-BR',{maximumFractionDigits:0})}% desconto informado</span>}
      </div>
      <div className="vivi-discover-card-body">
       <ShopBadge type={item.shopType}/>
       <h3 title={item.title}>{item.title}</h3>
       <p className="vivi-discover-store">{item.shopName||'Loja não informada'} · {item.category}</p>
       <div className="vivi-discover-prices">
        <strong>{money(item.price)}</strong>
        {item.priceMax>item.price&&<span>até {money(item.priceMax)}</span>}
       </div>
       <div className="vivi-discover-commission">
        <span>Comissão total <b>{pct(item.commissionPercent)}</b></span>
        <span>Shopee <b>{pct(percentRate(item.shopeeCommissionRate))}</b></span>
        <span>Vendedor <b>{pct(percentRate(item.sellerCommissionRate))}</b></span>
        <span>Valor informado <b>{item.commission!==null?money(item.commission):'—'}</b></span>
       </div>
       <div className="vivi-discover-stats">
        <span><Star size={15}/> {item.ratingStar!==null?Number(item.ratingStar).toLocaleString('pt-BR',{maximumFractionDigits:1}):'Sem avaliação'}</span>
        <span><ShoppingBag size={15}/> {item.sales!==null?number(item.sales)+' vendas':'Vendas indisponíveis'}</span>
       </div>
       <details className="vivi-discover-details">
        <summary>Outros dados da API</summary>
        <dl>
         <div><dt>ID do anúncio</dt><dd>{item.itemId}</dd></div>
         <div><dt>ID da loja</dt><dd>{item.shopId}</dd></div>
         <div><dt>Categorias Shopee (IDs)</dt><dd>{item.productCatIds?.length?item.productCatIds.join(', '):'Não disponibilizadas'}</dd></div>
         <div><dt>Início da campanha</dt><dd>{dateOf(item.periodStartTime)}</dd></div>
         <div><dt>Fim da campanha</dt><dd>{dateOf(item.periodEndTime)}</dd></div>
        </dl>
       </details>
       <div className="vivi-discover-card-actions">
        <label className={'vivi-discover-checkbox'+(exists?' imported':'')}>
         <input type="checkbox" disabled={exists||importing||busy} checked={exists||checked}
          onChange={()=>toggle(item.id)}/>
         {exists?'Já cadastrado':checked?'Selecionado':'Selecionar'}
        </label>
        {previewLink&&<a href={previewLink} target="_blank" rel="noopener noreferrer nofollow"
         className="vivi-discover-preview-link">Ver anúncio <ExternalLink size={14}/></a>}
       </div>
      </div>
     </article>;
    })}
   </div>
   {!displayed.length&&<div className="no-data">Nenhum produto desta página corresponde aos filtros. Reduza os filtros ou consulte outra página.</div>}
   <div className="vivi-discover-pagination">
    <button className="btn btn-outline btn-small" disabled={busy||importing||results.page<=1}
     onClick={()=>fetchPage(results.page-1,query)}><ChevronLeft size={17}/> Anterior</button>
    <span>Página {results.page}</span>
    <button className="btn btn-outline btn-small" disabled={busy||importing||!results.hasNextPage}
     onClick={()=>fetchPage(results.page+1,query)}>Próxima <ChevronRight size={17}/></button>
   </div>
   <p className="vivi-discover-note">Os preços, comissões, vendas e classificações são fornecidos pela API de Afiliados e podem mudar. A seleção importa os itens como <b>inativos</b>; só aparecem no site após publicação em Produtos. O selo Loja oficial depende exclusivamente da classificação Shopee Mall informada pela API.</p>
  </section>}
  {!results&&!busy&&<section className="admin-card vivi-discover-empty">
   <Compass size={38}/><h3>Explore oportunidades fora da vitrine</h3>
   <p>Busque um produto ou descubra os recomendados. Confira as taxas de comissão antes de escolher o que cadastrar.</p>
  </section>}
 </div>;
}

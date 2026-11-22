'use client';
import {categories} from '../lib/categories';

import {useState} from 'react';
import {X,Save,Image as ImageIcon,AlertCircle,RefreshCw,CheckCircle2} from 'lucide-react';

export default function OfferEditor({offer,onClose,onSaved}){
 const [form,setForm]=useState({
  title:offer.title||'',category:offer.category||'Outros',
  price:offer.price==null?'':String(offer.price),
  oldPrice:offer.oldPrice==null?'':String(offer.oldPrice),
  image:offer.image||'',description:offer.description||'',
  imagesText:(offer.images||[]).join('\n'),
  active:Boolean(offer.active),featured:Boolean(offer.featured)
 });
 const [busy,setBusy]=useState(false),[fetching,setFetching]=useState(false),[error,setError]=useState(''),[fetchResult,setFetchResult]=useState('');
 const [sourceUrl,setSourceUrl]=useState(offer.productLink||'');
 const update=(name,value)=>setForm(old=>({...old,[name]:value}));
 async function fetchShopeeDetails(){
  setFetching(true);setError('');setFetchResult('');
  try{
   const response=await fetch('/api/admin/products/enrich-batch',{
    method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',
    body:JSON.stringify({ids:[offer.id],
      ...(sourceUrl.trim()&&sourceUrl.trim()!==String(offer.productLink||'').trim()?
        {originalProductUrl:sourceUrl.trim()}:{})})
   });
   if(response.status===401){window.location.href='/adm/login';return}
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'Não foi possível consultar a Shopee.');
   const updated=data.updated?.[0];
   if(updated){
    setForm(prev=>{
     const existing=prev.imagesText.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
     const images=[...new Set([...existing,...(updated.images||[])])].slice(0,12);
     return {...prev,
       description:prev.description||updated.description||'',
       image:prev.image||updated.image||'',
       imagesText:images.join('\n')
     };
    });
    setFetchResult('Produto identificado. '+
     (updated.fromApi?.description?'Descrição encontrada. ':'A fonte não forneceu a descrição completa. ')+
     (updated.fromApi?.photoCount>1?updated.fromApi.photoCount+' fotos disponíveis.':
      'Somente a foto principal está disponível. ')+
     (updated.sourcePublicPage?' Dados da página pública da Shopee.':' Dados da API de Afiliados.'));
    await onSaved?.();
   }else{
    const detail=(data.errors||[]).map(e=>e.reason).filter(Boolean)[0];
    setFetchResult((data.identified?'Os IDs do anúncio foram identificados e salvos. ':'')+
      (detail||'A Shopee não forneceu fotos ou descrições adicionais verificáveis.'));
   }
  }catch(e){setError(String(e?.message||'Falha ao buscar informações'))}
  finally{setFetching(false)}
 }
 async function submit(event){
  event.preventDefault();setBusy(true);setError('');
  try{
   const response=await fetch('/api/admin/offers/'+encodeURIComponent(offer.id),{
    method:'PATCH',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({...form,images:form.imagesText.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)})
   });
   if(response.status===401){window.location.href='/adm/login';return}
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'Falha ao salvar o produto.');
   await onSaved?.();
   onClose?.();
  }catch(e){setError(String(e?.message||'Falha ao salvar'))}
  finally{setBusy(false)}
 }
 return <div className="vivi-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <section className="vivi-offer-editor" role="dialog" aria-modal="true" aria-label={'Editar '+offer.title}>
   <header className="vivi-editor-header">
    <div><small>Ofertas da Vivi</small><h2>Editar produto</h2></div>
    <button type="button" onClick={onClose} aria-label="Fechar edição"><X size={23}/></button>
   </header>
   <form onSubmit={submit} className="vivi-editor-form">
    <div className="vivi-editor-image">
     <img src={form.image||'/images/produto-1.webp'} alt="Prévia do produto"
      onError={e=>{e.currentTarget.src='/images/produto-1.webp'}}/>
     <small>Imagem de capa</small>
    </div>
    <label>Nome do produto<input required maxLength={180} value={form.title} onChange={e=>update('title',e.target.value)}/></label>
    <label>Categoria<select value={form.category} onChange={e=>update('category',e.target.value)}>{categories.map(cat=><option key={cat} value={cat}>{cat}</option>)}</select></label>
    <div className="vivi-editor-columns">
     <label>Preço atual (R$)<input type="number" min="0" step="0.01" value={form.price} placeholder="Não informado"
       onChange={e=>update('price',e.target.value)}/></label>
     <label>Preço antigo (R$)<input type="number" min="0" step="0.01" value={form.oldPrice} placeholder="Opcional"
       onChange={e=>update('oldPrice',e.target.value)}/></label>
    </div>
    <label>URL HTTPS da imagem<input type="url" value={form.image} placeholder="https://..."
     onChange={e=>update('image',e.target.value)}/></label>
    <label>Link original do anúncio na Shopee
     <input type="url" value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)}
      placeholder="https://shopee.com.br/product/ID_DA_LOJA/ID_DO_PRODUTO"/>
     <small style={{fontWeight:400,color:'#7c8590',lineHeight:1.5}}>Quando os links curtos não revelarem os IDs, abra o anúncio na Shopee e copie o endereço completo. Esse campo é usado somente para buscar os detalhes; seu link de afiliado com Sub ID permanece inalterado.</small>
    </label>
    <div className="vivi-editor-fetch">
     <button className="btn btn-outline" type="button" disabled={busy||fetching}
       onClick={fetchShopeeDetails}><RefreshCw size={17}/> {fetching?'Buscando na Shopee…':'Buscar descrição e fotos na Shopee'}</button>
     <small>Busca somente dados verificáveis. Preserva textos e fotos que você já adicionou.</small>
     {fetchResult&&<p role="status" className="vivi-notice vivi-notice-success"><CheckCircle2 size={17}/> {fetchResult}</p>}
    </div>
    <label>Descrição detalhada (quando a API não fornecer)
     <textarea value={form.description} rows={5} maxLength={6000} placeholder="Características confirmadas na página do produto..."
      onChange={e=>update('description',e.target.value)}/>
    </label>
    <label>Galeria de fotos — uma URL HTTPS por linha (até 12)
     <textarea value={form.imagesText} rows={4} placeholder="https://.../foto1.jpg"
      onChange={e=>update('imagesText',e.target.value)}/>
    </label>
    <div className="vivi-editor-columns vivi-editor-toggles">
     <label><input type="checkbox" checked={form.active} onChange={e=>update('active',e.target.checked)}/> Publicar no site</label>
     <label><input type="checkbox" checked={form.featured} onChange={e=>update('featured',e.target.checked)}/> Mostrar em destaque</label>
    </div>
    <div className="vivi-editor-link-note">Código interno: {offer.internalCode||'pendente'} · Sub ID: {offer.affiliateSubIds?.join(', ')||'não confirmado'}. O link de afiliado atual é preservado. Para gerar um novo, use o botão de link na lista de produtos.</div>
    {error&&<p role="alert" className="vivi-notice vivi-notice-error"><AlertCircle size={17}/> {error}</p>}
    <div className="vivi-editor-actions">
     <button type="button" onClick={onClose} className="btn btn-outline" disabled={busy}>Cancelar</button>
     <button type="submit" className="btn btn-primary" disabled={busy||fetching}><Save size={17}/> {busy?'Salvando…':'Salvar alterações'}</button>
    </div>
   </form>
  </section>
 </div>;
}

'use client';

import {useState} from 'react';
import {X,Save,Image as ImageIcon,AlertCircle} from 'lucide-react';

const categories=['Casa','Beleza','Moda','Eletrônicos','Utilidades','Infantil','Outros'];
export default function OfferEditor({offer,onClose,onSaved}){
 const [form,setForm]=useState({
  title:offer.title||'',category:offer.category||'Outros',
  price:offer.price==null?'':String(offer.price),
  oldPrice:offer.oldPrice==null?'':String(offer.oldPrice),
  image:offer.image||'',active:Boolean(offer.active),featured:Boolean(offer.featured)
 });
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const update=(name,value)=>setForm(old=>({...old,[name]:value}));
 async function submit(event){
  event.preventDefault();setBusy(true);setError('');
  try{
   const response=await fetch('/api/admin/offers/'+encodeURIComponent(offer.id),{
    method:'PATCH',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(form)
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
    <div className="vivi-editor-columns vivi-editor-toggles">
     <label><input type="checkbox" checked={form.active} onChange={e=>update('active',e.target.checked)}/> Publicar no site</label>
     <label><input type="checkbox" checked={form.featured} onChange={e=>update('featured',e.target.checked)}/> Mostrar em destaque</label>
    </div>
    <div className="vivi-editor-link-note">O link de afiliado atual é preservado. Para gerar um novo, use o botão de link na lista de produtos.</div>
    {error&&<p role="alert" className="vivi-notice vivi-notice-error"><AlertCircle size={17}/> {error}</p>}
    <div className="vivi-editor-actions">
     <button type="button" onClick={onClose} className="btn btn-outline" disabled={busy}>Cancelar</button>
     <button type="submit" className="btn btn-primary" disabled={busy}><Save size={17}/> {busy?'Salvando…':'Salvar alterações'}</button>
    </div>
   </form>
  </section>
 </div>;
}

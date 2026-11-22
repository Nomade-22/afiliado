'use client';
import {useEffect,useMemo,useState} from 'react';
import {Image as ImageIcon,Palette,Save,CheckCircle2,AlertCircle,ExternalLink,
 Plus,Trash2,ArrowLeft,ArrowRight,Upload,Flame,Images,FileText,Package,ImagePlus,ShoppingBag} from 'lucide-react';
import {readHeroSlides,getHeroInterval,newHeroSlide,MAX_HERO_SLIDES,MIN_HERO_SLIDES} from '../lib/hero-slides';
import {VIVI_THEMES,getThemeConfig,getThemeCssVars,isHeroImage} from '../lib/site-theme';

const input={width:'100%',minWidth:0,padding:'11px 12px',
 border:'1px solid #e1e2e9',borderRadius:10,fontSize:14,
 color:'#252735',background:'#fff'};
const label={fontSize:13,fontWeight:700,color:'#363743',display:'flex',flexDirection:'column',gap:7};
const TYPE_LABEL={intro:'Texto e apresentação',images:'Fotos da galeria',
 flash:'Ofertas relâmpago',product:'Produto em destaque'};
const TYPE_ICON={intro:FileText,images:Images,flash:Flame,product:Package};
const MAX_IMAGES=4;
function imageMeta(file){
 return file?.type?.startsWith('image/')&&file.size>0&&file.size<=12000000;
}
async function compressImage(file){
 if(!imageMeta(file))throw Error('Escolha imagem JPG, PNG, WebP ou formato compatível, de até 12 MB.');
 let src;
 let bitmap;
 try{
  bitmap=await createImageBitmap(file);
  src=bitmap;
 }catch{
  const url=URL.createObjectURL(file);
  try{
   src=await new Promise((resolve,reject)=>{
    const element=new Image();
    element.onload=()=>resolve(element);
    element.onerror=()=>reject(new Error('Não foi possível abrir esta imagem. Prefira JPG ou PNG.'));
    element.src=url;
   });
  }finally{URL.revokeObjectURL(url)}
 }
 const w=src.width||src.naturalWidth;
 const h=src.height||src.naturalHeight;
 if(!w||!h||w*h>45000000)throw Error('Dimensões inválidas. Escolha outra foto.');
 const width=Math.max(1,Math.round(w*Math.min(1,1500/Math.max(w,h))));
 const height=Math.max(1,Math.round(h*Math.min(1,1500/Math.max(w,h))));
 const canvas=document.createElement('canvas');
 canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d');
 if(!ctx)throw Error('O navegador não conseguiu preparar a imagem.');
 ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,height);
 ctx.drawImage(src,0,0,width,height);
 bitmap?.close?.();
 async function blob(format,quality){
  return await new Promise(resolve=>canvas.toBlob(resolve,format,quality));
 }
 let output=await blob('image/webp',.8);
 if(!output||output.type!=='image/webp')output=await blob('image/jpeg',.82);
 if(output?.size>1600000)output=await blob('image/jpeg',.64);
 if(!output||output.size>1600000)throw Error('A foto ficou acima de 1,6 MB. Tente uma imagem menor.');
 return new File([output],'vivi-banner.'+(output.type==='image/webp'?'webp':'jpg'),{type:output.type});
}
export default function BannerPanel({settings={},offers=[],onSaved,onManageOffers}){
 const [slides,setSlides]=useState(()=>readHeroSlides(settings));
 const [selected,setSelected]=useState(0);
 const [themeId,setThemeId]=useState(settings.heroTheme||'orange');
 const [palette,setPalette]=useState(()=>getThemeConfig(settings));
 const [seconds,setSeconds]=useState(getHeroInterval(settings));
 const [saving,setSaving]=useState(false);
 const [uploading,setUploading]=useState(false);
 const [uploadCount,setUploadCount]=useState({done:0,total:0});
 const [notice,setNotice]=useState(null);
 useEffect(()=>{
  setSlides(readHeroSlides(settings));
  setThemeId(settings.heroTheme||'orange');
  setPalette(getThemeConfig(settings));
  setSeconds(getHeroInterval(settings));
 },[settings]);
 const current=slides[selected]||slides[0];
 const activeOffers=offers.filter(o=>o.active&&o.url);
 const themeSettings={
  heroTheme:themeId,
  heroColorStart:palette.start,
  heroColorEnd:palette.end,
  heroAccent:palette.accent,
  heroGradientAngle:String(palette.angle),
  heroFillMode:palette.fill
 };
 const themeVars=useMemo(()=>getThemeCssVars(themeSettings),[
  themeId,palette.start,palette.end,palette.accent,palette.angle,palette.fill
 ]);
 function updateSlide(field,value){
  setSlides(old=>old.map((s,i)=>i===selected?{...s,[field]:value}:s));
  setNotice(null);
 }
 function updateImages(slideId,images){
  setSlides(old=>old.map(s=>s.id===slideId?{...s,images}:s));
 }
 function selectPreset(theme){
  setThemeId(theme.id);
  setPalette({id:theme.id,start:theme.start,end:theme.end,
   accent:theme.accent,angle:115,fill:'gradient'});
  setNotice(null);
 }
 function custom(field,value){
  setThemeId('custom');
  setPalette(prev=>({...prev,[field]:value,id:'custom'}));
  setNotice(null);
 }
 function add(type){
  if(slides.length>=MAX_HERO_SLIDES)return;
  const id='slide-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6);
  setSlides(old=>[...old,newHeroSlide(type,id)]);
  setSelected(slides.length);
 }
 function move(delta){
  const target=selected+delta;
  if(target<0||target>=slides.length)return;
  const next=[...slides];
  [next[selected],next[target]]=[next[target],next[selected]];
  setSlides(next);setSelected(target);
 }
 function remove(){
  if(slides.length<=MIN_HERO_SLIDES)return;
  setSlides(old=>old.filter((_,i)=>i!==selected));
  setSelected(i=>Math.max(0,Math.min(i,slides.length-2)));
 }
 async function uploadFiles(event){
  const files=Array.from(event.target.files||[]);
  event.target.value='';
  if(!files.length||!current)return;
  const id=current.id;
  const currentList=[...(current.images||[])];
  const capacity=MAX_IMAGES-currentList.length;
  if(capacity<=0){
   setNotice({error:true,text:'Esta página já contém 4 imagens. Remova uma antes de adicionar outra.'});return;
  }
  if(files.length>capacity){
   setNotice({error:true,text:'Restam '+capacity+' espaço(s). Selecione até 4 imagens por página.'});return;
  }
  setUploading(true);setUploadCount({done:0,total:files.length});setNotice(null);
  let completed=0;let imageList=currentList;
  try{
   for(const file of files){
    const optimized=await compressImage(file);
    const form=new FormData();
    form.set('image',optimized);
    const r=await fetch('/api/admin/media',{method:'POST',body:form,cache:'no-store'});
    if(r.status===401){window.location.href='/adm/login';return}
    const data=await r.json();
    if(!r.ok||!isHeroImage(data.url))throw Error(data.error||'Erro ao enviar a foto.');
    imageList=[...imageList,data.url].slice(0,MAX_IMAGES);
    updateImages(id,imageList);
    completed++;
    setUploadCount({done:completed,total:files.length});
   }
   setNotice({error:false,text:completed+' imagem(ns) enviada(s). Clique em Salvar todas as páginas para publicar no site.'});
  }catch(e){
   setNotice({error:true,text:'Enviadas '+completed+' de '+files.length+'. '+String(e?.message||'Erro no upload.')});
  }finally{setUploading(false)}
 }
 async function save(event){
  event.preventDefault();
  if(uploading)return;
  if(slides.every(x=>!x.enabled)){
   setNotice({error:true,text:'Ative pelo menos uma página do banner.'});return;
  }
  setSaving(true);setNotice(null);
  try{
   const r=await fetch('/api/admin/settings',{
    method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',
    body:JSON.stringify({
     ...themeSettings,
     heroSlides:JSON.stringify(slides),
     heroIntervalSeconds:String(seconds)
    })
   });
   if(r.status===401){window.location.href='/adm/login';return}
   const data=await r.json();
   if(!r.ok)throw Error(data.error||'Não foi possível salvar.');
   setNotice({error:false,text:'Configurações e '+slides.length+' páginas salvas com sucesso.'});
   await onSaved?.();
  }catch(e){setNotice({error:true,text:String(e?.message||'Falha ao salvar')})}
  finally{setSaving(false)}
 }
 if(!current)return null;
 const chosen=activeOffers.find(x=>x.id===current.productId);
 const previewImages=current.type==='product'&&chosen?.image?[chosen.image]:
  (current.images||[]).filter(isHeroImage);
 const previewBackground=current.type==='flash'?'linear-gradient(115deg,#ab1730,#f33736)':
  themeVars['--vivi-accent-gradient'];
 return <div className="vivi-carousel-admin">
  <section className="admin-card vivi-theme-editor">
   <div className="admin-card-title">
    <h2><Palette size={22}/> Cores e identidade do site</h2>
   </div>
   <p className="muted-text">Escolha uma das paletas ou monte qualquer combinação de cores e degradês. A seleção acompanha botões, categorias, detalhes e os banners (o relâmpago continua vermelho).</p>
   <div className="vivi-theme-presets">
    {VIVI_THEMES.map(t=><button key={t.id} type="button"
     className={'vivi-theme-preset'+(themeId===t.id?' selected':'')}
     onClick={()=>selectPreset(t)} title={t.name} aria-label={'Aplicar '+t.name}
     aria-pressed={themeId===t.id}>
     <span className="vivi-theme-swatch" style={{background:`linear-gradient(125deg,${t.start},${t.end})`}}/>
     <span>{t.name}</span>
    </button>)}
   </div>
   <div className="vivi-theme-customizer">
    <label style={label}>Cor inicial
     <span className="vivi-color-field"><input type="color" value={palette.start}
      onChange={e=>custom('start',e.target.value)}/><code>{palette.start}</code></span>
    </label>
    <label style={label}>Cor final
     <span className="vivi-color-field"><input type="color" value={palette.end}
      onChange={e=>custom('end',e.target.value)}/><code>{palette.end}</code></span>
    </label>
    <label style={label}>Botões e detalhes
     <span className="vivi-color-field"><input type="color" value={palette.accent}
      onChange={e=>custom('accent',e.target.value)}/><code>{palette.accent}</code></span>
    </label>
    <label style={label}>Estilo do fundo
     <select style={input} value={palette.fill} onChange={e=>custom('fill',e.target.value)}>
      <option value="gradient">Degradê</option>
      <option value="solid">Cor sólida</option>
     </select>
    </label>
   </div>
   {palette.fill==='gradient'&&<label className="vivi-angle-control">
    Ângulo do degradê: <b>{palette.angle}°</b>
    <input type="range" min="0" max="360" step="5" value={palette.angle}
     onChange={e=>custom('angle',Number(e.target.value))}/>
   </label>}
   <div className="vivi-theme-preview" style={{background:themeVars['--vivi-accent-gradient'],
    color:themeVars['--vivi-hero-ink']}}>
    <strong>Assim vai ficar a sua vitrine ✨</strong>
    <span style={{background:palette.accent,color:themeVars['--vivi-on-accent']}}>Ver ofertas →</span>
   </div>
  </section>
  <section className="admin-card">
   <div className="admin-card-title">
    <h2><Images size={21}/> Páginas do banner</h2>
    <button className="btn btn-outline btn-small" onClick={onManageOffers} type="button">Gerenciar ofertas</button>
   </div>
   <p className="muted-text">Tenha de 3 a 10 páginas, reorganize a ordem e programe a troca automática. No celular o conteúdo e as fotos ficam em áreas separadas, sem sobreposição.</p>
   <div className="vivi-carousel-global">
    <label style={label}>Tempo entre banners
     <select value={seconds} style={input} onChange={e=>setSeconds(Number(e.target.value))}>
      {[4,5,6,7,8,10,12,15,20].map(n=><option key={n} value={n}>{n} segundos</option>)}
     </select>
    </label>
    <div className="vivi-slide-count"><b>{slides.length}</b> página(s) configurada(s)</div>
   </div>
   <div className="vivi-carousel-slidebar">
    {slides.map((slide,i)=>{
     const Icon=TYPE_ICON[slide.type]||FileText;
     return <button type="button" key={slide.id}
      className={'vivi-carousel-slide-tab '+(i===selected?'chosen ':'')+(!slide.enabled?'disabled':'')}
      onClick={()=>setSelected(i)}>
      <Icon size={18}/><span>{i+1}. {TYPE_LABEL[slide.type]}</span>
     </button>;
    })}
   </div>
   <div className="vivi-carousel-slide-tools">
    <button type="button" className="btn btn-outline btn-small" disabled={selected===0||uploading}
      onClick={()=>move(-1)}><ArrowLeft size={15}/> Mover antes</button>
    <button type="button" className="btn btn-outline btn-small" disabled={selected===slides.length-1||uploading}
      onClick={()=>move(1)}>Mover depois <ArrowRight size={15}/></button>
    <button type="button" className="btn btn-outline btn-small" disabled={slides.length<=MIN_HERO_SLIDES||uploading}
      onClick={remove}><Trash2 size={15}/> Remover</button>
   </div>
   <div className="vivi-carousel-add">
    <span>Nova página:</span>
    {Object.keys(TYPE_LABEL).map(type=><button type="button" key={type}
     disabled={slides.length>=MAX_HERO_SLIDES||uploading}
     onClick={()=>add(type)}><Plus size={13}/>{TYPE_LABEL[type]}</button>)}
   </div>
  </section>
  <form className="vivi-banner-admin-grid" onSubmit={save}>
   <section className="admin-card vivi-banner-form">
    <h2><ImageIcon size={21}/> Personalizar página {selected+1}</h2>
    <label className="vivi-carousel-active">
     <input type="checkbox" checked={current.enabled}
      onChange={e=>updateSlide('enabled',e.target.checked)}/> Mostrar no site
    </label>
    <label style={label}>Tipo de banner
     <select style={input} value={current.type} onChange={e=>updateSlide('type',e.target.value)}>
      {Object.entries(TYPE_LABEL).map(([value,name])=><option key={value} value={value}>{name}</option>)}
     </select>
    </label>
    {current.type==='product'&&<label style={label}>Escolher produto ativo
     <select style={input} value={current.productId||''} onChange={e=>updateSlide('productId',e.target.value)}>
      <option value="">Selecione um produto</option>
      {activeOffers.map(o=><option key={o.id} value={o.id}>{o.title.slice(0,100)}</option>)}
     </select>
    </label>}
    <label style={label}>Etiqueta superior
     <input style={input} value={current.badge||''} maxLength={85}
      onChange={e=>updateSlide('badge',e.target.value)}/>
    </label>
    <label style={label}>Título do banner
     <textarea style={{...input,minHeight:78,resize:'vertical'}} maxLength={170}
      value={current.title||''} onChange={e=>updateSlide('title',e.target.value)}/>
    </label>
    <label style={label}>Texto de apoio
     <textarea style={{...input,minHeight:85,resize:'vertical'}} maxLength={300}
      value={current.subtitle||''} onChange={e=>updateSlide('subtitle',e.target.value)}/>
    </label>
    {current.type!=='product'&&<div className="vivi-banner-images-editor">
     <div className="vivi-banner-images-header">
      <strong><ImagePlus size={18}/> Fotos do banner</strong>
      <small>{(current.images||[]).length} / {MAX_IMAGES}</small>
     </div>
     <label className={'vivi-upload-button'+(uploading?' uploading':'')}>
      <Upload size={20}/>
      {uploading?'Enviando '+uploadCount.done+'/'+uploadCount.total+'…':
       'Escolher fotos do celular ou computador'}
      <input type="file" accept="image/*" multiple
       disabled={uploading||saving||(current.images||[]).length>=MAX_IMAGES}
       onChange={uploadFiles}/>
     </label>
     <p className="vivi-photo-info">Fotos JPG, PNG ou WebP. O site otimiza automaticamente para carregar rápido. Até quatro imagens por página.</p>
     {!!(current.images||[]).length&&<div className="vivi-admin-photo-list">
      {current.images.map((url,i)=><div key={url+i} className="vivi-admin-photo-card">
       {isHeroImage(url)?<img src={url} alt={'Imagem '+(i+1)}/>:<div>Link inválido</div>}
       <button type="button" aria-label={'Remover imagem '+(i+1)} title="Remover foto"
        onClick={()=>updateImages(current.id,current.images.filter((_,n)=>n!==i))}><Trash2 size={16}/></button>
      </div>)}
     </div>}
     <details className="vivi-image-url-details">
      <summary>Ou informar endereços das imagens</summary>
      <textarea style={{...input,minHeight:80,resize:'vertical'}}
       value={(current.images||[]).join('\n')}
       onChange={e=>updateSlide('images',e.target.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,4))}
       placeholder="https://exemplo.com/foto.webp"/>
     </details>
    </div>}
    {current.type==='flash'&&<p className="vivi-carousel-tip"><Flame size={17}/>
     Este banner mantém o vermelho de Ofertas Relâmpago e utiliza o link configurado no painel de promoções.</p>}
    <label style={label}>Texto do botão
     <input style={input} value={current.buttonLabel||''} maxLength={55}
      onChange={e=>updateSlide('buttonLabel',e.target.value)}/>
    </label>
    {current.type!=='flash'&&current.type!=='product'&&<label style={label}>Link do botão
     <input style={input} value={current.buttonUrl||''}
      onChange={e=>updateSlide('buttonUrl',e.target.value)} placeholder="#ofertas ou https://..."/>
    </label>}
    <button type="submit" className="btn btn-primary btn-wide" disabled={saving||uploading}>
     <Save size={18}/>{saving?'Salvando…':'Salvar banners e cores no site'}
    </button>
    {notice&&<div role={notice.error?'alert':'status'}
     className={'vivi-notice '+(notice.error?'vivi-notice-error':'vivi-notice-success')}>
     {notice.error?<AlertCircle size={17}/>:<CheckCircle2 size={17}/>}
     {notice.text}
    </div>}
   </section>
   <aside className="admin-card">
    <h2>Prévia da página {selected+1}</h2>
    <p className="muted-text">Esta visualização ajuda a conferir a disposição dos elementos antes de publicar.</p>
    <div className="vivi-banner-preview vivi-carousel-admin-preview"
     style={{background:previewBackground,color:current.type==='flash'?'white':themeVars['--vivi-hero-ink']}}>
     <div className="vivi-preview-copy">
      <span>{current.badge||'Destaque Vivi'}</span>
      <h3>{current.type==='product'&&chosen?chosen.title:current.title}</h3>
      <p>{current.subtitle}</p>
      <strong>{current.buttonLabel||'Ver ofertas'} ↗</strong>
     </div>
     {current.type==='images'&&previewImages.length>0?
      <div className="vivi-carousel-admin-gallery">
       {previewImages.map((url,i)=><img key={i} src={url} alt="" loading="lazy"/>)}
      </div>:previewImages[0]?<img src={previewImages[0]} alt="Prévia"/>:
      <div className="vivi-carousel-preview-illustration">{current.type==='flash'?
       <Flame size={62}/>:<ShoppingBag size={64}/>}</div>}
    </div>
    <p className="footnote">Página {selected+1} de {slides.length}. Troca automática a cada {seconds} segundos.</p>
    <a href="/" target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-wide">
     <ExternalLink size={17}/> Ver site público
    </a>
   </aside>
  </form>
 </div>;
}

'use client';
import {useEffect,useMemo,useState} from 'react';
import {Image as ImageIcon,Palette,Save,CheckCircle2,AlertCircle,ExternalLink,
 Plus,Trash2,ArrowLeft,ArrowRight,Upload,Flame,Images,FileText,Package,ImagePlus,ShoppingBag,Gift,Snowflake} from 'lucide-react';
import {readHeroSlides,getHeroInterval,newHeroSlide,MAX_HERO_SLIDES,MIN_HERO_SLIDES} from '../lib/hero-slides';
import {VIVI_THEMES,getThemeConfig,getPublicThemeCssVars,isHeroImage} from '../lib/site-theme';
import ResponsiveBannerImage,{bannerImageOf,bannerMobileImageOf} from './ResponsiveBannerImage';

const input={width:'100%',minWidth:0,padding:'11px 12px',
 border:'1px solid #e1e2e9',borderRadius:10,fontSize:14,
 color:'#252735',background:'#fff'};
const label={fontSize:13,fontWeight:700,color:'#363743',display:'flex',flexDirection:'column',gap:7};
const TYPE_LABEL={intro:'Texto e apresentação',images:'Banner de imagem inteira',
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
 const width=Math.max(1,Math.round(w*Math.min(1,1920/Math.max(w,h))));
 const height=Math.max(1,Math.round(h*Math.min(1,1500/Math.max(w,h))));
 const canvas=document.createElement('canvas');
 canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d');
 if(!ctx)throw Error('O navegador não conseguiu preparar a imagem.');
 ctx.clearRect(0,0,width,height);
 ctx.drawImage(src,0,0,width,height);
 bitmap?.close?.();
 async function blob(format,quality){
  return await new Promise(resolve=>canvas.toBlob(resolve,format,quality));
 }
 let output=await blob('image/webp',.8);
 if(output?.size>1600000)output=await blob('image/webp',.62);
 if(!output||output.type!=='image/webp'||output.size>1600000){
  ctx.globalCompositeOperation='destination-over';
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,height);
  ctx.globalCompositeOperation='source-over';
  output=await blob('image/jpeg',.65);
 }
 if(!output||output.size>1600000)throw Error('A foto ficou acima de 1,6 MB. Tente uma imagem menor.');
 return new File([output],'vivi-banner.'+(output.type==='image/webp'?'webp':'jpg'),{type:output.type});
}
export default function BannerPanel({settings={},offers=[],onSaved,onManageOffers}){
 const [slides,setSlides]=useState(()=>readHeroSlides(settings));
 const [selected,setSelected]=useState(0);
 const [previewDevice,setPreviewDevice]=useState('mobile');
 const [themeId,setThemeId]=useState(settings.heroTheme||'orange');
 const [palette,setPalette]=useState(()=>getThemeConfig(settings));
 const [seconds,setSeconds]=useState(getHeroInterval(settings));
 const [christmasTheme,setChristmasTheme]=useState(settings.christmasTheme==='on');
 const [saving,setSaving]=useState(false);
 const [uploading,setUploading]=useState(false);
 const [uploadCount,setUploadCount]=useState({done:0,total:0});
 const [notice,setNotice]=useState(null);
 useEffect(()=>{
  setSlides(readHeroSlides(settings));
  setThemeId(settings.heroTheme||'orange');
  setPalette(getThemeConfig(settings));
  setSeconds(getHeroInterval(settings));
  setChristmasTheme(settings.christmasTheme==='on');
 },[settings]);
 const current=slides[selected]||slides[0];
 const activeOffers=offers.filter(o=>o.active&&o.url);
 const themeSettings={
  heroTheme:themeId,
  christmasTheme:christmasTheme?'on':'off',
  heroColorStart:palette.start,
  heroColorEnd:palette.end,
  heroAccent:palette.accent,
  heroGradientAngle:String(palette.angle),
  heroFillMode:palette.fill
 };
 const themeVars=useMemo(()=>getPublicThemeCssVars(themeSettings),[
  themeId,christmasTheme,palette.start,palette.end,palette.accent,palette.angle,palette.fill
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
 async function uploadFiles(event,variant='desktop'){
  const files=Array.from(event.target.files||[]);
  event.target.value='';
  if(!files.length||!current)return;
  const id=current.id;
  const single=current.type==='images'||variant==='mobile';
  const currentList=[...(current.images||[])];
  const capacity=single?1:MAX_IMAGES-currentList.length;
  if(capacity<=0){
   setNotice({error:true,text:'Esta página já contém 4 imagens. Remova uma antes de adicionar outra.'});return;
  }
  if(files.length>capacity){
   setNotice({error:true,text:single?'Escolha uma imagem de cada vez.':'Restam '+capacity+' espaço(s).'});return;
  }
  setUploading(true);setUploadCount({done:0,total:files.length});setNotice(null);
  let completed=0;let imageList=single?[]:currentList;
  try{
   for(const file of files){
    const optimized=await compressImage(file);
    const form=new FormData();
    form.set('image',optimized);
    const r=await fetch('/api/admin/media',{method:'POST',body:form,cache:'no-store'});
    if(r.status===401){window.location.href='/adm/login';return}
    const data=await r.json();
    if(!r.ok||!isHeroImage(data.url))throw Error(data.error||'Erro ao enviar a foto.');
    if(variant==='mobile'){
     setSlides(old=>old.map(slide=>slide.id===id?{...slide,mobileImage:data.url}:slide));
    }else{
     imageList=single?[data.url]:[...imageList,data.url].slice(0,MAX_IMAGES);
     updateImages(id,imageList);
    }
    completed++;
    setUploadCount({done:completed,total:files.length});
   }
   setNotice({error:false,text:'Imagem enviada. Clique em Salvar personalização para publicar.'});
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
   setNotice({error:false,text:'Personalização salva: tema '+(christmasTheme?'de Natal ativado':'natalino desativado')+' e '+slides.length+' banners.'});
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
  <section className="admin-card vivi-seasonal-editor">
   <div className="admin-card-title"><h2><Gift size={22}/> Tema especial de Natal</h2>
    <span className={'vivi-season-status'+(christmasTheme?' active':'')}>{christmasTheme?'Ativo':'Desativado'}</span>
   </div>
   <p className="muted-text">Um toque natalino com luzes, neve suave, verde pinheiro, vermelho e dourado. Seus banners, fotos e links continuam iguais.</p>
   <label className="vivi-season-toggle">
    <span className="vivi-season-toggle-copy">
     <strong><Snowflake size={19}/> Ativar decoração de Natal</strong>
     <small>{christmasTheme?'Tema pronto para aparecer no site após salvar.':'Use quando quiser e desligue para voltar às suas cores de sempre.'}</small>
    </span>
    <input type="checkbox" checked={christmasTheme}
     onChange={e=>{setChristmasTheme(e.target.checked);setNotice(null)}} disabled={saving||uploading}/>
    <span className="vivi-season-toggle-track" aria-hidden="true"/>
   </label>
   <div className={'vivi-christmas-admin-preview'+(christmasTheme?' enabled':'')}>
    <div className="vivi-christmas-preview-stars" aria-hidden="true">✦ &nbsp; ❄ &nbsp; ✧</div>
    <span>🎄 Natal da Vivi</span>
    <strong>Achadinhos para presentear com carinho</strong>
    <small>{christmasTheme?'Prévia do tema natalino':'Prévia do Natal · ative para usar'}</small>
   </div>
   <button type="button" className="btn btn-primary btn-wide" onClick={save} disabled={saving||uploading}>
    <Save size={17}/>{saving?'Salvando…':'Aplicar personalização no site'}
   </button>
   <p className="footnote">O Natal fica desligado por padrão. Ao desativar e salvar, suas cores anteriores voltam automaticamente.</p>
  </section>
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
    <strong>{christmasTheme?'🎄 Assim vai ficar seu Natal na Vivi':'Assim vai ficar a sua vitrine ✨'}</strong>
    <span style={{background:themeVars['--vivi-accent'],color:themeVars['--vivi-on-accent']}}>Ver ofertas →</span>
   </div>
  </section>
  <section className="admin-card">
   <div className="admin-card-title">
    <h2><Images size={21}/> Páginas do banner</h2>
    <button className="btn btn-outline btn-small" onClick={onManageOffers} type="button">Gerenciar ofertas</button>
   </div>
   <p className="muted-text">Tenha de 3 a 10 banners. Os banners de imagem inteira ocupam toda a largura e podem ficar no carrossel, entre as seções ou no final da página, sem textos sobrepostos.</p>
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
    {current.type==='images'&&<>
     <label style={label}>Onde mostrar o banner
      <select style={input} value={current.placement||'carousel'} onChange={e=>updateSlide('placement',e.target.value)}>
       <option value="carousel">Carrossel principal (largura total)</option>
       <option value="after-categories">Banner interno: depois das categorias</option>
       <option value="after-offers">Banner interno: depois dos produtos</option>
       <option value="bottom">Banner inteiro no final da página</option>
      </select>
     </label>
     <div className="vivi-banner-layout-controls">
      <label style={label}>Enquadramento
       <select style={input} value={current.imageFit||'contain'} onChange={e=>updateSlide('imageFit',e.target.value)}>
        <option value="contain">Mostrar imagem inteira (sem cortar)</option>
        <option value="cover">Preencher a altura (pode cortar)</option>
       </select>
      </label>
      <label style={label}>Posição da imagem
       <select style={input} value={current.imagePosition||'center'} onChange={e=>updateSlide('imagePosition',e.target.value)}>
        <option value="center">Centro</option><option value="top">Topo</option>
        <option value="bottom">Parte inferior</option>
        <option value="left">Esquerda</option><option value="right">Direita</option>
       </select>
      </label>
      {(current.placement||'carousel')!=='carousel'&&<><label style={label}>Altura no computador
       <select style={input} value={current.imageHeightDesktop||'auto'} onChange={e=>updateSlide('imageHeightDesktop',e.target.value)}>
        <option value="auto">Automática: proporção original</option>
        {[180,240,320,420,520].map(n=><option key={n} value={n}>{n} px</option>)}
       </select>
      </label>
      <label style={label}>Altura no celular
       <select style={input} value={current.imageHeightMobile||'auto'} onChange={e=>updateSlide('imageHeightMobile',e.target.value)}>
        <option value="auto">Automática: proporção original</option>
        {[180,240,320,420,520].map(n=><option key={n} value={n}>{n} px</option>)}
       </select>
      </label></>}
     </div>
     <p className="vivi-photo-info">{(current.placement||'carousel')==='carousel'?
      'No carrossel principal, todos os slides têm o mesmo tamanho e cantos arredondados. Escolha Mostrar imagem inteira para não cortar a arte.':
      'Em banners internos, a altura pode ser automática ou personalizada. Recomendamos uma arte para celular e outra para computador.'}</p>
    </>}
    {current.type==='product'&&<label style={label}>Escolher produto ativo
     <select style={input} value={current.productId||''} onChange={e=>updateSlide('productId',e.target.value)}>
      <option value="">Selecione um produto</option>
      {activeOffers.map(o=><option key={o.id} value={o.id}>{o.title.slice(0,100)}</option>)}
     </select>
    </label>}
    {current.type!=='images'&&<label style={label}>Etiqueta superior
     <input style={input} value={current.badge||''} maxLength={85}
      onChange={e=>updateSlide('badge',e.target.value)}/>
    </label>}
    <label style={label}>{current.type==='images'?'Descrição da arte (acessibilidade)':'Título do banner'}
     <textarea style={{...input,minHeight:78,resize:'vertical'}} maxLength={170}
      value={current.title||''} onChange={e=>updateSlide('title',e.target.value)}/>
    </label>
    {current.type!=='images'&&<label style={label}>Texto de apoio
     <textarea style={{...input,minHeight:85,resize:'vertical'}} maxLength={300}
      value={current.subtitle||''} onChange={e=>updateSlide('subtitle',e.target.value)}/>
    </label>}
    {current.type!=='product'&&<div className="vivi-banner-images-editor">
     <div className="vivi-banner-images-header">
      <strong><ImagePlus size={18}/> {current.type==='images'?'Arte principal · computador':'Fotos do banner'}</strong>
      <small>{(current.images||[]).length} / {current.type==='images'?1:MAX_IMAGES}</small>
     </div>
     <label className={'vivi-upload-button'+(uploading?' uploading':'')}>
      <Upload size={20}/>
      {uploading?'Enviando '+uploadCount.done+'/'+uploadCount.total+'…':
       current.type==='images'?'Escolher ou substituir arte do computador':'Escolher fotos do celular ou computador'}
      <input type="file" accept="image/*" multiple={current.type!=='images'}
       disabled={uploading||saving||(current.type!=='images'&&(current.images||[]).length>=MAX_IMAGES)}
       onChange={e=>uploadFiles(e,'desktop')}/>
     </label>
     <p className="vivi-photo-info">{current.type==='images'?
      'Uma arte principal por banner. A imagem é otimizada para carregar rápido e pode ser substituída quando quiser.':
      'Fotos JPG, PNG ou WebP. O site otimiza automaticamente para carregar rápido. Até quatro imagens por página.'}</p>
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
    {current.type==='images'&&<div className="vivi-banner-images-editor">
     <div className="vivi-banner-images-header">
      <strong><ImagePlus size={18}/> Versão para celular (opcional)</strong>
     </div>
     <label className={'vivi-upload-button'+(uploading?' uploading':'')}>
      <Upload size={19}/>{uploading?'Enviando...':'Escolher ou substituir arte do celular'}
      <input type="file" accept="image/*" disabled={uploading||saving}
       onChange={e=>uploadFiles(e,'mobile')}/>
     </label>
     {bannerMobileImageOf(current)&&<div className="vivi-banner-mobile-uploaded">
      <img src={current.mobileImage} alt="Arte para celular"/>
      <button type="button" className="btn btn-outline btn-small"
       onClick={()=>updateSlide('mobileImage','')}><Trash2 size={15}/> Remover versão mobile</button>
     </div>}
     <details className="vivi-image-url-details">
      <summary>Ou usar URL HTTPS da imagem mobile</summary>
      <input style={input} value={current.mobileImage||''}
       onChange={e=>updateSlide('mobileImage',e.target.value)} placeholder="https://..."/>
     </details>
     <p className="vivi-photo-info">Sem arte para celular? Usaremos automaticamente a arte principal, sempre sem cortar no modo automático.</p>
    </div>}
    {current.type==='flash'&&<p className="vivi-carousel-tip"><Flame size={17}/>
     Este banner mantém o vermelho de Ofertas Relâmpago e utiliza o link configurado no painel de promoções.</p>}
    {current.type!=='images'&&<label style={label}>Texto do botão
     <input style={input} value={current.buttonLabel||''} maxLength={55}
      onChange={e=>updateSlide('buttonLabel',e.target.value)}/>
    </label>}
    {current.type!=='flash'&&current.type!=='product'&&<label style={label}>{current.type==='images'?'Link ao tocar na imagem':'Link do botão'}
     <input style={input} value={current.buttonUrl||''}
      onChange={e=>updateSlide('buttonUrl',e.target.value)} placeholder="#ofertas ou https://..."/>
    </label>}
    <button type="submit" className="btn btn-primary btn-wide" disabled={saving||uploading}>
     <Save size={18}/>{saving?'Salvando…':'Salvar personalização no site'}
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
    {current.type==='images'&&<div className="vivi-banner-preview-device">
     <button type="button" className={previewDevice==='mobile'?'selected':''} onClick={()=>setPreviewDevice('mobile')}>Celular</button>
     <button type="button" className={previewDevice==='desktop'?'selected':''} onClick={()=>setPreviewDevice('desktop')}>Computador</button>
    </div>}
    {current.type==='images'?<div className={'vivi-banner-full-preview device-'+previewDevice+((current.placement||'carousel')==='carousel'?' is-carousel':'')}>
     {bannerImageOf(current)||bannerMobileImageOf(current)?
      <ResponsiveBannerImage slide={current} previewDevice={previewDevice}/>:
      <p>Envie sua arte para visualizar o banner inteiro aqui.</p>}
    </div>:<div className="vivi-banner-preview vivi-carousel-admin-preview"
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
    </div>}
    <p className="footnote">Página {selected+1} de {slides.length}. Troca automática a cada {seconds} segundos.</p>
    <a href="/" target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-wide">
     <ExternalLink size={17}/> Ver site público
    </a>
   </aside>
  </form>
 </div>;
}

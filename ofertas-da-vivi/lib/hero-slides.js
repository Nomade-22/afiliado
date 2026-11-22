export const HERO_TYPES=['intro','images','flash','product'];
export const MIN_HERO_SLIDES=3;
export const MAX_HERO_SLIDES=10;

export function defaultHeroSlides(settings={}){
 const firstImage=settings.heroMode==='banner'?String(settings.heroImage||''):'';
 return [
  {id:'slide-intro',type:'intro',enabled:true,
   badge:settings.heroBadge||'Seu cantinho de achadinhos',
   title:settings.heroTitle||'Achadinhos, cupons e ofertas selecionadas pela Vivi ♡',
   subtitle:settings.heroSubtitle||'Uma seleção especial de achadinhos para você economizar!',
   buttonLabel:settings.heroButtonLabel||'Ver ofertas',
   buttonUrl:settings.heroButtonUrl||'#ofertas',
   images:firstImage?[firstImage]:[],productId:''},
  {id:'slide-imagens',type:'images',enabled:true,
   badge:'Seleção especial da Vivi',title:'Achadinhos que merecem destaque',
   subtitle:'Produtos escolhidos com carinho para você descobrir!',
   buttonLabel:'Explorar produtos',buttonUrl:'#ofertas',images:[],productId:''},
  {id:'slide-relampago',type:'flash',enabled:true,
   badge:'Não perca as oportunidades',title:'Ofertas relâmpago da semana',
   subtitle:'Veja as promoções disponíveis e confira os preços diretamente na Shopee.',
   buttonLabel:'Ver ofertas relâmpago',buttonUrl:'',images:[],productId:''}
 ];
}
export function newHeroSlide(type='images',id){
 return {id:id||'slide-'+Math.random().toString(36).slice(2,10),
  type:HERO_TYPES.includes(type)?type:'images',enabled:true,
  badge:'Destaque da Vivi',title:'Novo destaque da semana',
  subtitle:'Personalize este banner com seus produtos.',buttonLabel:'Ver ofertas',
  buttonUrl:'#ofertas',images:[],productId:''};
}
export function readHeroSlides(settings={}){
 let raw=settings.heroSlides;
 if(typeof raw==='string'&&raw){
  try{raw=JSON.parse(raw)}catch{raw=null}
 }
 if(!Array.isArray(raw)||raw.length<MIN_HERO_SLIDES)return defaultHeroSlides(settings);
 return raw.slice(0,MAX_HERO_SLIDES).map((slide,i)=>({
  ...newHeroSlide('intro','slide-'+i),
  ...slide,
  id:String(slide.id||'slide-'+i),
  type:HERO_TYPES.includes(slide.type)?slide.type:'intro',
  enabled:slide.enabled!==false,
  images:Array.isArray(slide.images)?slide.images.slice(0,4):[]
 }));
}
export function getHeroInterval(settings={}){
 const seconds=Number(settings.heroIntervalSeconds);
 return Number.isFinite(seconds)?Math.min(20,Math.max(4,Math.round(seconds))):7;
}
export function normalizeHeroSlides(value){
 if(!Array.isArray(value)||value.length<MIN_HERO_SLIDES||value.length>MAX_HERO_SLIDES)
  throw Error('Configure de 3 a 10 páginas para o banner.');
 const ids=new Set();
 const clean=value.map((slide,i)=>{
  if(!slide||typeof slide!=='object'||!HERO_TYPES.includes(slide.type))
   throw Error('Tipo de página inválido na posição '+(i+1)+'.');
  const id=String(slide.id||'slide-'+i).slice(0,70);
  if(ids.has(id))throw Error('O banner contém páginas com IDs repetidos.');
  ids.add(id);
  const text=(name,max)=>String(slide[name]||'').trim().slice(0,max);
  const images=Array.isArray(slide.images)?slide.images:[];
  if(images.length>4)throw Error('Cada página aceita até 4 imagens.');
  return {id,type:slide.type,enabled:slide.enabled!==false,
   badge:text('badge',85),title:text('title',170),
   subtitle:text('subtitle',300),buttonLabel:text('buttonLabel',55),
   buttonUrl:text('buttonUrl',1250),images:images.map(x=>String(x||'').trim()),
   productId:text('productId',150)};
 });
 if(!clean.some(x=>x.enabled))throw Error('Ative ao menos uma página do banner.');
 return clean;
}

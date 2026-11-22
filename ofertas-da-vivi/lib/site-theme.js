export const VIVI_THEMES=[
 {id:'orange',name:'Laranja Vivi',start:'#f4511e',end:'#ff982c',accent:'#f45c23'},
 {id:'pink',name:'Rosa chiclete',start:'#bd2b67',end:'#f26a99',accent:'#d12d72'},
 {id:'purple',name:'Lilás e violeta',start:'#5431a4',end:'#ad70dd',accent:'#7147bc'},
 {id:'blue',name:'Azul profundo',start:'#123b93',end:'#3688ec',accent:'#2464c4'},
 {id:'ocean',name:'Azul oceano',start:'#08779b',end:'#25b7d8',accent:'#087caa'},
 {id:'mint',name:'Verde menta',start:'#087e76',end:'#55d3b2',accent:'#047c79'},
 {id:'emerald',name:'Verde esmeralda',start:'#0c744b',end:'#26b67e',accent:'#08794d'},
 {id:'berry',name:'Frutas vermelhas',start:'#871e53',end:'#db5982',accent:'#ae285d'},
 {id:'sunset',name:'Pôr do sol',start:'#dc4b40',end:'#f9b44b',accent:'#d34b38'},
 {id:'gold',name:'Dourado',start:'#c57a11',end:'#f9d878',accent:'#9c6107'},
 {id:'night',name:'Noite elegante',start:'#17213f',end:'#4f5086',accent:'#4b4da6'},
 {id:'black',name:'Preto e grafite',start:'#14151d',end:'#4c5263',accent:'#373a46'},
 {id:'coral',name:'Coral',start:'#e43b4f',end:'#ff8e75',accent:'#d83350'},
 {id:'lavender',name:'Lavanda',start:'#704dbe',end:'#d49dde',accent:'#7750b6'}
];
const isHex=value=>typeof value==='string'&&/^#[a-fA-F0-9]{6}$/.test(value);
export const validHex=isHex;
export const isHeroImage=value=>{
 if(typeof value!=='string'||!value)return false;
 if(/^\/api\/media\/[a-f0-9]{32}$/.test(value))return true;
 try{
  const u=new URL(value);
  return u.protocol==='https:'&&!u.username&&!u.password;
 }catch{return false}
};
function rgb(hex){
 const n=parseInt(hex.slice(1),16);
 return [(n>>16)&255,(n>>8)&255,n&255];
}
function mix(hex,other,factor){
 const a=rgb(hex),b=rgb(other);
 return '#'+a.map((v,i)=>Math.round(v*(1-factor)+b[i]*factor).toString(16).padStart(2,'0')).join('');
}
function relativeLuminance(hex){
 const values=rgb(hex).map(x=>{
  const v=x/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
 });
 return values[0]*.2126+values[1]*.7152+values[2]*.0722;
}
export function getThemeConfig(settings={}){
 const preset=VIVI_THEMES.find(t=>t.id===settings.heroTheme)||VIVI_THEMES[0];
 const custom=settings.heroTheme==='custom';
 const start=custom&&isHex(settings.heroColorStart)?settings.heroColorStart:preset.start;
 const end=custom&&isHex(settings.heroColorEnd)?settings.heroColorEnd:preset.end;
 const accent=custom&&isHex(settings.heroAccent)?settings.heroAccent:preset.accent;
 const angle=Number(settings.heroGradientAngle);
 const degrees=Number.isFinite(angle)?Math.max(0,Math.min(360,Math.round(angle))):115;
 const fill=settings.heroFillMode==='solid'?'solid':'gradient';
 return {id:custom?'custom':preset.id,start,end,accent,angle:degrees,fill};
}
export function getThemeCssVars(settings={}){
 const {start,end,accent,angle,fill}=getThemeConfig(settings);
 const light=relativeLuminance(accent)>.38;
 const white='#ffffff',dark='#19212c';
 const gradient=fill==='solid'?start:`linear-gradient(${angle}deg, ${start} 0%, ${end} 100%)`;
 const avgLuminance=(relativeLuminance(start)+relativeLuminance(end))/2;
 const heroInk=avgLuminance>.43?dark:white;
 const heroIsLight=heroInk===dark;
 return {
  '--vivi-accent':accent,
  '--vivi-accent-deep':mix(accent,'#151522',light?.51:.2),
  '--vivi-accent-soft':mix(accent,'#ffffff',.9),
  '--vivi-accent-glow':accent+'38',
  '--vivi-accent-gradient':gradient,
  '--vivi-on-accent':light?dark:white,
  '--vivi-hero-ink':heroInk,
  '--vivi-hero-control':heroIsLight?'#21263418':'#ffffff35',
  '--vivi-hero-border':heroIsLight?'#21263435':'#ffffff56',
  '--vivi-hero-card':heroIsLight?'#fff9':'#ffffff30',
  '--vivi-hero-button-bg':heroIsLight?dark:'#ffffff',
  '--vivi-hero-button-ink':heroIsLight?white:mix(accent,dark,.4)
 };
}

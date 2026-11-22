import {isHeroImage} from '../lib/site-theme';

export const bannerImageOf=slide=>(slide?.images||[]).find(isHeroImage)||'';
export const bannerMobileImageOf=slide=>isHeroImage(slide?.mobileImage)?slide.mobileImage:'';

export const safeBannerLink=value=>{
 if(value==='#ofertas'||value==='#cupons'||/^\/produto\/[a-zA-Z0-9_-]+$/.test(String(value||'')))return true;
 try{
  const u=new URL(String(value||''));
  return u.protocol==='https:'&&!u.username&&!u.password;
 }catch{return false}
};

export default function ResponsiveBannerImage({slide,previewDevice=null,priority=false}){
 const desktop=bannerImageOf(slide),mobile=bannerMobileImageOf(slide);
 const main=previewDevice==='mobile'?(mobile||desktop):desktop||mobile;
 if(!main)return null;
 const src=previewDevice==='desktop'?(desktop||mobile):main;
 const desktopHeight=slide.imageHeightDesktop||'auto';
 const mobileHeight=slide.imageHeightMobile||'auto';
 const fit=slide.imageFit==='cover'?'cover':'contain';
 const position=['center','top','bottom','left','right'].includes(slide.imagePosition)?slide.imagePosition:'center';
 const style={
  '--vivi-desktop-banner-height':desktopHeight==='auto'?'auto':desktopHeight+'px',
  '--vivi-mobile-banner-height':mobileHeight==='auto'?'auto':mobileHeight+'px',
  '--vivi-banner-fit':fit,
  '--vivi-banner-position':position
 };
 return <picture className={'vivi-responsive-banner-picture'+(previewDevice?' vivi-picture-preview-'+previewDevice:'')} style={style}>
  {!previewDevice&&mobile&&<source media="(max-width:720px)" srcSet={mobile}/>}
  <img src={src} alt={slide.title||'Banner da Vivi'}
   loading={priority?'eager':'lazy'} decoding="async"/>
 </picture>;
}

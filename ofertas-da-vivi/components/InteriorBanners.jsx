import {readHeroSlides} from '../lib/hero-slides';
import ResponsiveBannerImage,{bannerImageOf,bannerMobileImageOf,safeBannerLink} from './ResponsiveBannerImage';

export default function InteriorBanners({settings={},placement}){
 const slides=readHeroSlides(settings).filter(slide=>
  slide.enabled!==false&&slide.type==='images'&&slide.placement===placement&&
  (bannerImageOf(slide)||bannerMobileImageOf(slide)));
 if(!slides.length)return null;
 return <section className="vivi-internal-banners" aria-label="Banners especiais da Vivi">
  {slides.map(slide=>{
   const href=slide.buttonUrl;
   const linked=safeBannerLink(href);
   const external=linked&&href.startsWith('https://');
   const content=<ResponsiveBannerImage slide={slide}/>;
   return <div className="vivi-internal-banner" key={slide.id}>
    {linked?<a href={href} aria-label={slide.title||'Ver promoção da Vivi'}
      target={external?'_blank':undefined}
      rel={external?'noopener noreferrer nofollow sponsored':undefined}>{content}</a>:content}
   </div>;
  })}
 </section>;
}

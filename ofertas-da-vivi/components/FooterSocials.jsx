import {Instagram} from 'lucide-react';

function TikTokLogo(){
 return <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false" fill="currentColor">
  <path d="M16.6 2H13v13.2a3.2 3.2 0 1 1-2.7-3.2V8.5a6.8 6.8 0 1 0 6.3 6.8V9.2c1.4 1 3.2 1.5 5.1 1.5V7.2c-2.7-.1-4.9-2.3-5.1-5.2Z"/>
 </svg>;
}
function TelegramLogo(){
 return <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false" fill="currentColor">
  <path d="m22.2 3.3-3.5 16.5c-.26 1.17-.96 1.46-1.94.91l-5.37-3.96-2.59 2.49c-.29.29-.52.52-1.07.52l.38-5.46L18.2 5.2c.44-.39-.09-.6-.67-.21L5.1 12.83.1 11.27c-1.09-.34-1.11-1.09.23-1.61L19.9 2.11c.91-.33 1.71.22 1.42 1.58l.88-.39Z"/>
 </svg>;
}
const items=[
 {key:'tiktok',label:'TikTok',Icon:TikTokLogo,host:['tiktok.com']},
 {key:'instagram',label:'Instagram',Icon:Instagram,host:['instagram.com','instagr.am']},
 {key:'telegram',label:'Telegram',Icon:TelegramLogo,host:['t.me','telegram.me']}
];
function safeSocialUrl(value,hosts){
 if(typeof value!=='string')return null;
 try{
  const url=new URL(value.trim());
  const host=url.hostname.toLowerCase();
  if(url.protocol!=='https:'||url.username||url.password)return null;
  if(!hosts.some(domain=>host===domain||host.endsWith('.'+domain)))return null;
  return url.toString();
 }catch{return null}
}
export default function FooterSocials({settings={}}){
 return <div className="vivi-footer-social" aria-label="Redes sociais da Vivi">
  <h3>Siga a Vivi nas redes</h3>
  <p>Mais achadinhos, novidades e promoções para você.</p>
  <div className="vivi-footer-social-grid">
   {items.map(({key,label,Icon,host})=>{
    const url=safeSocialUrl(settings[key],host);
    const cls='vivi-social-tile vivi-social-'+key;
    return url?
     <a key={key} className={cls} href={url} target="_blank"
      rel="noopener noreferrer" aria-label={'Visitar '+label+' da Vivi'} title={'Abrir '+label}>
      <span className="vivi-social-icon"><Icon size={28}/></span>
      <span className="vivi-social-label">{label}</span>
     </a>:
     <div key={key} className={cls+' vivi-social-pending'}
      title={label+' em breve'} aria-label={label+' ainda não configurado'}>
      <span className="vivi-social-icon"><Icon size={28}/></span>
      <span className="vivi-social-label">{label}</span>
      <small>Em breve</small>
     </div>;
   })}
  </div>
 </div>;
}

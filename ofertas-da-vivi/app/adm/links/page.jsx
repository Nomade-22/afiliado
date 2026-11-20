import {redirect} from 'next/navigation';
import {isAdmin} from '../../../lib/auth';
import AffiliateLinksPanel from '../../../components/AffiliateLinksPanel';
export const dynamic='force-dynamic';
export const metadata={title:'Links de Afiliado | Ofertas da Vivi',robots:{index:false,follow:false}};
export default async function AdminLinksPage(){
 if(!await isAdmin())redirect('/adm/login');
 return <main style={{minHeight:'100vh',background:'#f7f7fa',padding:'20px 14px',fontFamily:'Arial,sans-serif'}}>
  <div style={{maxWidth:840,margin:'auto'}}>
    <p><a href="/adm" style={{fontWeight:700,color:'#de4d17',textDecoration:'none'}}>← Painel ADM</a></p>
    <AffiliateLinksPanel/>
  </div>
 </main>;
}

import {redirect} from 'next/navigation';
import {isAdmin} from '../../../lib/auth';
import StorefrontPanel from '../../../components/StorefrontPanel';
export const dynamic='force-dynamic';
export const metadata={title:'Minha Vitrine Shopee | Ofertas da Vivi',robots:{index:false,follow:false}};
export default async function AdminStorefrontPage(){
 if(!await isAdmin())redirect('/adm/login');
 return <main style={{minHeight:'100vh',background:'#f8f8fa',padding:'24px 14px',fontFamily:'Arial,sans-serif',color:'#252535'}}>
   <div style={{maxWidth:960,margin:'auto'}}>
    <a href="/adm" style={{textDecoration:'none',fontWeight:700,color:'#e45b28'}}>← Voltar ao painel ADM</a>
    <h1 style={{fontSize:25,margin:'22px 0'}}>Minha Vitrine Shopee</h1>
    <StorefrontPanel/>
   </div>
 </main>;
}

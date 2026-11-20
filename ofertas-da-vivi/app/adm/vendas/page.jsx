import {isAdmin} from '../../../lib/auth';
import {redirect} from 'next/navigation';
import SalesPanel from '../../../components/SalesPanel';
export const metadata={title:'Vendas e Cliques | Ofertas da Vivi',robots:{index:false,follow:false}};
export const dynamic='force-dynamic';
export default async function Vendas(){
 if(!await isAdmin())redirect('/adm/login');
 return <main style={{background:'#f7f7f9',minHeight:'100vh',padding:'24px 14px'}}>
  <div style={{maxWidth:1140,margin:'0 auto'}}>
    <a href="/adm" style={{color:'#e84f20',fontWeight:700,textDecoration:'none'}}>← Voltar ao painel ADM</a>
    <h1 style={{fontSize:28,margin:'17px 0',color:'#262632'}}>Vendas e cliques — Ofertas da Vivi</h1>
    <SalesPanel/>
  </div>
 </main>;
}

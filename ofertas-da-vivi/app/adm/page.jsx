import {isAdmin} from '../../lib/auth';
import {redirect} from 'next/navigation';
import AdminPanel from '../../components/AdminPanel';
export const metadata={title:'Painel ADM | Ofertas da Vivi',robots:{index:false,follow:false}};
export default async function AdminPage(){if(!await isAdmin())redirect('/adm/login');return <AdminPanel/>}

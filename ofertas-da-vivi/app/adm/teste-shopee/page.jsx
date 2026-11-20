import {redirect} from 'next/navigation';
import {isAdmin} from '../../../lib/auth';
import ShopeeDiagnostic from '../../../components/ShopeeDiagnostic';

export const metadata={title:'Teste API Shopee | Ofertas da Vivi',robots:{index:false,follow:false}};
export const dynamic='force-dynamic';

export default async function TesteShopeePage() {
  if(!await isAdmin()) redirect('/adm/login');
  return <ShopeeDiagnostic/>;
}

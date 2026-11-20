import {redirect} from 'next/navigation';
import {isAdmin} from '../../../lib/auth';
import DatabaseDiagnostic from '../../../components/DatabaseDiagnostic';

export const dynamic='force-dynamic';
export const metadata={title:'Diagnóstico Neon | Ofertas da Vivi',robots:{index:false,follow:false}};
export default async function DatabaseDiagnosticPage(){
 if(!await isAdmin())redirect('/adm/login');
 return <DatabaseDiagnostic/>;
}

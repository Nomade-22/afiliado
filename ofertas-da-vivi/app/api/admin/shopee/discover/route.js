import {isAdmin,forbidden} from '../../../../../lib/auth';
import {searchShopeePage,hasShopeeCredentials} from '../../../../../lib/shopee';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=30;
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};

export async function POST(request){
 if(!await isAdmin())return forbidden();
 if(!hasShopeeCredentials())return Response.json({error:'Configure a API de Afiliados Shopee para descobrir produtos.'},{status:503,headers});
 const size=Number(request.headers.get('content-length')||0);
 if(size>2048)return Response.json({error:'Filtros muito extensos.'},{status:413,headers});
 const input=await request.json().catch(()=>({}));
 if(typeof input.keyword!=='string'&&input.keyword!==undefined)return Response.json({
  error:'Digite uma palavra-chave válida.'
 },{status:400,headers});
 const options={
  sortType:input.sortType,
  listType:input.listType,
  isAMSOffer:input.isAMSOffer===true,
  isKeySeller:input.isKeySeller===true
 };
 try{
  const result=await searchShopeePage(input.keyword||'',24,input.page||1,options);
  return Response.json(result,{headers});
 }catch(error){
  // Nenhuma credencial ou URL de conexão deve ser exposta.
  const message=String(error?.message||'Não foi possível consultar a Shopee.');
  console.error('vivi_discover_shopee_error',message.slice(0,90).replace(/https?:\/\/\S+/g,'[URL]'));
  return Response.json({error:message.includes('10035')?'Esta conta ainda não tem acesso à API de Afiliados.':
   'Não foi possível consultar esta combinação de filtros na API Shopee. Revise a busca ou tente novamente.'},
   {status:502,headers});
 }
}

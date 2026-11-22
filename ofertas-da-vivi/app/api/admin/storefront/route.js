import {isAdmin,forbidden} from '../../../../lib/auth';
import {getStorefrontPage} from '../../../../lib/storefront';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=25;
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};

export async function GET(req){
 if(!await isAdmin())return forbidden();
 const p=new URL(req.url).searchParams.get('page')||'1';
 try{
  const data=await getStorefrontPage(p);
  return Response.json({ok:true,...data},{headers});
 }catch(error){
  return Response.json({
   ok:false,code:'STOREFRONT_UNAVAILABLE',
   error:String(error?.message||'Não foi possível acessar a vitrine pública.').slice(0,240),
   message:'A integração da vitrine usa uma API pública não documentada e pode ter mudado.'
  },{status:502,headers});
 }
}

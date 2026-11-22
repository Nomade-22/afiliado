import {isAdmin,forbidden} from '../../../../lib/auth';
import {getStorefrontPage} from '../../../../lib/storefront';
import {getDB} from '../../../../lib/db';
import {knownOfferKeys,matchExisting} from '../../../../lib/product-identity';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=25;
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};

export async function GET(req){
 if(!await isAdmin())return forbidden();
 const pageParam=new URL(req.url).searchParams.get('page')||'1';
 try {
  const data=await getStorefrontPage(pageParam);
  try{
   const sql=await getDB();
   if(!sql)throw Error('db unavailable');
   const existing=await sql`SELECT id,url,product_link,item_id,shop_id,dedupe_key FROM vivi_offers`;
   const known=knownOfferKeys(existing);
   return Response.json({...data,ok:true,importedStatusAvailable:true,
    items:data.items.map(item=>({...item,imported:matchExisting(item,known)}))
   },{headers});
  }catch{
   return Response.json({...data,ok:true,importedStatusAvailable:false,
     items:data.items.map(item=>({...item,imported:false})),
     warning:data.warning+' Não foi possível verificar quais itens já estão no Neon.'
   },{headers});
  }
 }catch(error){
  return Response.json({
   ok:false,code:'STOREFRONT_UNAVAILABLE',
   error:String(error?.message||'Não foi possível acessar a vitrine pública.').slice(0,240),
   message:'A API pública da vitrine pode ter mudado. Tente novamente.'
  },{status:502,headers});
 }
}

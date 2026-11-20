import {isAdmin,forbidden} from '../../../../../lib/auth';
import {searchShopeePage} from '../../../../../lib/shopee';

export const dynamic='force-dynamic';
export const maxDuration=25;

export async function POST(req){
 if(!await isAdmin())return forbidden();
 try{
  const data=await req.json().catch(()=>({}));
  const found=await searchShopeePage(data.keyword,data.limit,data.page);
  return Response.json(found,{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){
  const msg=String(e?.message||'Erro ao consultar Shopee').slice(0,220);
  return Response.json({error:msg},{status:502,headers:{'Cache-Control':'private, no-store'}});
 }
}

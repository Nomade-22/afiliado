import {isAdmin,forbidden} from '../../../../../lib/auth';
import {searchShopee} from '../../../../../lib/shopee';
export const maxDuration=25;
export async function POST(req){
 if(!await isAdmin())return forbidden();
 try{let d=await req.json().catch(()=>({}));return Response.json({offers:await searchShopee(String(d.keyword||'').slice(0,80),Math.min(40,Math.max(1,Number(d.limit)||24)))},{headers:{'Cache-Control':'no-store'}})}
 catch(e){return Response.json({error:e.message},{status:502})}
}
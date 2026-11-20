import {isAdmin,forbidden} from '../../../../../lib/auth';
import {searchShopee} from '../../../../../lib/shopee';
export const maxDuration=25;
export async function POST(){
 if(!await isAdmin())return forbidden();
 try{await searchShopee('',1);return Response.json({ok:true,message:'Consulta autenticada à Shopee realizada com sucesso.'})}
 catch(e){return Response.json({error:e.message},{status:502})}
}
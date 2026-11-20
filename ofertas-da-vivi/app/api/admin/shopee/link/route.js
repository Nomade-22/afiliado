import {isAdmin,forbidden} from '../../../../../lib/auth';
import {generateAffiliateLink,defaultSubIds,validateSubIds} from '../../../../../lib/shopee-links';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=25;
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function POST(request){
 if(!await isAdmin()) return forbidden();
 let data;
 try{data=await request.json()}catch{return Response.json({error:'JSON inválido.'},{status:400,headers})}
 try{
   const subIds=Array.isArray(data.subIds) ? validateSubIds(data.subIds) :
      defaultSubIds({channel:data.channel,itemId:data.itemId,custom:data.custom});
   const generated=await generateAffiliateLink(data.originUrl,subIds);
   return Response.json({ok:true,link:generated.shortLink,subIds:generated.subIds,originUrl:generated.originUrl,source:generated.generatedBy}, {headers});
 }catch(error){
   // A resposta jamais inclui credenciais nem cabeçalhos de autenticação.
   const safeMessage=String(error?.message||'Não foi possível gerar o link.').slice(0,250);
   return Response.json({error:safeMessage},{status:502,headers});
 }
}

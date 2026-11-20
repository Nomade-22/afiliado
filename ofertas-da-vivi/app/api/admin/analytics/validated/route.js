import {isAdmin,forbidden} from '../../../../../lib/auth';
import {loadValidatedReport} from '../../../../../lib/shopee-reports';

export const dynamic='force-dynamic';
export const maxDuration=25;
export async function POST(req){
 if(!await isAdmin())return forbidden();
 const input=await req.json().catch(()=>({}));
 try{
  const report=await loadValidatedReport(input.validationId);
  return Response.json({status:'ok',report},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){
  return Response.json({status:'error',error:String(error?.message||'Não foi possível consultar o relatório.').slice(0,250)},{status:502,headers:{'Cache-Control':'private, no-store'}});
 }
}

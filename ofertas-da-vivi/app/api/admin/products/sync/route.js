import {isAdmin,forbidden} from '../../../../../lib/auth';
import {getDB} from '../../../../../lib/db';
import {getSyncHistory,startProductSync,runNextProductBatch,stopProductSync} from '../../../../../lib/product-sync';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const fail=(message,status=503)=>Response.json({error:message},{status,headers});
export async function GET(){
 if(!await isAdmin())return forbidden();
 try{
  const sql=await getDB();
  if(!sql)return fail('Banco de dados indisponível.');
  return Response.json(await getSyncHistory(sql),{headers});
 }catch{return fail('Não foi possível consultar o histórico de sincronização.')}
}
export async function POST(request){
 if(!await isAdmin())return forbidden();
 const body=await request.json().catch(()=>({}));
 if(!['start','batch','stop'].includes(body.action))return fail('Ação inválida.',400);
 try{
  const sql=await getDB();
  if(!sql)return fail('Banco de dados indisponível.');
  const result=body.action==='start'?
   await startProductSync(sql,'manual'):
   body.action==='batch'?
    await runNextProductBatch(sql,body.id):
    await stopProductSync(sql,body.id);
  return Response.json(result,{headers});
 }catch(error){
  console.error('vivi_sync_admin_failure',String(error?.code||error?.name||'ERROR'));
  return fail('Não foi possível realizar esta etapa da sincronização.');
 }
}

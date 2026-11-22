import {verifyGitHubScheduledWorkflow} from '../../../../lib/github-oidc';
import {getDB} from '../../../../lib/db';
import {startProductSync,runNextProductBatch,getSyncHistory} from '../../../../lib/product-sync';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function POST(request){
 if(!await verifyGitHubScheduledWorkflow(request)){
  return Response.json({error:'Não autorizado.'},{status:401,headers});
 }
 if(Number(request.headers.get('content-length')||0)>1024){
  return Response.json({error:'Requisição inválida.'},{status:413,headers});
 }
 const data=await request.json().catch(()=>({}));
 if(!['start','batch','status'].includes(data.action)){
  return Response.json({error:'Ação inválida.'},{status:400,headers});
 }
 try{
  const sql=await getDB();
  if(!sql)throw Error('DB_UNAVAILABLE');
  const result=data.action==='start'?
   await startProductSync(sql,'scheduled'):
   data.action==='batch'?
    await runNextProductBatch(sql,data.id):
    await getSyncHistory(sql);
  return Response.json(result,{headers});
 }catch(error){
  console.error('vivi_cron_error',String(error?.code||error?.name||'FAILURE'));
  return Response.json({error:'Falha interna de sincronização.'},{status:503,headers});
 }
}

import {randomUUID} from 'node:crypto';
import {enrichProducts} from './product-enrichment';

const FIELDS=['processed','matched','identified','descriptions_added','new_photos',
 'discounts_found','prices_updated','without_extra_data','failed'];
const MAX_PRODUCTS=500;
const BATCH_SIZE=3;
const MAX_AGE_MINUTES=150;

function summary(row){
 if(!row)return null;
 return {
  id:row.id,origin:row.origin,status:row.status,
  startedAt:row.started_at,finishedAt:row.finished_at,
  total:Number(row.total||0),nextIndex:Number(row.next_index||0),
  processing:Boolean(row.processing),
  processed:Number(row.processed||0),matched:Number(row.matched||0),
  identified:Number(row.identified||0),descriptionsAdded:Number(row.descriptions_added||0),
  newPhotos:Number(row.new_photos||0),discountsFound:Number(row.discounts_found||0),
  pricesUpdated:Number(row.prices_updated||0),
  withoutExtraData:Number(row.without_extra_data||0),
  failed:Number(row.failed||0),
  errors:(()=>{try{return JSON.parse(row.errors_json||'[]').slice(0,8)}catch{return []}})()
 };
}
export async function getSyncHistory(sql){
 const rows=await sql`SELECT id,origin,status,started_at,finished_at,total,next_index,
  processing,processed,matched,identified,descriptions_added,new_photos,
  discounts_found,prices_updated,without_extra_data,failed,errors_json
  FROM vivi_product_sync_runs ORDER BY started_at DESC LIMIT 8`;
 const runs=rows.map(summary);
 return {
  running:runs.find(x=>x.status==='running')||null,
  last:runs.find(x=>x.status!=='running')||null,
  history:runs.slice(0,5),
  schedule:{timezone:'America/Sao_Paulo',hours:['08:00','20:00'],
   provider:'GitHub Actions',configured:true}
 };
}
export async function startProductSync(sql,origin){
 if(!['manual','scheduled'].includes(origin))throw Error('Origem de execução inválida.');
 // Não bloquear o sistema se uma função anterior caiu durante a execução.
 await sql`UPDATE vivi_product_sync_runs SET
   status='error',finished_at=NOW(),processing=FALSE
   WHERE status='running' AND started_at < NOW()-INTERVAL '150 minutes'`;
 const active=await sql`SELECT * FROM vivi_product_sync_runs WHERE status='running' LIMIT 1`;
 if(active.length)return {...summary(active[0]),alreadyRunning:true};
 const items=await sql`SELECT id FROM vivi_offers ORDER BY id LIMIT ${MAX_PRODUCTS}`;
 const ids=items.map(x=>String(x.id));
 const id=randomUUID();
 try{
  const rows=await sql`
   INSERT INTO vivi_product_sync_runs (id,origin,status,product_ids,total)
   VALUES (${id},${origin},${ids.length?'running':'success'},
    ${JSON.stringify(ids)},${ids.length})
   RETURNING *`;
  if(!ids.length){
   const final=await sql`UPDATE vivi_product_sync_runs SET finished_at=NOW()
    WHERE id=${id} RETURNING *`;
   return summary(final[0]);
  }
  return summary(rows[0]);
 }catch(error){
  // Corrida entre duas instâncias tentando iniciar a mesma execução.
  if(String(error?.code)==='23505'||/unique|duplicate/i.test(String(error?.message||''))){
   const running=await sql`SELECT * FROM vivi_product_sync_runs WHERE status='running' LIMIT 1`;
   if(running.length)return {...summary(running[0]),alreadyRunning:true};
  }
  throw error;
 }
}
export async function runNextProductBatch(sql,id){
 if(typeof id!=='string'||!/^[0-9a-f-]{36}$/.test(id))throw Error('Execução inválida.');
 const existing=await sql`SELECT * FROM vivi_product_sync_runs WHERE id=${id} LIMIT 1`;
 if(!existing.length)throw Error('Execução não encontrada.');
 const row=existing[0];
 if(row.status!=='running')return summary(row);
 if(row.processing)return {...summary(row),busy:true};
 const claimed=await sql`UPDATE vivi_product_sync_runs
  SET processing=TRUE,processing_started_at=NOW()
  WHERE id=${id} AND status='running' AND processing=FALSE
  RETURNING *`;
 if(!claimed.length)return {...summary(row),busy:true};
 const run=claimed[0];
 const ids=JSON.parse(run.product_ids||'[]');
 const start=Number(run.next_index||0);
 const group=ids.slice(start,start+BATCH_SIZE);
 let report;
 try{
  report=group.length?
   await enrichProducts(sql,group):
   {processed:0,matched:0,identified:0,descriptionsAdded:0,
    newPhotos:0,discountsFound:0,pricesUpdated:0,withoutExtraData:0,errors:[]};
 }catch{
  report={processed:group.length,matched:0,identified:0,descriptionsAdded:0,
   newPhotos:0,discountsFound:0,pricesUpdated:0,withoutExtraData:0,
   errors:[{reason:'Falha na consulta de um lote. Os produtos não foram apagados.'}]};
 }
 const addedErrors=(report.errors||[]).slice(0,8).map(x=>String(x?.reason||'Falha de consulta.').slice(0,175));
 const oldErrors=(()=>{try{return JSON.parse(run.errors_json||'[]')}catch{return []}})();
 const errors=[...oldErrors,...addedErrors].slice(0,8);
 const processed=Math.min(ids.length,start+group.length);
 const finished=processed>=ids.length;
 const nextStatus=finished?(errors.length?'partial':'success'):'running';
 const matched=Number(report.matched||0);
 const identified=Number(report.identified||0);
 const descriptions=Number(report.descriptionsAdded||0);
 const photos=Number(report.newPhotos||0);
 const discounts=Number(report.discountsFound||0);
 const prices=Number(report.pricesUpdated||0);
 const without=Number(report.withoutExtraData||0);
 const failed=addedErrors.length;
 const updated=await sql`UPDATE vivi_product_sync_runs SET
  processing=FALSE,processing_started_at=NULL,next_index=${processed},
  processed=processed+${group.length},
  matched=matched+${matched},identified=identified+${identified},
  descriptions_added=descriptions_added+${descriptions},
  new_photos=new_photos+${photos},discounts_found=discounts_found+${discounts},
  prices_updated=prices_updated+${prices},
  without_extra_data=without_extra_data+${without},failed=failed+${failed},
  errors_json=${JSON.stringify(errors)},
  status=${nextStatus},finished_at=CASE WHEN ${finished} THEN NOW() ELSE finished_at END
  WHERE id=${id} RETURNING *`;
 return summary(updated[0]);
}
export async function stopProductSync(sql,id){
 if(typeof id!=='string'||!/^[0-9a-f-]{36}$/.test(id))throw Error('Execução inválida.');
 const rows=await sql`UPDATE vivi_product_sync_runs SET
  status='partial',finished_at=NOW(),processing=FALSE
  WHERE id=${id} AND status='running' AND processing=FALSE RETURNING *`;
 if(rows.length)return summary(rows[0]);
 const current=await sql`SELECT * FROM vivi_product_sync_runs WHERE id=${id} LIMIT 1`;
 return summary(current[0]);
}

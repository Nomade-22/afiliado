import {isAdmin,forbidden} from '../../../../lib/auth';
import {getDB,getSettings} from '../../../../lib/db';
import {defaultSettings} from '../../../../lib/demo';

export const dynamic='force-dynamic';
export async function GET(){
 if(!await isAdmin())return forbidden();
 let settings={};
 let sql=null;
 let databaseError=null;
 try{
  sql=await getDB();
  if(sql)settings=await getSettings(sql);
 }catch(e){
  databaseError=/password authentication failed|28P01/i.test(String(e?.message))?'Autenticação do Neon rejeitada. Verifique DATABASE_URL.':'Não foi possível consultar o Neon.';
 }
 return Response.json({
  settings:{...defaultSettings,...settings},
  shopeeConfigured:!!(process.env.SHOPEE_APP_ID?.trim()&&process.env.SHOPEE_APP_SECRET?.trim()),
  databaseConfigured:!!sql&&!databaseError,
  databaseError,
  adminConfigured:!!process.env.ADMIN_PASSWORD
 },{headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(req){
 if(!await isAdmin())return forbidden();
 let sql;
 try{sql=await getDB()}catch{return Response.json({error:'Falha ao conectar ao banco Neon.'},{status:503})}
 if(!sql)return Response.json({error:'Banco não configurado'},{status:503});
 let d=await req.json();
 for(const key of Object.keys(defaultSettings)){
  if(typeof d[key]==='string'){
   const v=d[key].trim().slice(0,key.includes('hero')?280:300);
   if(['whatsapp','instagram','tiktok'].includes(key)&&v){
    try{const u=new URL(v);if(u.protocol!=='https:')return Response.json({error:`URL inválida no campo ${key}`},{status:400})}
    catch{return Response.json({error:`URL inválida no campo ${key}`},{status:400})}
   }
   await sql`INSERT INTO vivi_settings(key,value) VALUES(${key},${v}) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value`;
  }
 }
 return Response.json({ok:true});
}

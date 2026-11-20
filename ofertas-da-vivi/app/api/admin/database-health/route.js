import {isAdmin,forbidden} from '../../../../lib/auth';
import {getDB} from '../../../../lib/db';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(){
 if(!await isAdmin())return forbidden();
 if(!process.env.DATABASE_URL)return Response.json({
  connected:false,code:'MISSING_DATABASE_URL',
  message:'A variável DATABASE_URL não está cadastrada na implantação de produção.'
 },{headers});
 try{
  const sql=await getDB();
  if(!sql)return Response.json({connected:false,code:'NOT_CONFIGURED',message:'DATABASE_URL inválida.'},{headers});
  const rows=await sql`SELECT COUNT(*)::int AS count FROM vivi_offers`;
  return Response.json({connected:true,code:'READY',count:rows[0]?.count??0,message:'Banco Neon conectado. Importação disponível.'},{headers});
 }catch(error){
  const text=String(error?.message||'').toLowerCase();
  const code=/password authentication failed|28p01/.test(text)?'DB_AUTHENTICATION':
    /invalid|connection string|url/.test(text)?'DB_URL_FORMAT':
    /permission denied/.test(text)?'DB_PERMISSION':'DB_CONNECTION_ERROR';
  const message=code==='DB_AUTHENTICATION'
    ?'O Neon rejeitou a senha da conexão DATABASE_URL. Copie a string completa com a senha real e faça Redeploy.'
    :'Não foi possível consultar o Neon. Verifique DATABASE_URL e a implantação de Production.';
  return Response.json({connected:false,code,message},{headers});
 }
}

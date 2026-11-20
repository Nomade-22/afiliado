import {isAdmin,forbidden} from '../../../../lib/auth';
import {getDB} from '../../../../lib/db';

export const dynamic='force-dynamic';
export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};

function environmentCheck() {
 const raw=process.env.DATABASE_URL||'';
 if(!raw)return {present:false,looksLikeNeon:false,roleMatches:false,databaseMatches:false,passwordPlaceholder:false,pooled:false};
 try {
  const url=new URL(raw);
  const password=decodeURIComponent(url.password||'');
  return {
   present:true,
   looksLikeNeon:url.protocol==='postgresql:'||url.protocol==='postgres:'?
      url.hostname.endsWith('.aws.neon.tech'):false,
   roleMatches:decodeURIComponent(url.username)==='neondb_owner',
   databaseMatches:url.pathname==='/neondb',
   passwordPlaceholder:/^\*+$/.test(password)||/^(YOUR_PASSWORD|PASSWORD|SENHA|REPLACE_ME)$/i.test(password),
   pooled:url.hostname.includes('-pooler.'),
   urlFormatValid:['postgres:','postgresql:'].includes(url.protocol)&&Boolean(url.hostname)
  };
 }catch{return {present:true,urlFormatValid:false}}
}

export async function GET(){
 if(!await isAdmin())return forbidden();
 const checks=environmentCheck();
 if(!checks.present)return Response.json({
  connected:false,code:'MISSING_DATABASE_URL',checks,
  message:'DATABASE_URL não foi cadastrada em Production na Vercel.'
 },{headers});
 if(checks.passwordPlaceholder)return Response.json({
  connected:false,code:'PASSWORD_PLACEHOLDER',checks,
  message:'A senha da URL está substituída por asteriscos ou texto de exemplo. No Neon, use a senha real antes de salvar na Vercel.'
 },{headers});
 if(!checks.urlFormatValid)return Response.json({
  connected:false,code:'DB_URL_FORMAT',checks,
  message:'DATABASE_URL não está no formato postgresql://usuario:senha@host/banco.'
 },{headers});
 try{
  const sql=await getDB();
  if(!sql)return Response.json({connected:false,code:'NOT_CONFIGURED',checks,message:'DATABASE_URL inválida.'},{headers});
  const rows=await sql`SELECT COUNT(*)::int AS count FROM vivi_offers`;
  return Response.json({
   connected:true,code:'READY',checks,count:rows[0]?.count??0,
   message:'Banco Neon conectado e pronto para salvar produtos Shopee.'
  },{headers});
 }catch(error){
  const messageText=String(error?.message||'').toLowerCase();
  const code=/password authentication failed|28p01/.test(messageText)?'DB_AUTHENTICATION':
   /database .*does not exist|3d000/.test(messageText)?'DB_NAME':
   /permission denied|42501/.test(messageText)?'DB_PERMISSION':
   /invalid|connection string|url|invalid port/.test(messageText)?'DB_URL_FORMAT':
   /fetch failed|network|timeout|enotfound|econnrefused/.test(messageText)?'DB_NETWORK':'DB_CONNECTION_ERROR';
  const messages={
   DB_AUTHENTICATION:'O Neon recusou a senha ou usuário salvo em DATABASE_URL. Atualize a conexão com a senha real, em Production, e faça Redeploy.',
   DB_NAME:'O banco indicado na DATABASE_URL não foi encontrado. Confirme neondb.',
   DB_PERMISSION:'O usuário configurado não tem permissão para acessar as tabelas.',
   DB_URL_FORMAT:'A URL da conexão não está no formato esperado.',
   DB_NETWORK:'A função não conseguiu chegar ao banco Neon. Consulte os logs de execução.'
  };
  return Response.json({
   connected:false,code,checks,
   message:messages[code]||'Falha ao abrir conexão Neon na implantação de Production. Consulte os logs.'
  },{headers});
 }
}

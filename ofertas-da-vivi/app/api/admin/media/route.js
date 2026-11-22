import {randomUUID} from 'node:crypto';
import {isAdmin,forbidden} from '../../../../lib/auth';
import {getDB} from '../../../../lib/db';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=30;
const limit=1600000;
const noCache={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
function detectMime(bytes){
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(bytes.length>=8&&bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&
    bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10)return 'image/png';
 if(bytes.length>=12&&Buffer.from(bytes.subarray(0,4)).toString('ascii')==='RIFF'&&
    Buffer.from(bytes.subarray(8,12)).toString('ascii')==='WEBP')return 'image/webp';
 return null;
}
export async function POST(request){
 if(!await isAdmin())return forbidden();
 const origin=request.headers.get('origin');
 if(origin){
  try{
   if(new URL(origin).host!==new URL(request.url).host)
    return Response.json({error:'Origem não autorizada.'},{status:403,headers:noCache});
  }catch{return Response.json({error:'Origem inválida.'},{status:403,headers:noCache})}
 }
 if(Number(request.headers.get('content-length')||0)>2200000)return Response.json({
  error:'A imagem enviada é muito grande. Escolha outra ou comprima.'
 },{status:413,headers:noCache});
 let file;
 try{const body=await request.formData();file=body.get('image')}
 catch{return Response.json({error:'Não foi possível ler o arquivo enviado.'},{status:400,headers:noCache})}
 if(!file||typeof file.arrayBuffer!=='function')return Response.json({
  error:'Selecione uma imagem do celular ou computador.'
 },{status:400,headers:noCache});
 if(file.size<50||file.size>limit)return Response.json({
  error:'A imagem deve ter até 1,6 MB após a otimização.'
 },{status:413,headers:noCache});
 const bytes=new Uint8Array(await file.arrayBuffer());
 const detected=detectMime(bytes);
 if(!detected)return Response.json({
  error:'Formato não aceito. Envie JPEG, PNG ou WebP.'
 },{status:415,headers:noCache});
 try{
  const sql=await getDB();
  if(!sql)throw Error('Neon ausente');
  const id=randomUUID().replaceAll('-','');
  const base64=Buffer.from(bytes).toString('base64');
  await sql`INSERT INTO vivi_banner_media (id,content_type,body_base64)
   VALUES (${id},${detected},${base64})`;
  return Response.json({ok:true,url:'/api/media/'+id,mime:detected,bytes:bytes.byteLength},
   {headers:noCache});
 }catch{
  return Response.json({error:'Não foi possível salvar a imagem no Neon. Tente novamente.'},
   {status:503,headers:noCache});
 }
}

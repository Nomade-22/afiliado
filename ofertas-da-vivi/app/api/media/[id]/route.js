import {getDB} from '../../../../lib/db';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const CACHE='public, max-age=31536000, immutable';

export async function GET(_request,{params}){
 const {id}=await params;
 if(typeof id!=='string'||!/^[a-f0-9]{32}$/.test(id))return new Response('Imagem inválida',{status:404});
 try{
  const sql=await getDB();
  if(!sql)return new Response('Imagem indisponível',{status:503});
  const rows=await sql`SELECT content_type,body_base64 FROM vivi_banner_media WHERE id=${id} LIMIT 1`;
  if(!rows.length)return new Response('Imagem não encontrada',{status:404});
  const mime=rows[0].content_type;
  if(!['image/jpeg','image/png','image/webp'].includes(mime))return new Response('Formato inválido',{status:415});
  return new Response(Buffer.from(rows[0].body_base64,'base64'),{
   status:200,headers:{
    'Content-Type':mime,'Cache-Control':CACHE,
    'X-Content-Type-Options':'nosniff',
    'Content-Disposition':'inline'
   }
  });
 }catch{return new Response('Imagem indisponível',{status:503})}
}

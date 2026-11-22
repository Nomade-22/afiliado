import {getDB} from '../../../../lib/db';
import {isShopeeLink} from '../../../../lib/shopee-links';

export const dynamic='force-dynamic';
export async function GET(_req,{params}){
 try{
  const sql=await getDB();
  if(!sql)return Response.json({error:'Não foi possível carregar esta oferta.'},{status:503});
  const {id}=await params;
  const rows=await sql`SELECT url FROM vivi_offers WHERE id=${id} AND active=true LIMIT 1`;
  if(!rows.length||!isShopeeLink(rows[0].url)){
    return Response.json({error:'Oferta indisponível ou link inválido.'},{status:404});
  }
  await sql`UPDATE vivi_offers SET clicks=clicks+1 WHERE id=${id}`;
  return Response.redirect(rows[0].url,302);
 }catch{
  return Response.json({error:'Não foi possível abrir esta oferta. Tente novamente.'},{status:503});
 }
}

import {getDB} from '../../../../lib/db';
const allowed=(s)=>{try{let u=new URL(s);return u.protocol==='https:'&&(/(^|\.)shopee\.com\.br$|(^|\.)shopee\.com$|(^|\.)shopee\.ee$|(^|\.)s\.shopee\.com\.br$/.test(u.hostname))}catch{return false}};
export async function GET(_req,{params}){
 const sql=await getDB();if(!sql)return Response.json({error:'Ofertas de demonstração não possuem links de compra.'},{status:404});
 const {id}=await params;const rows=await sql`SELECT url FROM vivi_offers WHERE id=${id} AND active=true LIMIT 1`;
 if(!rows.length||!allowed(rows[0].url))return Response.json({error:'Link indisponível.'},{status:404});
 await sql`UPDATE vivi_offers SET clicks=clicks+1 WHERE id=${id}`;
 return Response.redirect(rows[0].url,302)
}

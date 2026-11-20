import {isAdmin,forbidden} from '../../../../lib/auth';
import {getDB,mapOffer} from '../../../../lib/db';
export const dynamic='force-dynamic';
const validUrl=u=>{try{let x=new URL(u);return x.protocol==='https:'&&(/(^|\.)shopee\.com\.br$|(^|\.)shopee\.com$|(^|\.)shopee\.ee$|(^|\.)s\.shopee\.com\.br$/.test(x.hostname))}catch{return false}};
export async function GET(){if(!await isAdmin())return forbidden();try{let sql=await getDB();if(!sql)return Response.json({offers:[],db:false});let rows=await sql`SELECT * FROM vivi_offers ORDER BY updated_at DESC LIMIT 500`;return Response.json({offers:rows.map(mapOffer),db:true})}catch{return Response.json({error:'Falha no banco'},{status:500})}}
export async function POST(req){if(!await isAdmin())return forbidden();const sql=await getDB();if(!sql)return Response.json({error:'Configure DATABASE_URL no servidor para salvar ofertas.'},{status:503});let d;try{d=await req.json()}catch{return Response.json({error:'JSON inválido'},{status:400})};
 const title=String(d.title||'').trim().slice(0,160),url=String(d.url||'').trim(),category=String(d.category||'Outros').slice(0,35),image=String(d.image||'').trim().slice(0,1024);
 const price=Number(d.price),oldPrice=d.oldPrice?Number(d.oldPrice):null;
 if(!title||!validUrl(url)||!Number.isFinite(price)||price<=0||price>1000000||image&&!/^https:\/\//.test(image))return Response.json({error:'Informe título, preço, imagem HTTPS (opcional) e link de afiliado Shopee válido.'},{status:400});
 const id=`manual-${crypto.randomUUID()}`;
 await sql`INSERT INTO vivi_offers(id,title,category,price,old_price,image,url,featured,active,origin) VALUES (${id},${title},${category},${price},${oldPrice},${image},${url},${Boolean(d.featured)},true,'manual')`;
 return Response.json({id,ok:true})
}

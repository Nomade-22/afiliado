import {isAdmin,forbidden} from '../../../../lib/auth';
import {getDB} from '../../../../lib/db';
import {searchShopee,hasShopeeCredentials} from '../../../../lib/shopee';
export const maxDuration=30;
export async function POST(req){
 if(!await isAdmin())return forbidden();const sql=await getDB();if(!sql)return Response.json({error:'Configure o banco antes de sincronizar.'},{status:503});if(!hasShopeeCredentials())return Response.json({error:'Credenciais Shopee ainda não configuradas no servidor.'},{status:503});
 let d={};try{d=await req.json()}catch{};try{
  const offers=await searchShopee(String(d.keyword||'').slice(0,80),Math.min(40,Math.max(1,Number(d.limit)||20)));let count=0;
  for(const o of offers){const image=o.image||'';await sql`INSERT INTO vivi_offers(id,title,category,price,old_price,image,url,featured,active,origin,updated_at) VALUES (${o.id},${o.title},${o.category},${o.price},${o.oldPrice},${image},${o.url},false,false,'shopee',NOW()) ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,price=EXCLUDED.price,old_price=EXCLUDED.old_price,image=EXCLUDED.image,url=EXCLUDED.url,updated_at=NOW()`;count++}
  return Response.json({ok:true,count,message:`${count} produtos importados para revisão. Ative-os no painel antes da publicação.`});
 }catch(e){return Response.json({error:`Sincronização não concluída: ${e.message}`},{status:502})}
}

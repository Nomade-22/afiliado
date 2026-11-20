import {isAdmin,forbidden} from '../../../../lib/auth';
import {getDB} from '../../../../lib/db';
import {searchShopeePage,hasShopeeCredentials} from '../../../../lib/shopee';

export const maxDuration=30;
export async function POST(req){
 if(!await isAdmin())return forbidden();
 if(!hasShopeeCredentials())return Response.json({error:'Credenciais Shopee não configuradas na Vercel.'},{status:503});
 let data={};
 try{data=await req.json()}catch{return Response.json({error:'Dados inválidos'},{status:400});}
 const ids=Array.isArray(data.ids)?[...new Set(data.ids.filter(x=>typeof x==='string'&&/^shopee-[0-9]+-[0-9]+$/.test(x)))].slice(0,40):[];
 if(!ids.length)return Response.json({error:'Selecione pelo menos um produto para importar.'},{status:400});
 try{
  const sql=await getDB();
  if(!sql)return Response.json({error:'Conecte DATABASE_URL ao Neon para salvar as ofertas.'},{status:503});
  const found=await searchShopeePage(data.keyword, data.limit??24, data.page??1);
  const chosen=found.offers.filter(x=>ids.includes(x.id));
  if(chosen.length!==ids.length)return Response.json({error:'Alguns produtos não foram encontrados novamente nessa página. Faça uma nova busca antes de importar.'},{status:409});
  let count=0;
  for(const o of chosen){
   await sql`INSERT INTO vivi_offers
    (id,title,category,price,old_price,image,url,featured,active,origin,
      item_id,shop_id,shop_name,commission_rate,price_max,price_discount_rate,
      product_link,sales,rating_star,updated_at)
    VALUES
    (${o.id},${o.title},${o.category},${o.price},${o.oldPrice},${o.image},${o.url},
     false,false,'shopee',${o.itemId},${o.shopId},${o.shopName},
     ${o.commissionRate},${o.priceMax},${o.priceDiscountRate},${o.productLink},
     ${o.sales},${o.ratingStar},NOW())
    ON CONFLICT(id) DO UPDATE SET
     title=EXCLUDED.title,price=EXCLUDED.price,old_price=EXCLUDED.old_price,
     image=EXCLUDED.image,url=EXCLUDED.url,
     item_id=EXCLUDED.item_id,shop_id=EXCLUDED.shop_id,shop_name=EXCLUDED.shop_name,
     commission_rate=EXCLUDED.commission_rate,price_max=EXCLUDED.price_max,
     price_discount_rate=EXCLUDED.price_discount_rate,product_link=EXCLUDED.product_link,
     sales=EXCLUDED.sales,rating_star=EXCLUDED.rating_star,updated_at=NOW()`;
   count++;
  }
  return Response.json({ok:true,count,message:`${count} produtos importados para revisão. Eles continuam inativos até você publicar.`});
 }catch(e){
  const msg=String(e?.message||'Erro ao importar');
  const auth=/password authentication failed|28P01/i.test(msg);
  return Response.json({error:auth?'O Neon rejeitou as credenciais de DATABASE_URL. Corrija a conexão na Vercel.':'A importação não foi concluída. Verifique a conexão Neon e tente novamente.'},{status:502});
 }
}

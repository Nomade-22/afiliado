import {isAdmin,forbidden} from '../../../../lib/auth';
import {getDB} from '../../../../lib/db';
import {searchShopeePage,hasShopeeCredentials} from '../../../../lib/shopee';
import {generateAffiliateLink,defaultSubIds} from '../../../../lib/shopee-links';

export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store'};
export async function POST(req){
 if(!await isAdmin())return forbidden();
 if(!hasShopeeCredentials())return Response.json({error:'Credenciais Shopee não configuradas na Vercel.'},{status:503,headers});
 let data={};
 try{data=await req.json()}catch{return Response.json({error:'Dados inválidos'},{status:400,headers})}
 const ids=Array.isArray(data.ids)
  ?[...new Set(data.ids.filter(x=>typeof x==='string'&&/^shopee-[0-9]+-[0-9]+$/.test(x)))]
  :[];
 if(!ids.length)return Response.json({error:'Selecione pelo menos um produto para importar.'},{status:400,headers});
 if(ids.length>8)return Response.json({error:'Importe até 8 produtos por vez para evitar o limite da API Shopee.'},{status:400,headers});
 let sql;
 try{
  sql=await getDB();
  if(!sql)return Response.json({error:'Para publicar os produtos no site, conecte DATABASE_URL ao Neon. Você já pode gerar links individuais na aba Links de Afiliado.'},{status:503,headers});
 }catch(error){
  const invalid=/password authentication failed|28P01/i.test(String(error?.message));
  return Response.json({error:invalid?'O Neon rejeitou a senha da DATABASE_URL. Enquanto isso, use a aba Links de Afiliado.':'O Neon ainda não está conectado. A geração de links funciona sem banco.'},{status:503,headers});
 }
 try{
  const found=await searchShopeePage(data.keyword, data.limit??24, data.page??1);
  const chosen=found.offers.filter(x=>ids.includes(x.id));
  if(chosen.length!==ids.length)return Response.json({error:'Um ou mais produtos mudaram na Shopee. Atualize a pesquisa antes de importar.'},{status:409,headers});

  // Todas as conversões devem funcionar antes que qualquer produto seja
  // cadastrado. Jamais publicamos productLink (sem conversão) como se fosse
  // link rastreado.
  const converted=[];
  for(let i=0;i<chosen.length;i+=2){
   const batch=chosen.slice(i,i+2);
   const result=await Promise.all(batch.map(async offer=>{
    const origin=offer.productLink||offer.url;
    const subIds=defaultSubIds({channel:'site',itemId:offer.itemId});
    const generated=await generateAffiliateLink(origin,subIds);
    return {...offer,url:generated.shortLink};
   }));
   converted.push(...result);
  }

  let count=0;
  for(const o of converted){
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
  return Response.json({ok:true,count,linksGenerated:converted.length,message:`${count} produtos importados com links de afiliado gerados pela Shopee e Sub IDs da Vivi. Estão inativos até você aprovar.`},{headers});
 }catch(error){
  const m=String(error?.message||'Erro ao importar');
  const db=/password authentication failed|28p01/i.test(m);
  return Response.json({
   error:db?'Autenticação DATABASE_URL rejeitada pelo Neon. Nenhum link sem rastreamento será publicado.':
     'Importação interrompida. A Shopee precisa confirmar todos os links e o Neon precisa gravar os produtos. Detalhe: '+m.slice(0,180)
  },{status:502,headers});
 }
}

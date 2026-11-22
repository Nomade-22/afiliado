import {getDB,mapOffer} from '../../../../lib/db';
import {getShopeeProductMetadata} from '../../../../lib/shopee-product';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const headers={'Cache-Control':'public, s-maxage=600, stale-while-revalidate=900','X-Content-Type-Options':'nosniff'};
export async function GET(req,{params}){
 const {id}=await params;
 if(!id||id.length>150)return Response.json({error:'Produto inválido.'},{status:400});
 try{
  const sql=await getDB();
  if(!sql)return Response.json({error:'Banco indisponível.'},{status:503});
  const rows=await sql`SELECT * FROM vivi_offers WHERE id=${id} AND active=true LIMIT 1`;
  if(!rows.length)return Response.json({error:'Produto não encontrado.'},{status:404});
  let saved=mapOffer(rows[0]);
  const live=await getShopeeProductMetadata(rows[0]);
  // As consultas feitas ao abrir a ficha também abastecem o catálogo
  // principal. Só grava preços/descontos com identificação exata na
  // Open API; a navegação nunca altera o link de afiliado ou Sub ID.
  if(live?.matched&&live.sourceAffiliate){
   const price=Number(live.priceMin);
   const priceMax=Number(live.priceMax);
   const discount=Number(live.discountRate);
   const validatedPrice=Number.isFinite(price)&&price>0&&price<1000000?price:null;
   const validatedMax=Number.isFinite(priceMax)&&priceMax>0&&priceMax<1000000?priceMax:null;
   const validatedDiscount=live.discountRate!==null&&
    Number.isFinite(discount)&&discount>=0&&discount<=95?discount:null;
   if(validatedPrice!==null){
    try{
     await sql`UPDATE vivi_offers SET
      price=${validatedPrice},
      price_max=COALESCE(${validatedMax},price_max),
      price_discount_rate=${validatedDiscount},
      discount_checked_at=NOW(),
      shop_name=COALESCE(${live.shopName||null},shop_name),
      sales=COALESCE(${live.sales??null},sales),
      rating_star=COALESCE(${live.ratingStar??null},rating_star),
      item_id=COALESCE(item_id,${live.ids?.itemId||null}),
      shop_id=COALESCE(shop_id,${live.ids?.shopId||null}),
      updated_from_api_at=NOW()
      WHERE id=${id} AND active=true`;
     saved=mapOffer({...rows[0],price:validatedPrice,price_max:validatedMax,
      price_discount_rate:validatedDiscount,discount_checked_at:new Date()});
    }catch{
     // A ficha continua navegável se o Neon estiver indisponível para escrita.
    }
   }
  }
  return Response.json({
   product:{
    id:saved.id,internalCode:saved.internalCode,title:saved.title,category:saved.category,
    price:saved.price,oldPrice:saved.oldPrice,image:saved.image,
    shopName:saved.shopName,shopId:saved.shopId,itemId:saved.itemId,
    sales:saved.sales,ratingStar:saved.ratingStar,discount:saved.discount,
    stockQuantity:saved.stockQuantity,
    description:saved.description,images:saved.images,
    importedAt:saved.importedAt
   },
   live,
   note:'Vendas e avaliações são métricas gerais da Shopee, não vendas feitas pelo Ofertas da Vivi. Estoque é exibido somente quando retornado por fonte identificável.'
  },{headers});
 }catch{return Response.json({error:'Não foi possível consultar dados adicionais.'},{status:503})}
}

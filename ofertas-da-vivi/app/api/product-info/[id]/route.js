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
  const saved=mapOffer(rows[0]);
  const live=await getShopeeProductMetadata(rows[0]);
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

import {notFound} from 'next/navigation';
import {getDB,mapOffer,getSettings} from '../../../lib/db';
import ProductDetail from '../../../components/ProductDetail';
export const dynamic='force-dynamic';
export const metadata={title:'Detalhes do produto | Ofertas da Vivi'};
export default async function ProductPage({params}){
 const {id}=await params;
 if(!id||id.length>150)notFound();
 let offer;
 let theme='orange';
 try{
  const sql=await getDB();
  if(!sql)notFound();
  const found=await sql`SELECT * FROM vivi_offers WHERE id=${id} AND active=true LIMIT 1`;
  if(!found.length)notFound();
  offer=mapOffer(found[0]);
  try{const s=await getSettings(sql);if(['orange','pink','purple'].includes(s.heroTheme))theme=s.heroTheme}catch{}
 }catch{notFound()}
 return <ProductDetail theme={theme} offer={{
  id:offer.id,internalCode:offer.internalCode,title:offer.title,
  category:offer.category,price:offer.price,oldPrice:offer.oldPrice,
  image:offer.image,images:offer.images,shopName:offer.shopName,
  sales:offer.sales,ratingStar:offer.ratingStar,
  description:offer.description,stockQuantity:offer.stockQuantity,
  importedAt:offer.importedAt,discount:offer.discount
 }}/>;
}

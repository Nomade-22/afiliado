import HomePageClient from '../components/HomePageClient';
import {defaultSettings} from '../lib/demo';
import {getDB,mapOffer,getSettings} from '../lib/db';
import {matchExisting,offerIdentityKeys} from '../lib/product-identity';

// Entrega as ofertas e o tema no HTML inicial; sem uma segunda busca obrigatória
// no navegador e sem tela de "Carregando os achadinhos" ao atualizar.
export const dynamic='force-dynamic';

async function initialCatalog(){
 try{
  const sql=await getDB();
  if(!sql)throw Error('DB_NOT_CONFIGURED');
  const [rows,settings]=await Promise.all([
   sql`SELECT * FROM vivi_offers WHERE active=true ORDER BY featured DESC, updated_at DESC LIMIT 300`,
   getSettings(sql)
  ]);
  const offers=[];
  const seen=new Set();
  for(const row of rows){
   const item={
    id:row.id,title:row.title,image:row.image,url:row.url,
    productLink:row.product_link,shopId:row.shop_id,itemId:row.item_id,
    dedupeKey:row.dedupe_key
   };
   if(matchExisting(item,seen))continue;
   offers.push(mapOffer(row));
   for(const key of offerIdentityKeys(item))seen.add(key);
  }
  // Serialização explícita para props seguras entre servidor e componente cliente.
  return {
   initialOffers:JSON.parse(JSON.stringify(offers)),
   initialSettings:{...defaultSettings,...settings},
   initialMode:'live',
   initialError:''
  };
 }catch(error){
  console.error('vivi_home_initial_catalog',String(error?.code||'CATALOG_UNAVAILABLE'));
  return {
   initialOffers:[],
   initialSettings:defaultSettings,
   initialMode:'error',
   initialError:'As ofertas não foram carregadas. Tente novamente.'
  };
 }
}

export default async function HomePage(){
 const catalog=await initialCatalog();
 return <HomePageClient {...catalog}/>;
}

import {demoOffers,defaultSettings} from '../../../lib/demo';
import {getDB,mapOffer,getSettings} from '../../../lib/db';
export const dynamic='force-dynamic';
export async function GET(){
 try{
  const sql=await getDB();
  if(!sql) return Response.json({offers:demoOffers,settings:defaultSettings,mode:'demo'}, {headers:{'Cache-Control':'no-store'}});
  const [rows,settings]=await Promise.all([sql`SELECT * FROM vivi_offers WHERE active=true ORDER BY featured DESC, updated_at DESC LIMIT 300`,getSettings(sql)]);
  return Response.json({offers:rows.map(mapOffer),settings:{...defaultSettings,...settings},mode:'live'},{headers:{'Cache-Control':'no-store'}})
 }catch(err){return Response.json({error:'Não foi possível carregar as ofertas.'},{status:500})}
}

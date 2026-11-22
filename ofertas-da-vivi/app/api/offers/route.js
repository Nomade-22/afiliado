import {demoOffers,defaultSettings} from '../../../lib/demo';
import {getDB,mapOffer,getSettings} from '../../../lib/db';
import {matchExisting,offerIdentityKeys} from '../../../lib/product-identity';

export const dynamic='force-dynamic';

// Resposta de diagnóstico sem revelar URL, senha, token ou conteúdo do erro original.
function classifyDatabaseError(error) {
  const code=String(error?.code||'').toUpperCase();
  const message=String(error?.message||'').toLowerCase();
  if (code==='28P01'||/password authentication failed|authentication failed/.test(message)) return 'DB_AUTHENTICATION';
  if (code==='3D000'||/database .* does not exist/.test(message)) return 'DB_NAME';
  if (code==='42501'||/permission denied/.test(message)) return 'DB_PERMISSION';
  if (code==='42P01'||/relation .* does not exist/.test(message)) return 'DB_TABLE_MISSING';
  if (/invalid url|invalid connection string|connection string|password must be|invalid port/.test(message)) return 'DB_URL_FORMAT';
  if (/fetch failed|enotfound|econnrefused|network|timeout|timed out|failed to connect/.test(message)) return 'DB_NETWORK';
  return 'DB_UNKNOWN';
}
export async function GET() {
  try {
    const sql=await getDB();
    if (!sql) {
      return Response.json({offers:demoOffers,settings:defaultSettings,mode:'demo'},
        {headers:{'Cache-Control':'no-store'}});
    }
    const [rows,settings]=await Promise.all([
      sql`SELECT * FROM vivi_offers WHERE active=true ORDER BY featured DESC, updated_at DESC LIMIT 300`,
      getSettings(sql)
    ]);
    const unique=[];
    const seen=new Set();
    for(const row of rows){
      const item={
       id:row.id,title:row.title,image:row.image,url:row.url,
       productLink:row.product_link,shopId:row.shop_id,itemId:row.item_id,
       dedupeKey:row.dedupe_key
      };
      if(matchExisting(item,seen))continue;
      unique.push(row);
      for(const key of offerIdentityKeys(item))seen.add(key);
    }
    return Response.json({
      offers:unique.map(mapOffer),
      settings:{...defaultSettings,...settings},
      mode:'live'
    },{headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    const diagnostic=classifyDatabaseError(error);
    // Logue apenas a categoria; nunca registrar secrets ou URL do banco.
    console.error('vivi_offers_database_error',diagnostic);
    return Response.json({
      error:'Não foi possível carregar as ofertas.',
      diagnostic,
      message:'Verifique DATABASE_URL, banco de destino e logs do servidor na Vercel.'
    },{status:500,headers:{'Cache-Control':'no-store'}});
  }
}

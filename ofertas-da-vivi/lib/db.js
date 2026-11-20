import { neon } from '@neondatabase/serverless';
let initPromise;
export const hasDatabase = () => Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres'));
export async function getDB(){
 if(!hasDatabase())return null;
 const sql=neon(process.env.DATABASE_URL);
 if(!initPromise)initPromise=(async()=>{
  await sql`CREATE TABLE IF NOT EXISTS vivi_offers (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Outros',
    price NUMERIC(12,2),
    old_price NUMERIC(12,2),
    image TEXT,
    url TEXT,
    featured BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE,
    origin TEXT NOT NULL DEFAULT 'manual',
    clicks INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    item_id TEXT,
    shop_id TEXT,
    shop_name TEXT,
    commission_rate NUMERIC(10,5),
    price_max NUMERIC(12,2),
    price_discount_rate NUMERIC(10,5),
    product_link TEXT,
    sales NUMERIC(15,0),
    rating_star NUMERIC(6,3)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS vivi_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`;
  await sql`ALTER TABLE vivi_offers
    ADD COLUMN IF NOT EXISTS item_id TEXT,
    ADD COLUMN IF NOT EXISTS shop_id TEXT,
    ADD COLUMN IF NOT EXISTS shop_name TEXT,
    ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(10,5),
    ADD COLUMN IF NOT EXISTS price_max NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS price_discount_rate NUMERIC(10,5),
    ADD COLUMN IF NOT EXISTS product_link TEXT,
    ADD COLUMN IF NOT EXISTS sales NUMERIC(15,0),
    ADD COLUMN IF NOT EXISTS rating_star NUMERIC(6,3)`;
 })().catch(e=>{initPromise=null;throw e});
 await initPromise;
 return sql;
}
const numberOrNull=x=>x===null||x===undefined?null:Number(x);
export const mapOffer=o=>({
 id:String(o.id),title:o.title,category:o.category,
 price:numberOrNull(o.price),oldPrice:numberOrNull(o.old_price),
 discount:(Number(o.old_price)>Number(o.price)&&Number(o.price)>0)?Math.round(100*(Number(o.old_price)-Number(o.price))/Number(o.old_price)):0,
 image:o.image,url:o.url,featured:o.featured,active:o.active,origin:o.origin,
 clicks:Number(o.clicks??0),isDemo:false,
 itemId:o.item_id??null,shopId:o.shop_id??null,shopName:o.shop_name??null,
 commissionRate:numberOrNull(o.commission_rate),priceMax:numberOrNull(o.price_max),
 priceDiscountRate:numberOrNull(o.price_discount_rate),productLink:o.product_link??null,
 sales:numberOrNull(o.sales),ratingStar:numberOrNull(o.rating_star)
});
export async function getSettings(sql){
 const rows=await sql`SELECT key,value FROM vivi_settings`;
 return Object.fromEntries(rows.map(r=>[r.key,r.value]));
}

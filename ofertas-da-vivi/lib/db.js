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
    discount_checked_at TIMESTAMPTZ,
    product_link TEXT,
    sales NUMERIC(15,0),
    rating_star NUMERIC(6,3),
    affiliate_link_source TEXT,
    affiliate_sub_ids TEXT,
    dedupe_key TEXT,
    internal_code TEXT,
    imported_at TIMESTAMPTZ,
    affiliate_status TEXT DEFAULT 'legacy',
    product_description TEXT,
    product_images TEXT,
    stock_quantity INTEGER,
    updated_from_api_at TIMESTAMPTZ
  )`;
  await sql`CREATE TABLE IF NOT EXISTS vivi_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS vivi_banner_media (
    id TEXT PRIMARY KEY,
    content_type TEXT NOT NULL,
    body_base64 TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`ALTER TABLE vivi_offers
    ADD COLUMN IF NOT EXISTS item_id TEXT,
    ADD COLUMN IF NOT EXISTS shop_id TEXT,
    ADD COLUMN IF NOT EXISTS shop_name TEXT,
    ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(10,5),
    ADD COLUMN IF NOT EXISTS price_max NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS price_discount_rate NUMERIC(10,5),
    ADD COLUMN IF NOT EXISTS discount_checked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS product_link TEXT,
    ADD COLUMN IF NOT EXISTS sales NUMERIC(15,0),
    ADD COLUMN IF NOT EXISTS rating_star NUMERIC(6,3),
    ADD COLUMN IF NOT EXISTS affiliate_link_source TEXT,
    ADD COLUMN IF NOT EXISTS affiliate_sub_ids TEXT,
    ADD COLUMN IF NOT EXISTS dedupe_key TEXT,
    ADD COLUMN IF NOT EXISTS internal_code TEXT,
    ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS affiliate_status TEXT DEFAULT 'legacy',
    ADD COLUMN IF NOT EXISTS product_description TEXT,
    ADD COLUMN IF NOT EXISTS product_images TEXT,
    ADD COLUMN IF NOT EXISTS stock_quantity INTEGER,
    ADD COLUMN IF NOT EXISTS updated_from_api_at TIMESTAMPTZ`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS vivi_offers_unique_identity ON vivi_offers (dedupe_key) WHERE dedupe_key IS NOT NULL`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS vivi_offers_unique_code ON vivi_offers (internal_code) WHERE internal_code IS NOT NULL`;
  await sql`CREATE TABLE IF NOT EXISTS vivi_product_code_counters (day_key TEXT PRIMARY KEY, last_number INTEGER NOT NULL DEFAULT 0)`;
 })().catch(e=>{initPromise=null;throw e});
 await initPromise;
 return sql;
}
const numberOrNull=x=>x===null||x===undefined?null:Number(x);
export const mapOffer=o=>{
 const lastSaleCheck=o.discount_checked_at?Date.parse(String(o.discount_checked_at)):0;
 const fresh=Number.isFinite(lastSaleCheck)&&lastSaleCheck>0&&Date.now()-lastSaleCheck<72*3600*1000&&Date.now()>=lastSaleCheck;
 const reported=Number(o.price_discount_rate);
 const verifiedDiscount=fresh&&Number.isFinite(reported)&&reported>=1&&reported<=95?
  Math.round(reported):0;
 const manualDiscount=Number(o.old_price)>Number(o.price)&&Number(o.price)>0?
  Math.round(100*(Number(o.old_price)-Number(o.price))/Number(o.old_price)):0;
 return {
 id:String(o.id),title:o.title,category:o.category,
 price:numberOrNull(o.price),oldPrice:numberOrNull(o.old_price),
 discount:verifiedDiscount||manualDiscount,
 verifiedDiscount:verifiedDiscount||null,
 discountSource:verifiedDiscount?'shopee':manualDiscount?'manual':null,
 discountCheckedAt:o.discount_checked_at||null,
 image:o.image,url:o.url,featured:o.featured,active:o.active,origin:o.origin,
 clicks:Number(o.clicks??0),isDemo:false,
 itemId:o.item_id??null,shopId:o.shop_id??null,shopName:o.shop_name??null,
 commissionRate:numberOrNull(o.commission_rate),priceMax:numberOrNull(o.price_max),
 priceDiscountRate:numberOrNull(o.price_discount_rate),productLink:o.product_link??null,
 sales:numberOrNull(o.sales),ratingStar:numberOrNull(o.rating_star),
 internalCode:o.internal_code??null,importedAt:o.imported_at??null,affiliateStatus:o.affiliate_status??'legacy',
 description:o.product_description??null,
 images:(()=>{try{const v=JSON.parse(o.product_images||'[]');return Array.isArray(v)?v.filter(x=>typeof x==='string').slice(0,12):[]}catch{return []}})(),
 stockQuantity:o.stock_quantity??null,updatedFromApiAt:o.updated_from_api_at??null,
 affiliateLinkSource:o.affiliate_link_source??null,
 dedupeKey:o.dedupe_key??null,
 affiliateSubIds:typeof o.affiliate_sub_ids==='string'?o.affiliate_sub_ids.split(',').filter(Boolean):[]
 };};
export async function getSettings(sql){
 const rows=await sql`SELECT key,value FROM vivi_settings`;
 return Object.fromEntries(rows.map(r=>[r.key,r.value]));
}

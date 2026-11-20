import { neon } from '@neondatabase/serverless';
let initPromise;
export const hasDatabase = () => Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres'));
export async function getDB(){
 if(!hasDatabase()) return null;
 const sql = neon(process.env.DATABASE_URL);
 if(!initPromise) initPromise = (async()=>{
   await sql`CREATE TABLE IF NOT EXISTS vivi_offers (id TEXT PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'Outros', price NUMERIC(12,2), old_price NUMERIC(12,2), image TEXT, url TEXT, featured BOOLEAN DEFAULT FALSE, active BOOLEAN DEFAULT TRUE, origin TEXT NOT NULL DEFAULT 'manual', clicks INTEGER DEFAULT 0, updated_at TIMESTAMPTZ DEFAULT NOW())`;
   await sql`CREATE TABLE IF NOT EXISTS vivi_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`;
 })().catch(e=>{initPromise=null;throw e});
 await initPromise;
 return sql;
}
export const mapOffer = o => ({id:String(o.id),title:o.title,category:o.category,price:o.price===null?null:Number(o.price),oldPrice:o.old_price===null?null:Number(o.old_price),discount:(Number(o.old_price)>Number(o.price)&&Number(o.price)>0)?Math.round(100*(Number(o.old_price)-Number(o.price))/Number(o.old_price)):0,image:o.image,url:o.url,featured:o.featured,active:o.active,origin:o.origin,clicks:Number(o.clicks??0),isDemo:false});
export async function getSettings(sql){
 const rows=await sql`SELECT key,value FROM vivi_settings`;
 return Object.fromEntries(rows.map(r=>[r.key,r.value]));
}

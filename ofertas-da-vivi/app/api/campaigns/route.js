import {getDB,getSettings} from '../../../lib/db';
import {defaultSettings} from '../../../lib/demo';
import {getShopeeCampaigns,getShopeeFlashCampaigns} from '../../../lib/shopee-campaigns';
import {isShopeeLink} from '../../../lib/shopee-links';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=25;
const headers={'Cache-Control':'public, s-maxage=900, stale-while-revalidate=900','X-Content-Type-Options':'nosniff'};
export async function GET(){
 let settings={...defaultSettings};
 try{
  const sql=await getDB();
  if(sql)settings={...settings,...await getSettings(sql)};
 }catch{}
 if(settings.campaignsEnabled==='off')return Response.json({enabled:false,links:[],offers:[],flashOffers:[]},{headers});
 const links=[
  {id:'flash',title:settings.flashSaleLabel||'Ofertas relâmpago',
   url:settings.flashSaleUrl,description:'Confira as ofertas disponíveis na Shopee.'},
  {id:'coupon',title:settings.couponLabel||'Cupons da Shopee',
   url:settings.couponUrl,description:'Consulte os cupons disponíveis e suas regras na Shopee.'}
 ].filter(item=>isShopeeLink(item.url));
 const [apiResult,flashResult]=settings.autoCampaigns==='on'?
  await Promise.all([getShopeeCampaigns(6),getShopeeFlashCampaigns(3)]):
  [{offers:[],warning:null},{offers:[],warning:'Campanhas automáticas desativadas.'}];
 return Response.json({enabled:true,links,offers:apiResult.offers,flashOffers:flashResult.offers,flashWarning:flashResult.warning,
  warning:apiResult.warning,
  note:'Campanhas da API são ofertas de divulgação, não necessariamente ofertas relâmpago ou cupons individuais. Validade e benefícios devem ser confirmados na Shopee.'
 },{headers});
}

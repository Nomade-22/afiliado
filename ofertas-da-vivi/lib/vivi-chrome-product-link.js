// Android deep link: solicita explicitamente o Google Chrome (com.android.chrome).
// A plataforma pode bloquear o intent ou oferecer tratamento diferente.
// Não abre a aplicação nativa Shopee intencionalmente.
export function viviShopeeProductUrl(shopId,itemId){
 const shop=String(shopId||''), item=String(itemId||'');
 if(!/^\d{1,24}$/.test(shop)||!/^\d{1,24}$/.test(item))return null;
 return 'https://shopee.com.br/product/'+shop+'/'+item;
}

export function viviChromeIntentUrl(shopId,itemId){
 const safe=viviShopeeProductUrl(shopId,itemId);
 if(!safe)return null;
 const target=safe.replace(/^https:\/\//,'');
 return 'intent://'+target+'#Intent;scheme=https;action=android.intent.action.VIEW;'+
  'package=com.android.chrome;category=android.intent.category.BROWSABLE;'+
  'S.browser_fallback_url='+encodeURIComponent(safe)+';end';
}

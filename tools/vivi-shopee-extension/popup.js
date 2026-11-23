/* Vivi Captura Shopee · piloto: só conteúdo da aba ativa, sem rede ou cookies */
let lastPayload=null;
const el=id=>document.getElementById(id);
const msg=(value,error=false)=>{el('status').textContent=value;el('status').className=error?'error':'';};

function captureShopeePage(){
 const u=new URL(location.href);
 if(!/^(?:www\.)?shopee\.com\.br$/i.test(u.hostname))return {error:'Abra um anúncio em shopee.com.br.'};
 const m=u.pathname.match(/\/product\/(\d+)\/(\d+)/i)||
  u.pathname.match(/(?:^|[-/])i\.(\d+)\.(\d+)(?:$|\/)/i)||
  u.pathname.match(/\/opaanlp\/(\d+)\/(\d+)(?:$|\/)/i);
 if(!m)return {error:'Não foi possível identificar o ID do anúncio. Abra a página completa do produto.'};
 const shopId=m[1],itemId=m[2];
 const text=node=>String(node?.innerText||node?.textContent||'').trim();
 const cleaned=t=>String(t||'').replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
 const meta=name=>document.querySelector('meta[property="'+name+'"],meta[name="'+name+'"]')?.content||'';
 const title=cleaned(text(document.querySelector('h1'))||
  text(document.querySelector('[data-sqe="name"]'))||
  meta('og:title')||document.title).slice(0,300);
 const displayTitle=title&&!/Shopee Brasil\s*[|\-]|Ofertas incríveis/i.test(title)
  ?title:'Anúncio Shopee '+itemId;

 const descriptionSelectors=[
  '[data-sqe="product-description"]',
  '#product-description',
  '[class*="product-detail__description"]',
  '[class*="product-description"]',
  '[itemprop="description"]'
 ];
 let description='';
 for(const selector of descriptionSelectors){
  for(const node of document.querySelectorAll(selector)){
   const val=cleaned(text(node));
   if(val.length>description.length&&val.length>35&&val.length<30000)description=val;
  }
 }
 // Alternativa para layouts que escondem a descrição em elementos sem classe estável.
 if(description.length<40){
  const body=String(document.body?.innerText||'');
  const marker=/Descri[cç][aã]o\s+do\s+Produto\s*:?/i.exec(body);
  if(marker){
   const section=body.slice(marker.index+marker[0].length,marker.index+marker[0].length+16000);
   const after=section.split(/\n\s*(?:Avalia[cç][oõ]es\s+do\s+Produto|Avalia[cç][oõ]es\s+dos\s+Clientes|Perguntas\s+e\s+Respostas|Voc[eê]\s+tamb[eé]m\s+pode\s+gostar|Produtos\s+semelhantes)\b/i)[0];
   description=cleaned(after);
  }
 }
 if(description.length>12000)description=description.slice(0,12000);
 if(description.length<35)description='';

 const goodUrl=value=>{
  try{
   if(!value||typeof value!=='string')return null;
   const v=value.startsWith('//')?'https:'+value:value;
   const p=new URL(v,location.origin);
   if(p.protocol!=='https:')return null;
   const h=p.hostname.toLowerCase();
   if(!['susercontent.com','shopee.com.br','shopee.sg','shopee.com'].some(d=>h===d||h.endsWith('.'+d)))return null;
   if(!p.pathname||p.pathname==='/')return null;
   p.search='';p.hash='';return p.href;
  }catch{return null}
 };
 const fingerprint=value=>{
  const path=new URL(value).pathname.toLowerCase().split('/').pop()||'';
  return path.replace(/(_tn|@resize_w\d+_n[lq]|_\d+x\d+)(?=\.|$)/g,'')
   .replace(/\.(jpg|jpeg|webp|png)$/,'');
 };
 const candidateUrls=[];
 const push=u=>{if(u)candidateUrls.push(u)};
 const scriptNodes=document.querySelectorAll('script[type="application/ld+json"]');
 for(const script of [...scriptNodes].slice(0,12)){
  try{
   const json=JSON.parse(script.textContent);
   const queue=[json];
   for(let i=0;i<35&&queue.length;i++){
    const item=queue.shift();
    if(Array.isArray(item)){queue.push(...item.slice(0,10));continue}
    if(!item||typeof item!=='object')continue;
    const types=Array.isArray(item['@type'])?item['@type']:[item['@type']];
    if(types.some(v=>String(v).toLowerCase()==='product')){
     for(const src of Array.isArray(item.image)?item.image:[item.image]){
      push(typeof src==='string'?src:src?.url||src?.contentUrl);
     }
    }
    if(item['@graph'])queue.push(item['@graph']);
   }
  }catch{}
 }
 const gallerySelectors=[
  '[data-sqe="product-image"] img',
  '[class*="product-image"] img',
  '[class*="product-gallery"] img',
  '[class*="product-media"] img',
  '[class*="product-detail"] [class*="carousel"] img',
  '[class*="thumbnail"] img',
  '[class*="product"] [class*="thumb"] img'
 ];
 const addImg=im=>{
  if(!im)return;
  push(im.currentSrc);push(im.getAttribute('data-src'));push(im.getAttribute('data-original'));
  push(im.getAttribute('src'));
  const srcset=im.getAttribute('srcset');
  if(srcset)push(srcset.split(',').pop()?.trim().split(/\s+/)[0]);
 };
 const gallerySet=new Set();
 const titleNode=document.querySelector('h1')||document.querySelector('[data-sqe="name"]');
 const titleY=titleNode?titleNode.getBoundingClientRect().top+scrollY:350;
 const threshold=Math.max(1200,titleY+850);
 for(const selector of gallerySelectors){
  for(const im of [...document.querySelectorAll(selector)].slice(0,65)){
   const box=im.getBoundingClientRect();
   // Não capturar fotos de avaliações, que ficam depois da galeria do anúncio.
   if(box.top+scrollY>=0&&box.top+scrollY<=threshold)gallerySet.add(im);
  }
 }
 for(const im of gallerySet)addImg(im);
 // Em alguns layouts da Shopee a galeria é renderizada sem nomes de classe.
 // Neste fallback só consideramos imagens do topo da página, antes das avaliações.
 if(gallerySet.size<2){
  for(const im of document.images){
   const rect=im.getBoundingClientRect();
   const y=rect.top+scrollY;
   if(y<0||y>threshold||rect.width<48||rect.height<45)continue;
   addImg(im);
   if(candidateUrls.length>100)break;
  }
 }
 push(meta('og:image'));
 const seen=new Set(),images=[];let duplicates=0;
 for(const raw of candidateUrls){
  const image=goodUrl(raw);
  if(!image)continue;
  const fp=fingerprint(image);
  if(seen.has(fp)){duplicates++;continue}
  seen.add(fp);images.push(image);
  if(images.length>=16)break;
 }
 if(!images.length&&description.length<35)return {error:'Nenhuma foto ou descrição encontrada. Abra a seção de detalhes e tente novamente.'};
 return {
  type:'vivi-shopee-capture-v1',shopId,itemId,title:displayTitle,
  sourceUrl:'https://shopee.com.br'+u.pathname,
  description,images,duplicateImagesRemoved:duplicates,
  capturedAt:new Date().toISOString(),
  note:'Dados visíveis no navegador; requer revisão antes de usar'
 };
}


// O clique no ícone da extensão concede activeTab. A leitura começa ao abrir o popup.
// O conteúdo só sai da aba Shopee depois da ação explícita do usuário.
const VIVI_BRIDGE='https://ofertas-da-vivi.vercel.app/captura-vivi#vivi-capture=';
let scanning=false;

function autoSaveEligible(payload){
 return typeof payload?.title==='string'&&payload.title.trim().length>=5&&
  !/Shopee Brasil|Ofertas incríveis|^Anúncio Shopee \d+$/i.test(payload.title)&&
  typeof payload.description==='string'&&payload.description.trim().length>=50&&
  Array.isArray(payload.images)&&payload.images.length>0;
}
function captureLink(payload){
 const link=VIVI_BRIDGE+encodeURIComponent(JSON.stringify(payload));
 if(link.length>24000)throw Error('Captura muito grande para envio automático. Use Copiar JSON e cole no painel de teste.');
 return link;
}
async function openTestPage(payload){
 const url=captureLink(payload);
 // Abre uma nova aba, preservando o anúncio da Shopee para continuar a navegação.
 await chrome.tabs.create({url,active:true});
}
async function scanActiveProduct(){
 if(scanning)return;
 scanning=true;
 lastPayload=null;
 el('result').style.display='none';
 el('scan').disabled=true;
 el('send').hidden=true;
 msg('Lendo automaticamente o anúncio da Shopee...');
 try{
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(!tab?.id||!/^https:\/\/(?:www\.)?shopee\.com\.br\//i.test(tab.url||'')){
   throw Error('Abra um produto completo em shopee.com.br e clique novamente na extensão Vivi.');
  }
  const results=await chrome.scripting.executeScript({target:{tabId:tab.id},func:captureShopeePage});
  const captured=results?.[0]?.result;
  if(!captured||captured.error)throw Error(captured?.error||'O anúncio não disponibilizou os dados.');
  lastPayload=captured;
  el('title').textContent=captured.title;
  el('imgs').textContent=captured.images.length;
  el('chars').textContent=captured.description.length;
  el('removed').textContent=captured.duplicateImagesRemoved;
  el('result').style.display='block';
  if(autoSaveEligible(captured)){
   msg('Captura completa. Abrindo o ambiente de teste para salvar automaticamente...');
   try{
    await openTestPage(captured);
    msg('Captura enviada ao teste. Aguarde a confirmação de salvamento na aba Vivi.');
   }catch(error){
    msg(error?.message||'Não foi possível abrir a Vivi. Use Copiar JSON.',true);
   }
  }else{
   el('send').hidden=false;
   msg('Captura parcial: fotos, título ou descrição insuficientes. Abra todos os detalhes do anúncio e clique em Capturar novamente; ou envie para revisão manual.');
  }
 }catch(error){
  msg(error?.message||'Não foi possível ler a página.',true);
 }finally{
  scanning=false;
  el('scan').disabled=false;
 }
}

el('scan').addEventListener('click',scanActiveProduct);
el('send').addEventListener('click',async()=>{
 if(!lastPayload)return;
 el('send').disabled=true;
 try{
  await openTestPage(lastPayload);
  msg('Enviado para revisão no painel Vivi. Capturas parciais não são salvas automaticamente.');
 }catch(error){
  msg(error?.message||'Não foi possível enviar. Use Copiar JSON.',true);
 }finally{
  el('send').disabled=false;
 }
});
el('copy').addEventListener('click',async()=>{
 if(!lastPayload)return;
 try{
  await navigator.clipboard.writeText(JSON.stringify(lastPayload));
  msg('JSON copiado! Use ADM → Teste de importação → Salvar manualmente no teste.');
 }catch{
  msg('Não foi possível copiar. Confira a permissão da área de transferência.',true);
 }
});

// O usuário só precisa clicar no ícone Vivi na barra do Chrome.
scanActiveProduct();

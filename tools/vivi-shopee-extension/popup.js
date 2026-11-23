/* Vivi Captura Shopee · piloto: só conteúdo da aba ativa, sem rede ou cookies */
let lastPayload=null;
const el=id=>document.getElementById(id);
const msg=(value,error=false)=>{el('status').textContent=value;el('status').className=error?'error':'';};

function captureShopeePage(){
 const u=new URL(location.href);
 if(!/^(?:www\.)?shopee\.com\.br$/i.test(u.hostname))return {error:'Abra um anúncio em shopee.com.br.'};
 const m=u.pathname.match(/\/product\/(\d+)\/(\d+)/i)||
  u.pathname.match(/(?:^|[-/])i\.(\d+)\.(\d+)(?:$|\/)/i);
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

el('scan').addEventListener('click',async()=>{
 el('result').style.display='none';
 lastPayload=null;el('scan').disabled=true;
 msg('Lendo o anúncio aberto...');
 try{
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(!tab?.id||!/^https:\/\/(?:www\.)?shopee\.com\.br\//i.test(tab.url||'')){
   throw new Error('Abra primeiro o anúncio completo no Chrome, em shopee.com.br.');
  }
  const results=await chrome.scripting.executeScript({
   target:{tabId:tab.id},func:captureShopeePage
  });
  const result=results?.[0]?.result;
  if(!result||result.error)throw new Error(result?.error||'A página não disponibilizou os dados.');
  lastPayload=result;
  el('title').textContent=result.title;
  el('imgs').textContent=result.images.length;
  el('chars').textContent=result.description.length;
  el('removed').textContent=result.duplicateImagesRemoved;
  el('result').style.display='block';
  msg('Dados coletados. Revise-os na aba de teste antes de salvar.');
 }catch(error){msg(error?.message||'Não foi possível ler a página.',true)}
 finally{el('scan').disabled=false}
});
el('copy').addEventListener('click',async()=>{
 if(!lastPayload)return;
 try{
  await navigator.clipboard.writeText(JSON.stringify(lastPayload));
  msg('JSON copiado! Cole no ADM → Teste de importação → Salvar captura apenas no teste.');
 }catch(error){msg('Não foi possível copiar para a área de transferência.',true)}
});

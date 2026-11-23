'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const vm=require('node:vm');
const code=fs.readFileSync(path.join(__dirname,'..','batch.js'),'utf8');
const item={
 shopId:'429581781',itemId:'28493067358',
 title:'Bolsa Feminina Baguete Média De Ombro Estilosa Casual',
 sourceUrl:'https://shopee.com.br/product/429581781/28493067358'
};
const other={shopId:'100000',itemId:'99999999999'};
const captured=(extra={})=>({
 type:'vivi-shopee-capture-v1',shopId:item.shopId,itemId:item.itemId,
 title:item.title,description:'',images:[],sourceUrl:item.sourceUrl,...extra
});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness({second=captured({description:'Bolsa baguete elegante com alça confortável e fechamento reforçado para o dia a dia.'}),first=captured({images:['https://down-br.img.susercontent.com/file/bolsa-1']}),third=null}={}){
 const store={};
 const urls=[],saved=[],messages=[];
 let listener;
 let productUrl=item.sourceUrl;
 const chrome={
  runtime:{onMessage:{addListener(fn){listener=fn}}},
  storage:{
   session:{
    get:async key=>({[key]:store[key]}),
    set:async object=>Object.assign(store,object)
   },
   local:{set:async object=>Object.assign(store,object)}
  },
  tabs:{
   get:async id=>id===1?{id:1,url:'https://ofertas-da-vivi.vercel.app/adm#teste-importacao',status:'complete'}:
    {id:6,url:productUrl,status:'complete'},
   sendMessage:async(_id,message)=>{
    messages.push(message);
    if(message.type==='viviAdminCheckTab')
     return {ok:true,origin:'https://ofertas-da-vivi.vercel.app',pathname:'/adm'};
    if(message.type==='viviAdminSavePayload'){
     saved.push(message.payload);
     return {ok:true,status:200,imageCount:message.payload.images.length,
      descriptionChars:message.payload.description.length};
    }
   },
   create:async info=>{urls.push(info.url);productUrl=info.url;return {id:6}},
   update:async(_id,info)=>{if(info.url){urls.push(info.url);productUrl=info.url;}},
   remove:async()=>{}
  },
  scripting:{
   executeScript:async()=>[{
    result:productUrl.includes('opaanlp')?second:
     productUrl.includes('/-i.')?third:first
   }]
  }
 };
 const globals={chrome,URL,Date,Set,console,setTimeout:fn=>fn()};
 vm.runInNewContext(code,globals,{filename:'batch.js'});
 const send=(message)=>new Promise(resolve=>listener(message,{},resolve));
 async function complete(){
  for(let i=0;i<100;i++){
   if(['completed','paused'].includes(store.viviPilotBatch?.status))return store.viviPilotBatch;
   await tick();
  }
  throw Error('Batch execution did not finish');
 }
 return {send,complete,urls,saved,messages};
}
test('combina fotos da URL normal e descrição da rota alternativa do mesmo ID',async()=>{
 const h=harness();
 const response=await h.send({type:'viviBatchStart',adminTabId:1,items:[item]});
 assert.equal(response.ok,true);
 const job=await h.complete();
 assert.equal(job.results[0].status,'saved');
 assert.equal(h.saved.length,1);
 assert.equal(h.saved[0].images.length,1);
 assert.match(h.saved[0].description,/Bolsa baguete elegante/);
 assert.equal(h.saved[0].itemId,item.itemId);
 assert.equal(h.saved[0].sourceUrl,item.sourceUrl);
 assert.equal(h.urls.length,2);
 assert.match(h.urls[1],/\/opaanlp\//);
});
test('nunca usa descrição retornada por página de outro produto',async()=>{
 const h=harness({second:captured({
  shopId:other.shopId,itemId:other.itemId,
  sourceUrl:'https://shopee.com.br/opaanlp/'+other.shopId+'/'+other.itemId,
  description:'Descrição longa de outro produto que NÃO pertence ao anúncio da bolsa.'
 })});
 const response=await h.send({type:'viviBatchStart',adminTabId:1,items:[item]});
 assert.equal(response.ok,true);
 const job=await h.complete();
 assert.equal(job.results[0].status,'partial');
 assert.equal(h.saved.length,1);
 assert.equal(h.saved[0].description,'');
 assert.equal(h.saved[0].images.length,1);
 assert.equal(h.urls.length,3);
});
test('sem nenhuma informação, não salva dados vazios',async()=>{
 const h=harness({first:captured(),second:captured(),third:captured()});
 await h.send({type:'viviBatchStart',adminTabId:1,items:[item]});
 const job=await h.complete();
 assert.equal(job.results[0].status,'partial');
 assert.equal(h.saved.length,0);
});
test('endpoint preserva conteúdo válido e promove apenas descrição/galeria à vitrine',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../../../ofertas-da-vivi/app/api/admin/scrapling-test/extension/route.js'),'utf8');
 assert.match(source,/vivi_extension_test_captures\.description/);
 assert.match(source,/ELSE vivi_extension_test_captures\.description/);
 assert.match(source,/jsonb_array_length\(EXCLUDED\.images_json::jsonb\)>/);
 assert.match(source,/UPDATE vivi_offers SET/);
 assert.match(source,/publicStorefrontChanged:updated.length>0/);
 assert.doesNotMatch(source,/SET price=/i);
 assert.doesNotMatch(source,/SET updated_at=/i);
});

'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const vm=require('node:vm');
const code=fs.readFileSync(path.join(__dirname,'..','batch.js'),'utf8');
const item={shopId:'379854024',itemId:'21197672110',title:'Salomé sapatilha sapato feminino',
 sourceUrl:'https://shopee.com.br/product/379854024/21197672110'};
const captured={type:'vivi-shopee-capture-v1',shopId:item.shopId,itemId:item.itemId,
 title:'Salomé sapatilha sapato feminino',sourceUrl:item.sourceUrl,
 description:'Descrição visível completa, confortável e com informações detalhadas do produto de moda feminina.',
 images:['https://down-br.img.susercontent.com/file/abc123'],duplicateImagesRemoved:0};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function makeHarness({read=captured,backendStatus=200,backendPayload={ok:true,imageCount:1,descriptionChars:93}}={}){
 let listener=null;
 const stored={};
 const opened=[],removed=[],posted=[];
 const mock={
  chrome:{
   runtime:{onMessage:{addListener(fn){listener=fn}}},
   storage:{
    local:{set:async obj=>Object.assign(stored,obj)},
    session:{
     get:async key=>typeof key==='string'?{[key]:stored[key]}:{...stored},
     set:async obj=>Object.assign(stored,obj)
    }
   },
   tabs:{
    get:async id=>id===6?{id:6,status:'complete',url:item.sourceUrl}:
     {id:1,status:'complete',url:'https://ofertas-da-vivi.vercel.app/adm#teste-importacao'},
    create:async data=>{opened.push(data);return {id:6}},
    remove:async id=>{removed.push(id)},
    update:async()=>{}
   },
   scripting:{executeScript:async opts=>{
    if(opts.files)return [{result:read}];
    return [{result:await opts.func(opts.args[0])}];
   }}
  },
  fetch:async(url,params)=>{
   posted.push({url,body:JSON.parse(params.body)});
   return {ok:backendStatus===200,status:backendStatus,json:async()=>backendPayload};
  },
  URL,Set,Date,console,setTimeout:fn=>fn()
 };
 vm.runInNewContext(code,mock,{filename:'batch.js'});
 async function message(m){
  return await new Promise(resolve=>{
   const returned=listener(m,{},resolve);
   if(returned!==true)resolve({ok:false,error:'No async message handler'});
  });
 }
 async function finish(){
  for(let i=0;i<50;i++){
   const state=stored.viviPilotBatch;
   if(state&&state.status!=='running')return state;
   await tick();
  }
  throw Error('Batch did not finish');
 }
 return {stored,posted,opened,removed,message,finish};
}
test('captura e grava item completo pela API autenticada do ADM',async()=>{
 const h=await makeHarness();
 const started=await h.message({type:'viviBatchStart',adminTabId:1,items:[item]});
 assert.equal(started.ok,true);
 const state=await h.finish();
 assert.equal(state.status,'completed');
 assert.equal(state.results.length,1);
 assert.equal(state.results[0].status,'saved');
 assert.equal(h.posted.length,1);
 assert.equal(h.posted[0].url,'/api/admin/scrapling-test/extension');
 assert.equal(h.opened.length,1);
 assert.equal(h.removed[0],6);
});
test('dados parciais não são gravados, apesar da abertura do anúncio',async()=>{
 const h=await makeHarness({read:{...captured,description:'curta',images:[]}});
 const started=await h.message({type:'viviBatchStart',adminTabId:1,items:[item]});
 assert.equal(started.ok,true);
 const state=await h.finish();
 assert.equal(state.results[0].status,'partial');
 assert.equal(h.posted.length,0);
});
test('rejeita endereço não canônico e não inicia a fila',async()=>{
 const h=await makeHarness();
 const started=await h.message({type:'viviBatchStart',adminTabId:1,
  items:[{...item,sourceUrl:'https://example.com/product/379854024/21197672110'}]});
 assert.equal(started.ok,false);
 assert.equal(h.opened.length,0);
});
test('não dispara dois trabalhos com IDs repetidos',async()=>{
 const h=await makeHarness();
 const started=await h.message({type:'viviBatchStart',adminTabId:1,items:[item,item]});
 assert.equal(started.ok,false);
});
test('401 no ADM pausa lote para novo login, sem alegar sucesso',async()=>{
 const h=await makeHarness({backendStatus:401,backendPayload:{error:'Não autorizado'}});
 const started=await h.message({type:'viviBatchStart',adminTabId:1,items:[item]});
 assert.equal(started.ok,true);
 const state=await h.finish();
 assert.equal(state.status,'paused');
 assert.equal(state.results[0].status,'error');
 assert.equal(h.posted.length,1);
 assert.match(state.message,/Login administrativo/);
});

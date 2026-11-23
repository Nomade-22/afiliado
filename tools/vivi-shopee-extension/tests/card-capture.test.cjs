'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const code=fs.readFileSync(path.join(__dirname,'..','batch.js'),'utf8');
const item={
 shopId:'379854024',itemId:'21197672110',title:'Salomé sapatilha sapato feminino',
 sourceUrl:'https://shopee.com.br/product/379854024/21197672110'
};
const payload={
 type:'vivi-shopee-capture-v1',shopId:item.shopId,itemId:item.itemId,
 sourceUrl:item.sourceUrl,title:item.title,
 description:'Descrição completa visível na Shopee contendo informações suficientes sobre a sapatilha.',
 images:['https://down-br.img.susercontent.com/file/image123']
};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function createHarness({granted=true,save={ok:true,status:200,imageCount:1,descriptionChars:90},candidate=true}={}){
 let messageHandler;
 const store={},sent=[],opened=[],closed=[];
 const browser={
  chrome:{
   runtime:{onMessage:{addListener(fn){messageHandler=fn}}},
   permissions:{contains:async()=>granted},
   storage:{
    local:{set:async values=>Object.assign(store,values)},
    session:{
     get:async key=>({[key]:store[key]}),
     set:async values=>Object.assign(store,values)
    }
   },
   tabs:{
    get:async tabId=>tabId===1?{id:1,url:'https://ofertas-da-vivi.vercel.app/adm#teste-importacao',status:'complete'}:
     {id:6,url:item.sourceUrl,status:'complete'},
    create:async o=>{opened.push(o);return {id:6}},
    remove:async id=>{closed.push(id)},
    update:async()=>{},
    sendMessage:async(_id,msg)=>{
     sent.push(msg);
     if(msg.type==='viviAdminValidateProduct')return candidate?{item}:{error:'Produto fora dos dez anúncios de teste.'};
     if(msg.type==='viviAdminSavePayload')return save;
     return {ok:true};
    }
   },
   scripting:{executeScript:async()=>[{result:payload}]}
  },
  URL,Date,Set,console,setTimeout:fn=>fn()
 };
 vm.runInNewContext(code,browser,{filename:'batch.js'});
 const send=msg=>new Promise(resolve=>messageHandler(msg,{tab:{id:1}},resolve));
 async function complete(){
  for(let i=0;i<100;i++){
   if(store.viviPilotBatch?.status==='completed'||store.viviPilotBatch?.status==='paused')
    return store.viviPilotBatch;
   await tick();
  }
  throw Error('Timed out');
 }
 return {send,complete,store,sent,opened,closed};
}
const command={type:'viviCardCaptureStart',requestId:'vivi-card-12345678',
 shopId:item.shopId,itemId:item.itemId};
test('clique no card abre Shopee e grava no ADM autenticado',async()=>{
 const h=createHarness();
 const started=await h.send(command);
 assert.equal(started.ok,true);
 const result=await h.complete();
 assert.equal(result.results[0].status,'saved');
 assert.equal(result.origin,'card');
 assert.equal(h.opened.length,1);
 assert.equal(h.closed.length,1);
 assert.equal(h.sent.some(x=>x.type==='viviAdminValidateProduct'),true);
 assert.equal(h.sent.some(x=>x.type==='viviAdminSavePayload'),true);
 await tick();
 assert.equal(h.sent.some(x=>x.type==='viviCardCaptureFinished'),true);
});
test('extensão não tenta capturar sem permissão Shopee',async()=>{
 const h=createHarness({granted:false});
 const r=await h.send(command);
 assert.equal(r.ok,false);
 assert.match(r.error,/Autorize a Shopee/);
 assert.equal(h.opened.length,0);
});
test('só permite produtos presentes na lista de dez do ADM',async()=>{
 const h=createHarness({candidate:false});
 const r=await h.send(command);
 assert.equal(r.ok,false);
 assert.match(r.error,/fora dos dez/);
 assert.equal(h.opened.length,0);
});
test('não informa salvo se a API não confirmar',async()=>{
 const h=createHarness({save:{ok:false,status:422,error:'Captura inválida'}});
 const r=await h.send(command);
 assert.equal(r.ok,true);
 const end=await h.complete();
 assert.equal(end.results[0].status,'error');
 assert.match(end.results[0].reason,/Captura inválida/);
});

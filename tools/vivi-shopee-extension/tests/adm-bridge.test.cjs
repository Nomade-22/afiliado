'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const src=fs.readFileSync(path.join(__dirname,'..','adm-bridge.js'),'utf8');
const sample={
 type:'vivi-shopee-capture-v1',shopId:'379854024',itemId:'21197672110',
 sourceUrl:'https://shopee.com.br/product/379854024/21197672110',
 title:'Salomé sapatilha sapato feminino',
 description:'Descrição completa visível no anúncio, com detalhes do produto e medidas para uso.',
 images:['https://down-br.img.susercontent.com/file/photo'],duplicateImagesRemoved:0
};
function harness({origin='https://ofertas-da-vivi.vercel.app',pathname='/adm'}={}){
 const sent=[],runtime=[],requests=[];
 const handlers={};
 const win={
  location:{origin,pathname},
  addEventListener(type,fn){handlers[type]=fn},
  postMessage(msg,target){sent.push({msg,target})}
 };
 const chrome={
  runtime:{
   sendMessage:async msg=>{runtime.push(msg);return {ok:true}},
   onMessage:{addListener(fn){handlers.runtime=fn}}
  }
 };
 const ctx={window:win,location:win.location,chrome,
  fetch:async(url,options)=>{
   requests.push({url,options});
   if(url==='/api/admin/scrapling-test')return {
    ok:true,json:async()=>({candidates:[{shopId:'379854024',itemId:'21197672110',title:sample.title}]})
   };
   return {ok:true,status:200,json:async()=>({ok:true,imageCount:1,descriptionChars:sample.description.length})};
  }
 };
 vm.runInNewContext(src,ctx,{filename:'adm-bridge.js'});
 return {
  sent,runtime,requests,handlers,win,
  receive(msg,where=origin,source=win){
   handlers.message?.({data:msg,source,origin:where});
  },
  runtimeMessage(msg){
   return new Promise(resolve=>{
    const result=handlers.runtime?.(msg,{},resolve);
    if(result!==true)resolve(null);
   });
  }
 };
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('botão válido dispara captura pela extensão e recebe ACK',async()=>{
 const h=harness();
 h.receive({type:'vivi:card:capture:start:v1',requestId:'vivi-test-123456',
  shopId:'379854024',itemId:'21197672110'});
 await tick();
 assert.equal(h.runtime.length,1);
 assert.equal(h.runtime[0].type,'viviCardCaptureStart');
 assert.equal(h.sent.some(x=>x.msg.phase==='received'),true);
 assert.equal(h.sent.some(x=>x.msg.phase==='started'),true);
});
test('não aceita mensagens de outro domínio ou janela',async()=>{
 const h=harness();
 const request={type:'vivi:card:capture:start:v1',requestId:'vivi-test-123456',
  shopId:'379854024',itemId:'21197672110'};
 h.receive(request,'https://example.com');
 h.receive(request,'https://ofertas-da-vivi.vercel.app',{});
 h.receive({...request,itemId:'not-a-number'});
 await tick();
 assert.equal(h.runtime.length,0);
});
test('ponte só inicia no painel administrativo',()=>{
 const h=harness({pathname:'/adm/login'});
 assert.equal(h.handlers.message,undefined);
 assert.equal(h.handlers.runtime,undefined);
});
test('a validação do produto exige correspondência com a lista do servidor',async()=>{
 const h=harness();
 const allowed=await h.runtimeMessage({
  type:'viviAdminValidateProduct',shopId:'379854024',itemId:'21197672110'
 });
 assert.equal(allowed.item.sourceUrl,sample.sourceUrl);
 const denied=await h.runtimeMessage({
  type:'viviAdminValidateProduct',shopId:'379854024',itemId:'4444444'
 });
 assert.match(denied.error,/fora dos vinte/i);
 assert.equal(h.requests[0].url,'/api/admin/scrapling-test');
});
test('retorna sucesso somente após resposta confirmada da API',async()=>{
 const h=harness();
 const saved=await h.runtimeMessage({type:'viviAdminSavePayload',payload:sample});
 assert.equal(saved.ok,true);
 assert.equal(saved.imageCount,1);
 assert.equal(h.requests[0].url,'/api/admin/scrapling-test/extension');
 assert.equal(h.requests[0].options.credentials,'same-origin');
});
test('devolve a confirmação ao card específico',async()=>{
 const h=harness();
 h.handlers.runtime({
  type:'viviCardCaptureFinished',requestId:'vivi-test-123456',
  result:{status:'saved',photos:6,chars:120}
 },{},()=>{});
 assert.equal(h.sent.at(-1).msg.type,'vivi:card:capture:finished:v1');
 assert.equal(h.sent.at(-1).msg.photos,6);
});

test('ponte confirma a origem/caminho do ADM sem acessar tab.url',async()=>{
 const h=harness();
 const reply=await h.runtimeMessage({type:'viviAdminCheckTab'});
 assert.equal(reply.ok,true);
 assert.equal(reply.origin,'https://ofertas-da-vivi.vercel.app');
 assert.equal(reply.pathname,'/adm');
});

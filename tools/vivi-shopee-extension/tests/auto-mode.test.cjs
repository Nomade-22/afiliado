'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const code=fs.readFileSync(path.join(__dirname,'..','background.js'),'utf8');
const base={
 type:'vivi-shopee-capture-v1',shopId:'361729924',itemId:'14361398676',
 title:'Máscara Invigo Nutri-Enrich Wella Professionals 150ml',
 description:'Informações completas do produto que aparecem no anúncio de forma pública e validada.',
 images:['https://down-br.img.susercontent.com/file/abc123'],
 sourceUrl:'https://shopee.com.br/product/361729924/14361398676'
};
function makeContext(payload,{url='https://shopee.com.br/product/361729924/14361398676',enabled=true,history={},permission=true}={}){
 const events={},sent=[];
 const store={viviAutoEnabled:enabled,viviAutoLast:null};
 let processed={...history};
 let currentUrl=url;
 const ctx={URL,console,setTimeout:fn=>fn(),Date,importScripts:()=>{},
  chrome:{
   tabs:{
    onUpdated:{addListener(fn){events.updated=fn}},
    onActivated:{addListener(fn){events.activated=fn}},
    get:async()=>({id:5,active:true,url:currentUrl}),
    query:async()=>[{id:5,active:true,url:currentUrl}],
    create:async obj=>{sent.push(obj);return {id:6}}
   },
   permissions:{contains:async()=>permission},
   runtime:{onMessage:{addListener(fn){events.message=fn}}},
   scripting:{executeScript:async()=>[{result:payload}]},
   storage:{
    local:{
     get:async()=>({...store}),
     set:async values=>Object.assign(store,values)
    },
    session:{
     get:async()=>({viviAutoProcessed:processed}),
     set:async val=>{processed=val.viviAutoProcessed},
     remove:async()=>{processed={}}
    }
   }
  }
 };
 vm.createContext(ctx);
 vm.runInContext(code,ctx,{filename:'background.js'});
 return {ctx,sent,events,store,history:()=>processed,setUrl:value=>currentUrl=value};
}
test('auto captura anúncio completo sem trocar a aba ativa',async()=>{
 const x=makeContext(base);
 await x.ctx.scanAutoTab(5);
 assert.equal(x.sent.length,1);
 assert.equal(x.sent[0].active,false);
 assert.equal(new URL(x.sent[0].url).pathname,'/captura-vivi');
 assert.deepEqual(Object.keys(x.history()),['361729924:14361398676']);
 assert.equal(x.store.viviAutoLast.type,'sent');
});
test('não repete o mesmo produto na sessão',async()=>{
 const x=makeContext(base);
 await x.ctx.scanAutoTab(5);
 await x.ctx.scanAutoTab(5);
 assert.equal(x.sent.length,1);
});
test('sem modo ativado não faz captura ou envio',async()=>{
 const x=makeContext(base,{enabled:false});
 await x.ctx.scanAutoTab(5);
 assert.equal(x.sent.length,0);
 assert.equal(x.history()['361729924:14361398676'],undefined);
});
test('só considera domínios e páginas de produto Shopee',async()=>{
 const x=makeContext(base,{url:'https://shopee.com.br/shop/361729924'});
 await x.ctx.scanAutoTab(5);
 assert.equal(x.sent.length,0);
 assert.equal(x.ctx.productKeyFromUrl('https://evil.example/product/12/34'),'');
 assert.equal(x.ctx.productKeyFromUrl('https://shopee.com.br/opaanlp/361729924/14361398676'),'361729924:14361398676');
});
test('dados parciais ou título genérico nunca são enviados',async()=>{
 for(const data of [{...base,description:'pouca'}, {...base,title:'Anúncio Shopee 14361398676'}, {...base,images:[]}]){
  const x=makeContext(data);
  await x.ctx.scanAutoTab(5);
  assert.equal(x.sent.length,0);
  assert.equal(x.store.viviAutoLast.type,'partial');
 }
});
test('sem autorização opcional o modo é desativado',async()=>{
 const x=makeContext(base,{permission:false});
 await x.ctx.scanAutoTab(5);
 assert.equal(x.sent.length,0);
 assert.equal(x.store.viviAutoEnabled,false);
});
test('limite de dez anúncios desativa o modo contínuo',async()=>{
 const history={};
 for(let i=0;i<10;i++)history['2:'+i]={at:1};
 const x=makeContext(base,{history});
 await x.ctx.scanAutoTab(5);
 assert.equal(x.sent.length,0);
 assert.equal(x.store.viviAutoEnabled,false);
 assert.equal(x.store.viviAutoLast.type,'limit');
});
test('arquivo compartilhado de captura está presente e é sintaticamente válido',()=>{
 const content=fs.readFileSync(path.join(__dirname,'..','capture-page.js'),'utf8');
 assert.match(content,/captureShopeePage\(\);/);
 assert.match(content,/opaanlp/);
 new vm.Script(content,{filename:'capture-page.js'});
});

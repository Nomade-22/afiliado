'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const vm=require('node:vm');

const script=fs.readFileSync(path.join(__dirname,'..','popup.js'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'..','manifest.json'),'utf8'));
const complete={
 type:'vivi-shopee-capture-v1',shopId:'361729924',itemId:'14361398676',
 title:'Máscara Invigo Nutri-Enrich Wella Professionals 150ml',
 sourceUrl:'https://shopee.com.br/product/361729924/14361398676',
 description:'Descrição de produto completa, com informações visíveis no anúncio e mais de cinquenta caracteres.',
 images:['https://down-br.img.susercontent.com/file/abc123'],duplicateImagesRemoved:0
};
async function run(payload,{page='https://shopee.com.br/product/361729924/14361398676'}={}){
 const dom=new Map();
 for(const id of ['scan','send','copy','result','status','title','imgs','chars','removed','autoSwitch','autoState','autoLast','resetAuto']){
  dom.set(id,{
   style:{display:''},hidden:id==='send',disabled:false,className:'',textContent:'',
   handlers:{},addEventListener(event,handler){this.handlers[event]=handler;}
  });
 }
 const tabsCreated=[];
 let injections=0;
 const context={
  document:{getElementById:id=>dom.get(id)},
  chrome:{
   storage:{
    local:{get:async()=>({viviAutoEnabled:false}),set:async()=>{}},
    session:{get:async()=>({viviAutoProcessed:{}}),set:async()=>{},remove:async()=>{}}
   },
   permissions:{request:async()=>true},
   tabs:{
    query:async()=>[{id:5,url:page}],
    create:async args=>{tabsCreated.push(args);return {id:7};}
   },
   scripting:{executeScript:async()=>{injections++;return [{result:payload}];}}
  },
  navigator:{clipboard:{writeText:async()=>{}}},
  URL,console
 };
 vm.runInNewContext(script,context,{filename:'popup.js'});
 await new Promise(resolve=>setImmediate(resolve));
 return {dom,tabsCreated,get injections(){return injections;}};
}
test('clicar no ícone inicia captura e abre a ponte sem botões extras',async()=>{
 const r=await run(complete);
 assert.equal(r.injections,1);
 assert.equal(r.tabsCreated.length,1);
 assert.equal(r.tabsCreated[0].active,true);
 const url=new URL(r.tabsCreated[0].url);
 assert.equal(url.origin,'https://ofertas-da-vivi.vercel.app');
 assert.equal(url.pathname,'/captura-vivi');
 const data=JSON.parse(decodeURIComponent(url.hash.slice('#vivi-capture='.length)));
 assert.equal(data.itemId,complete.itemId);
 assert.equal(r.dom.get('send').hidden,true);
});
test('captura parcial oferece revisão, sem salvar automaticamente',async()=>{
 const r=await run({...complete,description:'curta'});
 assert.equal(r.tabsCreated.length,0);
 assert.equal(r.dom.get('send').hidden,false);
 assert.match(r.dom.get('status').textContent,/parcial/i);
});
test('título genérico não ativa salvamento automático',async()=>{
 const r=await run({...complete,title:'Anúncio Shopee 14361398676'});
 assert.equal(r.tabsCreated.length,0);
 assert.equal(r.dom.get('send').hidden,false);
});
test('não executa scripts fora de Shopee',async()=>{
 const r=await run(complete,{page:'https://example.org'});
 assert.equal(r.injections,0);
 assert.equal(r.tabsCreated.length,0);
 assert.match(r.dom.get('status').textContent,/shopee.com.br/i);
});
test('respeita limite de URL sem truncar informações silenciosamente',async()=>{
 const r=await run({...complete,description:'ç'.repeat(12000)});
 assert.equal(r.tabsCreated.length,0);
 assert.match(r.dom.get('status').textContent,/muito grande/i);
});
test('usa somente permissões temporárias e não acessa cookies',()=>{
 assert.deepEqual(manifest.permissions,['activeTab','scripting','clipboardWrite','storage']);
 assert.equal(manifest.host_permissions,undefined);
 assert.deepEqual(manifest.optional_host_permissions,['https://shopee.com.br/*','https://www.shopee.com.br/*']);
 assert.equal(manifest.background.service_worker,'background.js');
});

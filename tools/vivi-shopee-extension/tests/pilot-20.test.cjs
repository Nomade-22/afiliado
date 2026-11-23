'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const root=path.resolve(__dirname,'../../..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');

test('API do painel e recebimento da captura compartilham o limite de vinte anúncios',()=>{
 const api=read('ofertas-da-vivi/app/api/admin/scrapling-test/route.js');
 const save=read('ofertas-da-vivi/app/api/admin/scrapling-test/extension/route.js');
 assert.match(api,/updated_at DESC LIMIT 20/);
 assert.match(save,/updated_at DESC LIMIT 20/);
 assert.match(save,/entre os 20 anúncios do piloto/);
 assert.match(api,/vivi_extension_test_captures ORDER BY captured_at DESC LIMIT 120/);
});
test('painel exibe vinte cards e total dinâmico',()=>{
 const panel=read('ofertas-da-vivi/components/ScraplingTestPanel.jsx');
 assert.match(panel,/Comparação dos 20 produtos/);
 assert.match(panel,/Teste de importação Shopee — 20 produtos/);
 assert.match(panel,/\{index\+1\}\/\{data\?\.candidates\?\.length\|\|20\}/);
 assert.match(panel,/Na loja: \{item\.descriptionChars\}/);
});
test('extensão suporta lote e sessão de vinte',()=>{
 const batch=read('tools/vivi-shopee-extension/batch.js');
 const background=read('tools/vivi-shopee-extension/background.js');
 const manifest=JSON.parse(read('tools/vivi-shopee-extension/manifest.json'));
 assert.match(batch,/const MAX_ITEMS=20;/);
 assert.match(background,/const MAX_PER_SESSION=20;/);
 assert.equal(manifest.version,'0.7.0');
});
test('o catálogo público continua expondo galerias e descrições sem mudar preços ou comissões',()=>{
 const mapper=read('ofertas-da-vivi/lib/db.js');
 assert.match(mapper,/description:o\.product_description/);
 assert.match(mapper,/JSON\.parse\(o\.product_images/);
 const publicApi=read('ofertas-da-vivi/app/api/offers/route.js');
 assert.match(publicApi,/unique\.map\(mapOffer\)/);
});

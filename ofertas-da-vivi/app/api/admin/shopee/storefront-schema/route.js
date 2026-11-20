import {isAdmin,forbidden} from '../../../../../lib/auth';
import {hasShopeeCredentials,shopeeQuery} from '../../../../../lib/shopee';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=25;
const headers={'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff'};

// Verifica apenas as operações disponíveis, sem consultar dados pessoais
// nem depender de bancos/cookies de navegação da Shopee.
export async function POST(){
 if(!await isAdmin())return forbidden();
 if(!hasShopeeCredentials())return Response.json({
  status:'not_configured',message:'Credenciais da API Shopee não configuradas em Production.'
 },{status:503,headers});

 try{
  const schema=await shopeeQuery('{ __schema { queryType { name fields { name } } } }');
  const fields=(schema?.__schema?.queryType?.fields||[]).map(f=>String(f?.name||'')).filter(Boolean).slice(0,120);
  const candidates=fields.filter(name=>/storefront|vitrine|collection|showcase|favorite|wishlist|myproduct|myitem|myfeed|mycollection|affiliatelist|saved|like|itemfeed/i.test(name));
  return Response.json({
    status:'ok',
    schemaInspection:'read_only',
    queryCount:fields.length,
    possibleStorefrontQueries:candidates,
    availableQueries:fields,
    storefrontListingConfirmed:false,
    interpretation:candidates.length
      ? 'Foram encontradas operações que podem se relacionar a coleções. É preciso analisar os parâmetros antes de afirmar que leem sua vitrine.'
      : 'O schema consultado não revelou uma operação com nome relacionado à sua vitrine. Isso não prova que serviços internos não existam.',
    message:'Consulta de operações da API concluída. Nenhum produto foi alterado.'
  },{headers});
 }catch(e){
  const raw=String(e?.message||'A Shopee não permitiu consultar o schema.');
  // Não expor tokens, assinaturas nem cadeias de conexão.
  const sanitized=raw.replace(/https?:\/\/[^\s)]+/g,'[URL protegida]').slice(0,220);
  return Response.json({
    status:'schema_unavailable',
    message:'Não foi possível listar as operações do GraphQL nessa conta. Isso pode ocorrer se a introspecção estiver desabilitada.',
    diagnostic:sanitized,
    storefrontListingConfirmed:false
  },{headers});
 }
}

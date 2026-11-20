import {isAdmin,forbidden} from '../../../../../lib/auth';
import {hasShopeeCredentials,shopeeQuery} from '../../../../../lib/shopee';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=45;
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};

function unwrap(type){
 let node=type,nullable=true,depth=0;
 while(node&&depth++<5){
  if(node.kind==='NON_NULL')nullable=false;
  if(node.name)return {name:node.name,kind:node.kind,nullable};
  node=node.ofType;
 }
 return {name:'unknown',kind:'unknown',nullable};
}
function convertArg(arg){
 return {
  name:arg.name,
  description:String(arg.description||'').slice(0,260),
  type:unwrap(arg.type),
  defaultValue:arg.defaultValue??null
 };
}
function convertField(field){
 return {
  name:field.name,
  description:String(field.description||'').slice(0,360),
  type:unwrap(field.type)
 };
}
const TYPE_FRAGMENT='kind name ofType { kind name ofType { kind name ofType { kind name ofType { kind name } } } }';

export async function POST(){
 if(!await isAdmin())return forbidden();
 if(!hasShopeeCredentials())return Response.json({
  status:'not_configured',message:'Configure as credenciais Shopee em Production.'
 },{status:503,headers});

 try{
  const introspection=`{
    __schema {
      queryType {
        name
        fields {
          name description
          args { name description defaultValue type { ${TYPE_FRAGMENT} } }
          type { ${TYPE_FRAGMENT} }
        }
      }
    }
  }`;
  const root=await shopeeQuery(introspection);
  const fields=root?.__schema?.queryType?.fields||[];
  const selected=fields.filter(f=>['listItemFeeds','getItemFeedData'].includes(f.name));
  if(selected.length===0)return Response.json({
   status:'not_exposed',
   message:'Sua conexão não expõe estas operações.'
  },{headers});
  const operations=selected.map(f=>({
   name:f.name,description:String(f.description||'').slice(0,650),
   args:(f.args||[]).map(convertArg),
   returns:unwrap(f.type)
  }));
  const shapes=[];
  for(const operation of operations){
   const typeName=operation.returns.name;
   if(!typeName||typeName==='unknown'||typeName.startsWith('__'))continue;
   const query=`{ __type(name:${JSON.stringify(typeName)}) {
     name kind description
     fields { name description type { ${TYPE_FRAGMENT} } }
   } }`;
   const data=await shopeeQuery(query);
   const obj=data?.__type;
   shapes.push({
    operation:operation.name,
    typeName,
    description:String(obj?.description||'').slice(0,600),
    fields:(obj?.fields||[]).slice(0,45).map(convertField)
   });
  }
  return Response.json({
   status:'ok',
   source:'shopee_affiliate_graphql_schema',
   verifiedProfile:'https://collshp.com/perf.jaqueporto?view=storefront',
   operations,
   returnShapes:shapes,
   storefrontProductsReturned:0,
   note:'Consulta somente os tipos e argumentos. Feeds de itens não são automaticamente a seleção pessoal da Vitrine do Afiliado.',
   message:'Estrutura das duas operações consultada sem alterar dados na Shopee.'
  },{headers});
 }catch(e){
  let msg=String(e?.message||'Falha de introspecção').slice(0,300);
  for(const secret of [process.env.SHOPEE_APP_ID,process.env.SHOPEE_APP_SECRET,process.env.DATABASE_URL]){
    if(secret&&secret.length>2)msg=msg.split(secret).join('[protegido]');
  }
  return Response.json({
   status:'unavailable',
   message:'A Shopee não permitiu consultar todos os metadados da API.',
   error:msg
  },{headers});
 }
}

import {createHash} from 'node:crypto';
import {isAdmin,forbidden} from '../../../../../lib/auth';
import {hasShopeeCredentials} from '../../../../../lib/shopee';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 25;

const ENDPOINT = 'https://open-api.affiliate.shopee.com.br/graphql';
const cache = {'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff'};

function safeText(value, length=220) {
  let text=String(value??'').slice(0,length);
  for(const secret of [process.env.SHOPEE_APP_SECRET,process.env.SHOPEE_APP_ID]) {
    if(secret && secret.length>2) text=text.split(secret).join('[protegido]');
  }
  return text;
}

export async function POST(request) {
  if(!await isAdmin()) return forbidden();
  if(!hasShopeeCredentials()) return Response.json({
    status:'not_configured',
    message:'Configure SHOPEE_APP_ID e SHOPEE_APP_SECRET em Production na Vercel e faça Redeploy.',
    databaseRequired:false
  },{status:200,headers:cache});

  let input={};
  try{input=await request.json()}catch{}
  const keyword=String(input.keyword||'sandalia feminina').replace(/[\\\x00-\x1f]/g,' ').trim().slice(0,70);
  const wantedFields=[
    'itemId','shopId','productName','imageUrl','priceMin','priceMax',
    'priceDiscountRate','offerLink','productLink','commissionRate','shopName',
    'sales','ratingStar'
  ];
  // Somente parâmetros e campos previamente definidos no servidor.
  const query=`{ productOfferV2(keyword: ${JSON.stringify(keyword)}, page: 1, limit: 3) { nodes { ${wantedFields.join(' ')} } pageInfo { hasNextPage } } }`;
  const payload=JSON.stringify({query});
  const timestamp=Math.floor(Date.now()/1000);
  const appId=process.env.SHOPEE_APP_ID.trim();
  const signature=createHash('sha256')
    .update(appId+timestamp+payload+process.env.SHOPEE_APP_SECRET.trim())
    .digest('hex');

  try {
    const upstream=await fetch(ENDPOINT,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':`SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`
      },
      body:payload,cache:'no-store',signal:AbortSignal.timeout(16000)
    });
    let result;
    try {result=await upstream.json()}catch{return Response.json({
      status:'invalid_json', httpStatus:upstream.status,
      message:'A Shopee respondeu, mas a resposta não era JSON.',
      databaseRequired:false
    },{headers:cache})}
    const errors=Array.isArray(result?.errors)?result.errors:[];
    const list=Array.isArray(result?.data?.productOfferV2?.nodes)?result.data.productOfferV2.nodes:[];
    const samples=list.slice(0,3).map(item=>({
      itemId:safeText(item?.itemId,50),
      shopId:safeText(item?.shopId,50),
      productName:safeText(item?.productName,150),
      imageUrl:safeText(item?.imageUrl,350),
      priceMin:safeText(item?.priceMin,60),
      priceMax:safeText(item?.priceMax,60),
      priceDiscountRate:safeText(item?.priceDiscountRate,60),
      offerLink:safeText(item?.offerLink,350),
      productLink:safeText(item?.productLink,350),
      commissionRate:safeText(item?.commissionRate,60),
      shopName:safeText(item?.shopName,120),
      sales:safeText(item?.sales,30),
      ratingStar:safeText(item?.ratingStar,30)
    }));
    return Response.json({
      status:errors.length?'graphql_error':upstream.ok?'ok':'http_error',
      httpStatus:upstream.status,
      keyword,
      returnedCount:list.length,
      returnedFields:list[0]?Object.keys(list[0]).sort():[],
      hasNextPage:result?.data?.productOfferV2?.pageInfo?.hasNextPage??null,
      sampleProducts:samples,
      errors:errors.slice(0,4).map(e=>({
        code:safeText(e?.extensions?.code??'',40),
        message:safeText(e?.message??e?.extensions?.message,320)
      })),
      databaseRequired:false,
      message:errors.length?'A Shopee respondeu com erros GraphQL.':upstream.ok?'Resposta da Shopee recebida.':'A Shopee retornou erro HTTP.'
    },{headers:cache});
  } catch(error) {
    const type=error?.name==='TimeoutError'?'timeout':'network_error';
    return Response.json({
      status:type,
      message:type==='timeout'?'A conexão expirou.':'Falha de conexão com a Shopee. Consulte logs na Vercel.',
      databaseRequired:false
    },{headers:cache});
  }
}

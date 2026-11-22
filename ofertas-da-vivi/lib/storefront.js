import {inferCategory} from './categories';
import {createHash} from 'node:crypto';
import {isShopeeLink} from './shopee-links';

const ENDPOINT='https://collshp.com/api/v3/gql/graphql?q=getBaseInfoAndLinks';
const PROFILE='perf.jaqueporto';
const PAGE_SIZE=24;
const QUERY=`query getBaseInfoAndLinks(
  $urlSuffix: String!,
  $pageSize: String,
  $pageNum: String,
  $groupId: String,
  $linkNameKeyword: String
) {
  landingPageBaseInfo(urlSuffix:$urlSuffix) {
    name
    description
    region
    groupList { groupId groupName groupType }
  }
  landingPageLinkList(
    urlSuffix:$urlSuffix,
    pageSize:$pageSize,
    pageNum:$pageNum,
    groupId:$groupId,
    linkNameKeyword:$linkNameKeyword
  ) {
    totalCount
    linkList { linkId link linkName image linkType groupIds }
  }
}`;

function numberBetween(value,min,max,defaultValue){
 const n=Number(value);return Number.isInteger(n)&&n>=min&&n<=max?n:defaultValue;
}

function validImage(raw){
 try{const u=new URL(String(raw||''));return u.protocol==='https:'?u.toString():null}catch{return null}
}


export async function getStorefrontPage(page=1){
 const pageNumber=numberBetween(page,1,100,1);
 const body=JSON.stringify({
  operationName:'getBaseInfoAndLinks',
  variables:{urlSuffix:PROFILE,pageSize:String(PAGE_SIZE),pageNum:String(pageNumber)},
  query:QUERY
 });
 const response=await fetch(ENDPOINT,{
  method:'POST',
  headers:{
   'Content-Type':'application/json',
   'Accept':'application/json',
   'Origin':'https://collshp.com',
   'Referer':'https://collshp.com/'+PROFILE+'?view=storefront'
  },
  body,cache:'no-store',signal:AbortSignal.timeout(17000)
 });
 if(!response.ok)throw Error('A vitrine pública respondeu HTTP '+response.status);
 const json=await response.json();
 if(json.errors?.length)throw Error('A vitrine respondeu com erro GraphQL: '+String(json.errors[0]?.message||'desconhecido').slice(0,160));
 const info=json?.data?.landingPageBaseInfo;
 const list=json?.data?.landingPageLinkList;
 if(!list||!Array.isArray(list.linkList))throw Error('A vitrine não retornou a lista de links esperada.');
 const links=list.linkList.filter(entry=>entry?.linkType==='ITEM');
 const offers=links.map(item=>{
  const source=String(item.link||'');
  const name=String(item.linkName||'').trim().slice(0,210);
  const linkId=String(item.linkId??'').trim();
  const id='vitrine-'+createHash('sha256').update(PROFILE+':'+linkId).digest('hex').slice(0,20);
  return {id,linkId,title:name,category:inferCategory(name),image:validImage(item.image),
   url:source,linkType:'ITEM',groups:Array.isArray(item.groupIds)?item.groupIds.map(String).slice(0,10):[],
   affiliateLinkEligible:isShopeeLink(source),price:null,oldPrice:null,active:false,origin:'vitrine'};
 }).filter(item=>item.linkId&&item.title);
 const totalCount=Number(list.totalCount)||0;
 return {
  source:'collshp_public_graphql',profile:'https://collshp.com/'+PROFILE+'?view=storefront',
  profileName:String(info?.name||PROFILE).slice(0,150),
  page:pageNumber,pageSize:PAGE_SIZE,totalCount,
  hasNextPage:pageNumber*PAGE_SIZE<totalCount,
  items:offers,
  warning:'Dados públicos da sua vitrine; esta API não fornece preço atualizado. Itens importados ficam inativos até revisão.'
 };
}

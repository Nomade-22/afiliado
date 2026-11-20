import {shopeeQuery} from './shopee';

const money=v=>v===null||v===undefined||v===''?0:(Number.isFinite(Number(v))?Number(v):0);
const s=v=>v===null||v===undefined?'':String(v).slice(0,140);
const clamp=(v,min,max,def)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Math.trunc(Number(v)))):def;

function makeQuery(start,end,scrollId,full=true){
 const cursor=scrollId?', scrollId: '+JSON.stringify(scrollId):'';
 const fields=full
  ?'purchaseTime clickTime conversionId totalCommission sellerCommission shopeeCommissionCapped buyerType device utmContent orders { orderId orderStatus items { itemId itemName shopName itemPrice qty itemTotalCommission attributionType } }'
  :'purchaseTime conversionId totalCommission orders { orderId orderStatus items { itemId itemName itemPrice qty } }';
 return '{ conversionReport(purchaseTimeStart: '+start+', purchaseTimeEnd: '+end+', limit: 100'+cursor+') { nodes { '+fields+' } pageInfo { hasNextPage scrollId } } }';
}

function summarize(rows,days,cutOff){
 const orderIds=new Set();
 const statuses={UNPAID:0,PENDING:0,COMPLETED:0,CANCELLED:0,OTHER:0};
 const byProduct=new Map();
 let itemsSold=0,estimatedOrderValue=0,commission=0,sellerCommission=0,shopeeCommission=0;
 let newBuyers=0,recordedClickTimes=0,orders=0;
 const overview=rows.map(c=>{
  const orderArray=Array.isArray(c.orders)?c.orders:[];
  const top=orderArray[0]||{};
  const allItems=orderArray.flatMap(o=>Array.isArray(o.items)?o.items:[]);
  const comm=money(c.totalCommission);
  commission+=comm;
  sellerCommission+=money(c.sellerCommission);
  shopeeCommission+=money(c.shopeeCommissionCapped);
  if(s(c.buyerType).toUpperCase()==='NEW')newBuyers++;
  if(c.clickTime!==null&&c.clickTime!==undefined&&c.clickTime!==0)recordedClickTimes++;
  let amount=0,qtyTotal=0;
  orderArray.forEach(o=>{
   const orderId=s(o.orderId);
   const status=s(o.orderStatus).toUpperCase();
   const key=orderId||s(c.conversionId);
   if(key&&!orderIds.has(key)){
    orderIds.add(key);orders++;
    statuses[status in statuses?status:'OTHER']++;
   }
   (o.items||[]).forEach(item=>{
     const qty=Math.max(0,money(item.qty));
     const unit=money(item.itemPrice);
     amount+=qty*unit;qtyTotal+=qty;
     const key=s(item.itemId)+'|'+s(item.itemName);
     const prev=byProduct.get(key)||{itemId:s(item.itemId),name:s(item.itemName),shopName:s(item.shopName),quantity:0,valueApprox:0,commission:0};
     prev.quantity+=qty;prev.valueApprox+=qty*unit;prev.commission+=money(item.itemTotalCommission);
     byProduct.set(key,prev);
   });
  });
  itemsSold+=qtyTotal;
  estimatedOrderValue+=amount;
  return {
   conversionId:s(c.conversionId),
   purchaseTime:money(c.purchaseTime),
   clickTime:money(c.clickTime)||null,
   orderId:s(top.orderId),
   status:s(top.orderStatus)||'Não informado',
   buyerType:s(c.buyerType),
   source:s(c.utmContent),
   device:s(c.device),
   commission:comm,
   sellerCommission:money(c.sellerCommission),
   shopeeCommission:money(c.shopeeCommissionCapped),
   valueApprox:amount,
   itemsCount:qtyTotal,
   firstProduct:s(allItems[0]?.itemName),
   orderCount:orderArray.length
  };
 });
 return {
  periodDays:days,from:new Date(cutOff*1000).toISOString(),to:new Date().toISOString(),
  conversions:rows.length,orders,itemsSold,estimatedOrderValue,
  commissionEstimated:commission,sellerCommissionEstimated:sellerCommission,
  shopeeCommissionEstimated:shopeeCommission,newBuyers,
  recordedClickTimes, statusCounts:statuses,
  topProducts:[...byProduct.values()].sort((a,b)=>b.quantity-a.quantity).slice(0,15),
  conversionsList:overview.sort((a,b)=>b.purchaseTime-a.purchaseTime).slice(0,180)
 };
}

export async function loadSalesReport({days=30,maximumPages=4}={}){
 const d=clamp(days,1,89,30);
 const to=Math.floor(Date.now()/1000);
 const from=to-d*86400;
 const max=clamp(maximumPages,1,6,4);
 let next=null,more=false,mode='full';
 const all=[];
 const seen=new Set();
 const started=Date.now();
 let pages=0;
 for(let p=0;p<max;p++){
   let info;
   try{
     info=await shopeeQuery(makeQuery(from,to,next,mode==='full'));
   }catch(error){
     // Uma versão reduzida de campos é testada apenas na primeira página
     // para compatibilidade com alterações no schema GraphQL.
     if(p===0&&/Cannot query field|Unknown field|Unknown argument|Field .* not found/i.test(String(error.message))){
       mode='basic';
       info=await shopeeQuery(makeQuery(from,to,next,false));
     }else throw error;
   }
   if(!info?.conversionReport)throw Error('A Shopee não devolveu conversionReport para esse período.');
   const report=info.conversionReport;
   const nodes=Array.isArray(report.nodes)?report.nodes:[];
   for(const c of nodes){
     const key=String(c.conversionId??'');
     if(!key||!seen.has(key)){all.push(c);if(key)seen.add(key)}
   }
   pages++;
   more=Boolean(report.pageInfo?.hasNextPage);
   const cursor=report.pageInfo?.scrollId;
   if(!more||!cursor||cursor===next||Date.now()-started>19000)break;
   next=cursor;
 }
 const info=summarize(all,d,from);
 return {
  status:'ok',source:'shopee_conversionReport',schemaMode:mode,
  ...info,pagesFetched:pages,partial:more,hasMore:more,
  warning:more?'A consulta atingiu o limite de páginas/tempo. Os totais representam apenas os registros carregados.':null
 };
}

export async function loadValidatedReport(validationId){
 const n=Number(validationId);
 if(!Number.isSafeInteger(n)||n<1)throw Error('Informe um ID numérico de validação.');
 const query='{ validatedReport(validationId: '+n+', limit: 100) { nodes { conversionId netCommission totalCommission orders { orderId items { itemName itemTotalCommission refundAmount } } } pageInfo { hasNextPage scrollId } } }';
 const data=await shopeeQuery(query);
 const report=data?.validatedReport;
 if(!report)throw Error('A Shopee não retornou o relatório de validação solicitado.');
 const nodes=Array.isArray(report.nodes)?report.nodes:[];
 return {
  validationId:String(n),
  totalRecords:nodes.length,
  netCommission:nodes.reduce((a,r)=>a+money(r.netCommission),0),
  grossCommission:nodes.reduce((a,r)=>a+money(r.totalCommission),0),
  hasMore:Boolean(report.pageInfo?.hasNextPage),
  rows:nodes.slice(0,100).map(r=>({
    conversionId:s(r.conversionId),netCommission:money(r.netCommission),
    totalCommission:money(r.totalCommission),
    orders:Array.isArray(r.orders)?r.orders.map(o=>({
      orderId:s(o.orderId),
      items:Array.isArray(o.items)?o.items.map(item=>({
        itemName:s(item.itemName),itemTotalCommission:money(item.itemTotalCommission),
        refundAmount:money(item.refundAmount)
      })):[]
    })):[]
  }))
 };
}

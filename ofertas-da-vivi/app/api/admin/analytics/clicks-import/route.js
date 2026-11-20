import {isAdmin,forbidden} from '../../../../../lib/auth';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=30;
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const clean=t=>String(t??'').trim().replace(/\s+/g,' ').slice(0,100);
const normalize=t=>clean(t).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[ _-]+/g,' ');
const intOrNull=x=>{const s=String(x??'').trim().replace(/[^\d.,]/g,'');if(!s)return null;const last=Math.max(s.lastIndexOf(','),s.lastIndexOf('.'));const v=(last===-1?s:s.slice(0,last).replace(/[.,]/g,'')+'.'+s.slice(last+1)).replace(',','.');const n=Number(v);return Number.isFinite(n)&&n>=0?n:null};

function parseCSV(text) {
 const lines=text.replace(/^\uFEFF/,'');
 const sep=[';',',','\t'].sort((a,b)=>lines.slice(0,3500).split(b).length-lines.slice(0,3500).split(a).length)[0];
 const output=[];let field='',row=[],quoted=false;
 for(let i=0;i<lines.length&&output.length<30000;i++){
  const c=lines[i];
  if(c==='"'){
   if(quoted&&lines[i+1]==='"'){field+='"';i++}else quoted=!quoted;
  }else if(c===sep&&!quoted){row.push(field);field=''}
  else if((c==='\n'||c==='\r')&&!quoted){
   if(c==='\r'&&lines[i+1]==='\n')i++;
   row.push(field);field='';
   if(row.some(x=>String(x).trim()))output.push(row);
   row=[];
  }else field+=c;
 }
 if(field||row.length){row.push(field);output.push(row)}
 return output;
}

function summarize(matrix) {
 if(!matrix.length)throw Error('Relatório vazio.');
 const normalized=matrix.slice(0,18).map(row=>(row||[]).map(normalize));
 const headerIndex=normalized.findIndex(row=>row.some(col=>/^(id do clique|click id|data do clique|click date|cliques|clicks|sub ?id|utm ?content|regiao do clique|click time)$/.test(col)));
 const h=headerIndex>=0?headerIndex:0;
 const header=(matrix[h]||[]).map(clean).slice(0,80);
 const data=matrix.slice(h+1,30000).filter(row=>Array.isArray(row)&&row.some(x=>String(x??'').trim()));
 const named=header.map(normalize);
 const clickIndex=named.findIndex(t=>/^(cliques|clicks|numero de cliques|qtd cliques)$/.test(t));
 const subIndex=named.findIndex(t=>/^(sub ?id|sub ?id 1|subids|sub ids|utm ?content|info adicional|informacao adicional)$/.test(t));
 const countBySub=new Map();let clickSum=0,clickNumericCount=0;
 for(const row of data){
  const c=clickIndex>=0?intOrNull(row[clickIndex]):null;
  if(c!==null){clickSum+=c;clickNumericCount++}
  if(subIndex>=0){
   const key=clean(row[subIndex]||'(sem Sub ID)').slice(0,70);
   countBySub.set(key,(countBySub.get(key)||0)+(c??1));
  }
 }
 return {
  status:'ok',kind:'shopee_clicks_export',source:'arquivo_enviado',
  headerRow:h+1,columns:header,rows:data.length,
  officialClicks:clickIndex>=0&&clickNumericCount>0?clickSum:null,
  officialClicksMeaning:clickIndex>=0&&clickNumericCount>0?'soma_da_coluna_cliques':'nao_disponivel_nas_colunas',
  groupUnit:clickIndex>=0&&clickNumericCount>0?'cliques':'linhas',
  bySubId:[...countBySub].sort((a,b)=>b[1]-a[1]).slice(0,15).map(([subId,value])=>({subId,count:value})),
  isComplete:data.length<29999,
  message:clickIndex>=0&&clickNumericCount>0?'Somamos a coluna Cliques do relatório fornecido.':'Não encontramos uma coluna numérica Cliques; mostramos o total de linhas de dados, sem assumir que cada linha corresponde a um clique.'
 };
}

export async function POST(req) {
 if(!await isAdmin())return forbidden();
 try{
  const data=await req.formData();
  const file=data.get('file');
  if(!file||typeof file.arrayBuffer!=='function')return Response.json({error:'Selecione um arquivo CSV ou XLSX.'},{status:400,headers});
  if(file.size>4200000)return Response.json({error:'Arquivo maior que 4,2 MB. Exporte um intervalo menor.'},{status:413,headers});
  const name=String(file.name||'').toLowerCase();
  let matrix;
  if(name.endsWith('.csv'))matrix=parseCSV(await file.text());
  else if(name.endsWith('.xlsx')){
    const ExcelJS=(await import('exceljs')).default;
    const wb=new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await file.arrayBuffer()));
    const sheet=wb.worksheets[0];
    if(!sheet)throw Error('A planilha não possui abas.');
    matrix=[];
    sheet.eachRow({includeEmpty:false},row=>{
      if(matrix.length>=30000)return;
      matrix.push(Array.from({length:Math.min(row.cellCount,80)},(_,i)=>{
        const value=row.getCell(i+1).value;
        if(value===null||value===undefined)return '';
        if(typeof value==='object')return clean(value.text??value.result??'');
        return clean(value);
      }));
    });
  }else return Response.json({error:'Formato não aceito. Utilize .csv ou .xlsx (Excel).'}, {status:400,headers});
  return Response.json(summarize(matrix),{headers});
 }catch(error){
  return Response.json({error:'Não foi possível processar o relatório: '+String(error?.message||'formato inesperado').slice(0,170)},{status:422,headers});
 }
}

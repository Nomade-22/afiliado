/**
 * Código do produto e Sub ID usam exatamente 10 dígitos: DDMMAANNNN.
 * Exemplo: 2111260072. Sem separadores ou prefixos.
 */
export function subIdCandidates(internalCode){
 const code=String(internalCode||'').trim();
 if(!/^\d{10}$/.test(code))throw Error('Código interno inválido. Esperado: 2111260072.');
 return [code];
}
export function actualSubIdIsCurrent(internalCode,subIds,status){
 if(status!=='verified')return false;
 try{
  const list=Array.isArray(subIds)?subIds:String(subIds||'').split(',');
  return list.includes(subIdCandidates(internalCode)[0]);
 }catch{return false}
}
export function subIdCaption(internalCode,subIds,status){
 return actualSubIdIsCurrent(internalCode,subIds,status)?
  'Código interno confirmado como Sub ID na Shopee':
  'Sub ID numérico ainda não confirmado';
}

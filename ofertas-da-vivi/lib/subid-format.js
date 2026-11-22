/**
 * O identificador interno é preservado na forma DDMMAA_0001.
 * A Shopee pode rejeitar esse valor como Sub ID. Nesse caso, tentamos
 * seu equivalente alfanumérico, com prefixo v, sem perder a associação.
 */
export function subIdCandidates(internalCode){
 const code=String(internalCode||'');
 if(!/^\d{6}_\d{4}$/.test(code))throw Error('Código interno inválido.');
 return [code,'v'+code.replace('_','')];
}
export function actualSubIdIsCurrent(internalCode,subIds,status){
 if(status!=='verified')return false;
 try{
  const list=Array.isArray(subIds)?subIds:String(subIds||'').split(',');
  return subIdCandidates(internalCode).some(candidate=>list.includes(candidate));
 }catch{return false}
}
export function subIdCaption(internalCode,subIds,status){
 if(!actualSubIdIsCurrent(internalCode,subIds,status))return 'Sub ID ainda não confirmado';
 const list=Array.isArray(subIds)?subIds:String(subIds||'').split(',');
 return list.includes(internalCode)?
  'Código interno confirmado na Shopee':
  'Sub ID alfanumérico confirmado na Shopee';
}

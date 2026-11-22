/**
 * Código interno da Vivi: DDMMYY_NNNN. Dia e mês em America/Sao_Paulo.
 * A sequência é incrementada atomicamente no Neon e reinicia por dia.
 */
export function brazilDayKey(date=new Date()){
 const parts=new Intl.DateTimeFormat('en-GB',{
  timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'2-digit'
 }).formatToParts(date);
 const d=Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
 return d.day+d.month+d.year;
}
export async function allocateInternalCode(sql,date=new Date()){
 const day=brazilDayKey(date);
 const rows=await sql`INSERT INTO vivi_product_code_counters (day_key,last_number)
  VALUES (${day},1) ON CONFLICT(day_key)
  DO UPDATE SET last_number=vivi_product_code_counters.last_number+1
  RETURNING last_number`;
 const seq=Number(rows[0]?.last_number);
 if(!Number.isInteger(seq)||seq<1||seq>9999)throw Error('Limite diário de códigos internos atingido (9999).');
 return day+'_'+String(seq).padStart(4,'0');
}
export function internalCodeIsValid(code){
 return /^\d{6}_\d{4}$/.test(String(code||''));
}

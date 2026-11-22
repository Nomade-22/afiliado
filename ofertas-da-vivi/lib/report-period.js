// Usa o fuso de São Paulo, inclusive se houver mudança futura de horário de verão.
const TIME_ZONE = 'America/Sao_Paulo';
const DURATIONS = {'1':1,'7':7,'30':30,'60':60,'89':89};

function localCalendarParts(nowMs) {
  const parts = new Intl.DateTimeFormat('en-US',{
    timeZone:TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(new Date(nowMs));
  const get = field => Number(parts.find(part=>part.type===field)?.value);
  return [get('year'),get('month'),get('day')];
}

function offsetMinutes(timestamp) {
  const parts = new Intl.DateTimeFormat('en-US',{
    timeZone:TIME_ZONE,timeZoneName:'shortOffset'
  }).formatToParts(new Date(timestamp));
  const label = parts.find(part=>part.type==='timeZoneName')?.value||'';
  if(label==='GMT')return 0;
  const match=/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(label);
  if(!match)throw Error('Não foi possível determinar o fuso de São Paulo.');
  return (match[1]==='-'?-1:1)*(Number(match[2])*60+Number(match[3]||0));
}

function localMidnight(year,month,day) {
  const base=Date.UTC(year,month-1,day);
  let time=base-offsetMinutes(base)*60000;
  time=base-offsetMinutes(time)*60000;
  return Math.floor(time/1000);
}

export function resolveSalesPeriod(value='30', nowMs=Date.now()) {
  const period=String(value);
  const now=Math.floor(nowMs/1000);
  if(Object.hasOwn(DURATIONS,period)) {
    const days=DURATIONS[period];
    return {period,days,fromEpoch:now-days*86400,toEpoch:now,
      label:days===1?'Últimas 24 horas':'Últimos '+days+' dias'};
  }
  if(period!=='today'&&period!=='yesterday')throw Error('Período inválido.');
  const [year,month,day]=localCalendarParts(nowMs);
  const todayStart=localMidnight(year,month,day);
  if(period==='today'){
    return {period,days:1,fromEpoch:todayStart,toEpoch:now,label:'Hoje (São Paulo)'};
  }
  const previousDay=new Date(Date.UTC(year,month-1,day-1));
  const yesterdayStart=localMidnight(previousDay.getUTCFullYear(),previousDay.getUTCMonth()+1,previousDay.getUTCDate());
  return {period,days:1,fromEpoch:yesterdayStart,toEpoch:todayStart-1,label:'Ontem (São Paulo)'};
}

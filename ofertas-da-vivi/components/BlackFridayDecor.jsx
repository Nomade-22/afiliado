// Elementos decorativos fixos e leves; sem mensagens de desconto não verificadas.
const particles=Array.from({length:11},(_,i)=>i);

export function BlackFridayAnnouncement(){
 return <div className="vivi-bf-announcement">
  <span aria-hidden="true">✦</span>
  <strong>BLACK FRIDAY <em>DA VIVI</em></strong>
  <span>Achadinhos e cupons selecionados</span>
  <span aria-hidden="true">✦</span>
 </div>;
}
export function BlackFridayAtmosphere(){
 return <div className="vivi-bf-atmosphere" aria-hidden="true">
  {particles.map(i=><span key={i}
   className={'vivi-bf-particle particle-'+i}
   style={{left:((i*19+4)%94)+'%',animationDelay:'-'+((i%6)*1.4)+'s',fontSize:(11+(i%4)*5)+'px'}}>
   {i%3===0?'✦':i%3===1?'✧':'•'}
  </span>)}
 </div>;
}

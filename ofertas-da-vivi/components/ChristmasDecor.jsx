// Elementos festivos leves: não carregam imagens externas nem bloqueiam cliques.
const lightBulbs=Array.from({length:20},(_,i)=>i);
const flakes=Array.from({length:13},(_,i)=>i);

export function ChristmasAnnouncement(){
 return <div className="vivi-christmas-announcement">
  <span aria-hidden="true">✦</span>
  <strong>🎄 Natal da Vivi</strong>
  <span>Achadinhos para presentear com carinho</span>
  <span aria-hidden="true">✦</span>
 </div>;
}

export function ChristmasLights(){
 return <div className="vivi-christmas-lights" aria-hidden="true">
  {lightBulbs.map(i=><i key={i} className={'bulb bulb-'+(i%4)}/>)}
 </div>;
}

export function ChristmasSnow(){
 return <div className="vivi-christmas-snow" aria-hidden="true">
  {flakes.map(i=><span key={i} className={'flake flake-'+i}
   style={{left:((i*17+7)%96)+'%',animationDelay:'-'+((i%7)*1.3)+'s',fontSize:(12+(i%3)*6)+'px'}}>❄</span>)}
 </div>;
}

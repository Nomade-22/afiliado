import {ImageResponse} from 'next/og';

export const alt='Ofertas da Vivi — Achadinhos, cupons e ofertas selecionadas';
export const size={width:1200,height:630};
export const contentType='image/png';

// Artes do carrossel e campanhas mudam; a imagem OG permanece com a identidade
// permanente da loja para que o compartilhamento não fique desatualizado.
export default function OpenGraphImage(){
 return new ImageResponse(
  <div style={{
   display:'flex',width:'100%',height:'100%',position:'relative',
   overflow:'hidden',alignItems:'center',justifyContent:'center',
   fontFamily:'Arial,sans-serif',color:'#fff5dd',
   background:'linear-gradient(125deg,#100610 0%,#320a20 48%,#5e103b 100%)'
  }}>
   <div style={{
    position:'absolute',left:115,top:-360,width:970,height:655,
    display:'flex',border:'5px solid #e4a653',borderRadius:'50%',
    boxShadow:'0 0 28px #efb65c88',transform:'rotate(-8deg)'
   }}/>
   <div style={{
    position:'absolute',left:-165,top:-95,width:530,height:195,
    borderRadius:120,transform:'rotate(-21deg)',
    background:'linear-gradient(155deg,#640528,#fa267b 52%,#f7b0d3 65%,#9e104f 100%)'
   }}/>
   <div style={{
    position:'absolute',right:-142,bottom:-95,width:640,height:140,
    borderRadius:160,transform:'rotate(-17deg)',
    background:'linear-gradient(145deg,#6b052e,#ee267c 50%,#ffd5e3 65%,#9c0c51)'
   }}/>
   <div style={{
    position:'absolute',left:38,bottom:48,width:180,height:170,
    display:'flex',borderRadius:18,transform:'rotate(-5deg)',
    background:'linear-gradient(145deg,#1b0e17,#a31c55)',
    border:'2px solid #b98153',boxShadow:'0 10px 35px #0008'
   }}/>
   <div style={{
    position:'absolute',left:92,bottom:185,width:68,height:52,
    display:'flex',border:'7px solid #efa45c',borderBottom:'none',
    borderTopLeftRadius:55,borderTopRightRadius:55,transform:'rotate(-5deg)'
   }}/>
   <div style={{
    position:'absolute',right:38,bottom:52,width:185,height:155,
    display:'flex',borderRadius:14,
    background:'linear-gradient(145deg,#240c18,#8b1949)',
    border:'2px solid #bb8753',boxShadow:'0 10px 35px #000a'
   }}/>
   <div style={{
    position:'absolute',right:118,bottom:52,width:26,height:154,
    background:'linear-gradient(90deg,#ac1b56,#fa5ba5,#991c56)'
   }}/>
   <div style={{
    position:'absolute',right:38,bottom:155,width:185,height:23,
    background:'linear-gradient(90deg,#aa155b,#fd62a8,#9d1e5c)'
   }}/>
   <div style={{
    position:'absolute',left:247,top:80,color:'#f8cb76',
    display:'flex',fontSize:37
   }}>✦</div>
   <div style={{
    position:'absolute',right:234,top:80,color:'#f8cb76',
    display:'flex',fontSize:46
   }}>✧</div>
   <div style={{
    position:'absolute',right:100,top:48,color:'#ffd48a',
    display:'flex',fontSize:31
   }}>✦</div>
   <div style={{
    display:'flex',position:'relative',flexDirection:'column',
    alignItems:'center',justifyContent:'center',
    width:850,height:480,
    padding:'24px 18px',marginTop:6
   }}>
    <div style={{
     display:'flex',position:'relative',alignItems:'center',justifyContent:'center',
     width:83,height:76,borderRadius:17,
     border:'4px solid #efbd71',background:'#6f113d',
     boxShadow:'0 0 20px #efa95055',marginBottom:25
    }}>
     <div style={{display:'flex',fontSize:53,color:'#fff',marginTop:5}}>♥</div>
    </div>
    <div style={{
     display:'flex',fontSize:72,fontFamily:'Georgia,serif',
     fontWeight:700,letterSpacing:-2,
     color:'#f7d593',lineHeight:1.1,
     textShadow:'0 3px 10px #a55833aa'
    }}>Ofertas da</div>
    <div style={{
     display:'flex',alignItems:'center',
     fontSize:105,fontFamily:'Georgia,serif',
     fontWeight:700,fontStyle:'italic',
     color:'#ff59a8',lineHeight:1.05,marginTop:0,
     textShadow:'0 2px 14px #e4207c66'
    }}>Vivi <span style={{display:'flex',color:'#ff83bd',fontSize:69,marginLeft:15}}>♡</span></div>
    <div style={{display:'flex',width:460,height:2,background:'#f4bc67',marginTop:10,marginBottom:22}}/>
    <div style={{
     display:'flex',fontSize:27,fontWeight:600,
     color:'#fff1de',textAlign:'center',lineHeight:1.3
    }}>Achadinhos, cupons e ofertas selecionadas</div>
   </div>
   <div style={{
    position:'absolute',left:0,right:0,bottom:0,height:8,
    display:'flex',background:'linear-gradient(90deg,#ff4e9d,#efa84d,#ff4e9d)'
   }}/>
  </div>,
  {width:1200,height:630}
 );
}

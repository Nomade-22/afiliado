'use client';
import {useEffect,useState} from 'react';
import {Heart,ShieldCheck,AlertTriangle} from 'lucide-react';

// Entrada pública de transferência, não uma página administrativa.
// O payload no fragmento é lido no navegador e nunca enviado no pedido HTTP.
const KEY='vivi-pending-capture-v1';
const AUTO_SAVE_KEY='vivi-pending-capture-auto-save-v1';
export default function CaptureBridge(){
 const [error,setError]=useState('');
 useEffect(()=>{
  const prefix='#vivi-capture=';
  const hash=window.location.hash||'';
  // Não manter fotos/descrição no histórico ou na URL compartilhável.
  window.history.replaceState(null,'','/captura-vivi');
  if(!hash.startsWith(prefix)){
   setError('Nenhuma captura recebida. Abra um produto na Shopee e use Capturar Vivi.');
   return;
  }
  const encoded=hash.slice(prefix.length);
  if(!encoded||encoded.length>45000){
   setError('Captura muito grande. Volte ao anúncio e use Copiar dados.');
   return;
  }
  try{
   const data=JSON.parse(decodeURIComponent(encoded));
   if(data?.type!=='vivi-shopee-capture-v1'||
      !/^\d{1,24}$/.test(String(data.shopId||''))||
      !/^\d{1,24}$/.test(String(data.itemId||''))||
      typeof data.sourceUrl!=='string'){
    throw Error('Formato de captura inválido.');
   }
   // SessionStorage é do domínio Vivi, da aba atual, não persiste em cookies.
   // Ainda exige login ADM e revisão antes de qualquer escrita no banco.
   window.sessionStorage.setItem(KEY,JSON.stringify(data));
   // Enviar sem confirmação apenas quando a captura contém título, fotos e descrição útil.
   // Capturas parciais continuam disponíveis para revisão manual, sem sobrescrever uma boa captura.
   const eligible=typeof data.title==='string'&&data.title.trim().length>=5&&
    !/Shopee Brasil|Ofertas incríveis|^Anúncio Shopee \d+$/i.test(data.title)&&
    typeof data.description==='string'&&data.description.trim().length>=50&&
    Array.isArray(data.images)&&data.images.length>0;
   if(eligible)window.sessionStorage.setItem(AUTO_SAVE_KEY,'1');
   else window.sessionStorage.removeItem(AUTO_SAVE_KEY);
   window.location.replace('/adm#teste-importacao');
  }catch{
   setError('Não foi possível guardar a captura neste navegador. Use Copiar dados no anúncio.');
  }
 },[]);
 return <main className="auth-page">
  <section className="auth-card">
   <div className="brand brand-center"><span className="logo-mark">♥</span> Ofertas da <em>Vivi</em></div>
   {error?<><h1>Captura não recebida</h1>
    <p><AlertTriangle size={16} style={{verticalAlign:'middle'}}/> {error}</p>
    <a href="/adm#teste-importacao" className="btn btn-primary btn-wide">Abrir teste de importação</a>
   </>:<><h1>Enviando captura para o teste</h1>
    <p>Transferindo as fotos e a descrição para salvamento automático no ambiente de teste. Se necessário, faça login no painel; a captura será retomada.</p>
    <p><ShieldCheck size={16} style={{verticalAlign:'middle'}}/> Nenhum produto da loja foi alterado.</p>
   </>}
  </section>
 </main>;
}

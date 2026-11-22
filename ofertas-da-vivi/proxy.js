import {NextResponse} from 'next/server';

// Defesa adicional contra CSRF/clickjacking. A autorização real permanece
// obrigatória em todas as rotas (isAdmin), nunca depende só deste Proxy.
export function proxy(request){
 const isAdminApi=request.nextUrl.pathname.startsWith('/api/admin/');
 const unsafe=!['GET','HEAD','OPTIONS'].includes(request.method);
 if(isAdminApi&&unsafe){
  const origin=request.headers.get('origin');
  const fetchSite=request.headers.get('sec-fetch-site');
  let sameOrigin=false;
  try{sameOrigin=Boolean(origin&&new URL(origin).origin===request.nextUrl.origin)}
  catch{}
  if(!sameOrigin||(fetchSite&&!['same-origin','none'].includes(fetchSite))){
   return NextResponse.json({error:'Solicitação de outra origem não permitida.'},{
    status:403,headers:{'Cache-Control':'private, no-store'}
   });
  }
 }
 const response=NextResponse.next();
 response.headers.set('Cache-Control','private, no-store');
 response.headers.set('X-Frame-Options','DENY');
 response.headers.set('Content-Security-Policy',"frame-ancestors 'none'");
 response.headers.set('Referrer-Policy','no-referrer');
 response.headers.set('X-Content-Type-Options','nosniff');
 response.headers.set('X-Robots-Tag','noindex, nofollow, noarchive');
 return response;
}
export const config={matcher:['/adm/:path*','/api/admin/:path*']};

import './globals.css';

const SITE='https://ofertas-da-vivi.vercel.app';
const DESCRIPTION='Achadinhos, cupons e ofertas selecionadas pela Vivi. Confira as novidades e economize nas suas compras!';

export const metadata={
 metadataBase:new URL(SITE),
 title:'Ofertas da Vivi | Achadinhos e cupons',
 description:DESCRIPTION,
 alternates:{canonical:'/'},
 robots:{index:true,follow:true},
 openGraph:{
  title:'Ofertas da Vivi',
  description:DESCRIPTION,
  url:SITE,
  siteName:'Ofertas da Vivi',
  type:'website',
  locale:'pt_BR'
 },
 twitter:{
  card:'summary_large_image',
  title:'Ofertas da Vivi',
  description:DESCRIPTION
 }
};
// O Next.js inclui automaticamente o endereço HTTPS e as dimensões de
// app/opengraph-image.jsx nas tags og:image do HTML inicial.
export default function RootLayout({children}){
 return <html lang="pt-BR"><body>{children}</body></html>;
}

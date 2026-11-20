import {comparePassword,canLogin,newToken,cookieName} from '../../../../lib/auth';
export async function POST(req){
 let data;try{data=await req.json()}catch{return Response.json({error:'Dados inválidos'},{status:400})}
 if(!canLogin())return Response.json({error:'Acesso ADM ainda não configurado. Cadastre ADMIN_PASSWORD e SESSION_SECRET no servidor.'},{status:503});
 if(!comparePassword(data.password))return Response.json({error:'Senha inválida.'},{status:401});
 const out=Response.json({ok:true});out.headers.append('Set-Cookie',`${cookieName}=${newToken()}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`);return out
}

import {getUser} from "../auth";
import html from "../../reader/rendered";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 const user=await getUser();
 if(!user)return Response.redirect(new URL("/signin?return_to=%2Fread",request.url),302);
 return new Response(html,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"same-origin"}});
}

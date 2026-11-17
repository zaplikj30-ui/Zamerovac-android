'use strict';
function local(url,base){try{const u=new URL(url);return u.protocol==='http:'&&u.hostname==='127.0.0.1'&&u.origin===new URL(base).origin}catch{return false}}
async function install(context,base){
 if(!local(base,base)||!new URL(base).port)throw Error('CLOUD network base rejected');
 await context.routeWebSocket('**/*',socket=>socket.close());
 await context.route('**/*',async route=>{
  try{
   const url=route.request().url();if(!local(url,base))return route.abort();
   const response=await route.fetch({maxRedirects:0});const target=response.headers()['location'];
   if(target&&!local(new URL(target,url).href,base))return route.abort();
   return route.fulfill({response});
  }catch{return route.abort()}
 });
}
module.exports={local,install};

import {configured,getSession,json,storedToken} from '../_lib/core.js';
export async function onRequestGet({request,env}){
  const config=configured(env);
  if(!config){
    const missing=['APP_PASSWORD','SESSION_SECRET','RADIO_KV'].filter(name=>!env[name]);
    return json({configured:false,authenticated:false,sonosConnected:false,missing});
  }
  const authenticated=Boolean(await getSession(request,env));
  return json({configured:true,authenticated,sonosConnected:authenticated&&Boolean(await storedToken(env))});
}

import {required,json,error} from '../_lib/core.js';

// Handmatige stationszoeker. De browser haalt de audiostream zelf op.
export async function onRequestGet(context){
  const auth=await required(context);if(auth)return auth;
  const q=(new URL(context.request.url).searchParams.get('q')||'').trim();
  if(q.length<2||q.length>75)return error('Typ minimaal twee letters voor het zoeken.',400);
  try{
    const url=new URL('https://de1.api.radio-browser.info/json/stations/search');
    url.searchParams.set('name',q);
    url.searchParams.set('limit','40');
    url.searchParams.set('hidebroken','true');
    url.searchParams.set('order','votes');
    url.searchParams.set('reverse','true');
    const res=await fetch(url,{method:'GET',headers:{Accept:'application/json','User-Agent':'JivesRadioAgenda/2.0 (https://sonos-radio-agenda.pages.dev)'},signal:AbortSignal.timeout(7500)});
    if(!res.ok)throw new Error('Radio Browser antwoordt niet.');
    const data=await res.json();
    if(!Array.isArray(data))throw new Error('Ongeldige stationslijst ontvangen.');
    const stations=data.filter(x=>{
      const stream=[x?.url_resolved,x?.url].find(v=>typeof v==='string'&&v.startsWith('https://'));
      return x&&typeof x.name==='string'&&x.name.trim()&&!!stream;
    }).slice(0,25).map(x=>({
      name:x.name.trim().slice(0,140),
      url:[x.url_resolved,x.url].find(v=>typeof v==='string'&&v.startsWith('https://')).slice(0,1500),
      codec:typeof x.codec==='string'?x.codec.slice(0,30):'',
      bitrate:Number(x.bitrate)||0,
      country:typeof x.country==='string'?x.country.slice(0,80):''
    }));
    return json({stations});
  }catch(err){
    return error('Zoeken is nu niet beschikbaar. Voer eventueel handmatig een HTTPS-streamadres in.',502);
  }
}

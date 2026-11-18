import {required,checkOrigin,readJson,json,error} from '../_lib/core.js';

const KEY='radio.local.v1';
const EMPTY={revision:'initial',mappings:{},localItems:[]};
const validURL=url=>typeof url==='string'&&url.length<=1500&&/^https:\/\/[^\s<>]+$/i.test(url)&&(()=>{try{const u=new URL(url);return u.protocol==='https:'&&!!u.hostname&&!u.username&&!u.password}catch{return false}})();
const str=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
const validTime=t=>typeof t==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(t);
const validDay=d=>d==='all'||['0','1','2','3','4','5','6'].includes(d);
const validMap=m=>m&&typeof m==='object'&&!Array.isArray(m)&&Object.keys(m).length<=300&&
  Object.entries(m).every(([key,row])=>str(key,150)&&row&&typeof row==='object'&&
    validURL(row.url)&&str(row.name,200));
const validLocal=i=>i&&typeof i==='object'&&str(i.id,80)&&str(i.name,90)&&
  str(i.stationName,200)&&validURL(i.streamUrl)&&validDay(i.day)&&validTime(i.start)&&
  (!i.end||validTime(i.end)&&i.end>i.start);
export async function onRequestGet(context){
  const auth=await required(context);if(auth)return auth;
  const stored=await context.env.RADIO_KV.get(KEY,'json');
  return json(stored&&Array.isArray(stored.localItems)?stored:EMPTY);
}
export async function onRequestPut(context){
  const origin=checkOrigin(context.request);if(origin)return origin;
  const auth=await required(context);if(auth)return auth;
  const body=await readJson(context.request);
  if(!body||!validMap(body.mappings)||!Array.isArray(body.localItems)||body.localItems.length>300||
      !body.localItems.every(validLocal)||
      new Set(body.localItems.map(item=>item.id)).size!==body.localItems.length){
    return error('De lokale radio-instellingen bevatten ongeldige gegevens.',400);
  }
  const stored=await context.env.RADIO_KV.get(KEY,'json');
  const current=stored&&Array.isArray(stored.localItems)?stored:EMPTY;
  if(body.revision!==current.revision)return error('De lokale radio is elders gewijzigd. Vernieuw de pagina.',409);
  const next={revision:crypto.randomUUID(),mappings:body.mappings,localItems:body.localItems};
  await context.env.RADIO_KV.put(KEY,JSON.stringify(next));
  return json(next);
}

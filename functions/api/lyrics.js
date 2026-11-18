import {required,json,error} from '../_lib/core.js';

// Wordt alleen vanaf de knop in de muziekpopup aangeroepen.
// Geen Sonos-aanvragen, automatische verversing, KV-opslag of API-sleutels.
const TIMEOUT_MS=6500;
const MAX_LYRICS=20000;
function normalize(value){
  return String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/\b(remaster(?:ed)?|radio edit|single version)\b/g,'')
    .replace(/[^a-z0-9]+/g,' ').trim();
}
function matchArtist(candidate,artist){
  const a=normalize(candidate),b=normalize(artist);
  return !!a&&!!b&&(a===b||a.startsWith(b+' ')||b.startsWith(a+' '));
}
function removeLrcTimestamps(value){
  return value.split(/\r?\n/).map(line=>line.replace(/^(?:\[\d{1,2}:\d{2}(?:\.\d{1,3})?\])+\s*/g,''))
    .filter(line=>!(/^\[(?:ar|ti|al|by|offset|length):/i.test(line))).join('\n').trim();
}
async function requestJson(url,headers={}){
  const res=await fetch(url,{
    method:'GET',
    headers:{'Accept':'application/json',...headers},
    signal:AbortSignal.timeout(TIMEOUT_MS)
  });
  if(!res.ok)return null;
  const type=res.headers.get('content-type')||'';
  if(!type.includes('json'))return null;
  return res.json();
}
async function fromLrclib(title,artist){
  const url=new URL('https://lrclib.net/api/search');
  url.searchParams.set('track_name',title);
  url.searchParams.set('artist_name',artist);
  const records=await requestJson(url.toString(),{
    'User-Agent':'JivesRadioAgenda/1.0 (https://sonos-radio-agenda.pages.dev)',
    'Lrclib-Client':'JivesRadioAgenda/1.0 (https://sonos-radio-agenda.pages.dev)'
  });
  if(!Array.isArray(records))return null;
  const matches=records.filter(row=>row&&!row.instrumental&&normalize(row.trackName||row.name)===normalize(title)&&matchArtist(row.artistName,artist));
  for(const row of matches){
    const raw=typeof row.plainLyrics==='string'&&row.plainLyrics.trim()?row.plainLyrics:
      typeof row.syncedLyrics==='string'?removeLrcTimestamps(row.syncedLyrics):'';
    if(raw.trim())return {lyrics:raw.trim().slice(0,MAX_LYRICS),source:'LRCLIB'};
  }
  return null;
}
async function fromLyricsOvh(title,artist){
  const url='https://api.lyrics.ovh/v1/'+encodeURIComponent(artist)+'/'+encodeURIComponent(title);
  const data=await requestJson(url);
  if(typeof data?.lyrics==='string'&&data.lyrics.trim()){
    return {lyrics:data.lyrics.trim().slice(0,MAX_LYRICS),source:'Lyrics.ovh'};
  }
  return null;
}
export async function onRequestGet(context){
  const auth=await required(context);if(auth)return auth;
  const url=new URL(context.request.url);
  const title=(url.searchParams.get('title')||'').trim();
  const artist=(url.searchParams.get('artist')||'').trim();
  if(!title||!artist||title.length>150||artist.length>150)return error('Een geldige titel en artiest zijn nodig.',400);
  let lrclib=null,lyricsOvh=null;
  try{lrclib=await fromLrclib(title,artist)}catch{}
  if(lrclib)return json({found:true,...lrclib});
  try{lyricsOvh=await fromLyricsOvh(title,artist)}catch{}
  if(lyricsOvh)return json({found:true,...lyricsOvh});
  return json({found:false,lyrics:'',source:''});
}

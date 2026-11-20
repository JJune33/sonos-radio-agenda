import {required,json,error} from '../_lib/core.js';

// Alleen een verzoek na een klik in de bestaande nummerpopup.
// MusicBrainz: eerst zoeken, dan de gekoppelde Wikipedia-URL opzoeken.
// Geen polling, KV-opslag, Sonos-aanvragen of nieuwe API-sleutels.
const MB='https://musicbrainz.org/ws/2';
const UA='JivesRadioAgenda/2.0 (https://sonos-radio-agenda.pages.dev)';
const MB_INTERVAL_MS=1150;
const LIMIT_MS=7000;
const text=(v,max=200)=>typeof v==='string'?v.trim().slice(0,max):'';
const norm=v=>text(v,300).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('en').replace(/[^a-z0-9]+/g,' ').trim();
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function getJson(url){
  const response=await fetch(url,{
    method:'GET',
    headers:{Accept:'application/json','User-Agent':UA},
    signal:AbortSignal.timeout(LIMIT_MS)
  });
  if(!response.ok)throw new Error('Muziekdatabase niet beschikbaar ('+response.status+').');
  return response.json();
}
function exactArtist(search,requested){
  const expected=norm(requested);
  const matches=(Array.isArray(search?.artists)?search.artists:[])
    .filter(x=>x?.id&&
      (norm(x.name)===expected||(Array.isArray(x.aliases)&&x.aliases.some(a=>norm(a.name)===expected))))
    .sort((a,b)=>(Number(b.score)||0)-(Number(a.score)||0));
  return matches[0]||null;
}
function wikipediaRelation(artist){
  const links=Array.isArray(artist?.relations)?artist.relations:[];
  const candidates=[];
  for(const relation of links){
    const link=relation?.url?.resource;
    if(!['wikipedia','wikidata'].includes(relation?.type)||typeof link!=='string')continue;
    try{
      const url=new URL(link);
      if(url.protocol!=='https:')continue;
      if(/^(en|nl)\.wikipedia\.org$/.test(url.hostname)&&url.pathname.startsWith('/wiki/')){
        candidates.push({url:url.href,lang:url.hostname.slice(0,2),title:decodeURIComponent(url.pathname.slice(6)).replaceAll('_',' ')});
      }
    }catch{}
  }
  return candidates.find(x=>x.lang==='nl')||candidates.find(x=>x.lang==='en')||null;
}
async function wikipediaIntro(relation){
  if(!relation)return null;
  const url=new URL('https://'+relation.lang+'.wikipedia.org/w/api.php');
  url.searchParams.set('action','query');
  url.searchParams.set('prop','extracts');
  url.searchParams.set('exintro','1');
  url.searchParams.set('explaintext','1');
  url.searchParams.set('redirects','1');
  url.searchParams.set('format','json');
  url.searchParams.set('titles',relation.title);
  const data=await getJson(url.toString());
  const pages=Object.values(data?.query?.pages||{});
  const extract=pages.find(page=>typeof page?.extract==='string')?.extract||'';
  const cleaned=extract.replace(/\s{3,}/g,'\n\n').trim().slice(0,1100);
  return cleaned?{text:cleaned,source:'Wikipedia',url:relation.url}:null;
}
export async function onRequestGet(context){
  const auth=await required(context);if(auth)return auth;
  const url=new URL(context.request.url);
  const requested=text(url.searchParams.get('artist'),160);
  if(!requested||requested.length<2||requested.length>150)return error('Geef een geldige artiestnaam op.',400);
  try{
    const query=new URL(MB+'/artist/');
    query.searchParams.set('query','artist:"'+requested.replace(/["\\]/g,' ')+'"');
    query.searchParams.set('fmt','json');
    query.searchParams.set('limit','6');
    const search=await getJson(query.toString());
    const matched=exactArtist(search,requested);
    if(!matched)return json({found:false,artist:requested});
    // MusicBrainz vraagt gemiddeld niet meer dan één request per seconde.
    await wait(MB_INTERVAL_MS);
    let details=matched;
    try{
      const lookup=new URL(MB+'/artist/'+encodeURIComponent(matched.id));
      lookup.searchParams.set('inc','url-rels+genres+tags');
      lookup.searchParams.set('fmt','json');
      details=await getJson(lookup.toString());
    }catch{}
    const wikipedia=wikipediaRelation(details);
    let bio=null;
    try{bio=await wikipediaIntro(wikipedia)}catch{}
    const genres=Array.isArray(details.genres)?details.genres:
      Array.isArray(details.tags)?details.tags:[];
    const genreNames=genres.filter(x=>x?.name&&typeof x.name==='string')
      .sort((a,b)=>(Number(b.count)||0)-(Number(a.count)||0))
      .slice(0,5).map(x=>text(x.name,70));
    return json({
      found:true,
      artist:text(details.name||matched.name,160),
      type:details.type||matched.type||'',
      area:text(details.area?.name||matched.area?.name,100),
      beginArea:text(details['begin-area']?.name||matched['begin-area']?.name,100),
      started:text(details['life-span']?.begin||matched['life-span']?.begin,30),
      ended:text(details['life-span']?.end||matched['life-span']?.end,30),
      genres:genreNames,
      description:text(details.disambiguation||matched.disambiguation,180),
      biography:bio?.text||'',
      biographyUrl:bio?.url||'',
      musicbrainzUrl:'https://musicbrainz.org/artist/'+matched.id
    });
  }catch{
    return error('Artiestinformatie ophalen lukt nu niet. Probeer het later opnieuw.',502);
  }
}

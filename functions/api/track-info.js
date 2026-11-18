import {required,sonosConfigError,sonosRequest,groupsArray,json,error,apiError,encodePath} from '../_lib/core.js';

// Alleen aangeroepen na een klik op 'Welk nummer speelt?'.
// Geen polling, opslag of wijziging aan de Sonos-afspeelstatus.
export async function onRequestGet(context){
  const auth=await required(context);if(auth)return auth;
  const configError=sonosConfigError(context.env);if(configError)return configError;
  const url=new URL(context.request.url);
  const householdId=url.searchParams.get('householdId')||'';
  const groupId=url.searchParams.get('groupId')||'';
  if(!householdId||householdId.length>160||!groupId||groupId.length>160)return error('Kies een Sonos-kamer.',400);
  try{
    const groups=await sonosRequest(context.env,'GET','/households/'+encodePath(householdId)+'/groups');
    if(!groupsArray(groups).some(g=>g.id===groupId))return error('De gekozen Sonos-kamer is niet beschikbaar.',404);
    const response=await sonosRequest(context.env,'GET','/groups/'+encodePath(groupId)+'/playbackMetadata');
    const metadata=response.metadataStatus||response;
    const track=metadata.currentItem?.track||{};
    const clean=v=>typeof v==='string'?v.trim().slice(0,300):'';
    const station=clean(metadata.container?.name);
    const rawTitle=clean(track.name);
    const artist=clean(track.artist?.name);
    // Sommige radiostations gebruiken de stationsnaam als tracktitel.
    const title=rawTitle&&rawTitle!==station?rawTitle:'';
    const streamInfo=(!title&&!artist)?clean(metadata.streamInfo):'';
    return json({title,artist,streamInfo,station,checkedAt:new Date().toISOString()});
  }catch(err){return apiError(err)}
}

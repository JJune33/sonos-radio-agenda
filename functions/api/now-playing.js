import {required,sonosConfigError,sonosRequest,groupsArray,json,error,apiError,encodePath} from '../_lib/core.js';
export async function onRequestGet(context){
  const auth=await required(context);if(auth)return auth;
  const cfg=sonosConfigError(context.env);if(cfg)return cfg;
  const url=new URL(context.request.url);
  const householdId=url.searchParams.get('householdId')||'';
  const groupId=url.searchParams.get('groupId')||'';
  if(!householdId||householdId.length>160||!groupId||groupId.length>160)return error('Ongeldige kamer of huishouden.');
  try{
    const groups=await sonosRequest(context.env,'GET','/households/'+encodePath(householdId)+'/groups');
    if(!groupsArray(groups).some(group=>group.id===groupId))return error('Deze Sonos-groep is niet beschikbaar.',404);
    const path='/groups/'+encodePath(groupId);
    const results=await Promise.allSettled([
      sonosRequest(context.env,'GET',path+'/playbackMetadata'),
      sonosRequest(context.env,'GET',path+'/playback')
    ]);
    if(results[0].status==='rejected'&&results[1].status==='rejected')throw results[0].reason;
    const rawMetadata=results[0].status==='fulfilled'?results[0].value:{};
    const rawPlayback=results[1].status==='fulfilled'?results[1].value:{};
    const metadata=rawMetadata.metadataStatus||rawMetadata;
    const playback=rawPlayback.playbackStatus||rawPlayback;
    const name=metadata.container?.name||metadata.currentItem?.track?.name||'';
    return json({
      source:typeof name==='string'?name.slice(0,200):'',
      sourceType:typeof metadata.container?.type==='string'?metadata.container.type.slice(0,100):'',
      playbackState:typeof playback.playbackState==='string'?playback.playbackState:'',
      metadataAvailable:results[0].status==='fulfilled'
    });
  }catch(e){return apiError(e)}
}

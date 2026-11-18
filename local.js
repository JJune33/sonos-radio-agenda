'use strict';
// Zelfstandige lokale editie. De oorspronkelijke Sonos-app en Sonos-KV worden niet gewijzigd.
const $=id=>document.getElementById(id);
const DAYS=['Zondag','Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag'];
const state={shared:[],local:[],mappings:{},revision:'initial',view:'today',loaded:false,lastDay:-1,playingUrl:'',playingName:'',searchId:0};
const audio=$('localAudio');
const $show=(id,yes=true)=>$(id).classList.toggle('hidden',!yes);
const el=(tag,cls,content)=>{
  const item=document.createElement(tag);
  if(cls)item.className=cls;
  if(content!==undefined)item.textContent=String(content);
  return item;
};
function toast(message,isError=false){
  const target=$('toast');target.textContent=message;
  target.className='toast'+(isError?' error':'');
  clearTimeout(toast.timer);
  toast.timer=setTimeout(()=>target.classList.add('hidden'),4300);
}
async function api(path,options={}){
  let response;
  try{
    response=await fetch('/api/'+path,{
      credentials:'same-origin',cache:'no-store',...options,
      headers:{...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}
    });
  }catch{
    throw new Error('Geen verbinding met Cloudflare. Probeer opnieuw.');
  }
  let payload={};
  try{payload=await response.json()}catch{}
  if(!response.ok){
    if(response.status===401&&path!=='login')showLogin();
    throw new Error(payload.error||'Serverfout ('+response.status+')');
  }
  return payload;
}
function showLogin(){
  stopAudio();
  $show('loginScreen');$show('appScreen',false);$show('setupScreen',false);
  $show('logoutBtn',false);$('connectionText').textContent='Privé';
  $('connection').classList.remove('online');
}
function showSetup(message){
  $show('setupScreen');$show('loginScreen',false);$show('appScreen',false);
  $show('logoutBtn',false);$('setupText').textContent=message;
}
function showApp(){
  $show('appScreen');$show('loginScreen',false);$show('setupScreen',false);
  $show('logoutBtn');
  $('connectionText').textContent='Lokale radio';
  $('connection').classList.add('online');
  updateDate();
}
function updateDate(){
  const d=new Date();
  $('dateDay').textContent=d.toLocaleDateString('nl-NL',{day:'numeric'});
  $('dateMonth').textContent=d.toLocaleDateString('nl-NL',{month:'long',year:'numeric'}).toUpperCase();
  $('dateWeekday').textContent=DAYS[d.getDay()];
  $('clock').textContent=d.toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'});
  if(state.lastDay!==d.getDay()){
    state.lastDay=d.getDay();renderTabs();renderList();
  }
}
const isHttpsStream=value=>{
  if(typeof value!=='string'||value.length>1500)return false;
  try{
    const url=new URL(value);
    return url.protocol==='https:'&&Boolean(url.hostname)&&!url.username&&!url.password;
  }catch{return false}
};
function allPrograms(){
  const shared=state.shared.map(item=>{
    const mapping=state.mappings[item.favoriteId];
    return {...item,source:'sonos',stationName:mapping?.name||item.favoriteName||'Onbekend station',streamUrl:mapping?.url||''};
  });
  return [...shared,...state.local.map(item=>({...item,source:'local'}))];
}
function listForDay(day){
  return allPrograms().filter(item=>item.day==='all'||item.day===String(day))
    .sort((a,b)=>a.start.localeCompare(b.start)||a.name.localeCompare(b.name,'nl'));
}
function selectedDay(){return state.view==='today'?new Date().getDay():Number(state.view)}
function renderTabs(){
  const tabs=$('dayTabs');tabs.replaceChildren();
  const opts=[['today','Vandaag'],['1','Ma'],['2','Di'],['3','Wo'],['4','Do'],['5','Vr'],['6','Za'],['0','Zo'],['week','Hele week']];
  for(const [value,title] of opts){
    const btn=el('button','day-tab'+(state.view===value?' active':''),title);
    btn.type='button';btn.setAttribute('aria-pressed',String(state.view===value));
    const count=value==='week'?allPrograms().length:listForDay(value==='today'?new Date().getDay():value).length;
    if(count)btn.append(el('span','day-count',count));
    btn.addEventListener('click',()=>{state.view=value;renderTabs();renderList()});
    tabs.append(btn);
  }
}
function empty(){
  const block=el('div','empty-state');
  block.append(el('div','empty-icon','♫'),el('h4','','Nog geen programma\'s voor deze dag'),
    el('p','','Maak een eigen lokaal programma of gebruik je bestaande Sonos-agenda.'));
  return block;
}
function inTimeRange(item,day){
  if(Number(day)!==new Date().getDay())return false;
  const time=new Date().toTimeString().slice(0,5);
  return item.start<=time&&(!item.end||time<item.end);
}
function renderList(){
  const box=$('programList');box.replaceChildren();
  const all=allPrograms();
  if(state.view==='week'){
    $('selectedDayLabel').textContent='OVERZICHT';
    $('selectedTitle').textContent='De hele week';
    $('itemCount').textContent=all.length+' programma'+(all.length===1?'':'\'s');
    if(!all.length){box.append(empty());return}
    for(const day of [1,2,3,4,5,6,0]){
      const items=listForDay(day);
      if(!items.length)continue;
      box.append(el('div','week-heading',DAYS[day].toUpperCase()));
      items.forEach(item=>box.append(programRow(item,day)));
    }
    return;
  }
  const day=selectedDay(),items=listForDay(day);
  $('selectedDayLabel').textContent=state.view==='today'?'VANDAAG':'DAGOVERZICHT';
  $('selectedTitle').textContent=state.view==='today'?'Programma\'s van vandaag':DAYS[day];
  $('itemCount').textContent=items.length+' programma'+(items.length===1?'':'\'s');
  if(!items.length){box.append(empty());return}
  items.forEach(item=>box.append(programRow(item,day)));
}
function programRow(item,day){
  const row=el('article','program-row');
  const time=el('div','time-block',item.start);
  time.append(el('small','',item.end?'tot '+item.end:(item.day==='all'?'dagelijks':'starttijd')));
  const main=el('div','program-main');
  main.append(el('h4','',item.name));
  const sub=el('div','program-sub');
  sub.append(el('span','',item.stationName||'Onbekend station'));
  sub.append(el('span','local-row-badge'+(item.source==='local'?' local-only':''),item.source==='local'?'Lokaal':'Sonos-agenda'));
  if(item.day==='all')sub.append(el('span','','• Iedere dag'));
  if(inTimeRange(item,day))sub.append(el('span','onair','NU GEPLAND'));
  main.append(sub);
  const actions=el('div','program-actions local-program-actions');
  const play=el('button','play-button','Afspelen');
  play.type='button';play.disabled=!isHttpsStream(item.streamUrl);
  play.title=play.disabled?'Koppel eerst een HTTPS-radiostream':'Speel dit station op dit apparaat af';
  play.addEventListener('click',()=>playItem(item));
  actions.append(play);
  if(item.source==='sonos'){
    const set=el('button','local-configure',item.streamUrl?'Stream wijzigen':'Stream koppelen');
    set.type='button';set.title='Streamadres voor dit Sonos-favoriet instellen';
    set.addEventListener('click',()=>openMappingModal(item));
    actions.append(set);
  }else{
    const edit=el('button','subtle-action','✎');
    edit.type='button';edit.title='Programma wijzigen';
    edit.setAttribute('aria-label','Programma wijzigen');
    edit.addEventListener('click',()=>openProgramModal(item));
    const del=el('button','subtle-action delete','×');
    del.type='button';del.title='Programma verwijderen';
    del.setAttribute('aria-label','Programma verwijderen');
    del.addEventListener('click',()=>deleteLocalItem(item.id));
    actions.append(edit,del);
  }
  row.append(time,main,actions);return row;
}
function stopAudio(){
  audio.pause();audio.removeAttribute('src');audio.load();
  state.playingUrl='';state.playingName='';
  $('playerStation').textContent='Kies een programma uit de agenda';
  $('playerStatus').textContent='Nog niets aan het afspelen';
  $('playerPause').disabled=true;$('playerStop').disabled=true;
  $('playerPause').textContent='Pauzeren';
}
function playItem(item){
  const url=item.streamUrl;
  if(!isHttpsStream(url))return toast('Koppel eerst een geldig HTTPS-streamadres.',true);
  const same=state.playingUrl===url;
  if(!same){audio.pause();audio.src=url;state.playingUrl=url;}
  state.playingName=item.stationName||item.name;
  $('playerStation').textContent=state.playingName;
  $('playerStatus').textContent='Verbinding maken met het radiostation...';
  $('playerStop').disabled=false;$('playerPause').disabled=false;
  $('playerPause').textContent='Pauzeren';
  // play() gebeurt direct binnen de klik, dus geen geblokkeerde automatische start.
  const playPromise=audio.play();
  if(playPromise&&typeof playPromise.catch==='function'){
    playPromise.catch(()=>{
      $('playerStatus').textContent='Stream afspelen mislukt. Probeer een andere directe HTTPS MP3/AAC-stream.';
      $('playerPause').textContent='Opnieuw';
      toast('De browser kan deze stream niet afspelen.',true);
    });
  }
}
function togglePause(){
  if(!state.playingUrl)return;
  if(audio.paused){
    const promise=audio.play();
    if(promise&&typeof promise.catch==='function')promise.catch(()=>toast('Hervatten lukt niet.',true));
  }else audio.pause();
}
const localSnapshot=()=>({
  revision:state.revision,
  mappings:structuredClone(state.mappings),
  localItems:structuredClone(state.local)
});
async function saveConfig(mappings,localItems){
  const previous=localSnapshot();
  state.mappings=mappings;state.local=localItems;renderTabs();renderList();
  try{
    const result=await api('local-radio',{
      method:'PUT',body:JSON.stringify({revision:previous.revision,mappings,localItems})
    });
    state.revision=result.revision;
    state.mappings=result.mappings;state.local=result.localItems;
    renderTabs();renderList();toast('Lokale radio opgeslagen');
    return true;
  }catch(err){
    state.mappings=previous.mappings;state.local=previous.localItems;
    state.revision=previous.revision;renderTabs();renderList();
    toast(err.message,true);
    return false;
  }
}
function resetModal(){
  $('localForm').reset();
  $('editLocalId').value='';$('mappingFavoriteId').value='';
  $('formError').textContent='';$('searchMessage').textContent='';
  $('searchResults').replaceChildren();
  $('searchStations').disabled=false;
  state.searchId++;
}
function showModal(){
  $show('modal');document.body.style.overflow='hidden';
  $('stationName').focus();
}
function openMappingModal(item){
  resetModal();
  $('modalTitle').textContent='Stream koppelen';
  $('mappingFavoriteId').value=item.favoriteId;
  $show('programFields',false);
  $('programName').required=false;$('startTime').required=false;
  $('stationName').value=item.stationName||item.favoriteName||'';
  $('streamUrl').value=state.mappings[item.favoriteId]?.url||'';
  $('stationSearchQuery').value=item.favoriteName||item.stationName||'';
  $('saveBtn').textContent='Stream bewaren';
  showModal();
}
function openProgramModal(item){
  resetModal();
  $('modalTitle').textContent=item?'Lokaal programma wijzigen':'Lokaal programma toevoegen';
  $show('programFields');
  $('programName').required=true;$('startTime').required=true;
  $('programName').value=item?.name||'';
  $('daySelect').value=item?.day||(state.view==='week'?'1':String(selectedDay()));
  $('startTime').value=item?.start||'08:00';
  $('endTime').value=item?.end||'';
  $('stationName').value=item?.stationName||'';
  $('streamUrl').value=item?.streamUrl||'';
  $('editLocalId').value=item?.id||'';
  $('stationSearchQuery').value=item?.stationName||'';
  $('saveBtn').textContent=item?'Wijzigingen opslaan':'Programma toevoegen';
  showModal();
}
function closeModal(){
  state.searchId++;$show('modal',false);
  document.body.style.overflow='';
}
async function saveForm(event){
  event.preventDefault();
  $('formError').textContent='';
  const stationName=$('stationName').value.trim(),url=$('streamUrl').value.trim();
  if(!stationName||stationName.length>200){$('formError').textContent='Vul de naam van het radiostation in.';return}
  if(!isHttpsStream(url)){$('formError').textContent='Vul een direct HTTPS-streamadres in.';return}
  const favoriteId=$('mappingFavoriteId').value;
  if(favoriteId){
    const mappings={...state.mappings,[favoriteId]:{url,name:stationName}};
    if(await saveConfig(mappings,state.local))closeModal();
    return;
  }
  const name=$('programName').value.trim(),start=$('startTime').value,end=$('endTime').value,day=$('daySelect').value;
  if(!name||name.length>90||!start){$('formError').textContent='Vul een programmanaam en starttijd in.';return}
  if(end&&end<=start){$('formError').textContent='De eindtijd moet later zijn dan de starttijd.';return}
  const editing=state.local.find(item=>item.id===$('editLocalId').value);
  const item={id:editing?.id||crypto.randomUUID(),name,day,start,end,stationName,streamUrl:url};
  const items=editing?state.local.map(x=>x.id===editing.id?item:x):[...state.local,item];
  if(await saveConfig(state.mappings,items))closeModal();
}
async function deleteLocalItem(id){
  const item=state.local.find(x=>x.id===id);
  if(!item||!confirm('Verwijder "'+item.name+'" uit de lokale agenda?'))return;
  await saveConfig(state.mappings,state.local.filter(x=>x.id!==id));
}
async function searchStations(){
  const query=$('stationSearchQuery').value.trim();
  if(query.length<2){$('searchMessage').textContent='Typ minimaal twee letters van de zendernaam.';return}
  const searchId=++state.searchId;
  $('searchResults').replaceChildren();
  $('searchMessage').textContent='Stations zoeken via Radio Browser...';
  $('searchStations').disabled=true;
  try{
    const result=await api('radio-search?q='+encodeURIComponent(query));
    if(searchId!==state.searchId)return;
    const stations=Array.isArray(result.stations)?result.stations:[];
    $('searchMessage').textContent=stations.length
      ?stations.length+' stations gevonden. Kies de gewenste stream:'
      :'Geen bruikbare HTTPS-stations gevonden. Je kunt ook zelf een streamadres invoeren.';
    for(const station of stations){
      if(!isHttpsStream(station.url))continue;
      const b=el('button','local-search-result');
      b.type='button';
      const name=el('span','search-name',station.name);
      const codec=el('span','search-detail',([station.codec,station.bitrate?station.bitrate+' kbps':''].filter(Boolean).join(' · ')));
      b.append(name,codec);
      b.addEventListener('click',()=>{
        $('stationName').value=station.name;
        $('streamUrl').value=station.url;
        $('searchMessage').textContent='Gekozen: '+station.name+'. Klik op Opslaan om de koppeling te bewaren.';
      });
      $('searchResults').append(b);
    }
  }catch(err){
    if(searchId!==state.searchId)return;
    $('searchMessage').textContent=err.message;
  }finally{
    if(searchId===state.searchId)$('searchStations').disabled=false;
  }
}
async function loadContent(){
  const [schedule,config]=await Promise.all([api('schedule'),api('local-radio')]);
  state.shared=Array.isArray(schedule.items)?schedule.items:[];
  state.local=Array.isArray(config.localItems)?config.localItems:[];
  state.mappings=config.mappings&&typeof config.mappings==='object'?config.mappings:{};
  state.revision=config.revision||'initial';
  state.loaded=true;
  renderTabs();renderList();
}
async function init(){
  try{
    const status=await api('status');
    if(!status.configured){
      showSetup('Deze app mist Cloudflare-instellingen. Controleer APP_PASSWORD, SESSION_SECRET en RADIO_KV.');
      return;
    }
    if(!status.authenticated){showLogin();return}
    showApp();await loadContent();
  }catch(err){
    if(!$('appScreen').classList.contains('hidden'))toast('Agenda laden mislukt: '+err.message,true);
    else showSetup('De app kan Cloudflare momenteel niet bereiken: '+err.message);
  }
}
$('loginForm').addEventListener('submit',async event=>{
  event.preventDefault();$('loginError').textContent='';
  try{
    await api('login',{method:'POST',body:JSON.stringify({password:$('password').value})});
    $('password').value='';await init();
  }catch(err){$('loginError').textContent=err.message}
});
$('logoutBtn').addEventListener('click',async()=>{
  try{await api('logout',{method:'POST',body:'{}'})}catch{}
  showLogin();
});
$('playerPause').addEventListener('click',togglePause);
$('playerStop').addEventListener('click',stopAudio);
$('playerVolume').addEventListener('input',event=>{
  audio.volume=Number(event.target.value)/100;
  localStorage.setItem('local_radio_volume',String(event.target.value));
});
audio.addEventListener('playing',()=>{
  $('playerStatus').textContent='Live aan het afspelen';
  $('playerPause').textContent='Pauzeren';
});
audio.addEventListener('waiting',()=>{$('playerStatus').textContent='Stream bufferen...'});
audio.addEventListener('pause',()=>{
  if(state.playingUrl&&audio.src)$('playerPause').textContent='Hervatten';
});
audio.addEventListener('error',()=>{
  if(state.playingUrl)$('playerStatus').textContent='Stream niet beschikbaar of niet ondersteund. Probeer een andere HTTPS-stream.';
});
$('addBtn').addEventListener('click',()=>openProgramModal(null));
$('closeModal').addEventListener('click',closeModal);
$('cancelModal').addEventListener('click',closeModal);
$('modal').addEventListener('click',event=>{if(event.target===$('modal'))closeModal()});
$('localForm').addEventListener('submit',saveForm);
$('searchStations').addEventListener('click',searchStations);
$('stationSearchQuery').addEventListener('keydown',event=>{
  if(event.key==='Enter'){event.preventDefault();void searchStations()}
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!$('modal').classList.contains('hidden'))closeModal()
});
const storedVolume=Number(localStorage.getItem('local_radio_volume'));
if(Number.isFinite(storedVolume)&&storedVolume>=0&&storedVolume<=100&&localStorage.getItem('local_radio_volume')!==null){
  audio.volume=storedVolume/100;$('playerVolume').value=String(storedVolume);
}else audio.volume=.75;
setInterval(()=>{
  if($('appScreen').classList.contains('hidden'))return;
  const lastMinute=state.lastMinute;
  const minute=new Date().toTimeString().slice(0,5);
  updateDate();
  if(minute!==lastMinute){state.lastMinute=minute;renderList()}
},15000);
init();

'use strict';
const $=id=>document.getElementById(id);
const DAYS=['Zondag','Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag'];
const SHORT=['Zo','Ma','Di','Wo','Do','Vr','Za'];
const state={items:[],revision:null,households:[],favorites:[],groups:[],selectedHousehold:localStorage.getItem('radio_household')||'',groupId:localStorage.getItem('radio_group')||'',view:'today',connected:false,loading:false};
const safeText=v=>String(v??'');
function node(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e}
function toast(message,error=false){const el=$('toast');el.textContent=message;el.className=`toast${error?' error':''}`;clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.add('hidden'),4200)}
async function api(path,options={}){let res;try{res=await fetch('/api/'+path,{credentials:'same-origin',cache:'no-store',...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}})}catch(e){throw new Error('Geen verbinding met Cloudflare. Probeer opnieuw.')}let payload={};try{payload=await res.json()}catch{}if(!res.ok){if(res.status===401&&path!=='login'){showLogin();}throw new Error(payload.error||`Serverfout (${res.status})`)}return payload}
function show(el,yes=true){$(el).classList.toggle('hidden',!yes)}
function showLogin(){show('loginScreen');show('appScreen',false);show('setupScreen',false);show('logoutBtn',false);$('connectionText').textContent='Privé';$('connection').classList.remove('online')}
function showSetup(message){show('setupScreen');show('loginScreen',false);show('appScreen',false);show('logoutBtn',false);$('setupText').textContent=message||'Stel eerst Cloudflare Secrets en de KV-binding in.'}
function showApp(){show('appScreen');show('loginScreen',false);show('setupScreen',false);show('logoutBtn');updateDate()}
function updateDate(){const d=new Date();$('dateDay').textContent=d.toLocaleDateString('nl-NL',{day:'numeric'});$('dateMonth').textContent=d.toLocaleDateString('nl-NL',{month:'long',year:'numeric'}).toUpperCase();$('dateWeekday').textContent=DAYS[d.getDay()];$('clock').textContent=d.toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'});if(state.lastDay!==d.getDay()){state.lastDay=d.getDay();renderTabs();renderList()}}
function setConnection(connected,message){state.connected=connected;$('trackInfoBtn').disabled=!(connected&&state.groupId);if(!connected)show('nowPlaying',false);$('connection').classList.toggle('online',connected);$('connectionText').textContent=connected?'Sonos gekoppeld':'Sonos niet gekoppeld';$('sonosMessage').textContent=message|| (connected?'Favorieten zijn beschikbaar.':'Log in op Sonos om je favorieten te laden.');show('connectBtn',!connected);show('refreshBtn',connected);show('roomWrap',connected&&state.groups.length>0);show('householdWrap',connected&&state.households.length>1)}
async function loadSchedule(){const result=await api('schedule');state.items=Array.isArray(result.items)?result.items:[];state.revision=result.revision||null;renderTabs();renderList()}
function listForDay(day){return state.items.filter(x=>x.day==='all'||x.day===String(day)).sort((a,b)=>(a.start||'').localeCompare(b.start||''))}
function selectedIndex(){return state.view==='today'?new Date().getDay():Number(state.view)}
function renderTabs(){const tabs=$('dayTabs');tabs.replaceChildren();const defs=[['today','Vandaag'],['1','Ma'],['2','Di'],['3','Wo'],['4','Do'],['5','Vr'],['6','Za'],['0','Zo'],['week','Hele week']];for(const [key,title] of defs){const b=node('button','day-tab'+(state.view===key?' active':''));b.type='button';b.textContent=title;const count=key==='week'?state.items.length:listForDay(key==='today'?new Date().getDay():key).length;if(count){const s=node('span','day-count',String(count));b.append(s)}b.addEventListener('click',()=>{state.view=key;renderTabs();renderList()});tabs.append(b)}}
function renderList(){const target=$('programList');target.replaceChildren();if(state.view==='week'){$('selectedDayLabel').textContent='OVERZICHT';$('selectedTitle').textContent='De hele week';$('itemCount').textContent=`${state.items.length} opgeslagen`;if(!state.items.length){target.append(empty());return}for(const day of [1,2,3,4,5,6,0]){const items=listForDay(day);if(!items.length)continue;target.append(node('div','week-heading',DAYS[day].toUpperCase()));items.forEach(item=>target.append(programRow(item,day)))}return}const day=selectedIndex();const items=listForDay(day);$('selectedDayLabel').textContent=state.view==='today'?'VANDAAG':'DAGOVERZICHT';$('selectedTitle').textContent=state.view==='today'?"Programma's van vandaag":DAYS[day];$('itemCount').textContent=`${items.length} programma${items.length===1?'':'\'s'}`;if(!items.length){target.append(empty());return}items.forEach(item=>target.append(programRow(item,day)))}
function empty(){const e=node('div','empty-state');e.append(node('div','empty-icon','♫'),node('h4','','Nog geen programma\'s ingepland'),node('p','','Voeg een favoriet toe en je radiogids wordt hier gevuld.'));return e}
function inTimeRange(item,day){if(day!==new Date().getDay())return false;const hhmm=new Date().toTimeString().slice(0,5);return item.start<=hhmm&&(!item.end||hhmm<item.end)}
function programRow(item,day){const row=node('article','program-row');const time=node('div','time-block',item.start);time.append(node('small','',item.end?'tot '+item.end:(item.day==='all'?'dagelijks':'starttijd')));const main=node('div','program-main');main.append(node('h4','',item.name));const sub=node('div','program-sub');sub.append(node('span','',item.favoriteName||'Onbekend station'));if(item.day==='all')sub.append(node('span','','• Iedere dag'));if(inTimeRange(item,day))sub.append(node('span','onair','NU GEPLAND'));main.append(sub);const actions=node('div','program-actions');const play=node('button','play-button','Afspelen');play.type='button';play.disabled=!state.connected||!state.groupId;play.title=play.disabled?'Koppel Sonos en kies een kamer om af te spelen':'Start deze favoriet op Sonos';play.addEventListener('click',()=>playFavorite(item,play));const edit=node('button','subtle-action','✎');edit.type='button';edit.title='Programma wijzigen';edit.setAttribute('aria-label','Programma wijzigen');edit.addEventListener('click',()=>openModal(item));const del=node('button','subtle-action delete','×');del.type='button';del.title='Programma verwijderen';del.setAttribute('aria-label','Programma verwijderen');del.addEventListener('click',()=>removeItem(item.id));actions.append(play,edit,del);row.append(time,main,actions);return row}
function normalizeFavoriteList(raw){const a=Array.isArray(raw)?raw:(raw?.favorites||raw?.items||raw?.favoriteList?.favorites||raw?.favoriteList?.items||raw?.favoriteList||[]);return Array.isArray(a)?a.filter(f=>f&&f.id).map(f=>({id:safeText(f.id),name:safeText(f.name||f.title||f.id)})):[]}

function playbackText(value){
  const labels={PLAYBACK_STATE_PLAYING:'Speelt',PLAYBACK_STATE_PAUSED:'Gepauzeerd',PLAYBACK_STATE_BUFFERING:'Laden',PLAYBACK_STATE_IDLE:'Inactief'};
  return labels[value]||'';
}
async function updateNowPlaying(){
  if(!state.connected||!state.selectedHousehold||!state.groupId){show('nowPlaying',false);return}
  const groupId=state.groupId,householdId=state.selectedHousehold;
  const room=state.groups.find(g=>g.id===groupId);
  $('nowPlayingRoom').textContent=room?.name||'Sonos';
  if($('nowPlaying').classList.contains('hidden'))$('nowPlayingTitle').textContent='Bron controleren...';
  show('nowPlaying');
  try{
    const data=await api('now-playing?householdId='+encodeURIComponent(householdId)+'&groupId='+encodeURIComponent(groupId));
    if(!state.connected||state.groupId!==groupId||state.selectedHousehold!==householdId)return;
    $('nowPlayingTitle').textContent=data.source||'Sonos geeft geen bronnaam door';
    $('nowPlayingStatus').textContent=playbackText(data.playbackState);
  }catch(e){
    if(!state.connected||state.groupId!==groupId||state.selectedHousehold!==householdId)return;
    $('nowPlayingTitle').textContent='Afspeelinformatie niet beschikbaar';
    $('nowPlayingStatus').textContent='';
  }
}

// Deze aanvraag gebeurt alleen na een bewuste klik, nooit via de 90s-zendercontrole.
let trackRequestId=0;
let lyricsRequestId=0;
let lyricsQuery=null;
function resetLyrics(){
  lyricsRequestId++;
  lyricsQuery=null;
  $('lyricsLookupBtn').disabled=false;
  show('lyricsLookupBtn',false);
  show('lyricsSection',false);
  show('lyricsText',false);
  show('lyricsSource',false);
  $('lyricsStatus').textContent='';
  $('lyricsText').textContent='';
  $('lyricsSource').textContent='';
}
function identifyLyricsQuery(title,artist,streamInfo){
  const song=String(title||'').trim(),by=String(artist||'').trim();
  if(song&&by)return {title:song,artist:by};
  const combined=song||String(streamInfo||'').trim();
  const parts=combined.match(/^(.{2,100}?)\s+[-\u2013\u2014]\s+(.{2,120})$/);
  return parts?{artist:parts[1].trim(),title:parts[2].trim()}:null;
}
async function requestLyrics(){
  if(!lyricsQuery)return;
  const requestId=++lyricsRequestId;
  $('lyricsLookupBtn').disabled=true;
  $('lyricsStatus').textContent='Songtekst zoeken bij LRCLIB en Lyrics.ovh...';
  show('lyricsSection');
  show('lyricsText',false);
  show('lyricsSource',false);
  try{
    const data=await api('lyrics?title='+encodeURIComponent(lyricsQuery.title)+'&artist='+encodeURIComponent(lyricsQuery.artist));
    if(requestId!==lyricsRequestId||$('trackPopup').classList.contains('hidden'))return;
    if(data.found&&typeof data.lyrics==='string'&&data.lyrics.trim()){
      $('lyricsStatus').textContent='';
      $('lyricsText').textContent=data.lyrics;
      show('lyricsText');
      $('lyricsSource').textContent='Bron: '+(data.source||'gratis songtekstbron');
      show('lyricsSource');
    }else{
      $('lyricsStatus').textContent='Voor dit nummer is helaas geen songtekst gevonden in de gratis bronnen.';
    }
  }catch(err){
    if(requestId!==lyricsRequestId||$('trackPopup').classList.contains('hidden'))return;
    $('lyricsStatus').textContent='Songtekst ophalen mislukt: '+err.message;
  }finally{
    if(requestId===lyricsRequestId)$('lyricsLookupBtn').disabled=false;
  }
}
let trackPopupReturnFocus=null;
let trackPopupPreviousOverflow='';
function closeTrackPopup(){
  resetLyrics();
  trackRequestId++;
  show('trackPopup',false);
  document.body.style.overflow=trackPopupPreviousOverflow;
  $('trackInfoBtn').disabled=!(state.connected&&state.groupId);
  if(trackPopupReturnFocus?.isConnected)trackPopupReturnFocus.focus();
  trackPopupReturnFocus=null;
}
async function requestTrackInfo(){
  if(!state.connected||!state.selectedHousehold||!state.groupId){
    toast('Kies eerst een verbonden Sonos-kamer.',true);return;
  }
  const householdId=state.selectedHousehold,groupId=state.groupId;
  const requestId=++trackRequestId;
  trackPopupReturnFocus=document.activeElement;
  trackPopupPreviousOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  $('trackPopupMessage').textContent='Nummerinformatie wordt nu opgehaald bij Sonos...';
  show('trackPopupResult',false);
  resetLyrics();
  show('trackPopup');
  $('closeTrackPopup').focus();
  $('trackInfoBtn').disabled=true;
  try{
    const data=await api('track-info?householdId='+encodeURIComponent(householdId)+'&groupId='+encodeURIComponent(groupId));
    if(requestId!==trackRequestId)return;
    const title=typeof data.title==='string'?data.title:'';
    const artist=typeof data.artist==='string'?data.artist:'';
    const streamInfo=typeof data.streamInfo==='string'?data.streamInfo:'';
    const station=typeof data.station==='string'?data.station:'';
    const available=Boolean(title||artist||streamInfo);
    if(!available){
      $('trackPopupMessage').textContent='Deze zender geeft momenteel geen nummer of artiest door via Sonos.';
      show('trackPopupResult',false);
    }else{
      $('trackPopupMessage').textContent='Op dit moment volgens Sonos:';
      $('trackPopupSong').textContent=title||streamInfo||'Artiest bekend, titel niet beschikbaar';
      $('trackPopupArtist').textContent=artist;
      show('trackPopupArtist',Boolean(artist));
      $('trackPopupStation').textContent=station?'Via '+station:'';
      show('trackPopupStation',Boolean(station));
      show('trackPopupResult');
      lyricsQuery=identifyLyricsQuery(title,artist,streamInfo);
      show('lyricsLookupBtn');
      $('lyricsLookupBtn').disabled=!lyricsQuery;
      $('lyricsLookupBtn').title=lyricsQuery?'Zoek de songtekst van dit nummer':'Titel en artiest zijn nodig voor een songtekst';
    }
  }catch(err){
    if(requestId!==trackRequestId)return;
    $('trackPopupMessage').textContent='Nummerinformatie ophalen mislukt: '+err.message;
    show('trackPopupResult',false);
  }finally{
    if(requestId===trackRequestId)$('trackInfoBtn').disabled=!(state.connected&&state.groupId);
  }
}

async function loadSonos(){setConnection(false,'Sonos-favorieten ophalen...');try{const householdsResult=await api('households');const households=householdsResult.households||[];state.households=households;if(!households.length){setConnection(false,'Er zijn geen Sonos-huishoudens gevonden.');return}if(!households.some(h=>h.id===state.selectedHousehold))state.selectedHousehold=households[0].id;const hs=$('householdSelect');hs.replaceChildren();households.forEach(h=>{const opt=node('option','',h.name||h.id);opt.value=h.id;hs.append(opt)});hs.value=state.selectedHousehold;localStorage.setItem('radio_household',state.selectedHousehold);const result=await api('sonos?householdId='+encodeURIComponent(state.selectedHousehold));state.groups=Array.isArray(result.groups)?result.groups:[];state.favorites=normalizeFavoriteList(result.favorites);if(!state.groups.some(g=>g.id===state.groupId))state.groupId=state.groups[0]?.id||'';localStorage.setItem('radio_group',state.groupId);const rs=$('roomSelect');rs.replaceChildren();state.groups.forEach(g=>{const opt=node('option','',g.name||g.id);opt.value=g.id;rs.append(opt)});rs.value=state.groupId;setConnection(true,`${state.favorites.length} favorieten beschikbaar • ${state.groups.length} kamers / groepen`);if(!state.groups.length)toast('Geen actieve Sonos-groepen gevonden.',true);renderList();void updateNowPlaying()}catch(err){setConnection(false,err.message);if(!/niet gekoppeld|Log eerst/.test(err.message))toast(err.message,true);renderList()}}
function updateFavoriteSelect(value=''){const sel=$('favoriteSelect');sel.replaceChildren();const base=node('option','','Kies je Sonos-favoriet');base.value='';sel.append(base);for(const fav of state.favorites){const o=node('option','',fav.name);o.value=fav.id;sel.append(o)}if(value&&!state.favorites.some(f=>f.id===value)){const opt=node('option','','Oud favoriet (niet meer bij Sonos)');opt.value=value;sel.append(opt)}sel.value=value}
function openModal(item){$('programForm').reset();$('editId').value=item?.id||'';$('modalTitle').textContent=item?'Programma wijzigen':'Programma toevoegen';$('programName').value=item?.name||'';$('daySelect').value=item?.day||(state.view==='week'?'1':String(selectedIndex()));$('startTime').value=item?.start||'08:00';$('endTime').value=item?.end||'';updateFavoriteSelect(item?.favoriteId||'');$('formError').textContent='';show('modal');$('programName').focus();document.body.style.overflow='hidden';if(!state.connected)toast('Koppel eerst Sonos om favorieten te selecteren.',true)}
function closeModal(){show('modal',false);document.body.style.overflow=''}
async function saveItems(items){const current=state.items;const revision=state.revision;state.items=items;renderTabs();renderList();try{const result=await api('schedule',{method:'PUT',body:JSON.stringify({items,revision})});state.items=result.items;state.revision=result.revision;renderTabs();renderList();toast('Agenda opgeslagen')}catch(e){state.items=current;state.revision=revision;renderTabs();renderList();toast(e.message,true);if(e.message.includes('gewijzigd'))await loadSchedule().catch(()=>{})}}
async function saveProgram(ev){ev.preventDefault();$('formError').textContent='';const fav=state.favorites.find(f=>f.id===$('favoriteSelect').value);const old=state.items.find(i=>i.id===$('editId').value);if(!fav&&!old){$('formError').textContent='Selecteer eerst een Sonos-favoriet.';return}const name=$('programName').value.trim(),start=$('startTime').value,end=$('endTime').value,day=$('daySelect').value;if(!name||!start){$('formError').textContent='Vul een programmanaam en starttijd in.';return}if(end&&end<=start){$('formError').textContent='De eindtijd moet later zijn dan de starttijd.';return}const item={id:old?.id||crypto.randomUUID(),name,day,start,end,favoriteId:fav?.id||old.favoriteId,favoriteName:fav?.name||old.favoriteName};const items=old?state.items.map(i=>i.id===old.id?item:i):[...state.items,item];closeModal();await saveItems(items)}
async function removeItem(id){const item=state.items.find(i=>i.id===id);if(!item)return;if(!confirm(`Verwijder "${item.name}" uit de agenda?`))return;await saveItems(state.items.filter(i=>i.id!==id))}
async function playFavorite(item,button){if(!state.connected||!state.groupId)return toast('Selecteer eerst een Sonos-kamer.',true);button.disabled=true;button.textContent='Bezig...';try{await api('play',{method:'POST',body:JSON.stringify({householdId:state.selectedHousehold,groupId:state.groupId,favoriteId:item.favoriteId})});toast(`▶ ${item.favoriteName} speelt op ${state.groups.find(g=>g.id===state.groupId)?.name||'Sonos'}`);setTimeout(()=>{if(state.connected)void updateNowPlaying()},1600)}catch(err){toast('Afspelen mislukt: '+err.message,true)}finally{button.disabled=false;button.textContent='Afspelen'}}
async function init(){try{const status=await api('status');if(!status.configured){showSetup('Cloudflare-instellingen ontbreken. Voeg APP_PASSWORD en SESSION_SECRET toe en verbind RADIO_KV volgens de README.');return}if(!status.authenticated){showLogin();return}showApp();await loadSchedule();if(status.sonosConnected){await loadSonos()}else{setConnection(false,'Eenmalig inloggen om je Sonos-favorieten te laden.')} }catch(e){showSetup('Kan de Cloudflare Pages Functions niet bereiken. Open de app via je Cloudflare Pages-URL en controleer of functions/api/status.js is gedeployed. '+e.message)}}
$('loginForm').addEventListener('submit',async ev=>{ev.preventDefault();$('loginError').textContent='';try{await api('login',{method:'POST',body:JSON.stringify({password:$('password').value})});$('password').value='';await init()}catch(err){$('loginError').textContent=err.message}});
$('logoutBtn').addEventListener('click',async()=>{try{await api('logout',{method:'POST',body:'{}'});}catch{}showLogin()});
$('connectBtn').addEventListener('click',()=>{location.href='/api/oauth/start'});
$('refreshBtn').addEventListener('click',loadSonos);
$('trackInfoBtn').addEventListener('click',requestTrackInfo);
$('lyricsLookupBtn').addEventListener('click',requestLyrics);
$('closeTrackPopup').addEventListener('click',closeTrackPopup);
$('closeTrackPopupBottom').addEventListener('click',closeTrackPopup);
$('trackPopup').addEventListener('click',e=>{if(e.target===$('trackPopup'))closeTrackPopup()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('trackPopup').classList.contains('hidden'))closeTrackPopup()});
$('householdSelect').addEventListener('change',async e=>{state.selectedHousehold=e.target.value;state.groupId='';localStorage.setItem('radio_household',state.selectedHousehold);await loadSonos()});
$('roomSelect').addEventListener('change',e=>{state.groupId=e.target.value;localStorage.setItem('radio_group',state.groupId);$('trackInfoBtn').disabled=!(state.connected&&state.groupId);if(!$('trackPopup').classList.contains('hidden'))closeTrackPopup();void updateNowPlaying()});
$('addBtn').addEventListener('click',()=>openModal());$('closeModal').addEventListener('click',closeModal);$('cancelModal').addEventListener('click',closeModal);$('modal').addEventListener('click',e=>{if(e.target===$('modal'))closeModal()});$('programForm').addEventListener('submit',saveProgram);document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
setInterval(()=>{if(!$('appScreen').classList.contains('hidden')){const old=state.lastMinute;const now=new Date().toTimeString().slice(0,5);updateDate();if(now!==old){state.lastMinute=now;renderList()}}},15000);
setInterval(()=>{if(!document.hidden&&state.connected)void updateNowPlaying()},90000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.connected)void updateNowPlaying()});
if(location.search.includes('sonos=connected')){history.replaceState(null,'',location.pathname);setTimeout(()=>toast('Sonos is gekoppeld. Favorieten worden geladen.'),400)}if(location.search.includes('sonos=error')){const params=new URLSearchParams(location.search);history.replaceState(null,'',location.pathname);setTimeout(()=>toast('Sonos-login mislukt: '+(params.get('reason')||'onbekende fout'),true),400)}
init();

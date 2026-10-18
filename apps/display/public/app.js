'use strict';
const $ = selector => document.querySelector(selector);
const defaults = {format:'12',unit:'f',brightness:40,night:false};
let prefs = {...defaults};
try { const saved=JSON.parse(localStorage.getItem('angstrom.display.v1')||'{}'); prefs={...defaults,...saved}; if(saved.formatRevision!==2){prefs.format='12';prefs.unit='f';} } catch {}
prefs.formatRevision=2;
if(!['12','24'].includes(prefs.format)) prefs.format='12';
if(!['f','c'].includes(prefs.unit)) prefs.unit='f';
prefs.brightness=Math.min(70,Math.max(20,Number(prefs.brightness)||40));
const save=()=>{try{localStorage.setItem('angstrom.display.v1',JSON.stringify(prefs));}catch{}};
const icon=name=>`<svg aria-hidden="true"><use href="#${name}"/></svg>`;
const temperature=f=>`${prefs.unit==='c'?Math.round((f-32)*5/9):f}°`;
let dayOffset=0;
const samples=[
  [{time:'9:00 AM',title:'A slow start',meta:'Personal · 30 min',description:'A little space for coffee, a book, and an unhurried morning.'},{time:'12:30 PM',title:'Lunch with a friend',meta:'Personal · 1 hour',description:'Sample lunch event. Your connected calendar will eventually populate this space.'},{time:'6:00 PM',title:'Reset for the week',meta:'Home · 45 min',description:'Plan the week ahead and make a little room for what matters.'}],
  [{time:'9:30 AM',title:'Weekly planning',meta:'Work · 30 min',description:'Review the week and choose your priorities.'},{time:'1:00 PM',title:'Project check-in',meta:'Work · 1 hour',description:'A sample project meeting for the next day.'},{time:'5:30 PM',title:'An evening walk',meta:'Personal · 30 min',description:'Step outside and unwind.'}],
  []
];
function dateForOffset(){const d=new Date();d.setDate(d.getDate()+dayOffset);return d;}
function renderAgenda(){
  const d=dateForOffset();
  $('#agenda-day').textContent=dayOffset===0?'Today':dayOffset===1?'Tomorrow':d.toLocaleDateString(undefined,{month:'short',day:'numeric'});
  $('#agenda-day').title='Return to today';
  const entries=dayOffset>=0&&dayOffset<samples.length?samples[dayOffset]:[];
  const container=$('#events');container.replaceChildren();
  if(!entries.length){const empty=document.createElement('div');empty.className='empty-state';empty.innerHTML=icon('sun')+'<span>A little breathing room. No sample events for this day.</span>';container.append(empty);return;}
  entries.forEach(event=>{const button=document.createElement('button');button.className='event';button.innerHTML=`<span class="event-marker"></span><span><span class="event-time">${event.time}</span><span class="event-name" style="display:block">${event.title}</span><span class="event-meta">${event.meta}</span></span>`;button.addEventListener('click',()=>{$('#event-title').textContent=event.title;$('#event-time').textContent=`${d.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})} · ${event.time}`;$('#event-description').textContent=event.description;$('#event-dialog').showModal();});container.append(button);});
}
let dayKey='';
function tick(){const now=new Date();const parts=new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit',hour12:prefs.format==='12'}).formatToParts(now);$('#clock').textContent=parts.filter(p=>['hour','minute','literal'].includes(p.type)).map(p=>p.value).join('').trim();$('#period').textContent=parts.find(p=>p.type==='dayPeriod')?.value||'';$('#date').textContent=now.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});$('#timezone').textContent=new Intl.DateTimeFormat(undefined,{timeZoneName:'short'}).formatToParts(now).find(p=>p.type==='timeZoneName')?.value||'LOCAL';const key=now.toDateString();if(key!==dayKey){dayKey=key;renderAgenda();}}
function applyPreferences(){document.body.classList.toggle('night',!!prefs.night);document.documentElement.style.setProperty('--night-brightness',String(prefs.brightness/100));$('#night-button').setAttribute('aria-pressed',String(!!prefs.night));$('#night-button span').textContent=prefs.night?'Day mode':'Night mode';$('#footer-message').textContent=prefs.night?'Rest easy. Tap Day mode to brighten.':'Your day, at a glance.';window.AngstromWeather.setPreferences(prefs);tick();}
$('#weather-open').addEventListener('click',()=>{window.AngstromWeather.render();$('#weather-dialog').showModal();});
$('#night-button').addEventListener('click',()=>{prefs.night=!prefs.night;save();applyPreferences();});
$('#settings-button').addEventListener('click',()=>{$('#clock-format').value=prefs.format;$('#temperature-unit').value=prefs.unit;$('#brightness').value=prefs.brightness;$('#settings-dialog').showModal();});
$('#settings-form').addEventListener('submit',e=>{e.preventDefault();prefs.format=$('#clock-format').value;prefs.unit=$('#temperature-unit').value;prefs.brightness=Number($('#brightness').value);save();applyPreferences();$('#settings-dialog').close();});
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}}));
$('#previous-day').addEventListener('click',()=>{dayOffset--;renderAgenda();});$('#next-day').addEventListener('click',()=>{dayOffset++;renderAgenda();});$('#agenda-day').addEventListener('click',()=>{dayOffset=0;renderAgenda();});
$('#fullscreen-button').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('#footer-message').textContent='Use your browser’s fullscreen option.';}});
document.addEventListener('fullscreenchange',()=>{$('#fullscreen-button').setAttribute('aria-label',document.fullscreenElement?'Exit fullscreen':'Enter fullscreen');});
save();applyPreferences();window.AngstromWeather.start();setInterval(tick,1000);

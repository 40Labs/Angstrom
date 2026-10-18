const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../apps/display/public/weather.js'),'utf8');

function fixture(now) {
  const midnight=Date.parse('2026-10-18T00:00:00-04:00')/1000;
  return {current_units:{temperature_2m:'°F',wind_speed_10m:'mp/h',precipitation:'inch'},hourly_units:{wind_speed_10m:'mp/h'},current:{time:now/1000,temperature_2m:32,apparent_temperature:30,weather_code:0,is_day:1,relative_humidity_2m:0,wind_speed_10m:0,wind_gusts_10m:4,precipitation:0,surface_pressure:1000,cloud_cover:0},hourly:{time:Array.from({length:48},(_,i)=>midnight+i*3600),temperature_2m:Array(48).fill(32),weather_code:Array(48).fill(0),is_day:Array(48).fill(1),apparent_temperature:Array(48).fill(30),precipitation_probability:Array(48).fill(0),wind_speed_10m:Array(48).fill(0)},daily:{time:[midnight,midnight+86400],temperature_2m_max:[40,42],temperature_2m_min:[20,22],sunrise:[Date.parse('2026-10-18T07:20:00-04:00')/1000,null],sunset:[Date.parse('2026-10-18T18:15:00-04:00')/1000,null],daylight_duration:[39300,null],precipitation_probability_max:[0,null],weather_code:[0,3]}};
}
function environment({data,at='2026-10-18T12:00:00-04:00',cached=false,fail=false}={}) {
  const now=Date.parse(at);data??=fixture(now);
  class Element {
    constructor(){this.textContent='';this.children=[];this.dataset={};this.hidden=false;}
    append(...items){this.children.push(...items);}
    replaceChildren(...items){this.children=[...items];}
    setAttribute(key,value){this[key]=value;}
    addEventListener(){}
  }
  const elements=new Map();
  const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
  class Clock extends Date {static now(){return now;}}
  const context={window:{addEventListener(){}},document:{getElementById:get,createElement:()=>new Element(),createElementNS:()=>new Element(),addEventListener(){}},localStorage:{getItem:()=>cached?JSON.stringify({data,fetchedAt:now-120000}):null,setItem(){}},URL,URLSearchParams,Intl,Date:Clock,AbortController,setTimeout:()=>0,clearTimeout(){},setInterval(){},fetch:async()=>{if(fail)throw Error('offline');return {ok:true,json:async()=>data};}};
  vm.createContext(context);vm.runInContext(source,context);
  const api=context.window.AngstromWeather;
  return {api,get,data,settle:async()=>{api.start();await new Promise(setImmediate);}};
}
test('Eastern sunrise/sunset remain correct when browser timezone is elsewhere; zero values are real data',async()=>{
  const e=environment();await e.settle();
  assert.equal(e.get('weather-status').textContent,'LIVE');
  assert.equal(e.get('weather-sunrise').textContent,'7:20 AM');
  assert.equal(e.get('weather-sunset').textContent,'6:15 PM');
  assert.equal(e.get('weather-metrics').children[0].children[1].textContent,'0%');
  assert.equal(e.get('weather-metrics').children[3].children[1].textContent,'0.00 in');
  assert.equal(e.get('weather-hourly').children.length,12);
});
test('units and clock preferences apply to the details as well as the summary',async()=>{
  const e=environment();await e.settle();e.api.setPreferences({unit:'c',format:'24'});
  assert.equal(e.get('detail-temperature').textContent,'0°C');
  assert.equal(e.get('detail-sunrise').textContent,'07:20');
});
test('missing solar/optional metrics display unavailable values without breaking the rest of the forecast',async()=>{
  const e=environment();e.data.daily.sunrise[0]=null;e.data.daily.sunset[0]=null;delete e.data.current.relative_humidity_2m;
  await e.settle();assert.equal(e.get('weather-sunrise').textContent,'—');assert.equal(e.get('detail-sunset').textContent,'—');assert.equal(e.get('weather-temperature').textContent,'32°');
});
test('offline cached weather is explicitly stale and expired forecast rows are not presented',async()=>{
  const now=Date.parse('2026-10-18T12:00:00-04:00');const data=fixture(now);data.current.time-=7200;
  const e=environment({data,cached:true,fail:true});await e.settle();
  assert.equal(e.get('weather-status').textContent,'STALE');assert.match(e.get('weather-detail-status').textContent,/STALE/);assert.equal(e.get('weather-hourly').children.length,0);assert.match(e.get('weather-hourly-empty').textContent,/fresh weather/);
});
test('unavailable data hides detail content and offers recovery',async()=>{
  const e=environment({fail:true});await e.settle();assert.equal(e.get('weather-detail-content').hidden,true);assert.equal(e.get('weather-status').textContent,'UNAVAILABLE');assert.match(e.get('weather-detail-status').textContent,/Refresh/);
});
test('day changes in Eastern time do not reuse yesterday’s solar times',async()=>{
  const e=environment({at:'2026-10-19T00:30:00-04:00'});e.data.daily.sunrise[1]=Date.parse('2026-10-19T07:21:00-04:00')/1000;
  await e.settle();assert.equal(e.get('weather-sunrise').textContent,'7:21 AM');assert.equal(e.get('weather-sunset').textContent,'—');
});
test('provider shape errors fail validation; nullable optional fields are supported',()=>{
  const e=environment();e.api.validate(e.data);e.data.daily.sunrise.push(null);assert.throws(()=>e.api.validate(e.data),/Invalid optional/);
});

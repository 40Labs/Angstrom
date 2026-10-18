'use strict';
// Public weather only. No Google tokens or calendar data belong in this adapter.
window.AngstromWeather = (() => {
  const zone = 'America/New_York';
  const cacheKey = 'angstrom.weather.vestal.v1';
  const refreshMs = 15 * 60 * 1000;
  const staleMs = 60 * 60 * 1000;
  const maxCacheMs = 24 * 60 * 60 * 1000;
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({latitude:'42.08507',longitude:'-76.05381',timezone:zone,timeformat:'unixtime',temperature_unit:'fahrenheit',current:'temperature_2m,apparent_temperature,weather_code,is_day',hourly:'temperature_2m,weather_code,is_day',daily:'temperature_2m_max,temperature_2m_min',forecast_days:'2'});
  let snapshot = null, unit = 'f', format = '12', loading = false, failed = false, retryAt = 0;
  const el = id => document.getElementById(id);
  const temp = f => Number.isFinite(f) ? `${Math.round(unit === 'c' ? (f-32)*5/9 : f)}°` : '—';
  const time = seconds => new Intl.DateTimeFormat('en-US',{timeZone:zone,hour:'numeric',minute:'2-digit',hour12:format==='12'}).format(new Date(seconds*1000));
  const dateKey = seconds => new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(seconds*1000));
  function condition(code, day) {
    if(code===0) return [day ? 'Clear skies' : 'Clear night',day?'sun':'moon'];
    if(code===1) return [day ? 'Mostly clear' : 'Mostly clear night',day?'sun':'moon'];
    if(code===2) return ['Partly cloudy','cloud'];
    if(code===3) return ['Overcast','cloud'];
    if([45,48].includes(code)) return ['Fog','cloud'];
    if([51,53,55].includes(code)) return ['Drizzle','rain'];
    if([56,57].includes(code)) return ['Freezing drizzle','rain'];
    if([61,63,65,80,81,82].includes(code)) return ['Rain','rain'];
    if([66,67].includes(code)) return ['Freezing rain','rain'];
    if([71,73,75,77,85,86].includes(code)) return ['Snow','snow'];
    if([95,96,99].includes(code)) return ['Thunderstorms','storm'];
    return ['Weather conditions','cloud'];
  }
  function validate(data) {
    const c=data?.current, h=data?.hourly, d=data?.daily;
    if(data?.current_units?.temperature_2m!=='°F' || !c || !h || !d || ![c.time,c.temperature_2m,c.apparent_temperature,c.weather_code,c.is_day].every(Number.isFinite)) throw new Error('Incomplete weather response');
    for(const group of [[h,['time','temperature_2m','weather_code','is_day']],[d,['time','temperature_2m_max','temperature_2m_min']]]) {
      const [values,keys]=group;
      if(!keys.every(k=>Array.isArray(values[k])&&values[k].length>0&&values[k].length===values.time.length&&values[k].every(Number.isFinite))) throw new Error('Incomplete forecast response');
    }
    return data;
  }
  function render() {
    const now=Date.now();
    if(snapshot && now-snapshot.fetchedAt>maxCacheMs) snapshot=null;
    const status=el('weather-status');
    const stale=!!snapshot && (failed || now-snapshot.fetchedAt>staleMs || now-snapshot.data.current.time*1000>staleMs);
    status.textContent=loading ? 'UPDATING' : !snapshot ? 'UNAVAILABLE' : stale ? 'STALE' : 'LIVE';
    status.dataset.state=stale || (!snapshot&&!loading) ? 'warning' : '';
    el('weather-refresh').disabled=loading;
    if(!snapshot){
      el('weather-temperature').textContent='—';
      el('weather-condition').textContent=loading?'Fetching weather…':'Weather unavailable';
      ['weather-high','weather-low','weather-feels'].forEach(id=>el(id).textContent='—');
      el('forecast').replaceChildren();
      el('weather-updated').textContent=loading?'Connecting to Open-Meteo':'Check your connection and try Refresh.';
      return;
    }
    const {data,fetchedAt}=snapshot, c=data.current;
    const [description,symbol]=condition(c.weather_code,c.is_day);
    el('weather-condition').textContent=description;
    el('weather-symbol').setAttribute('href',`#${symbol}`);
    el('weather-temperature').textContent=temp(c.temperature_2m);
    const today=data.daily.time.findIndex(t=>dateKey(t)===dateKey(now/1000));
    el('weather-high').textContent=temp(data.daily.temperature_2m_max[today]);
    el('weather-low').textContent=temp(data.daily.temperature_2m_min[today]);
    el('weather-feels').textContent=temp(c.apparent_temperature);
    el('weather-updated').textContent=`${stale?'Last updated':'Updated'} ${time(fetchedAt/1000)} · ET`;
    el('weather-updated').title=`Model conditions at ${time(c.time)} Eastern. ${stale?'Data may be out of date.':'Refreshes every 15 minutes.'}`;
    const entries=[{label:'Now',value:c.temperature_2m,symbol}];
    data.hourly.time.forEach((t,i)=>{if(t*1000>now&&entries.length<5){entries.push({label:new Intl.DateTimeFormat('en-US',{timeZone:zone,hour:'numeric',...(format==='24'?{minute:'2-digit'}:{}),hour12:format==='12'}).format(new Date(t*1000)),value:data.hourly.temperature_2m[i],symbol:condition(data.hourly.weather_code[i],data.hourly.is_day[i])[1]});}});
    const forecast=el('forecast');forecast.replaceChildren();
    if(stale && now-c.time*1000>staleMs) return;
    entries.forEach(entry=>{const item=document.createElement('div');item.className='forecast-item';const label=document.createElement('span');label.textContent=entry.label;const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('aria-hidden','true');const use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href',`#${entry.symbol}`);svg.append(use);const value=document.createElement('b');value.textContent=temp(entry.value);item.append(label,svg,value);forecast.append(item);});
  }
  async function refresh() {
    if(loading || Date.now()<retryAt) return;
    loading=true;render();
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
    try {
      const response=await fetch(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});
      if(!response.ok) {
        const header=response.headers.get('Retry-After');
        const wait=header ? (Number.isFinite(Number(header))?Number(header)*1000:Date.parse(header)-Date.now()) : 0;
        retryAt=Date.now()+Math.max(30000,Number.isFinite(wait)?wait:0);
        throw new Error('Weather service unavailable');
      }
      const data=validate(await response.json());
      snapshot={data,fetchedAt:Date.now()};failed=false;
      try{localStorage.setItem(cacheKey,JSON.stringify(snapshot));}catch{}
    } catch {failed=true;} finally {clearTimeout(timer);loading=false;retryAt=Math.max(retryAt,Date.now()+30000);render();}
  }
  function start() {
    try{const cached=JSON.parse(localStorage.getItem(cacheKey)||'null');if(cached&&Number.isFinite(cached.fetchedAt)&&cached.fetchedAt<=Date.now()&&Date.now()-cached.fetchedAt<=maxCacheMs){validate(cached.data);snapshot=cached;}}catch{}
    el('weather-refresh').addEventListener('click',refresh);
    window.addEventListener('online',()=>{retryAt=0;refresh();});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&(!snapshot||Date.now()-snapshot.fetchedAt>=refreshMs))refresh();});
    refresh();setInterval(refresh,refreshMs);setInterval(render,60000);
  }
  return {start,setPreferences(next){unit=next.unit;format=next.format;render();},condition,validate};
})();

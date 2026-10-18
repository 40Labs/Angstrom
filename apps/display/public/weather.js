'use strict';
// Public weather only. No Google tokens or calendar data belong in this adapter.
window.AngstromWeather = (() => {
  const zone = 'America/New_York';
  const cacheKey = 'angstrom.weather.vestal.v2';
  const refreshMs = 15 * 60 * 1000;
  const staleMs = 60 * 60 * 1000;
  const maxCacheMs = 24 * 60 * 60 * 1000;
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({latitude:'42.08507',longitude:'-76.05381',timezone:zone,timeformat:'unixtime',temperature_unit:'fahrenheit',wind_speed_unit:'mph',precipitation_unit:'inch',current:'temperature_2m,apparent_temperature,weather_code,is_day,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,surface_pressure,precipitation,cloud_cover',hourly:'temperature_2m,apparent_temperature,weather_code,is_day,precipitation_probability,wind_speed_10m',daily:'temperature_2m_max,temperature_2m_min,sunrise,sunset,daylight_duration,precipitation_probability_max,weather_code',forecast_days:'5'});
  let snapshot = null, unit = 'f', format = '12', loading = false, failed = false, retryAt = 0;
  const el = id => document.getElementById(id);
  const temp = f => Number.isFinite(f) ? `${Math.round(unit === 'c' ? (f-32)*5/9 : f)}°` : '—';
  const time = seconds => !Number.isFinite(seconds) || seconds<=0 ? '—' : new Intl.DateTimeFormat('en-US',{timeZone:zone,hour:'numeric',minute:'2-digit',hour12:format==='12'}).format(new Date(seconds*1000));
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
    for (const [values, keys] of [[h,['apparent_temperature','precipitation_probability','wind_speed_10m']],[d,['sunrise','sunset','daylight_duration','precipitation_probability_max','weather_code']]]) {
      for (const key of keys) {
        const field=values[key];
        if(field!==undefined && (!Array.isArray(field)||field.length!==values.time.length||!field.every(v=>v===null||Number.isFinite(v)))) throw new Error('Invalid optional forecast field');
      }
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
      ['weather-high','weather-low','weather-feels','weather-sunrise','weather-sunset'].forEach(id=>el(id).textContent='—');
      el('forecast').replaceChildren();
      el('weather-updated').textContent=loading?'Connecting to Open-Meteo':'Check your connection and try Refresh.';
      renderDetails(null, now);
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
    el('weather-sunrise').textContent=time(data.daily.sunrise?.[today]);
    el('weather-sunset').textContent=time(data.daily.sunset?.[today]);
    renderDetails({data,fetchedAt,stale,today}, now);
    el('weather-updated').textContent=`${stale?'Last updated':'Updated'} ${time(fetchedAt/1000)} · ET`;
    el('weather-updated').title=`Model conditions at ${time(c.time)} Eastern. ${stale?'Data may be out of date.':'Refreshes every 15 minutes.'}`;
    const entries=[{label:'Now',value:c.temperature_2m,symbol}];
    data.hourly.time.forEach((t,i)=>{if(t*1000>now&&entries.length<5){entries.push({label:new Intl.DateTimeFormat('en-US',{timeZone:zone,hour:'numeric',...(format==='24'?{minute:'2-digit'}:{}),hour12:format==='12'}).format(new Date(t*1000)),value:data.hourly.temperature_2m[i],symbol:condition(data.hourly.weather_code[i],data.hourly.is_day[i])[1]});}});
    const forecast=el('forecast');forecast.replaceChildren();
    if(stale && now-c.time*1000>staleMs) return;
    entries.forEach(entry=>{const item=document.createElement('span');item.className='forecast-item';const label=document.createElement('span');label.textContent=entry.label;const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('aria-hidden','true');const use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href',`#${entry.symbol}`);svg.append(use);const value=document.createElement('b');value.textContent=temp(entry.value);item.append(label,svg,value);forecast.append(item);});
  }
  const number = (value, suffix='', digits=0) => Number.isFinite(value) ? `${value.toFixed(digits)}${suffix}` : '—';
  function textElement(tag, text, className) {
    const node=document.createElement(tag); node.textContent=text;
    if(className) node.className=className;
    return node;
  }
  function renderDetails(state, now) {
    const status=el('weather-detail-status');
    el('weather-detail-content').hidden=!state;
    if(!state){status.textContent=loading?'Fetching the latest weather…':'Weather is unavailable. Close this view and use Refresh to retry.';return;}
    const {data,fetchedAt,stale,today}=state, c=data.current;
    status.textContent=`${stale?'STALE · Last updated':'Updated'} ${time(fetchedAt/1000)} ET · Conditions at ${time(c.time)} ET${stale?' · Cached values may be out of date.':''}`;
    status.dataset.state=stale?'warning':'';
    el('detail-temperature').textContent=`${temp(c.temperature_2m)}${unit==='c'?'C':'F'}`;
    el('detail-condition').textContent=condition(c.weather_code,c.is_day)[0];
    el('detail-feels').textContent=`Feels like ${temp(c.apparent_temperature)}`;
    el('detail-sunrise').textContent=time(data.daily.sunrise?.[today]);
    el('detail-sunset').textContent=time(data.daily.sunset?.[today]);
    const daylight=data.daily.daylight_duration?.[today];
    el('detail-daylight').textContent=Number.isFinite(daylight)?`${Math.floor(daylight/3600)}h ${Math.floor(daylight%3600/60)}m`:'—';
    const metrics=el('weather-metrics'); metrics.replaceChildren();
    const windUnits=data.current_units?.wind_speed_10m==='mp/h'||data.current_units?.wind_speed_10m==='mph'?' mph':null;
    [['Humidity',number(c.relative_humidity_2m,'%')],['Wind',windUnits?number(c.wind_speed_10m,windUnits):'—'],['Wind gusts',windUnits?number(c.wind_gusts_10m,windUnits):'—'],['Precipitation',data.current_units?.precipitation==='inch'?number(c.precipitation,' in',2):'—'],['Pressure',number(c.surface_pressure,' hPa')],['Cloud cover',number(c.cloud_cover,'%')]].forEach(([label,value])=>{const cell=document.createElement('div');cell.append(textElement('dt',label),textElement('dd',value));metrics.append(cell);});
    const hourly=el('weather-hourly');hourly.replaceChildren();
    const expired=now-c.time*1000>staleMs;
    data.hourly.time.map((t,i)=>({t,i})).filter(({t})=>t*1000>=now).slice(0,12).forEach(({t,i})=>{
      if(expired)return;
      const row=document.createElement('tr');
      const values=[time(t),condition(data.hourly.weather_code[i],data.hourly.is_day[i])[0],temp(data.hourly.temperature_2m[i]),temp(data.hourly.apparent_temperature?.[i]),number(data.hourly.precipitation_probability?.[i],'%'),['mp/h','mph'].includes(data.hourly_units?.wind_speed_10m)?number(data.hourly.wind_speed_10m?.[i],' mph'):'—'];
      values.forEach((value,index)=>{const cell=textElement(index===0?'th':'td',value);if(index===0)cell.scope='row';row.append(cell);});hourly.append(row);
    });
    el('weather-hourly-empty').hidden=hourly.children.length>0;
    el('weather-hourly-empty').textContent=expired?'Forecast hidden until fresh weather is available.':'No upcoming hourly forecast available.';
    const daily=el('weather-daily');daily.replaceChildren();
    data.daily.time.forEach((t,i)=>{
      if(dateKey(t)<dateKey(now/1000) || daily.children.length>=5 || expired)return;
      const card=document.createElement('article');card.className='daily-card';
      const label=i===today?'Today':new Intl.DateTimeFormat('en-US',{timeZone:zone,weekday:'short',month:'short',day:'numeric'}).format(new Date(t*1000));
      card.append(textElement('h3',label),textElement('p',Number.isFinite(data.daily.weather_code?.[i])?condition(data.daily.weather_code[i],1)[0]:'Forecast','daily-condition'),textElement('p',`${temp(data.daily.temperature_2m_max[i])} / ${temp(data.daily.temperature_2m_min[i])}`,'daily-temperature'),textElement('p',`Precip. ${number(data.daily.precipitation_probability_max?.[i],'%')}`),textElement('p',`Rise ${time(data.daily.sunrise?.[i])}`),textElement('p',`Set ${time(data.daily.sunset?.[i])}`));daily.append(card);
    });
    if(!daily.children.length) daily.append(textElement('p',expired?'Forecast hidden until fresh weather is available.':'No upcoming daily forecast available.','detail-empty'));
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
  return {start,render,setPreferences(next){unit=next.unit;format=next.format;render();},condition,validate};
})();

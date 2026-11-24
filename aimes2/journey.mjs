const maximumYear = new Date().getUTCFullYear();
export function cleanJourney(value) {
  if (!value || typeof value !== 'object') return null;
  const name = String(value.name || '').trim().slice(0, 120);
  const lat = Number(value.lat), lon = Number(value.lon);
  if (!name || value.lat == null || value.lon == null || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat)>90 || Math.abs(lon)>180) return null;
  const period = String(value.period || '').trim();
  const validPeriod = /^(\d{4})(?:s|[- ]?luku)?$/.test(period) && Number(period.slice(0,4))>=1826 && Number(period.slice(0,4))<=maximumYear;
  return {name,lat,lon,article:String(value.article || name).slice(0,120),country:/^[A-Z]{2}$/.test(value.country || '')?value.country:'',period:validPeriod?period:''};
}
export function readJourney(address) {
  const p=new URL(address).searchParams;
  return cleanJourney({name:p.get('jname'),lat:p.get('jlat'),lon:p.get('jlon'),article:p.get('jarticle'),country:p.get('jcountry'),period:p.get('jperiod')});
}
export function withJourney(address, journey) {
  const url=new URL(address);
  for (const key of [...url.searchParams.keys()]) if(key.startsWith('j')&&['jname','jlat','jlon','jarticle','jcountry','jperiod'].includes(key))url.searchParams.delete(key);
  const state=cleanJourney(journey);
  if(state)for(const [key,value]of Object.entries(state))if(value!=='')url.searchParams.set('j'+key,String(value));
  return url;
}
export function finnishDay(date=new Date()) {
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Helsinki',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const get=key=>parts.find(p=>p.type===key).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function dailyIndex(date,count) {
  if(!Number.isInteger(count)||count<1)throw new Error('Empty discovery catalogue');
  const day=Math.floor(Date.parse(finnishDay(date)+'T00:00:00Z')/86400000);
  return ((day%count)+count)%count;
}
export function isPreview(address) {
  const url=new URL(address);
  return ['localhost','127.0.0.1','[::1]'].includes(url.hostname) || (/^[a-z0-9-]+\.aimes-fi\.pages\.dev$/.test(url.hostname)&&url.searchParams.get('preview')==='1');
}

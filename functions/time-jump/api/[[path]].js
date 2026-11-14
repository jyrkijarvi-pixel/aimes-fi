'use strict';

const ua = 'AIMESWorldExplorer/0.3 (+https://aimes.fi/time-jump/)';
const configuredSearch = 'https://nominatim.openstreetmap.org/search';
const regionNames = new Intl.DisplayNames(['fi'], { type: 'region', fallback: 'none' });
const englishRegions = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' });
const countryLabels = new Map();
const fold = value => String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().trim();
const unique = values => [...new Set(values.filter(Boolean))];

// Cloudflare Pages: load GeoNames shards as static assets on demand.
let countries = [];
const cityCaches = new Map();
let countriesPromise;
async function assetJson(ctx, filename) {
  if (!ctx.env.ASSETS) throw new Error('Cloudflare Assets binding missing');
  const url = new URL('/time-jump/data/' + filename, ctx.request.url);
  const response = await ctx.env.ASSETS.fetch(new Request(url, { method:'GET' }));
  if (!response.ok) throw new Error('Asset ' + filename + ' unavailable');
  return response.json();
}
async function ensureCountries(ctx) {
  if (!countriesPromise) countriesPromise = assetJson(ctx, 'countries.json').then(rows => {
    countries = rows;
    for (const [name, longName, code] of countries) {
      if (/^[A-Z]{2}$/.test(code)) countryLabels.set(code, unique([regionNames.of(code), englishRegions.of(code), name, longName]));
    }
  }).catch(error => { countriesPromise = null; throw error });
  return countriesPromise;
}
async function localSearch(query, ctx) {
  await ensureCountries(ctx);
  const [name, country] = query.split(',', 2).map(fold);
  const matches = [];
  for (const [short, long, code, lat, lon] of countries) {
    const aliases = [short, long, ...(countryLabels.get(code)||[])];
    if (aliases.some(label => fold(label) === name)) {
      matches.push({ name: aliases[2] || short, label: aliases[2] || short, lat, lon, kind: 'country', article: englishRegions.of(/^[A-Z]{2}$/.test(code) ? code : 'ZZ') || short, source: 'Natural Earth', score: 3e9 });
    }
  }
  const shard = /^[a-z]/.test(name) ? name[0] : '_';
  if (!cityCaches.has(shard)) cityCaches.set(shard, assetJson(ctx, `cities-${shard}.json`).catch(error => {cityCaches.delete(shard); throw error}));
  const cities = await cityCaches.get(shard);
  for (const [cityName, , lat, lon, code, population, keys] of cities) {
    const labels = countryLabels.get(code) || [regionNames.of(code) || code];
    if (country && !labels.some(label => fold(label).startsWith(country))) continue;
    const exact = keys.includes(name);
    if (!exact && (name.length < 3 || !keys.some(key => key.startsWith(name)))) continue;
    matches.push({ name:cityName, label:`${cityName}, ${labels[0]}`, lat, lon, kind:'place', source:'GeoNames', score:(exact ? 1e9 : 0) + population });
  }
  return matches.sort((a,b)=>b.score-a.score).slice(0,7).map(({score,...place})=>place);
}

const cache = new Map();
async function cached(key, loader, ttl = 900000) {
  const existing = cache.get(key);
  if (existing && existing.until > Date.now()) return existing.promise;
  const promise = Promise.resolve().then(loader);
  cache.set(key, { promise, until: Date.now() + ttl });
  if (cache.size > 256) cache.delete(cache.keys().next().value);
  try { return await promise; } catch (error) {
    if (cache.get(key)?.promise === promise) cache.delete(key);
    throw error;
  }
}

async function json(url) {
  const response = await fetch(url, { headers: { 'User-Agent': ua, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.code || 'Upstream error');
  return payload;
}

let nextSearchAt = 0;
let searchQueue = Promise.resolve();

function remoteSearch(query) {
  return cached(`osm:${fold(query)}`, () => {
    const request = searchQueue.then(async () => {
      await new Promise(resolve => setTimeout(resolve, Math.max(0, nextSearchAt - Date.now())));
      nextSearchAt = Date.now() + 1100;
      const url = new URL(configuredSearch);
      for (const [key, value] of Object.entries({ q: query, format: 'jsonv2', limit: 6, namedetails: 1, 'accept-language': 'fi,en' })) {
        url.searchParams.set(key, value);
      }
      const rows = await json(url);
      return rows.map(row => ({
        name: row.name || row.display_name.split(',')[0], label: row.display_name, lat: +row.lat, lon: +row.lon,
        kind: row.addresstype === 'country' ? 'country' : 'place',
        article: row.namedetails?.['name:en'] || row.name || '',
        source: 'OpenStreetMap'
      })).filter(row => Number.isFinite(row.lat) && Number.isFinite(row.lon));
    });
    searchQueue = request.catch(() => {});
    return request;
  }, 86400000);
}

async function search(query, ctx) {
  const local = await localSearch(query, ctx);
  try {
    const remote = await remoteSearch(query);
    for (const hit of remote) {
      if (!hit.article || fold(hit.article) === fold(hit.name)) {
        const match = local.find(candidate => candidate.kind === hit.kind && distance(candidate, hit) < (hit.kind === 'country' ? 250000 : 8000));
        if (match) hit.article = match.article || match.name;
      }
    }
    const others = local.filter(place => !remote.some(hit => distance(place, hit) < (place.kind === 'country' ? 250000 : 2000)));
    return { results: [...remote, ...others].slice(0, 9), online: true };
  } catch {
    return { results: local, online: false };
  }
}

function distance(a, b) {
  const rad = Math.PI / 180;
  const y = Math.sin((a.lat - b.lat) * rad / 2);
  const x = Math.sin((a.lon - b.lon) * rad / 2);
  const h = y*y + Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*x*x;
  return 12742000 * Math.asin(Math.sqrt(Math.min(1,h)));
}

function wiki(host, parameters) {
  return json(`https://${host}/w/api.php?${new URLSearchParams({ action: 'query', format: 'json', formatversion: 2, ...parameters })}`)
    .then(data => data.query?.pages || []);
}

function geo(point, radius, limit, namespace) {
  return { generator: 'geosearch', ggscoord: `${point.lat}|${point.lon}`, ggsradius: radius, ggslimit: limit, ggsnamespace: namespace };
}

const articleProps = { prop: 'extracts|info|coordinates|pageprops', exintro: 1, explaintext: 1, exsentences: 2, exlimit: 10, inprop: 'url', ppprop: 'disambiguation' };
function toArticle(page) {
  if (!page.fullurl || page.pageprops?.disambiguation !== undefined) return null;
  const coordinate = page.coordinates?.[0];
  return { title: page.title, url: page.fullurl, extract: page.extract || '', point: coordinate ? { lat: coordinate.lat, lon: coordinate.lon } : null };
}

async function articles(point) {
  const byGeo = await wiki('en.wikipedia.org', { ...geo(point, 10000, 10, 0), ...articleProps });
  const nearby = byGeo.map(toArticle).filter(article => article?.point)
    .map(article => ({ ...article, distance: Math.round(distance(point, article.point)) }))
    .sort((a, b) => a.distance - b.distance);
  const title = point.article || point.name;
  let main = nearby.find(article => fold(article.title) === fold(title));
  if (!main && title) {
    try {
      const rows = await wiki('en.wikipedia.org', { titles: title, redirects: 1, ...articleProps });
      const article = toArticle(rows[0] || {});
      if (article?.point && distance(point, article.point) < (point.kind === 'country' ? 650000 : 22000)) main = article;
    } catch { /* Nearby articles remain usable. */ }
  }
  return { main: main || null, nearby: nearby.filter(article => article.url !== main?.url).slice(0, 6) };
}

const mediaProps = {
  prop: 'imageinfo|coordinates', coprimary: 'all', iiprop: 'url|mime|extmetadata', iiurlwidth: '800',
  iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl|DateTimeOriginal|Categories|ObjectName|ImageDescription|Restrictions'
};

function plain(value) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/&([a-z]+|#\d+|#x[\da-f]+);/gi, (original, name) => {
    if (name[0] !== '#') return entities[name.toLowerCase()] ?? original;
    const code = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1));
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : original;
  }).replace(/\s+/g, ' ').trim();
}

function photo(page, point, radius) {
  const info = page.imageinfo?.[0];
  if (!info || !/^image\/(jpeg|png|webp)$/.test(info.mime)) return null;
  const meta = key => plain(info.extmetadata?.[key]?.value);
  const license = meta('LicenseShortName');
  const licenseUrl = meta('LicenseUrl');
  const artist = meta('Artist');
  const dates = meta('DateTimeOriginal');
  const categories = meta('Categories');
  const title = page.title.replace(/^File:/, '').replace(/\.[^.]+$/, '');
  const context = [title, categories, meta('ImageDescription')].join(' ');
  if (!/^(CC BY(?:-SA)?\b|CC0\b|Public domain\b|PDM\b)/i.test(license) || !artist) return null;
  if (/\b(map|locator map|illustration|rendering|logo|screenshot|diagram|coat of arms|flag|AI-generated|collage)\b/i.test(title) ||
      /AI-generated|AI generated|generated with (AI|Midjourney|DALL)|Photomontages|Photographs of maps|Screenshots of/i.test(categories)) return null;
  if (!dates && !/photograph|photos?|Unsplash|Flickr/i.test(context)) return null;
  const points = (page.coordinates || []).filter(c => c.globe === 'earth');
  const metres = Math.min(...points.map(c => distance(point, { lat: c.lat, lon: c.lon })));
  if (!(metres <= radius)) return null;
  const src = info.thumburl || info.url;
  if (!/^https:\/\/(?:upload|thumb)\.wikimedia\.org\//.test(src) || !/^https:\/\/commons\.wikimedia\.org\//.test(info.descriptionurl)) return null;
  const years = [...new Set(dates.match(/\b(?:18|19|20)\d{2}\b/g) || [])];
  const exactYear = years.length === 1 && !/circa|\bc\.\s|between|before|after|unknown|or |vers|\?|\bca\./i.test(dates) ? Number(years[0]) : null;
  const nearest = points.reduce((best, candidate) => {
    const d = distance(point, { lat:candidate.lat, lon:candidate.lon });
    return !best || d < best.metres ? { lat:candidate.lat, lon:candidate.lon, metres:d } : best;
  }, null);
  return { title, artist: artist.slice(0, 300), license, licenseUrl: /^https:\/\//.test(licenseUrl) ? licenseUrl : '', src, url: info.descriptionurl,
    date: dates.slice(0, 95), year: exactYear, distance: Math.round(metres),
    lat: nearest?.lat, lon: nearest?.lon, locationApprox: false, restrictions: meta('Restrictions').slice(0, 150) };
}

const helsinki = { lat: 60.174, lon: 24.934 };
const archive = {
  title: 'Helsingin olympialaisten avajaiset Olympiastadionilla', artist: 'Olympia-kuva Oy / Helsingin kaupunginmuseo',
  src: 'data/helsinki-1952-archive.jpg', url: 'https://commons.wikimedia.org/wiki/File:Helsingin_olympialaiset_1952_-_XLVIII-276_-_hkm.HKMS000005-km0000mrdm.jpg',
  original: 'https://www.finna.fi/Record/hkm.HKMS000005:km0000mrdm', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  date: '19.7.1952', year: 1952, lat:60.187, lon:24.927, locationApprox:true, distance:1500
};

async function pictures(point) {
  const radius = point.kind === 'country' ? 2500 : 5000;
  if (Math.abs(point.lat) >= 89.99) return [];
  const host = 'commons.wikimedia.org';
  const historical = point.year >= 1839 && point.year <= new Date().getFullYear();
  const parameters = historical
    ? { generator: 'search', gsrnamespace: 6, gsrlimit: 25, gsrsearch: `nearcoord:5km,${point.lat},${point.lon} ${point.year} filetype:bitmap` }
    : { ...geo(point, radius, 22, 6), ggsprimary: 'all' };
  const pages = await wiki(host, { ...parameters, ...mediaProps });
  return pages.map(page => photo(page, point, radius)).filter(item => item && (point.year === null || item.year === point.year))
    .sort((a,b) => a.distance - b.distance).slice(0, 6);
}

async function place(point) {
  const demo = point.year === 1952 && distance(point, helsinki) <= 16000;
  const key = JSON.stringify(point);
  const [wikiResult, commonsResult] = await Promise.allSettled([
    cached(`wiki:${JSON.stringify({ ...point, year: null })}`, () => articles(point)),
    point.year !== null && (point.year < 1839 || point.year > new Date().getFullYear()) ? Promise.resolve([]) : cached(`media:${key}`, () => pictures(point))
  ]);
  const photos = commonsResult.value || [];
  return {
    demo, photos: demo ? [archive, ...photos.filter(image => image.url !== archive.url)].slice(0, 6) : photos,
    wiki: wikiResult.value || { main: null, nearby: [] }, availability: { wiki: wikiResult.status === 'fulfilled', photos: commonsResult.status === 'fulfilled' }
  };
}



const apiHeaders = {
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'strict-origin-when-cross-origin'
};
const respond=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:apiHeaders});
function parsePoint(params) {
  const rawLat=params.get('lat'),rawLon=params.get('lon');
  const lat=Number(rawLat),lon=Number(rawLon);
  const rawYear=params.get('year')||'';
  const year=rawYear ? Number(rawYear):null;
  if(rawLat===null||rawLon===null||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180||
    (year!==null&&(!Number.isInteger(year)||year===0||Math.abs(year)>100000)))return null;
  return {lat:+lat.toFixed(5),lon:+lon.toFixed(5),year,
    name:(params.get('name')||'').slice(0,140),article:(params.get('article')||'').slice(0,140),
    kind:params.get('kind')==='country'?'country':'place'};
}
export async function onRequest(ctx) {
  if(ctx.request.method!=='GET')return respond({error:'Vain GET-pyynnöt.'},405);
  try {
    const url=new URL(ctx.request.url);
    const route=url.pathname.replace(/\/$/,'').split('/').pop();
    if(route==='search') {
      const q=(url.searchParams.get('q')||'').trim();
      if(q.length<2||q.length>140)return respond({error:'Anna 2–140 merkkiä.'},400);
      return respond(await search(q,ctx));
    }
    if(route==='place') {
      const p=parsePoint(url.searchParams);
      if(!p)return respond({error:'Tarkista koordinaatit ja vuosi.'},400);
      return respond(await place(p));
    }
    return respond({error:'Ei löydy.'},404);
  }catch(err){return respond({error:'Tietojen lataus epäonnistui.'},503)}
}

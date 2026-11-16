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
async function localSearch(query, ctx, countryCode = '') {
  await ensureCountries(ctx);
  const [name, country] = query.split(',', 2).map(fold);
  const matches = [];
  for (const [short, long, code, lat, lon] of countries) {
    const aliases = [short, long, ...(countryLabels.get(code)||[])];
    if (!countryCode && aliases.some(label => fold(label) === name)) {
      matches.push({ name: aliases[2] || short, label: aliases[2] || short, lat, lon, kind: 'country', article: englishRegions.of(/^[A-Z]{2}$/.test(code) ? code : 'ZZ') || short, source: 'Natural Earth', score: 3e9 });
    }
  }
  const shard = /^[a-z]/.test(name) ? name[0] : '_';
  if (!cityCaches.has(shard)) cityCaches.set(shard, assetJson(ctx, `cities-${shard}.json`).catch(error => {cityCaches.delete(shard); throw error}));
  const cities = await cityCaches.get(shard);
  for (const [cityName, , lat, lon, code, population, keys] of cities) {
    if (countryCode && code !== countryCode) continue;
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

function remoteSearch(query, countryCode) {
  return cached(`osm:${countryCode}:${fold(query)}`, () => {
    const request = searchQueue.then(async () => {
      await new Promise(resolve => setTimeout(resolve, Math.max(0, nextSearchAt - Date.now())));
      nextSearchAt = Date.now() + 1100;
      const url = new URL(configuredSearch);
      for (const [key, value] of Object.entries({ q: query, format: 'jsonv2', limit: 6, namedetails: 1, 'accept-language': 'fi,en' })) {
        url.searchParams.set(key, value);
      }
      if (countryCode) url.searchParams.set('countrycodes', countryCode.toLowerCase());
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

async function search(query, ctx, countryCode = '') {
  const local = await localSearch(query, ctx, countryCode);
  try {
    const remote = await remoteSearch(query, countryCode);
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
function toArticle(page, language) {
  if (!page.fullurl || page.pageprops?.disambiguation !== undefined) return null;
  const coordinate = page.coordinates?.[0];
  return { title: page.title, url: page.fullurl, extract: page.extract || '', language, point: coordinate ? { lat: coordinate.lat, lon: coordinate.lon } : null };
}

async function articlesInLanguage(point, language) {
  const host = language + '.wikipedia.org';
  const byGeo = await wiki(host, { ...geo(point, 10000, 10, 0), ...articleProps });
  const nearby = byGeo.map(page => toArticle(page, language)).filter(article => article?.point)
    .map(article => ({ ...article, distance: Math.round(distance(point, article.point)) }))
    .sort((a, b) => a.distance - b.distance);
  const title = language === 'fi' ? point.name || point.article : point.article || point.name;
  let main = nearby.find(article => fold(article.title) === fold(title));
  if (!main && title) {
    try {
      const rows = await wiki(host, { titles: title, redirects: 1, ...articleProps });
      const article = toArticle(rows[0] || {}, language);
      if (article?.point && distance(point, article.point) < (point.kind === 'country' ? 650000 : 22000)) main = article;
    } catch { /* Nearby articles remain usable. */ }
  }
  return { main: main || null, nearby: nearby.filter(article => article.url !== main?.url).slice(0, 6) };
}

async function articles(point, language = 'fi') {
  const results = await Promise.allSettled([language, language === 'fi' ? 'en' : 'fi'].map(lang => articlesInLanguage(point, lang)));
  const [primary, fallback] = results.map(result => result.value);
  if (!primary && !fallback) throw results[0].reason;
  const main = primary?.main || fallback?.main || null;
  const seen = new Set([primary?.main, fallback?.main].filter(Boolean).map(article => fold(article.title)));
  const candidates = [...primary?.nearby || [], ...fallback?.nearby || []].sort((a,b) => a.distance - b.distance);
  const nearby = [];
  for (const article of candidates) {
    const key = fold(article.title);
    if (seen.has(key)) continue;
    seen.add(key);
    nearby.push(article);
    if (nearby.length === 6) break;
  }
  return { main, nearby };
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

function mediaCategory(context) {
  // Categories guide presentation only: nothing is excluded for being a grave, portrait or interior.
  const words = fold(context);
  if (/\b(gravestone|tombstone|grave|cemetery|cemeteries|memorial|hauta|hautaus|muistomerkki|headstone)\b/.test(words)) return 'memory';
  if (/\b(map|maps|kartta|kartat|atlas|plans|plan of|city plan)\b/.test(words)) return 'maps';
  if (/\b(interior|interiors|indoor|inside|kitchen|classroom|living room|interieur|sisakuva|sisatilat|keittio|olohuone)\b/.test(words)) return 'interior';
  if (/\b(portrait|portraits|people|person|people of|family|families|muotokuva|perhe|henkilo|henkilot)\b/.test(words)) return 'people';
  if (/\b(street|streets|buildings|building|architecture|roads|road|town|village|church|school|market|kauppa|koulu|raitti|keskusta|katu|kirkko|kyla|ilmakuva|aerial|landscape|maisema)\b/.test(words)) return 'places';
  return 'other';
}
function photo(page, point, radius, named = false, eras = false, photographTemplate = false) {
  const info = page.imageinfo?.[0];
  if (!info || (!/^image\/(jpeg|png|webp)$/.test(info.mime) &&
      !(eras && info.mime === 'image/tiff' && /\.jpe?g(?:\?|$)/i.test(info.thumburl || '')))) return null;
  const meta = key => plain(info.extmetadata?.[key]?.value);
  const license = meta('LicenseShortName');
  const licenseUrl = meta('LicenseUrl');
  const artist = meta('Artist');
  const dateMetadata = String(info.extmetadata?.DateTimeOriginal?.value || '');
  const dates = eras ? plain(dateMetadata.replace(/<div\b[^>]*>\s*date QS:[\s\S]*?<\/div>/gi, '')) : meta('DateTimeOriginal');
  const categories = meta('Categories');
  const title = page.title.replace(/^File:/, '').replace(/\.[^.]+$/, '');
  const description = meta('ImageDescription');
  const context = [title, categories, description].join(' ');
  if (!/^(CC BY(?:-SA)?\b|CC0\b|Public domain\b|PDM\b)/i.test(license)) return null;
  if (!artist && /^(CC BY(?:-SA)?\b)/i.test(license)) return null;
  if (/AI.generated|generated with (AI|Midjourney|DALL)|Photomontages created by AI/i.test(context)) return null;
  const points = (page.coordinates || []).filter(c => c.globe === 'earth' && Number.isFinite(c.lat) && Number.isFinite(c.lon));
  const nearest = points.reduce((best, candidate) => {
    const metres = distance(point, { lat:candidate.lat, lon:candidate.lon });
    return !best || metres < best.metres ? { lat:candidate.lat, lon:candidate.lon, metres } : best;
  }, null);
  // A title containing the place name is a useful lead, not verified geographic evidence.
  const localNames = eras ? commonsNames(point) : [(point.name || '').split(',')[0]];
  const titleNamesPlace = localNames.some(name => fold(name).length >= 4 && fold(title).includes(fold(name)));
  const categoryNames = new Set(categories.split('|').map(value => fold(value).replace(/^\d{4} in /,'')));
  const categoryNamesPlace = eras && localNames.some(name => categoryNames.has(fold(name)));
  if (named && !titleNamesPlace && !categoryNamesPlace) return null;
  if (eras && nearest && nearest.metres > 15000) return null;
  if (!named && (!nearest || nearest.metres > radius)) return null;
  const src = info.thumburl || info.url;
  if (!/^https:\/\/(?:upload|thumb)\.wikimedia\.org\//.test(src) || !/^https:\/\/commons\.wikimedia\.org\//.test(info.descriptionurl)) return null;
  const years = [...new Set((dates.match(/\b(?:18|19|20)\d{2}\b/g) || []))];
  const exactYear = years.length === 1 && !/circa|\bc\.\s|between|before|after|unknown|or |vers|\?|\bca\./i.test(dates) ? Number(years[0]) : null;
  const category = mediaCategory(context);
  const isIllustration = /\b(drawing|illustration|painting|sketch|engraving|piirros|maalaus|kaiverrus)\b/i.test(context);
  if (eras && (category === 'maps' || isIllustration ||
      /\b(flag|logo|coat of arms|icon|screenshot|diagram|postage stamp|book cover|poster)\b/i.test(title) ||
      !(photographTemplate || /photograph|\bphotos?\b|valokuva|negatiiv|flickr|daguerreotype|albumen/i.test(context)))) return null;
  const kind = category === 'maps' ? 'Kartta' : isIllustration ? 'Piirros tai kuvitus' : 'Kuva-aineisto';
  const evidence = nearest && nearest.metres <= radius ? 'coordinates' : categoryNamesPlace ? 'category' : 'title';
  return {
    title, artist: (artist || 'Tekijää ei ilmoitettu').slice(0, 300), license,
    licenseUrl: /^https:\/\//.test(licenseUrl) ? licenseUrl : '',
    src, url: info.descriptionurl, date:dates.slice(0, 95), year:exactYear,
    distance:nearest ? Math.round(nearest.metres) : null,
    lat: evidence === 'coordinates' ? nearest?.lat : null, lon: evidence === 'coordinates' ? nearest?.lon : null,
    locationApprox:false, locationEvidence:evidence, category, kind,
    restrictions:meta('Restrictions').slice(0, 150)
  };
}

const helsinki = { lat: 60.174, lon: 24.934 };
const archive = {
  title: 'Helsingin olympialaisten avajaiset Olympiastadionilla', artist: 'Olympia-kuva Oy / Helsingin kaupunginmuseo',
  src: 'data/helsinki-1952-archive.jpg', url: 'https://commons.wikimedia.org/wiki/File:Helsingin_olympialaiset_1952_-_XLVIII-276_-_hkm.HKMS000005-km0000mrdm.jpg',
  original: 'https://www.finna.fi/Record/hkm.HKMS000005:km0000mrdm', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  date: '19.7.1952', year: 1952, lat:60.187, lon:24.927, locationApprox:true, distance:1500, category:'people', kind:'Valokuva', locationEvidence:'coordinates'
};

// Museovirasto credits the collection and leaves the photographer field blank.
// Each record describes the same border area and dates its own photograph to 1954.
const punkalaidun1954 = [
  '8132C068D723B68525B5EA74916A8C75','EF13583BAD7D1ABDBA6F1B13A107E2D4',
  '3CE6AEB305936F127E87FFC0AACD53CB','89A512CA6F8C48D45A3FBFE818C7E303',
  'FDCAC1FD3D78189262A3042C7F0ECB21'
].map((id,index) => {
  const record = 'museovirasto.'+id;
  return {
    title:'Ravustus Huittisten ja Punkalaitumen rajamailla · JOKAUAS2 2438:'+(index+1),
    date:'1954', artist:'Museovirasto / JOKA Journalistinen kuva-arkisto / UA Saarisen kokoelma',
    artistUnspecified:true, locationEvidence:'archive', license:'CC BY 4.0',
    licenseUrl:'https://creativecommons.org/licenses/by/4.0/',
    original:'https://www.finna.fi/Record/'+record,
    url:'https://commons.wikimedia.org/wiki/File:'+encodeURIComponent(
      'Crabbing has started on the borderland of Huittinen and Punkalaidun 1954 (JOKAUAS2 2438-'+(index+1)+').tif'),
    src:'https://www.finna.fi/Cover/Show?source=Solr&id='+record+'&index=0&size=medium'
  };
});

function commonsNames(point) {
  const names = unique([point.alias, point.name, point.article].map(name => name?.split(',')[0].trim()));
  return names.filter(name => name.length >= 4 && name.length <= 45 && /^[\p{L}\p{N}\s\-']+$/u.test(name));
}

async function pictures(point, eras = false) {
  const radius = point.kind === 'country' ? 2500 : 5000;
  if (Math.abs(point.lat) >= 89.99) return [];
  const host = 'commons.wikimedia.org';
  const requests = [
    // All dates and categories: historical dates must not erase other valuable source material.
    wiki(host, { ...geo(point, radius, 48, 6), ggsprimary:'all', ...mediaProps })
  ];
  // Also look for source files whose titles mention the place, even if they lack geo tags.
  const names = commonsNames(eras ? point : {name:point.name});
  if (point.kind !== 'country' && names.length) {
    const title = 'intitle:"'+names[0]+'"';
    requests.push(wiki(host, {
      generator:'search', gsrnamespace:6, gsrlimit:30,
      gsrsearch:title+' filetype:bitmap',
      ...mediaProps
    }));
    if (eras) requests.push(wiki(host, {
      generator:'search', gsrnamespace:6, gsrlimit:48,
      gsrsearch:title+' filetype:bitmap hastemplate:Photograph',
      ...mediaProps
    }));
  }
  if (eras) requests.push(wiki(host, {
    generator:'search', gsrnamespace:6, gsrlimit:40,
    gsrsearch:`nearcoord:5km,${point.lat},${point.lon} filetype:bitmap hastemplate:Photograph`,
    ...mediaProps
  }));
  const settled = await Promise.allSettled(requests);
  if (settled.every(r => r.status === 'rejected')) throw new Error('Wikimedia Commons ei vastannut.');
  const imageBySource = new Map();
  settled.forEach((result, sourceIndex) => {
    if (result.status !== 'fulfilled') return;
    for (const page of result.value) {
      const archiveSearch = eras && sourceIndex === requests.length-1;
      const image = photo(page, point, radius, sourceIndex > 0 && !archiveSearch, eras, archiveSearch || (eras && names.length > 0 && sourceIndex === 2));
      if (!image) continue;
      const previous = imageBySource.get(image.url);
      // Prefer verified coordinates if another search found the same photo without them.
      if (!previous || (previous.locationEvidence !== 'coordinates' && image.locationEvidence === 'coordinates')) {
        imageBySource.set(image.url, image);
      }
    }
  });
  if (eras) return { photos:[...imageBySource.values()], requests:requests.length, succeeded:settled.filter(r=>r.status === 'fulfilled').length };
  const selectedYear = point.year;
  const score = image => {
    const yearGap = selectedYear == null || image.year == null ? null : Math.abs(selectedYear - image.year);
    const period = yearGap === 0 ? 320 : yearGap !== null && yearGap <= 10 ? 175 : yearGap !== null && yearGap <= 30 ? 95 : 0;
    const placeConfidence = image.locationEvidence === 'coordinates' ? 90 : 60;
    const distanceBonus = Number.isFinite(image.distance) ? Math.max(0, 40 - image.distance / 200) : 0;
    return period + placeConfidence + distanceBonus;
  };
  return [...imageBySource.values()]
    .sort((a,b) => score(b)-score(a) || (a.distance ?? Infinity)-(b.distance ?? Infinity) || a.title.localeCompare(b.title))
    .slice(0, 24);
}

async function place(point) {
  const demo = point.year === 1952 && distance(point, helsinki) <= 16000;
  const key = JSON.stringify(point);
  const [wikiResult, commonsResult] = await Promise.allSettled([
    cached(`wiki:${JSON.stringify({ ...point, year: null })}`, () => articles(point)),
    cached(`media:${key}`, () => pictures(point))
  ]);
  const photos = commonsResult.value || [];
  return {
    demo, photos: demo ? [archive, ...photos.filter(image => image.url !== archive.url)].slice(0, 24) : photos,
    wiki: wikiResult.value || { main: null, nearby: [] }, availability: { wiki: wikiResult.status === 'fulfilled', photos: commonsResult.status === 'fulfilled' }
  };
}

// Capture dates only. A date in a title, upload record or Wikipedia article is never input.
function captureDate(raw) {
  const value = raw.trim();
  const unknown = { precision:'unknown', start:null, end:null };
  const valid = year => year >= 1826 && year <= new Date().getUTCFullYear();
  const exact = value.match(/^(\d{4})(?:[-:]\d{2}(?:[-:]\d{2})?(?:[ T]\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})?)?)?$/);
  if (exact && valid(+exact[1])) return { precision:'exact', start:+exact[1], end:+exact[1] };
  const decade = value.match(/^(\d{3})0\s*(?:s|[-– ]?luku(?:a|lla)?)$/i);
  if (decade && valid(+decade[1]*10)) return { precision:'approximate', start:+decade[1]*10, end:Math.min(+decade[1]*10+9,new Date().getUTCFullYear()) };
  const range = value.match(/^(?:between\s+)?(\d{4})\s*(?:[–—/-]|and|to)\s*(\d{4})$/i);
  if (range && valid(+range[1]) && valid(+range[2]) && +range[1]<=+range[2]) return { precision:'approximate', start:+range[1], end:+range[2] };
  const circa = value.match(/^(?:circa|approx\.?|around|ca\.?|c\.|noin|n\.|vers)\s*(\d{4})$/i);
  if (circa && valid(+circa[1])) return { precision:'approximate', start:+circa[1], end:+circa[1], uncertain:true };
  return unknown;
}

async function eras(point, language) {
  const key = JSON.stringify(point);
  const started = Date.now();
  const [history, wikiData] = await Promise.allSettled([
    cached(`era-media:${key}`, () => pictures(point, true)),
    eraWiki(point, language)
  ]);
  const media = [...history.value?.photos || []];
  if (/^punkalaidun$/i.test(point.name) && distance(point,{lat:61.1158,lon:23.0994})<=15000) {
    media.unshift(...punkalaidun1954);
  }
  if (distance(point, helsinki) <= 3000 && /^(helsinki|helsingfors)$/i.test(point.name)) {
    const index = media.findIndex(image => image.url === archive.url);
    const record = { ...archive, src:'/time-jump/' + archive.src, date:'1952-07-19' };
    if (index >= 0) media.splice(index, 1);
    const market = [
      ['Kolera-allas, Kauppatori','Arvo Kajantie','kolera-allas.webp','1950–1959','hkm.87455276-66CB-47DF-98AF-DF2A3EA7C062'],
      ['Kaupungintalo ja Kauppatori','Börje Dilén','kaupungintalo-1952.webp','1952','hkm.429E061A-83E3-4F8C-AFE2-AACC8CA07B86']
    ].map(([title, artist, file, date, id])=>({
      title,artist:artist+' / Helsingin kaupunginmuseo',date,locationEvidence:'archive',
      src:'/time-jump/helsinki-1952-photo/'+file, original:'https://www.finna.fi/Record/'+id,
      license:'Public Domain Mark',licenseUrl:'https://creativecommons.org/publicdomain/mark/1.0/'
    }));
    media.unshift(record,...market);
  }
  const photos = media.map(image => ({ ...image, capture:captureDate(image.date) }));
  const counts = new Map();
  for (const image of photos) {
    const { precision,start,end,uncertain } = image.capture;
    // A cross-decade range or circa-year cannot substantiate a particular decade.
    const decade = Math.floor(start/10)*10;
    if (image.locationEvidence === 'title'||precision === 'unknown'||uncertain||end>=decade+10) continue;
    const count = counts.get(decade) || { decade, exact:0, approximate:0 };
    count[precision]++;
    counts.set(decade,count);
  }
  return {
    photos, decades:[...counts.values()].sort((a,b)=>a.decade-b.decade),
    wiki:wikiData.value || { main:null, nearby:[] },
    availability:{ photos:history.status==='fulfilled', wiki:wikiData.status==='fulfilled' },
    diagnostics:{ commonsBatches:history.value?.requests ?? 0, succeeded:history.value?.succeeded ?? 0, serverMs:Date.now()-started }
  };
}

function eraWiki(point, language) {
  const { alias, ...wikiPoint } = point;
  return cached(`era-wiki:${language}:${JSON.stringify(wikiPoint)}`, () => articles(wikiPoint, language));
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
      const country = (url.searchParams.get('country') || '').toUpperCase();
      if(country && !/^[A-Z]{2}$/.test(country))return respond({error:'Virheellinen maatunnus.'},400);
      return respond(await search(q,ctx,country));
    }
    if(route==='eras' || route==='era-wiki') {
      const point=parsePoint(url.searchParams);
      if(!point || !point.name || point.kind==='country')return respond({error:'Valitse paikka.'},400);
      const language = url.searchParams.get('lang')==='en'?'en':'fi';
      if(route==='era-wiki')return respond(await eraWiki({ ...point, year:null },language));
      return respond(await eras({ ...point, alias:(url.searchParams.get('alias') || '').slice(0,45), year:null },language));
    }
    if(route==='place') {
      const p=parsePoint(url.searchParams);
      if(!p)return respond({error:'Tarkista koordinaatit ja vuosi.'},400);
      return respond(await place(p));
    }
    return respond({error:'Ei löydy.'},404);
  }catch(err){return respond({error:'Tietojen lataus epäonnistui.'},503)}
}

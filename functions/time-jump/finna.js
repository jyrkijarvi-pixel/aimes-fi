// Finna metadata is CC0. Image rights are separate and checked per image.
const fields = ['id','title','formats','fullRecord','rawData','imagesExtended','subjectPlaces',
  'nonPresenterAuthors','institutions','dedupIds','subjects'];
const list = value => Array.isArray(value) ? value : value ? [value] : [];
const fold = value => String(value || '').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().trim();
const unique = values => [...new Set(values.filter(Boolean))];
const text = value => String(value || '').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&')
  .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
function tags(xml,name) {
  const pattern = new RegExp('<(?:\\w+:)?'+name+'\\b[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?'+name+'>','g');
  return [...String(xml || '').matchAll(pattern)].map(match=>match[1]);
}

export async function searchFinna({names,period,page=1,cached=(_key,load)=>load()}) {
  const url = new URL('https://api.finna.fi/v1/search');
  // Quoted phrases keep user input out of Solr query syntax.
  const quote = value => '"'+value.replace(/[\\"]/g,' ')+'"';
  url.searchParams.set('lookfor',names.length ? names.map(quote).join(' OR ') : '');
  const limit=24;
  url.searchParams.set('limit',String(limit));
  url.searchParams.set('page',String(page));
  url.searchParams.set('sort','relevance');
  url.searchParams.append('filter[]','format:"1/Image/Photo/"');
  url.searchParams.append('filter[]','online_boolean:"1"');
  if (period) {
    const end = period.year + (period.decade ? 9 : 0);
    url.searchParams.append('filter[]','search_daterange_mv:"['+period.year+' TO '+end+']"');
  }
  for (const field of fields) url.searchParams.append('field[]',field);
  const started=Date.now();
  const queries=[];
  if(names.length) {
    const geographic=new URL(url);
    geographic.searchParams.set('lookfor',names.map(name=>'geographic:'+quote(name)).join(' OR '));
    queries.push(geographic);
  }
  queries.push(url);
  let requests=0;
  const batches=await Promise.allSettled(queries.map(query=>cached('finna:'+query.href,async()=>{
    requests++;
    const response=await fetch(query,{signal:AbortSignal.timeout(9000),headers:{Accept:'application/json'}});
    if (!response.ok) throw Error('Finna '+response.status);
    const data=await response.json();
    if (data.status!=='OK' || !Array.isArray(data.records)) throw Error('Finna response');
    return data;
  })));
  const successful=batches.filter(batch=>batch.status==='fulfilled').map(batch=>batch.value);
  if(!successful.length)throw Error('Finna unavailable');
  const records=new Map();
  for(let index=0;index<limit;index++)for(const data of successful) {
    const record=data.records[index];
    if(record&&!records.has(record.id))records.set(record.id,record);
  }
  const partial=successful.length<queries.length;
  const more=successful.some(data=>data.resultCount>page*limit);
  return {
    records:[...records.values()],total:successful.at(-1).resultCount,
    ms:Date.now()-started,query:url.href,requests,
    queries:queries.map((query,index)=>({url:query.href,total:batches[index].value?.resultCount ?? null})),
    page,nextPage:partial?page:more&&page<4166?page+1:null,partial
  };
}

export function finnaPhoto(record,{point,names,code,countryNames,cities,boundary,withinCountry,distance,captureDate}) {
  if (!record.formats?.some(format=>format.value==='1/Image/Photo/')) return null;
  // Only creation/capture events of photographs, never acquisition/use or a generic record year.
  const events=tags(record.fullRecord,'event').filter(event=>
    tags(event,'eventType').some(type=>/\b(creation|valmistus|kuvaus|photographing|photography)\b/i.test(text(type))));
  const dateValues=unique(events.flatMap(event=>tags(event,'eventDate').flatMap(date=>tags(date,'displayDate')))
    .map(text).filter(Boolean));
  const date = dateValues[0] || '';
  const cleanDate = value => value.replace(/^(?:kuvausaika|valmistusaika|kuvaus|valmistus)\s*:?\s*/i,'').trim();
  let capture=captureDate(cleanDate(date));
  const knownDates=dateValues.map(value=>captureDate(cleanDate(value))).filter(value=>value.start!==null);
  if (knownDates.some(value=>value.start!==capture.start || value.end!==capture.end || Boolean(value.uncertain)!==Boolean(capture.uncertain))) {
    capture={precision:'unknown',start:null,end:null};
  }
  const eventPlaces=unique(events.flatMap(event=>tags(event,'eventPlace').flatMap(place=>tags(place,'displayPlace'))).map(text));
  const places=eventPlaces.length ? eventPlaces : unique([...list(record.subjectPlaces),...list(record.rawData?.geographic)].map(text));
  const locationTokens=unique(places.flatMap(place=>fold(place).split(/\s*(?:,|;|\s-\s)\s*/)));
  const aliases=names.map(fold);
  const matchesPlace=point && aliases.some(name=>locationTokens.includes(name));
  const eventPositions=events.flatMap(event=>tags(event,'eventPlace').flatMap(place=>tags(place,'pos')))
    .map(pos=>text(pos).split(/\s+/).map(Number))
    .filter(([lat,lon])=>Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180&&(lat!==0||lon!==0))
    .map(([lat,lon])=>({lat,lon}));
  const indexedPositions=list(record.rawData?.location_geo).flatMap(value=>{
    const match=String(value).match(/^POINT\((-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\)$/);
    if(!match)return [];
    const lon=Number(match[1]),lat=Number(match[2]);
    return Math.abs(lat)<=90&&Math.abs(lon)<=180&&(lat!==0||lon!==0)?[{lat,lon}]:[];
  });
  const positions=eventPositions.length?eventPositions:indexedPositions;
  const nearest=point ? positions.map(pos=>({...pos,metres:distance(point,pos)})).sort((a,b)=>a.metres-b.metres)[0] : positions[0];
  const conflictingLocality=locationTokens.some(token=>!aliases.includes(token)&&!countryNames.has(token)&&Object.hasOwn(cities,token));
  // Explicit municipality metadata can cover rural locations beyond the town-centre radius.
  if (point && (nearest ? nearest.metres>15000&&(!matchesPlace||conflictingLocality) : !matchesPlace)) return null;
  const explicitCountries=locationTokens.flatMap(token=>countryNames.get(token) || []);
  const cityCountries=locationTokens.flatMap(token=>Object.hasOwn(cities,token)?cities[token]:[]);
  if (code && (nearest && boundary ? !withinCountry(nearest,boundary)
    : explicitCountries.length ? !explicitCountries.includes(code) : !cityCountries.includes(code))) return null;
  // A village named Somero in a different municipality must not match the town of Somero.
  if (point && !nearest && matchesPlace) {
    if (conflictingLocality) return null;
  }
  const image=record.imagesExtended?.[0];
  const rights=image?.rights || {};
  const copyright=text(rights.copyright);
  const licenseUrl=String(rights.link || '').replace(/^http:/,'https:');
  // NC/ND and unassessed rights are source-link-only in this prototype.
  const permitted=/^(?:CC0(?: 1\.0)?|PDM|Public Domain(?: Mark)?|CC BY(?:-SA)? [1-4]\.0)$/i.test(copyright) &&
    /^https:\/\/creativecommons\.org\/(?:licenses\/(?:by|by-sa)\/[1-4]\.0|publicdomain\/(?:zero|mark)\/1\.0)(?:\/|$)/i.test(licenseUrl);
  const preview=image?.urls?.medium || image?.urls?.small;
  const previewUrl=preview ? new URL(preview,'https://api.finna.fi') : null;
  const authors=list(record.nonPresenterAuthors).map(author=>text([author.name,author.role].filter(Boolean).join(', ')));
  if (!authors.length) authors.push(...list(record.rawData?.photographer_str_mv || record.rawData?.author).map(text));
  const institution=unique([...list(record.institutions).map(item=>text(typeof item==='string'?item:item.translated || item.value)),
    ...list(record.rawData?.institution).map(text)]);
  const url='https://www.finna.fi/Record/'+encodeURIComponent(record.id);
  return {
    title:text(record.title),date,capture,
    artist:authors.join(' · ') || 'Tekijää ei ilmoitettu',institution:institution.join(' · '),
    license:copyright || 'Unknown',licenseUrl:/^https:\/\//.test(licenseUrl)?licenseUrl:'',
    restrictions:list(rights.description).map(text).join(' ').slice(0,2400),
    src:permitted&&previewUrl?.protocol==='https:'&&previewUrl.hostname==='api.finna.fi'?previewUrl.href:null,
    url,original:url,source:'finna',finnaIds:unique([record.id,...list(record.dedupIds)]),
    locationEvidence:nearest?(eventPositions.length?'finnaCoordinates':'finnaIndexedCoordinates'):eventPlaces.length?'finnaEventPlace':places.length?'finnaSubject':'unknownPlace',
    locationApprox:Boolean(nearest&&!eventPositions.length),
    placeLabel:places[0] || '',lat:nearest?.lat ?? null,lon:nearest?.lon ?? null,
    dateEvidence:dateValues.join(' · '),dateMissing:!date,previewRestricted:!permitted,
    identifiers:list(record.rawData?.identifier).map(text),
    subjects:unique(list(record.subjects).flat().map(text)).slice(0,24),
    kind:'Valokuva',category:'other'
  };
}

export function photoTopic(image) {
  const words=fold([image.title,...image.subjects || []].join(' '));
  if(/\b(church|churches|sacristy|kirkko|kirkot|sakaristo|kivisakaristo|kyrka|kyrkor)\b/.test(words))return 'religion';
  if(/\b(kudonta|kudontaa|kutomot|teollisuus|lasiteollisuus|lasitehtaat|tehtaat|tehdas|punonta|punontaa|tyo|kasityot|industry|factory|weaving|crafts)\b/.test(words))return 'work';
  if(/\b(postitalo|postitalot|posti|postitoimistot|postitoimipaikat|postiauto|junat|rautatiet|tasoristeys|liikenne|asemat|autot|kaupat|myymalat|transport|railway|railways|shops|buses)\b/.test(words))return 'transport';
  if(/\b(muotokuvat|henkilokuva|henkilokuvat|henkilokuvia|ryhmakuva|ryhmakuvat|people|portraits|portrait)\b/.test(words)||image.category==='people')return 'people';
  if(/\b(nayttely|nayttelyt|juhlat|juhlatilaisuudet|juhlakulkueet|teatteri|urheilu|festivals|exhibitions|events)\b/.test(words))return 'events';
  if(image.category==='memory'||/\b(hauta|haudat|hautausmaat|muistomerkit|graves|memorials)\b/.test(words))return 'memory';
  if(image.category==='places'||/\b(koulut|koulu|koulurakennukset|sairaalat|kunnantalo|rakennukset|raitit|raitti|kadut|maisema|maisemat|maalaismaisemaa|maisemakuvat|maisemavalokuvaus|buildings|landscapes|streets)\b/.test(words))return 'places';
  return 'other';
}

export function diversifyPhotos(photos) {
  const groups=new Map();
  for(const photo of photos) {
    const topic=photoTopic(photo);
    if(!groups.has(topic))groups.set(topic,[]);
    groups.get(topic).push({...photo,topic});
  }
  const result=[];
  const buckets=[...groups.values()].map(group=>group.filter(photo=>photo.src).concat(group.filter(photo=>!photo.src)));
  for(let index=0;index<Math.max(0,...buckets.map(group=>group.length));index++) {
    for(const group of buckets)if(group[index])result.push(group[index]);
  }
  return result;
}

export { combinePhotos } from '../../time-jump/eras/media.js';

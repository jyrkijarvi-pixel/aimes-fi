// Finna metadata is CC0. Image rights are separate and checked per image.
const fields = ['id','title','formats','fullRecord','rawData','imagesExtended','subjectPlaces',
  'nonPresenterAuthors','institutions','dedupIds'];
const list = value => Array.isArray(value) ? value : value ? [value] : [];
const fold = value => String(value || '').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().trim();
const unique = values => [...new Set(values.filter(Boolean))];
const text = value => String(value || '').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&')
  .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
function tags(xml,name) {
  const pattern = new RegExp('<(?:\\w+:)?'+name+'\\b[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?'+name+'>','g');
  return [...String(xml || '').matchAll(pattern)].map(match=>match[1]);
}

export async function searchFinna({names,period}) {
  const url = new URL('https://api.finna.fi/v1/search');
  // Quoted phrases keep user input out of Solr query syntax.
  const quote = value => '"'+value.replace(/[\\"]/g,' ')+'"';
  url.searchParams.set('lookfor',names.length ? names.map(quote).join(' OR ') : '');
  url.searchParams.set('limit','36');
  url.searchParams.set('page','1');
  url.searchParams.append('filter[]','format:"1/Image/Photo/"');
  url.searchParams.append('filter[]','online_boolean:"1"');
  if (period) {
    const end = period.year + (period.decade ? 9 : 0);
    url.searchParams.append('filter[]','search_daterange_mv:"['+period.year+' TO '+end+']"');
  }
  for (const field of fields) url.searchParams.append('field[]',field);
  const started=Date.now();
  const response=await fetch(url,{signal:AbortSignal.timeout(9000),headers:{Accept:'application/json'}});
  if (!response.ok) throw Error('Finna '+response.status);
  const data=await response.json();
  if (data.status!=='OK' || !Array.isArray(data.records)) throw Error('Finna response');
  return {records:data.records,total:data.resultCount,ms:Date.now()-started,query:url.href};
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
  if (point && (nearest ? nearest.metres>15000 : !matchesPlace)) return null;
  const explicitCountries=locationTokens.flatMap(token=>countryNames.get(token) || []);
  const cityCountries=locationTokens.flatMap(token=>Object.hasOwn(cities,token)?cities[token]:[]);
  if (code && (nearest && boundary ? !withinCountry(nearest,boundary)
    : explicitCountries.length ? !explicitCountries.includes(code) : !cityCountries.includes(code))) return null;
  // A village named Somero in a different municipality must not match the town of Somero.
  if (point && !nearest && matchesPlace) {
    const otherCities=locationTokens.filter(token=>!aliases.includes(token)&&Object.hasOwn(cities,token));
    if (otherCities.some(token=>!countryNames.has(token) && !aliases.some(alias=>alias.includes(token)))) return null;
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
    kind:'Valokuva',category:'other'
  };
}

export function combinePhotos(commons,finna) {
  const result=[];
  const ids=new Map();
  let duplicates=0;
  for (const image of [...commons,...finna]) {
    const references=unique([...(image.finnaIds || []),...[image.original,image.url]
      .flatMap(url=>[...String(url || '').matchAll(/finna\.fi\/Record\/([^?#\s]+)/g)].map(match=>{
        try {return decodeURIComponent(match[1]);} catch {return match[1];}
      }))]);
    const same=references.map(id=>ids.get(id)).find(Boolean);
    const item={...image,source:image.source || (/^https?:\/\/(?:www\.)?finna\.fi\//.test(image.original || image.url)?'finna':'commons')};
    if (same) {
      // Keep each record's dating and rights, even when two catalogues describe one photo.
      same.alternatives=[...(same.alternatives || []),item];
      duplicates++;
    } else result.push(item);
    for (const id of references) ids.set(id,same || item);
  }
  const commonsPhotos=result.filter(image=>image.source==='commons');
  const finnaPhotos=result.filter(image=>image.source==='finna');
  const photos=[];
  for(let index=0;index<Math.max(commonsPhotos.length,finnaPhotos.length);index++) {
    if(commonsPhotos[index])photos.push(commonsPhotos[index]);
    if(finnaPhotos[index])photos.push(finnaPhotos[index]);
  }
  return {photos,duplicates};
}

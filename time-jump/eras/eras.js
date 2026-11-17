import { parsePeriod } from './period.js';

const labels = {
  fi: {
    source:'Lähde',allSources:'Kaikki',finnaCoordinates:'Sijaintiyhteys: Finnan kuvaustapahtuman koordinaatit.',finnaEventPlace:'Sijaintiyhteys: Finnan kuvaustapahtuman paikkatieto.',finnaSubject:'Sijaintiyhteys: arkiston aihepaikka. Tarkkaa kuvauspaikkaa ei ole varmennettu.',
    restricted:'Esikatselua ei näytetä, koska käyttöoikeus on rajoitettu tai epäselvä.',finnaFailed:'Finna-haku epäonnistui. Muiden lähteiden tulokset ovat käytettävissä.',finnaScope:'Finna: rajattu 36 tietueen otos. Ajoitukset perustuvat kuvaus- tai valmistustapahtumaan. Puuttuvasta kuvausajasta ei ehdoteta vuosikymmentä.',
    alternative:'Sama kuva myös lähteessä',dateEvidence:'Arkiston alkuperäinen ajoitustieto',institution:'Kokoelmaorganisaatio',rightsUnknown:'Käyttöoikeutta ei ilmoitettu',rightsDetails:'Lähteen käyttöoikeusohje',
    brand:'MAAILMAN TUTKIMINEN',nav:'AIMESin palvelut',gallery:'Historialliset kuvat',navEras:'Aikakaudet',stories:'Tarinat',radios:'Radiot',office:'Toimisto',discover:'Muut löydöt',
    home:'Kartta ja paikkahaku',title:'Historialliset aikakaudet',intro:'Hae historiallisia valokuvia maan, paikan tai ajan mukaan. Yksi rajaus riittää.',
    country:'Maa tai alue',place:'Paikkakunta (valinnainen)',period:'Vuosi tai vuosikymmen',periodExample:'1952 tai 1950-luku',find:'Hae',choose:'Kaikki maat',decade:'Vuosikymmen',precision:'Ajoitustarkkuus',location:'Sijainti aineistossa',more:'Näytä lisää',
    guide:'Aloita esimerkiksi valitsemalla Suomi tai kirjoittamalla vuosikymmen 1950-luku.',invalidPeriod:'Anna vuosi tai vuosikymmen, esimerkiksi 1952 tai 1950-luku.',
    scope:'Rajattu aineistohaku. Ehdotukset perustuvat kuville ilmoitettuun kuvausaikaan ja saatavilla olevaan paikkatietoon. Kaikki arkistokuvat eivät sisälly hakuun.',
    includeUncertain:'Näytä myös vahvistamattomat otsikko-osumat',noDecades:'Tästä hausta ei löytynyt kuvia, jotka tukisivat tiettyä vuosikymmentä.',
    all:'Kaikki löydöt',exact:'Tarkasti ajoitettu',approximate:'Likimääräisesti ajoitettu',unknown:'Ajoittamaton',
    searching:'Haetaan…',loading:'Etsitään valokuvia ja Wikipedia-tietoja…',noPlaces:'Paikkaa ei löytynyt. Kokeile toista nimeä.',failed:'Haku epäonnistui. Yritä uudelleen.',
    noPhotos:'Tällä rajauksella ei löytynyt valokuvia.',photoFailed:'Commons-haku ei vastannut. Paikallinen arkistoaineisto näkyy, jos sitä on.',
    imageFailed:'Kuvan esikatselu ei latautunut.',retry:'Yritä uudelleen',notDated:'Lähde ei ilmoita tunnistettavaa kuvausaikaa.',photoSource:'Avaa kuvan lähde',license:'Käyttöoikeus',
    artistUnknown:'Tekijää ei ilmoitettu',coordinates:'Sijaintiyhteys: Commonsin koordinaatit.',titleMatch:'Sijaintiyhteys: tiedoston otsikko. Sijaintia ei ole vahvistettu.',archive:'Sijaintiyhteys: arkistotietue.',category:'Sijaintiyhteys: Commonsin paikkaluokka.',unknownPlace:'Kuvauspaikkaa ei voitu vahvistaa.',sourceCategory:'Commonsin hakuluokka',
    wikiMissing:'Tälle paikalle ei löytynyt Wikipedia-tietoja.',wikiFailed:'Wikipedia ei vastannut.',nearby:'Lähikohteita Wikipediassa',count:'kuvaa',estimate:'likimääräistä',dated:'tarkkaa',partial:'Osa Commonsin hauista epäonnistui. Löydöt ovat osittaisia.'
  },
  en: {
    source:'Source',allSources:'All',finnaCoordinates:'Location evidence: Finna capture-event coordinates.',finnaEventPlace:'Location evidence: Finna capture-event place.',finnaSubject:'Location evidence: archive subject place. The precise camera location is unverified.',
    restricted:'Preview withheld because image rights are restricted or unclear.',finnaFailed:'Finna search failed. Results from the other sources remain available.',finnaScope:'Finna: a limited sample of 36 records. Dating uses capture or creation events. A missing capture date cannot suggest a decade.',
    alternative:'Same photograph also catalogued at',dateEvidence:'Original archive date statement',institution:'Collection institution',rightsUnknown:'Rights not specified',rightsDetails:'Usage instructions from the source',
    brand:'WORLD EXPLORER',nav:'AIMES services',gallery:'Historical photo gallery',navEras:'Historical eras',stories:'Stories',radios:'Radio',office:'Office',discover:'Discover',
    home:'Map and place search',title:'Historical eras',intro:'Find photographs by country, place or time. One search field is enough.',
    country:'Country or area',place:'Place (optional)',period:'Year or decade',periodExample:'1952 or 1950s',find:'Search',choose:'All countries',decade:'Decade',precision:'Dating precision',location:'Location in the source',more:'Show more',
    guide:'Start by selecting Finland or typing a decade such as 1950s.',invalidPeriod:'Enter a year or decade, such as 1952 or 1950s.',
    scope:'This search covers a limited sample. Suggestions use the declared capture date and available location evidence. The search does not include every archive photograph.',
    includeUncertain:'Include unverified filename matches',noDecades:'This search found no photographs that substantiate a specific decade.',
    all:'All finds',exact:'Precisely dated',approximate:'Approximately dated',unknown:'Undated',
    searching:'Searching…',loading:'Searching for photographs and Wikipedia information…',noPlaces:'No place found. Try another name.',failed:'The request failed. Try again.',
    noPhotos:'No photographs match these filters.',photoFailed:'Commons did not respond. Local archive material is shown where available.',
    imageFailed:'The image preview could not be loaded.',retry:'Try again',notDated:'The source has no recognizable capture date.',photoSource:'Open photo source',license:'Usage rights',
    artistUnknown:'Artist not provided',coordinates:'Location evidence: Commons coordinates.',titleMatch:'Location evidence: filename. The location is unverified.',archive:'Location evidence: archive record.',category:'Location evidence: Commons place category.',unknownPlace:'The location could not be verified.',sourceCategory:'Commons search category',
    wikiMissing:'No Wikipedia information found for this place.',wikiFailed:'Wikipedia did not respond.',nearby:'Nearby in Wikipedia',count:'photos',estimate:'approximate',dated:'precise',partial:'Some Commons searches failed. These results are incomplete.'
  }
};
const byId = id => document.getElementById(id);
const endpoint = '/time-jump/api/';
const country = byId('country');
const decade = byId('decade');
const precision = byId('precision');
const locationFilter = byId('location');
const periodInput = byId('period');
const batchSize = 18;
let language = new URL(location.href).searchParams.get('lang') === 'en' ? 'en' : 'fi';
let countries = [];
let place;
let data;
let request;
let region;
let visibleLimit = batchSize;
let statusKey;
const t = key => labels[language][key];
const text = (tag, value) => Object.assign(document.createElement(tag),{textContent:value});
const option = (value, label) => Object.assign(text('option',label),{value});
const link = (label, url) => Object.assign(text('a',label),{href:url});
const setStatus = key => { statusKey = key; byId('status').textContent = key ? t(key) : ''; };
function renderCountries() {
  const previous = country.value;
  const names = new Intl.DisplayNames([language],{type:'region'});
  const options = countries.map(code=>[code,names.of(code)]);
  options.sort((a,b)=>a[1].localeCompare(b[1],language));
  country.replaceChildren(option('',t('choose')),...options.map(([code,name])=>option(code,name)));
  country.value = previous;
}
function setLanguage() {
  document.documentElement.lang = language;
  document.title = 'AIMES · '+t('title');
  document.querySelectorAll('[data-ui]').forEach(el=>el.textContent=t(el.dataset.ui));
  document.querySelector('.aimes-nav').setAttribute('aria-label',t('nav'));
  const toggle = byId('language');
  toggle.textContent = language === 'fi' ? 'English' : 'Suomi';
  toggle.lang = language === 'fi' ? 'en' : 'fi';
  periodInput.placeholder=t('periodExample');
  renderCountries();
  byId('source').options[0].textContent=t('allSources');
  if(data)renderSourceStatus();
}
async function api(route, parameters, signal) {
  const result = await fetch(endpoint+route+'?'+new URLSearchParams(parameters),{signal});
  if(!result.ok)throw Error(result.status);
  return result.json();
}
function start() {
  request?.abort();
  request = new AbortController();
  return request.signal;
}
function renderWiki() {
  const wiki = byId('wiki');
  wiki.replaceChildren();
  if (region) return;
  const article = data.wiki.main;
  if (article) {
    const languageName = article.language === 'fi' ? 'Suomi' : 'English';
    const paragraph = text('p',article.extract || article.title);
    paragraph.lang = article.language;
    wiki.append(paragraph,link('Wikipedia · '+languageName,article.url),document.createTextNode(' · '),
      link('CC BY-SA','https://creativecommons.org/licenses/by-sa/4.0/'));
  } else wiki.append(text('p',t(data.availability.wiki?'wikiMissing':'wikiFailed')));
  if (data.wiki.nearby.length) {
    const list = text('ul','');
    for (const nearby of data.wiki.nearby) {
      const item = text('li','');
      item.append(link(nearby.title,nearby.url));
      list.append(item);
    }
    const detail = text('details','');
    detail.append(text('summary',t('nearby')),list);
    wiki.append(detail);
  }
}
function renderFilters() {
  const selectedDecade = decade.value, selectedPrecision = precision.value;
  const counts=new Map();
  for(const image of selectedPhotos()) {
    const capture=image.capture;
    const decade=Math.floor(capture.start/10)*10;
    if(image.locationEvidence==='title'||capture.start===null||capture.uncertain||capture.end>=decade+10)continue;
    const row=counts.get(decade)||{decade,exact:0,approximate:0};
    row[capture.precision]++;
    counts.set(decade,row);
  }
  decade.replaceChildren(option('',t('all')),...[...counts.values()].sort((a,b)=>a.decade-b.decade).map(row=>option(String(row.decade),
    (language==='fi'?row.decade+'-luku':row.decade+'s')+' · '+row.exact+' '+t('dated')+', '+row.approximate+' '+t('estimate'))));
  precision.replaceChildren(...['all','exact','approximate','unknown'].map(key=>option(key,t(key))));
  if([...decade.options].some(item=>item.value===selectedDecade))decade.value=selectedDecade;
  precision.value = selectedPrecision || 'all';
  const selectedLocation=locationFilter.value;
  const locations=[...new Set(data.photos.map(image=>image.placeLabel).filter(Boolean))].sort((a,b)=>a.localeCompare(b,language));
  locationFilter.replaceChildren(option('',t('all')),...locations.map(name=>option(name,name)));
  if(locations.includes(selectedLocation))locationFilter.value=selectedLocation;
  byId('location-filter').hidden = locations.length < 2;
  byId('include-uncertain').closest('label').hidden = !data.photos.some(image=>image.locationEvidence==='title');
}
function photoPreview(image) {
  const frame = text('div','');
  frame.className='era-image';
  if(!image.src) {
    frame.classList.add('era-image-error');
    frame.append(text('p',t('restricted')),link(t('photoSource'),image.original || image.url));
    return frame;
  }
  const source = new URL(image.src,location.href);
  if (['upload.wikimedia.org','thumb.wikimedia.org'].includes(source.hostname)) {
    for (const key of ['utm_source','utm_campaign','utm_content']) source.searchParams.delete(key);
  }
  function load(retry = false) {
    const preview = document.createElement('img');
    preview.alt=image.title;
    preview.loading=retry?'eager':'lazy';
    preview.decoding='async';
    preview.addEventListener('error',()=>{
      const fallback = text('div','');
      fallback.className='era-image-error';
      const message = text('p',t('imageFailed'));
      message.setAttribute('role','status');
      const button = text('button',t('retry'));
      button.type='button';
      button.className='outline';
      button.addEventListener('click',()=>load(true));
      fallback.append(message,button,link(t('photoSource'),image.original || image.url));
      frame.replaceChildren(fallback);
    },{once:true});
    preview.src=source.href;
    frame.replaceChildren(preview);
  }
  load();
  return frame;
}

function photoCard(image) {
  const figure = text('figure','');
  figure.className='era-photo';
  const caption = text('figcaption','');
  const artist = image.artistUnspecified ? t('artistUnknown')+' · '+image.artist
    : image.artist === 'Tekijää ei ilmoitettu' ? t('artistUnknown') : image.artist;
  caption.append(text('strong',image.title),text('small',artist),
    text('small',t(image.capture.precision)+(image.date?' · '+image.date:' · '+t('notDated'))),
    text('small',t(image.locationEvidence==='title'?'titleMatch':image.locationEvidence)));
  caption.append(text('small',image.source==='finna'?'Finna':'Wikimedia Commons'));
  if(image.institution)caption.append(text('small',t('institution')+' · '+image.institution));
  if(image.dateEvidence && image.dateEvidence!==image.date)caption.append(text('small',t('dateEvidence')+' · '+image.dateEvidence));
  if(image.placeLabel)caption.append(text('small',image.placeLabel));
  if(image.lat!=null && image.lon!=null)caption.append(text('small',image.lat.toFixed(4)+', '+image.lon.toFixed(4)));
  if(image.scopeCategory)caption.append(link(t('sourceCategory'), 'https://commons.wikimedia.org/wiki/Category:'+encodeURIComponent(image.scopeCategory)));
  if(image.restrictions) {
    const instructions=text('details','');
    instructions.append(text('summary',t('rightsDetails')),text('small',image.restrictions));
    caption.append(instructions);
  }
  const source = text('small','');
  source.append(link(t('photoSource'),image.original || image.url),document.createTextNode(' · '+t('license')+' '),
    image.licenseUrl?link(image.license,image.licenseUrl):document.createTextNode(image.license==='Unknown'?t('rightsUnknown'):image.license));
  caption.append(source);
  for(const alternative of image.alternatives || []) {
    caption.append(link(t('alternative')+' · '+(alternative.source==='finna'?'Finna':'Wikimedia Commons'),alternative.original || alternative.url));
    caption.append(text('small',[alternative.date,alternative.artist,alternative.license].filter(Boolean).join(' · ')));
  }
  figure.append(photoPreview(image),caption);
  return figure;
}
function renderPhotos() {
  const chosen = decade.value ? Number(decade.value) : null;
  const photos = selectedPhotos().filter(({capture,locationEvidence,placeLabel})=>
    (!locationFilter.value||locationFilter.value===placeLabel) &&
    (locationEvidence!=='title'||byId('include-uncertain').checked) &&
    (precision.value==='all'||precision.value===capture.precision) &&
    (chosen===null||(!capture.uncertain&&capture.start!==null&&capture.start>=chosen&&capture.end<chosen+10)));
  byId('count').textContent = photos.length ? photos.length+' '+t('count')+(!data.decades.length?' · '+t('noDecades'):'') : t('noPhotos');
  byId('photos').replaceChildren(...photos.slice(0,visibleLimit).map(photoCard));
  byId('more').hidden=photos.length<=visibleLimit;
}
function selectedPhotos() {
  const source=byId('source').value;
  return source==='all' ? data.photos : data.photos.flatMap(image=>{
    const match=[image,...image.alternatives || []].find(item=>item.source===source);
    return match ? [match] : [];
  });
}
function renderSourceStatus() {
  byId('source-status').textContent=t(data.availability.finna===false?'finnaFailed':'finnaScope');
}
function resetFilters() {
  byId('source').value='all';
  decade.replaceChildren();
  precision.replaceChildren();
  locationFilter.replaceChildren();
  byId('include-uncertain').checked=false;
  visibleLimit=batchSize;
}
function showResults() {
  const title=region ? (region.country ? new Intl.DisplayNames([language],{type:'region'}).of(region.country) : t('choose')) : place.name || place.label;
  const period=region?.period || place?.period;
  byId('place-name').textContent=title+(period?' · '+period:'');
  const detail=byId('place-detail');
  detail.hidden=Boolean(region) || !place?.label || place.label===title;
  detail.textContent=detail.hidden?'':place.label;
  renderWiki(); renderFilters(); renderPhotos();
  renderSourceStatus();
  byId('destination').hidden=false;
  setStatus(!data.availability.photos?'photoFailed':data.diagnostics.succeeded<data.diagnostics.commonsBatches?'partial':'');
}
async function loadPlace(selected, keepFilters = false) {
  place = selected;
  region = null;
  const signal = start();
  setStatus('loading');
  byId('places').replaceChildren();
  byId('destination').hidden = true;
  if (!keepFilters) resetFilters();
  try {
    const response = await api('eras',{lat:place.lat,lon:place.lon,name:place.name,article:place.article||'',alias:place.alias,period:place.period,lang:language,country:place.country || ''},signal);
    if(signal.aborted)return;
    data=response;
    showResults();
  } catch {
    if(!signal.aborted)setStatus('failed');
  }
}
async function changeWiki() {
  const selected = place;
  const signal = start();
  byId('wiki').replaceChildren(text('p',t('searching')));
  try {
    const wiki = await api('era-wiki',{lat:selected.lat,lon:selected.lon,name:selected.name,article:selected.article||'',lang:language},signal);
    if(signal.aborted)return;
    data.wiki=wiki;
    data.availability.wiki=true;
  } catch {
    if(signal.aborted)return;
    data.wiki={main:null,nearby:[]};
    data.availability.wiki=false;
  }
  renderWiki();
}
byId('search').addEventListener('submit',async event=>{
  event.preventDefault();
  const signal=start();
  const q=byId('query').value.trim();
  const period=periodInput.value.trim();
  const code=country.value;
  place=null;
  region=null;
  data=null;
  byId('destination').hidden=true;
  byId('places').replaceChildren();
  try { parsePeriod(period); } catch {setStatus('invalidPeriod');periodInput.focus();return;}
  if(!q && !code && !period){setStatus('guide');return;}
  setStatus('searching');
  try {
    if(!q) {
      const response=await api('eras',{country:code,period},signal);
      if(signal.aborted)return;
      region={country:code,period};
      data=response;
      resetFilters();
      showResults();
      return;
    }
    const response=await api('search',{q,country:code},signal);
    if(signal.aborted)return;
    for(const hit of response.results.filter(item=>item.kind!=='country')) {
      const item=text('li','');
      const button=text('button',hit.label);
      button.type='button';
      button.addEventListener('click',()=>loadPlace({ ...hit, alias:q, period, country:code }));
      item.append(button);
      byId('places').append(item);
    }
    setStatus(byId('places').children.length?'':'noPlaces');
  } catch {
    if(!signal.aborted)setStatus('failed');
  }
});
byId('language').addEventListener('click',()=>{
  language=language==='fi'?'en':'fi';
  const url=new URL(location.href);
  url.searchParams.set('lang',language);
  history.replaceState(null,'',url);
  setLanguage();
  if (place && !byId('destination').hidden && data) {
    renderFilters();
    renderPhotos();
    setStatus(!data.availability.photos?'photoFailed':data.diagnostics.succeeded<data.diagnostics.commonsBatches?'partial':'');
    changeWiki();
  } else if (place) loadPlace(place,true);
  else if (region && data) showResults();
  else setStatus(statusKey);
});
decade.addEventListener('change',()=>{
  precision.value='all';
  visibleLimit=batchSize;
  renderPhotos();
});
for (const filter of [precision,locationFilter,byId('include-uncertain')])filter.addEventListener('change',()=>{
  visibleLimit=batchSize;
  renderPhotos();
});
byId('more').addEventListener('click',()=>{visibleLimit+=batchSize;renderPhotos();});
byId('source').addEventListener('change',()=>{visibleLimit=batchSize;renderFilters();renderPhotos();});
byId('query').value=(new URL(location.href).searchParams.get('q') || '').slice(0,120);
setLanguage();
setStatus('guide');
fetch('countries.json').then(res=>{
  if(!res.ok)throw Error(res.status);
  return res.json();
}).then(value=>{
  countries=value;
  renderCountries();
}).catch(()=>setStatus('failed'));

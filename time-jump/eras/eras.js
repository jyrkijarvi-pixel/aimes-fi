'use strict';

const labels = {
  fi: {
    home:'Kartta ja paikkahaku',title:'Historialliset aikakaudet',intro:'Valitse maa ja etsi paikka. AIMES ehdottaa vuosikymmeniä löytyneiden valokuvien ajoitustiedoista.',
    country:'Maa',place:'Paikka',find:'Hae paikka',choose:'Valitse maa',decade:'Vuosikymmen',precision:'Ajoitustarkkuus',
    scope:'Ehdotukset kuvaavat tämän haun löydöksiä. Kuvien sijainti voi perustua koordinaatteihin tai paikannimeen tiedoston otsikossa.',
    all:'Kaikki löydöt',exact:'Tarkasti ajoitettu',approximate:'Likimääräisesti ajoitettu',unknown:'Ajoittamaton',
    searching:'Haetaan…',loading:'Etsitään valokuvia ja Wikipedia-tietoja…',noPlaces:'Paikkaa ei löytynyt. Kokeile toista nimeä.',failed:'Haku epäonnistui. Yritä uudelleen.',
    noPhotos:'Tällä rajauksella ei löytynyt valokuvia.',photoFailed:'Commons-haku ei vastannut. Paikallinen arkistoaineisto näkyy, jos sitä on.',
    imageFailed:'Kuva ei latautunut. Voit avata lähdesivun.',notDated:'Lähde ei ilmoita tunnistettavaa kuvausaikaa.',photoSource:'Avaa kuvan lähde',license:'Käyttöoikeus',
    artistUnknown:'Tekijää ei ilmoitettu',coordinates:'Sijaintiyhteys: Commonsin koordinaatit.',titleMatch:'Sijaintiyhteys: tiedoston otsikko. Sijaintia ei ole vahvistettu.',archive:'Sijaintiyhteys: museon tietue.',
    wikiMissing:'Tälle paikalle ei löytynyt Wikipedia-tietoja.',wikiFailed:'Wikipedia ei vastannut.',nearby:'Lähikohteita Wikipediassa',count:'kuvaa',estimate:'likimääräistä',dated:'tarkkaa',partial:'Osa Commonsin hauista epäonnistui. Löydöt ovat osittaisia.'
  },
  en: {
    home:'Map and place search',title:'Historical eras',intro:'Choose a country and find a place. AIMES suggests decades based on dates found in the photograph metadata.',
    country:'Country',place:'Place',find:'Find a place',choose:'Choose a country',decade:'Decade',precision:'Dating precision',
    scope:'Suggestions reflect this search only. A photo’s connection to the place may come from coordinates or a place name in its filename.',
    all:'All finds',exact:'Precisely dated',approximate:'Approximately dated',unknown:'Undated',
    searching:'Searching…',loading:'Searching for photographs and Wikipedia information…',noPlaces:'No place found. Try another name.',failed:'The request failed. Try again.',
    noPhotos:'No photographs match these filters.',photoFailed:'Commons did not respond. Local archive material is shown where available.',
    imageFailed:'The image could not be loaded. You can open its source page.',notDated:'The source has no recognizable capture date.',photoSource:'Open photo source',license:'Usage rights',
    artistUnknown:'Artist not provided',coordinates:'Location evidence: Commons coordinates.',titleMatch:'Location evidence: filename. The location is unverified.',archive:'Location evidence: museum record.',
    wikiMissing:'No Wikipedia information found for this place.',wikiFailed:'Wikipedia did not respond.',nearby:'Nearby in Wikipedia',count:'photos',estimate:'approximate',dated:'precise',partial:'Some Commons searches failed. These results are incomplete.'
  }
};
const byId = id => document.getElementById(id);
const endpoint = '/time-jump/api/';
const country = byId('country');
const decade = byId('decade');
const precision = byId('precision');
let language = new URL(location.href).searchParams.get('lang') === 'en' ? 'en' : 'fi';
let countries = [];
let place;
let data;
let request;
const t = key => labels[language][key];
const text = (tag, value) => Object.assign(document.createElement(tag),{textContent:value});
const option = (value, label) => Object.assign(text('option',label),{value});
const link = (label, url) => Object.assign(text('a',label),{href:url});
const setStatus = key => { byId('status').textContent = key ? t(key) : ''; };
function renderCountries() {
  const previous = country.value;
  const names = new Intl.DisplayNames([language],{type:'region'});
  const options = countries.filter(row=>/^[A-Z]{2}$/.test(row[2])).map(row=>[row[2],names.of(row[2])]);
  options.sort((a,b)=>a[1].localeCompare(b[1],language));
  country.replaceChildren(option('',t('choose')),...options.map(([code,name])=>option(code,name)));
  country.value = previous;
}
function setLanguage() {
  document.documentElement.lang = language;
  document.title = 'AIMES · '+t('title');
  document.querySelectorAll('[data-ui]').forEach(el=>el.textContent=t(el.dataset.ui));
  const toggle = byId('language');
  toggle.textContent = language === 'fi' ? 'English' : 'Suomi';
  toggle.lang = language === 'fi' ? 'en' : 'fi';
  renderCountries();
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
  decade.replaceChildren(option('',t('all')),...data.decades.map(row=>option(String(row.decade),
    (language==='fi'?row.decade+'-luku':row.decade+'s')+' · '+row.exact+' '+t('dated')+', '+row.approximate+' '+t('estimate'))));
  precision.replaceChildren(...['all','exact','approximate','unknown'].map(key=>option(key,t(key))));
  if([...decade.options].some(item=>item.value===selectedDecade))decade.value=selectedDecade;
  precision.value = selectedPrecision || 'all';
}
function photoCard(image) {
  const figure = text('figure','');
  figure.className='era-photo';
  const preview = document.createElement('img');
  preview.alt=image.title;
  preview.loading='lazy';
  preview.decoding='async';
  preview.addEventListener('error',()=>{
    preview.replaceWith(text('p',t('imageFailed')));
  },{once:true});
  preview.src=image.src;
  const caption = text('figcaption','');
  const artist = image.artist === 'Tekijää ei ilmoitettu' ? t('artistUnknown') : image.artist;
  caption.append(text('strong',image.title),text('small',artist),
    text('small',t(image.capture.precision)+(image.date?' · '+image.date:' · '+t('notDated'))),
    text('small',t(image.locationEvidence==='coordinates'?'coordinates':image.locationEvidence==='archive'?'archive':'titleMatch')));
  if(image.restrictions)caption.append(text('small',image.restrictions));
  const source = text('small','');
  source.append(link(t('photoSource'),image.original || image.url),document.createTextNode(' · '+t('license')+' '),
    image.licenseUrl?link(image.license,image.licenseUrl):document.createTextNode(image.license));
  caption.append(source);
  figure.append(preview,caption);
  return figure;
}
function renderPhotos() {
  const chosen = decade.value ? Number(decade.value) : null;
  const photos = data.photos.filter(({capture})=>
    (precision.value==='all'||precision.value===capture.precision) &&
    (chosen===null||(!capture.uncertain&&capture.start!==null&&capture.start>=chosen&&capture.end<chosen+10)));
  byId('count').textContent = photos.length ? photos.length+' '+t('count') : t('noPhotos');
  byId('photos').replaceChildren(...photos.map(photoCard));
}
async function loadPlace(selected, keepFilters = false) {
  place = selected;
  const signal = start();
  setStatus('loading');
  byId('places').replaceChildren();
  byId('destination').hidden = true;
  if (!keepFilters) {
    decade.replaceChildren();
    precision.replaceChildren();
  }
  try {
    const response = await api('eras',{lat:place.lat,lon:place.lon,name:place.name,article:place.article||'',lang:language},signal);
    if(signal.aborted)return;
    data=response;
    byId('place-name').textContent=selected.label;
    renderWiki(); renderFilters(); renderPhotos();
    byId('destination').hidden=false;
    setStatus(!data.availability.photos?'photoFailed':data.diagnostics.succeeded<data.diagnostics.commonsBatches?'partial':'');
  } catch {
    if(!signal.aborted)setStatus('failed');
  }
}
byId('search').addEventListener('submit',async event=>{
  event.preventDefault();
  const signal=start();
  const q=byId('query').value.trim();
  place=null;
  data=null;
  byId('destination').hidden=true;
  byId('places').replaceChildren();
  setStatus('searching');
  try {
    const response=await api('search',{q,country:country.value},signal);
    if(signal.aborted)return;
    for(const hit of response.results.filter(item=>item.kind!=='country')) {
      const item=text('li','');
      const button=text('button',hit.label);
      button.type='button';
      button.addEventListener('click',()=>loadPlace(hit));
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
  if(place)loadPlace(place,true);
});
decade.addEventListener('change',()=>{
  precision.value='all';
  renderPhotos();
});
precision.addEventListener('change',()=>renderPhotos());
setLanguage();
fetch('../data/countries.json').then(res=>{
  if(!res.ok)throw Error(res.status);
  return res.json();
}).then(value=>{
  countries=value;
  renderCountries();
}).catch(()=>setStatus('failed'));

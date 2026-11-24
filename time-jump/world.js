'use strict';

const tr=window.AimesLanguage.t;
const uiCreator=value=>['Tekijää ei ilmoitettu','Tekijä tuntematon'].includes(value)?tr(value):value;
const uiError=error=>error.name==='TypeError'?tr('Pyyntö epäonnistui.'):error.message;
const uiLanguage=window.AimesLanguage.language;
window.AimesLanguage.apply();

const byId = id => document.getElementById(id);
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const worldBounds = L.latLngBounds([-90, -180], [90, 180]);
const atlas = byId('atlas');
const map = L.map('map', { crs: L.CRS.EPSG4326, zoomControl:false, zoomAnimation:false, minZoom: -2, maxZoom: 17, zoomSnap: .25, maxBounds: worldBounds, maxBoundsViscosity: 1 });
map.attributionControl.setPrefix(false).addAttribution('<a href="https://www.naturalearthdata.com/about/terms-of-use/">Natural Earth · '+tr('nykykartta')+'</a>');
let roadMap;
let roadMarker;
let roadTiles;
let isStreet = false;
let current = null;
let currentYear = null;
let media = [];
let allMedia = [];
let photoIndex = 0;
let nearbyPlaces = [];
let showDemo = false;
let placeRequest;
let searchRequest;
let loadSequence = 0;

const boundsFit = () => map.fitBounds(worldBounds, { animate:false, reset:true, padding:[12,12] });
boundsFit();

for (let lat = -60; lat <= 60; lat += 30) {
  L.polyline([[lat,-180],[lat,180]], { color:'#6c9896', opacity:.35, weight:1, interactive:false }).addTo(map);
}
for (let lon = -180; lon <= 180; lon += 30) {
  L.polyline([[-90,lon],[90,lon]], { color:'#6c9896', opacity:.35, weight:1, interactive:false }).addTo(map);
}
const continentLabels = L.layerGroup([
  [tr('Pohjois-Amerikka'), 48, -108], [tr('Etelä-Amerikka'), -16, -59], [tr('Eurooppa'), 53, 19],
  [tr('Afrikka'), 7, 19], [tr('Aasia'), 50, 92], [tr('Oseania'), -25, 139], [tr('Etelämanner'), -78, 0]
].map(([name, lat, lon]) => L.marker([lat, lon], {
  icon: L.divIcon({ className:'continent', html:`<span>${name}</span>`, iconSize:[0,0] }),
  interactive:false, keyboard:false
})));
function showLabels() {
  if (map.getZoom() <= 2) continentLabels.addTo(map);
  else continentLabels.remove();
}
map.on('zoomend', showLabels);
showLabels();
fetch('data/world.json').then(response => {
  if (!response.ok) throw new Error(tr('Karttaa ei voitu ladata'));
  return response.json();
}).then(world => {
  L.geoJSON(world, { interactive:false, style: { fillColor:'#79b8a0', fillOpacity:.78, color:'#143c3c', weight:1 } }).addTo(map);
  if (current) marker.bringToFront();
}).catch(() => { byId('search-status').textContent = tr('Maailmankartan rajat eivät latautuneet. Koordinaatit ja paikkahaku ovat edelleen käytössä.'); });

const markerStyle = { radius:8, color:'#142825', fillColor:'#ffda8f', fillOpacity:1, weight:3, interactive:false };
const marker = L.circleMarker([0,0], markerStyle);
function pin(pinMarker, point, layer) {
  pinMarker.setLatLng([point.lat, point.lon]).addTo(layer).bringToFront();
  pinMarker.unbindTooltip().bindTooltip(text('span', point.name || tr('Karttapiste')), {
    permanent:true, direction:'top', offset:[0,-9], className:'place-pin'
  });
}

function pointLabel(lat, lon) {
  return `${Math.abs(lat).toFixed(4)}° ${lat < 0 ? 'S' : 'N'} · ${Math.abs(lon).toFixed(4)}° ${lon < 0 ? 'W' : 'E'}`;
}

function pointAt(coordinates) {
  const point = coordinates.wrap();
  return { lat: Math.max(-90, Math.min(90, point.lat)), lon: point.lng, name: tr('Karttapiste'), label: '', kind: 'point' };
}

function streetView(enable) {
  if (enable && Math.abs((current?.lat ?? map.getCenter().lat)) > 85) {
    byId(current ? 'travel-status' : 'search-status').textContent = tr('Katukartta ei ulotu näin lähelle napaa. Piste näkyy maailmankartalla.');
    return;
  }
  if (enable === isStreet) return;
  const center = isStreet ? roadMap.getCenter() : map.getCenter();
  isStreet = enable;
  byId('street-map').hidden = !enable;
  byId('map').hidden = enable;
  byId('detail-toggle').setAttribute('aria-pressed', String(enable));
  byId('detail-toggle').textContent = enable ? tr('Yleiskartta') : tr('Katukartta');
  if (enable) {
    if (!roadMap) {
      roadMap = L.map('street-map', { zoomControl:false, maxZoom:18, worldCopyJump:true });
      roadMap.attributionControl.setPrefix(false);
      roadMap.on('click', event => travel(pointAt(event.latlng), currentYear));
      roadMarker = L.circleMarker([0,0], markerStyle);
    }
    roadMap.invalidateSize({ pan: false });
    const target = current ? [current.lat, current.lon] : center;
    roadMap.setView(target, current ? 12 : Math.max(2, Math.min(9, map.getZoom())), { animate:false });
    roadTiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18, keepBuffer: 1, updateWhenIdle: true,
      attribution: '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>'
    }).on('tileerror', () => {
      byId(current ? 'travel-status' : 'search-status').textContent = tr('Katukartan tiiliä ei saatu ladattua. Yleiskartta toimii myös ilman verkkoa.');
    }).addTo(roadMap);
    if (current) pin(roadMarker, current, roadMap);
  } else {
    roadMap.removeLayer(roadTiles);
    if (!current) map.setView(center, map.getZoom(), { animate:false });
    map.invalidateSize({ pan:false });
  }
}

for (const [id, step] of [['zoom-in', 1], ['zoom-out', -1]]) {
  byId(id).addEventListener('click', () => {
    const activeMap = isStreet ? roadMap : map;
    activeMap.setZoom(activeMap.getZoom() + step, { animate:false });
  });
}
byId('detail-toggle').addEventListener('click', () => streetView(!isStreet));
map.on('click', event => travel(pointAt(event.latlng), currentYear));
byId('center').addEventListener('click', () => travel(pointAt((isStreet ? roadMap : map).getCenter()), currentYear));
byId('world-view').addEventListener('click', () => { streetView(false); boundsFit(); });

new ResizeObserver(() => {
  (isStreet ? roadMap : map).invalidateSize({ debounceMoveend:true });
  if (!current && !isStreet && map.getZoom() < 0) boundsFit();
}).observe(byId('map').parentElement);

function link(label, url) {
  const node = document.createElement('a');
  node.textContent = label;
  node.href = url;
  node.target = '_blank';
  node.rel = 'noopener noreferrer';
  return node;
}

function text(tag, content, className) {
  const node = document.createElement(tag);
  node.textContent = content;
  if (className) node.className = className;
  return node;
}

function button(label, action) {
  const node = text('button', label);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}

async function api(route, params, signal) {
  const response = await fetch(`/time-jump/api/${route}?${new URLSearchParams({ ...params, lang:uiLanguage })}`, { signal });
  const data = await response.json();
  if (!response.ok) throw new Error(tr(data.error || tr('Pyyntö epäonnistui.')));
  return data;
}

// Optional Reconstruction Mode: deliberately no image request until a visitor clicks.
function resetReconstruction() {
  const option = byId('reconstruction-option');
  const panel = byId('reconstruction-panel');
  const button = byId('reconstruction-toggle');
  const picture = byId('reconstruction-image');
  option.hidden = true;
  panel.hidden = true;
  button.setAttribute('aria-expanded', 'false');
  button.textContent = tr('✨ Näytä AI-rekonstruktio');
  picture.removeAttribute('src');
  picture.hidden = false;
  byId('reconstruction-error').textContent = '';
}
byId('reconstruction-toggle').addEventListener('click', () => {
  const panel = byId('reconstruction-panel');
  const button = byId('reconstruction-toggle');
  const picture = byId('reconstruction-image');
  const opening = panel.hidden;
  panel.hidden = !opening;
  button.setAttribute('aria-expanded', String(opening));
  button.textContent = opening ? tr('Piilota AI-rekonstruktio') : tr('✨ Näytä AI-rekonstruktio');
  if (opening) {
    picture.hidden = false;
    picture.onerror = () => {
      picture.hidden = true;
      byId('reconstruction-error').textContent = tr('Rekonstruktiokuva ei latautunut. Voit avata Helsinki 1952 -koeympäristön linkistä.');
    };
    // This file already belongs to the Helsinki 1952 demo; never claim a live AI render.
    picture.src = 'helsinki-1952/images/market.webp';
  } else {
    picture.removeAttribute('src');
    picture.onerror = null;
    byId('reconstruction-error').textContent = '';
  }
});

function clearPhoto() {
  loadSequence++;
  byId('photo').hidden = true;
  byId('photo-image').removeAttribute('src');
  byId('photo-controls').hidden = true;
}

function renderPhoto() {
  clearPhoto();
  if (!media.length) return;
  const image = media[photoIndex];
  const token = loadSequence;
  const preview = byId('photo-image');
  preview.alt = image.title;
  const caption = byId('photo-credit');
  caption.replaceChildren(text('strong', image.title), document.createTextNode(`${uiCreator(image.artist)} · `));
  caption.append(image.licenseUrl ? link(image.license, image.licenseUrl) : document.createTextNode(image.license));
  if (image.date) caption.append(document.createTextNode(tr(" · Kuvausaika lähteen mukaan: {0}", image.date)));
  if (image.locationEvidence === 'title') caption.append(document.createTextNode(tr(' · Paikkayhteys: nimi tai otsikko; tarkkaa kuvauspaikkaa ei vahvistettu')));
  else if (Number.isFinite(image.distance)) caption.append(document.createTextNode(tr(" · Paikkatieto: {0} kohdepisteestä", formatDistance(image.distance))));
  if (image.kind) caption.append(document.createTextNode(tr(" · Aineiston tyyppi: {0}", tr(image.kind))));
  caption.append(document.createElement('br'), link(tr('Lähde Wikimedia Commonsissa ↗'), image.url));
  if (image.original) caption.append(document.createTextNode(' · '), link(tr('Museon tietue Finnassa ↗'), image.original));
  if (image.restrictions) caption.append(text('p', tr("Muut käyttöehdot lähteessä: {0}", image.restrictions)));
  byId('photo').hidden = false;
  byId('photo-controls').hidden = media.length < 2;
  byId('photo-number').textContent = `${photoIndex + 1} / ${media.length}`;
  byId('prev').disabled = photoIndex === 0;
  byId('next').disabled = photoIndex === media.length - 1;
  preview.hidden = false;
  preview.onerror = () => {
    if (token !== loadSequence) return;
    preview.hidden = true;
    caption.prepend(text('p', tr('Kuva ei latautunut. Voit avata sen lähdesivun.')));
  };
  preview.src = image.src;
}

function formatDistance(metres) {
  return metres < 1000 ? `${metres} m` : `${(metres / 1000).toLocaleString(uiLanguage, { maximumFractionDigits: 1 })} km`;
}

byId('prev').addEventListener('click', () => { if (photoIndex > 0) { photoIndex--; renderPhoto(); } });
byId('next').addEventListener('click', () => { if (photoIndex + 1 < media.length) { photoIndex++; renderPhoto(); } });

function renderContext(wiki, available) {
  const context = byId('context');
  context.replaceChildren();
  if (wiki.main) {
    context.append(text('h3', wiki.main.title));
    if (wiki.main.extract) context.append(text('p', wiki.main.extract));
    context.append(link(wiki.main.language === 'fi' ? tr('Suomenkielinen Wikipedia ↗') : tr('Englanninkielinen Wikipedia ↗'), wiki.main.url), document.createTextNode(' · '), link('CC BY-SA', 'https://creativecommons.org/licenses/by-sa/4.0/'));
  }
  if (wiki.nearby.length) {
    const list = text('ul', '', 'nearby');
    for (const place of wiki.nearby) {
      const item = document.createElement('li');
      const choose = button(`${place.title} · ${formatDistance(place.distance)}`, () =>
        travel({ ...place.point, name:place.title, label:'Wikipedia · lähikohde', article:place.title }, currentYear));
      item.append(choose, link('Wikipedia ↗', place.url));
      list.append(item);
    }
    context.append(text('h3', tr('Lähikohteet')), list);
  } else {
    context.append(text('p', available ? tr('Läheltä ei löytynyt koordinaatein merkittyjä Wikipedia-artikkeleita.') : tr('Wikipedia-tietoja ei saatu ladattua.')));
  }
}

function yearLabel(year) {
  return year < 0 ? `${-year} ${tr("eaa.")}` : String(year);
}

function moveMap(point) {
  const coordinate = [point.lat, point.lon];
  pin(marker, point, map);
  const zoom = point.kind === 'country' ? 4 : 7;
  map.invalidateSize({ pan:false });
  if (isStreet || motion.matches || Math.abs(point.lat) >= 85) map.setView(coordinate, zoom, { animate:false });
  else {
    map.flyTo(coordinate, zoom, { duration:.8 });
    // A resize can interrupt Leaflet's flight. Complete it only if this destination is still selected.
    setTimeout(() => {
      if (current !== point || isStreet) return;
      const center = map.getCenter();
      if (map.getZoom() !== zoom || center.distanceTo(coordinate) > 1000) {
        map.setView(coordinate, zoom, { animate:false });
      }
    }, 950);
  }
  if (isStreet) {
    if (Math.abs(point.lat) > 85) streetView(false);
    else {
      roadMap.invalidateSize({ pan:false });
      pin(roadMarker, point, roadMap);
      roadMap.setView(coordinate, 12, { animate:!motion.matches });
    }
  }
}

async function travel(point, year = null, move = true) {
  searchRequest?.abort();
  placeRequest?.abort();
  const request = new AbortController();
  placeRequest = request;
  current = point;
  currentYear = year;
  byId('search-panel').hidden = true;
  byId('destination').hidden = false;
  byId('back').hidden = false;
  byId('place-title').textContent = point.name || tr('Karttapiste');
  byId('place-eras').href = '/time-jump/eras/' + (point.kind === 'point' || !point.name ? '' : '?q='+encodeURIComponent(point.name));
  window.AimesJourney?.remember({...point, period:year === null ? '' : String(year)});
  const trailUrl=new URL(window.AimesLanguage.localizedUrl('/time-jump/eras/'));
  for(const [key,value] of new URL(location.href).searchParams)if(key.startsWith('j'))trailUrl.searchParams.set(key,value);
  if(point.name)trailUrl.searchParams.set('q',point.name);
  byId('place-eras').href=trailUrl;
  byId('place-label').textContent = point.label === point.name ? '' : point.label || '';
  byId('coordinates').textContent = `${pointLabel(point.lat, point.lon)} · ${year === null ? tr('NYKYHETKI') : yearLabel(year)}`;
  byId('year').value = year ?? '';
  byId('year').setCustomValidity('');
  byId('street').href = `https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lon}#map=13/${point.lat}/${point.lon}`;
  byId('demo').hidden = true;
  resetReconstruction();
  byId('context').replaceChildren();
  media = [];
  allMedia = [];
  byId('source-category').value = 'all';
  byId('source-time').value = 'all';
  byId('source-filter-status').textContent = '';
  byId('gallery-count').textContent = tr('Etsitään aineistoa…');
  byId('enter-explorer').disabled = true;
  nearbyPlaces = [];
  showDemo = false;
  clearPhoto();
  byId('media-title').textContent = year === null ? tr('Paikan kuvia ja historiaa') : tr("Löytöjä ajan {0} ympäriltä", yearLabel(year));
  byId('media-note').textContent = '';
  byId('travel-status').textContent = tr('Etsitään paikan kuvia ja lähikohteita…');
  if (move) {
    moveMap(point);
    byId('place-title').focus({ preventScroll:true });
    window.scrollTo(0, 0);
  }
  try {
    const params = { lat:point.lat, lon:point.lon, name:point.kind === 'point' ? '' : point.name, kind:point.kind || 'place', article:point.article || '', year:year ?? '' };
    const data = await api('place', params, request.signal);
    if (request.signal.aborted) return false;
    byId('travel-status').textContent = '';
    byId('demo').hidden = !data.demo;
    // A pre-generated scene exists only for the Helsinki 1952 demonstration.
    byId('reconstruction-option').hidden = !data.demo;
    allMedia = data.photos || [];
    media = allMedia;
    byId('gallery-count').textContent = allMedia.length + tr(' löytöä');
    photoIndex = 0;
    nearbyPlaces = data.wiki?.nearby || [];
    showDemo = !!data.demo;
    if (media.length) {
      byId('media-note').textContent = year === null ? tr('Kuvia ja dokumentteja lähialueelta sekä paikannimen perusteella. Päiväykset vaihtelevat.') : tr('Eri vuosien aineistot ovat mukana. Valitse aihe ja ajanjakso Tutki-näkymässä. Tarkista kuvausvuosi ja sijaintitiedon varmuus lähteestä.');
      renderPhoto();
    } else {
      byId('gallery-count').textContent = !data.availability.photos ? tr('Haku ei vastannut') : tr('0 löytöä');
      byId('media-note').textContent = !data.availability.photos
        ? tr('Kuvahaku ei vastannut. Voit jatkaa kartalla tai yrittää uudelleen.')
        : tr('Wikimedia Commonsista ei löytynyt tähän hakuun sopivaa, sallittua aineistoa. Kaikkien museoiden aineistot eivät kuulu tähän hakuun.');
    }
    renderContext(data.wiki, data.availability.wiki);
    byId('enter-explorer').disabled = false;
    return true;
  } catch (error) {
    if (!request.signal.aborted) {
      byId('gallery-count').textContent = tr('Haku epäonnistui');
      byId('travel-status').textContent = tr("Aineiston lataus epäonnistui. {0}", uiError(error));
    }
    return false;
  }
}

byId('year').addEventListener('input', event => event.target.setCustomValidity(''));
byId('time').addEventListener('submit', event => {
  event.preventDefault();
  const field = byId('year');
  if (field.value === '0') {
    field.setCustomValidity(tr('Valitse eaa. tai jaa. Vuotta nolla ei käytetä.'));
    field.reportValidity();
    return;
  }
  if (current) travel(current, field.value ? Number(field.value) : null, false);
});
byId('present').addEventListener('click', () => { if (current) travel(current, null, false); });

const helsinki1952 = { name:'Helsinki', label:tr('Helsinki, Suomi'), lat:60.1699, lon:24.9384, article:'Helsinki' };
byId('helsinki').addEventListener('click', () => travel({ ...helsinki1952 }, 1952));
byId('home-gallery')?.addEventListener('click', async () => {
  const place = { ...helsinki1952 };
  if (await travel(place, 1952) && current === place && !placeRequest?.signal.aborted) openExplorer();
});
byId('nav-gallery').addEventListener('click', () => {
  if (!byId('explorer').hidden) {
    byId('gallery-title').scrollIntoView({block:'start'});
  } else if (current) {
    if (!byId('enter-explorer').disabled) openExplorer();
    else byId('place-title').focus();
  } else {
    byId('query').focus();
  }
});
byId('back').addEventListener('click', () => {
  placeRequest?.abort();
  streetView(false);
  current = null;
  currentYear = null;
  window.AimesJourney?.forget();
  resetReconstruction();
  marker.remove();
  roadMarker?.remove();
  byId('destination').hidden = true;
  byId('search-panel').hidden = false;
  byId('back').hidden = true;
  map.invalidateSize({ pan:false });
  boundsFit();
  byId('query').focus({ preventScroll:true });
  window.scrollTo(0,0);
});

byId('search').addEventListener('submit', async event => {
  event.preventDefault();
  searchRequest?.abort();
  const request = new AbortController();
  searchRequest = request;
  const q = byId('query').value.trim();
  byId('search-year').setCustomValidity('');
  const coordinate = q.match(/^([+-]?\d+(?:\.\d+)?)\s*[,;]\s*([+-]?\d+(?:\.\d+)?)$/);
  byId('results').replaceChildren();
  if (coordinate) {
    const [, a, b] = coordinate;
    if (Math.abs(+a) > 90 || Math.abs(+b) > 180) {
      byId('search-status').textContent = tr('Leveysaste on −90…90 ja pituusaste −180…180.');
      return;
    }
    byId('search-status').textContent = '';
    const yr = byId('search-year').value.trim();
    if (yr && (!Number.isInteger(Number(yr)) || Number(yr) === 0 || Math.abs(Number(yr)) > 100000)) {
      byId('search-year').setCustomValidity(tr('Anna kelvollinen vuosiluku.')); byId('search-year').reportValidity(); return;
    }
    await travel(pointAt(L.latLng(+a,+b)), yr ? Number(yr) : null);
    return;
  }
  if (q.length < 2) { byId('search-status').textContent = tr('Kirjoita vähintään kaksi merkkiä.'); return; }
  byId('search-status').textContent = tr('Haetaan paikkoja…');
  try {
    const data = await api('search', { q }, request.signal);
    if (request.signal.aborted) return;
    for (const place of data.results) {
      const item = document.createElement('li');
      const choose = button('', async () => {
        const input = byId('search-year');
        const raw = input.value.trim();
        const year = raw ? Number(raw) : null;
        if (raw && (!Number.isInteger(year) || year === 0 || Math.abs(year) > 100000)) {
          input.setCustomValidity(tr('Anna kelvollinen vuosiluku. Vuotta nolla ei käytetä.'));
          input.reportValidity();
          return;
        }
        input.setCustomValidity('');
        choose.disabled = true;
        try { await travel(place, year); }
        finally { choose.disabled = false; }
      });
      choose.className = 'place-choice';
      const heading = text('strong', place.name || place.label.split(',')[0]);
      const details = text('span', place.label === place.name ? '' : place.label, 'fine');
      const source = text('small', tr('Paikkatieto: ') + (place.source || tr('tuntematon')));
      const action = text('span', tr('Näytä kartalla →'), 'place-action');
      choose.append(heading, details, source, action);
      item.append(choose);
      byId('results').append(item);
    }
    byId('search-status').textContent = data.results.length
      ? tr("{0} tulosta{1}.", data.results.length, data.online ? '' : tr(' paikallisesta hakemistosta'))
      : data.online ? tr('Paikkaa ei löytynyt. Kokeile toista nimeä tai valitse kartalta.')
      : tr('Verkkohaku ei vastannut, eikä nimeä löytynyt paikallisesta hakemistosta. Valitse kartalta tai anna koordinaatit.');
  } catch (error) {
    if (!request.signal.aborted) byId('search-status').textContent = uiError(error);
  }
});


// VAIHE 03: Paikan tutkimustila. Kuvapisteet ovat lähteisiin sidottuja,
// ei generoituja näkymiä. Kartta kertoo nykyisestä maantieteestä.
let explorerMap;
let explorerTiles;
let explorerPhotoMarkers;
let explorerTargetMarker;
let explorerRoad = false;
let exploreZoom = 1;
let exploreX = 0;
let exploreY = 0;
let dragStart = null;
const stage = byId('explore-stage');
const stageImage = byId('explore-image');
const explorerVisible = () => !byId('explorer').hidden;

function applyExploreTransform() {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  const limitX = w * (exploreZoom - 1) / 2;
  const limitY = h * (exploreZoom - 1) / 2;
  exploreX = Math.max(-limitX, Math.min(limitX, exploreX));
  exploreY = Math.max(-limitY, Math.min(limitY, exploreY));
  stageImage.style.transform = `translate(${exploreX}px, ${exploreY}px) scale(${exploreZoom})`;
  stage.classList.toggle('zoomed', exploreZoom > 1);
  byId('explore-zoom-out').disabled = exploreZoom <= 1 || !media.length;
  byId('explore-zoom-in').disabled = exploreZoom >= 4 || !media.length;
  byId('explore-reset').disabled = exploreZoom === 1 || !media.length;
}
function changeExploreZoom(delta) {
  if (!media.length) return;
  exploreZoom = Math.max(1, Math.min(4, Math.round((exploreZoom + delta) * 10) / 10));
  if (exploreZoom === 1) { exploreX = 0; exploreY = 0; }
  applyExploreTransform();
}
byId('explore-zoom-in').addEventListener('click', () => changeExploreZoom(.5));
byId('explore-zoom-out').addEventListener('click', () => changeExploreZoom(-.5));
byId('explore-reset').addEventListener('click', () => { exploreZoom = 1; exploreX = 0; exploreY = 0; applyExploreTransform(); });
stage.addEventListener('wheel', event => {
  if (!media.length) return;
  event.preventDefault();
  changeExploreZoom(event.deltaY < 0 ? .25 : -.25);
}, { passive:false });
stage.addEventListener('pointerdown', event => {
  if (exploreZoom <= 1 || event.target !== stageImage) return;
  dragStart = { id:event.pointerId, x:event.clientX, y:event.clientY, originX:exploreX, originY:exploreY };
  stage.setPointerCapture(event.pointerId);
});
stage.addEventListener('pointermove', event => {
  if (!dragStart || dragStart.id !== event.pointerId) return;
  exploreX = dragStart.originX + event.clientX - dragStart.x;
  exploreY = dragStart.originY + event.clientY - dragStart.y;
  applyExploreTransform();
});
for (const type of ['pointerup','pointercancel','lostpointercapture']) {
  stage.addEventListener(type, () => { dragStart = null; });
}
stage.addEventListener('keydown', event => {
  if (!explorerVisible()) return;
  if (event.key === '+' || event.key === '=') { event.preventDefault(); changeExploreZoom(.5); }
  if (event.key === '-') { event.preventDefault(); changeExploreZoom(-.5); }
  if (event.key === 'ArrowLeft' && photoIndex > 0) { event.preventDefault(); selectStation(photoIndex - 1); }
  if (event.key === 'ArrowRight' && photoIndex + 1 < media.length) { event.preventDefault(); selectStation(photoIndex + 1); }
});

function safeCredit(image) {
  const credit = byId('explore-credit');
  credit.replaceChildren();
  if (!image) return;
  credit.append(document.createTextNode(`${uiCreator(image.artist) || tr('Tekijä tuntematon')} · ${image.license || tr('Lisenssi tarkistettava')} · `));
  if (image.url) credit.append(link(tr('Alkuperäinen aineisto Wikimedia Commonsissa ↗'), image.url));
  if (image.licenseUrl) credit.append(document.createTextNode(' · '), link(tr('Lisenssi ↗'), image.licenseUrl));
  if (image.original) credit.append(document.createTextNode(' · '), link(tr('Museon alkuperäinen tietue ↗'), image.original));
  if (image.restrictions) credit.append(text('p', tr("Lähteen muut ehdot: {0}", image.restrictions)));
}
function showStations() {
  const list = byId('explore-stations');
  list.replaceChildren();
  byId('explore-stations-count').textContent = `(${media.length})`;
  if (!media.length) { list.append(text('p', tr('Valitulla suodatuksella ei ole osumia. Kokeile Kaikki aineistot ja Kaikki vuodet.'), 'fine')); return; }
  media.forEach((photo, index) => {
    const item = button('', () => selectStation(index));
    item.className = 'station';
    item.setAttribute('aria-pressed', String(index === photoIndex));
    const thumbnail = document.createElement('img');
    thumbnail.src = photo.src;
    thumbnail.alt = '';
    thumbnail.loading = 'lazy';
    item.append(thumbnail);
    const details = document.createElement('span');
    details.append(text('small', tr("KUVAUSPISTE {0}", index + 1)), text('strong', photo.title));
    details.append(text('span', tr("Aineiston päiväys: {0}", photo.date || tr('ei tarkkaa vuotta')), 'fine'));
    if (photo.locationEvidence === 'title') details.append(text('span', tr('Paikkayhteys vain nimen perusteella'), 'fine'));
    item.append(details);
    list.append(item);
  });
}
function refreshPhotoMarkers() {
  if (!explorerMap) return;
  explorerPhotoMarkers?.clearLayers();
  if (current && explorerTargetMarker) explorerTargetMarker.setLatLng([current.lat, current.lon]);
  media.forEach((photo, index) => {
    if (!Number.isFinite(photo.lat) || !Number.isFinite(photo.lon)) return;
    const circle = L.circleMarker([photo.lat, photo.lon], {
      radius:index === photoIndex ? 9 : 6, color:'#162e32', weight:2,
      fillColor:index === photoIndex ? '#ffe1a5' : '#a8efd2', fillOpacity:1, bubblingMouseEvents:false
    });
    circle.bindTooltip(`Kuvauspiste ${index + 1}: ${photo.title}`);
    circle.on('click', () => selectStation(index));
    circle.addTo(explorerPhotoMarkers);
  });
  const photo = media[photoIndex];
  if (photo && Number.isFinite(photo.lat) && Number.isFinite(photo.lon)) {
    explorerMap.setView([photo.lat, photo.lon], explorerRoad ? 12 : 6, { animate:false });
  } else if (current) explorerMap.setView([current.lat, current.lon], explorerRoad ? 12 : 5, { animate:false });
}
function selectStation(index) {
  if (index < 0 || index >= media.length) return;
  photoIndex = index;
  const photo = media[index];
  exploreZoom = 1; exploreX = 0; exploreY = 0;
  stageImage.hidden = false;
  stageImage.src = photo.src;
  stageImage.alt = tr("{0}. Lähdeaineisto; ei historiallinen 3D-näkymä.", photo.title);
  stageImage.onerror = () => { stageImage.hidden = true; byId('explore-empty').hidden = false; byId('explore-empty').textContent = tr('Valokuva ei latautunut. Alkuperäinen kuva on avattavissa lähdelinkistä.'); };
  stageImage.onload = () => { byId('explore-empty').hidden = true; };
  byId('explore-empty').hidden = true;
  byId('explore-photo-title').textContent = photo.title;
  const coords = Number.isFinite(photo.lat) && Number.isFinite(photo.lon) ? ` · ${photo.locationApprox ? tr('Arvioitu kuvauspaikka') : tr('Kuvan paikkatieto')}: ${pointLabel(photo.lat, photo.lon)}` : '';
  const locationInfo = photo.locationEvidence === 'title' ? tr(' · Paikkayhteys otsikon perusteella; kuvauspaikka ei ole varmistettu') : coords;
  byId('explore-photo-detail').textContent = tr("Lähteen ilmoittama kuvausaika: {0}{1} · {2}", photo.date || tr('ei tarkkaa päiväystä'), locationInfo, tr(photo.kind || 'Kuva-aineisto'));
  byId('explore-authenticity').textContent = tr('LÄHDEAINEISTO · EI 3D-REKONSTRUKTIO');
  byId('selected-photo').hidden = false;
  byId('explore-counter').textContent = tr("{0} / {1} kuvauspistettä", index + 1, media.length);
  byId('explore-prev').disabled = index === 0;
  byId('explore-next').disabled = index === media.length - 1;
  safeCredit(photo);
  showStations();
  renderGallery();
  refreshPhotoMarkers();
  applyExploreTransform();
}
byId('explore-prev').addEventListener('click', () => selectStation(photoIndex - 1));
byId('explore-next').addEventListener('click', () => selectStation(photoIndex + 1));

function renderExplorerNearby() {
  const list = byId('explore-nearby');
  list.replaceChildren();
  if (!nearbyPlaces.length) { list.append(text('p', tr('Tälle pisteelle ei löytynyt lähikohteita tai Wikipedia ei vastannut.'), 'fine')); return; }
  nearbyPlaces.slice(0, 6).forEach(place => {
    const node = button(`${place.title} · ${formatDistance(place.distance)} →`, async () => {
      closeExplorer();
      await travel({ ...place.point, name:place.title, label:'Wikipedia · lähikohde', article:place.title }, currentYear);
      openExplorer();
    });
    node.className = 'nearby-choice';
    list.append(node);
  });
}
function buildExplorerMap() {
  if (explorerMap) { explorerMap.invalidateSize({ pan:false }); return; }
  // The local vector overview and OSM tiles must share Web Mercator.
  explorerMap = L.map('explore-map', { zoomControl:false, zoomAnimation:false, minZoom:-2, maxZoom:17, maxBounds:worldBounds });
  explorerMap.setView([current.lat, current.lon], 5, { animate:false });
  explorerMap.attributionControl.setPrefix(false).addAttribution('<a href="https://www.naturalearthdata.com/about/terms-of-use/">Natural Earth · '+tr('nykykartta')+'</a>');
  explorerPhotoMarkers = L.layerGroup().addTo(explorerMap);
  explorerTargetMarker = L.circleMarker([0,0], {radius:11, color:'#ffe1a5', fillColor:'#0e302e', fillOpacity:.5, weight:2, interactive:false }).addTo(explorerMap);
  explorerMap.on('click', async event => {
    const chosen = pointAt(event.latlng);
    closeExplorer();
    await travel(chosen, currentYear);
    openExplorer();
  });
  fetch('data/world.json').then(response => response.json()).then(data => {
    L.geoJSON(data, { interactive:false, style:{ fillColor:'#659888', fillOpacity:.78, color:'#17383c', weight:.7 } }).addTo(explorerMap);
    explorerPhotoMarkers.bringToFront();
    explorerTargetMarker.bringToFront();
  }).catch(() => {});
}
function toggleExplorerStreet() {
  if (!explorerMap) return;
  if (explorerRoad) {
    if (explorerTiles) explorerMap.removeLayer(explorerTiles);
    explorerRoad = false;
    byId('explore-road').textContent = tr('Näytä nykyinen katukartta');
    refreshPhotoMarkers();
  } else {
    if (Math.abs(current?.lat || 0) > 85) return;
    explorerTiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom:18, keepBuffer:1, updateWhenIdle:true,
      attribution:'<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>'
    }).addTo(explorerMap);
    explorerRoad = true;
    byId('explore-road').textContent = tr('Näytä yleiskartta');
    refreshPhotoMarkers();
  }
}
byId('explore-road').addEventListener('click', toggleExplorerStreet);
function showEmptyExplorer() {
    stageImage.hidden = true;
    stageImage.removeAttribute('src');
    byId('explore-empty').hidden = false;
    byId('explore-photo-title').textContent = tr('Tutki karttaa ja lähikohteita');
    byId('explore-photo-detail').textContent = tr('Tälle ajalle ei löytynyt varmennettua lähdekuvaa.');
    byId('explore-counter').textContent = tr('0 / 0 kuvauspistettä');
    byId('explore-authenticity').textContent = tr('EI VARMENNETTUA KUVA-AINEISTOA');
    byId('explore-prev').disabled = true;
    byId('explore-next').disabled = true;
    safeCredit(null);
    showStations();
    refreshPhotoMarkers();
    applyExploreTransform();
}
function renderGallery() {
  const grid = byId('gallery-grid');
  grid.replaceChildren();
  const count = media.length;
  byId('gallery-count').textContent = count + ' / ' + allMedia.length + tr(' löytöä');
  byId('gallery-empty').hidden = count > 0;
  media.forEach((item,index) => {
    const card = button('', () => {
      selectStation(index);
      byId('selected-photo').scrollIntoView({ behavior:motion.matches ? 'instant' : 'smooth', block:'start' });
      byId('explore-photo-title').setAttribute('tabindex','-1');
      byId('explore-photo-title').focus({preventScroll:true});
    });
    card.className = 'gallery-card';
    card.setAttribute('aria-label', tr('Avaa kuva ') + (index+1) + ': ' + item.title);
    card.setAttribute('aria-pressed', String(!byId('selected-photo').hidden && photoIndex === index));
    const thumbnail = document.createElement('img');
    thumbnail.src = item.src;
    thumbnail.alt = '';
    thumbnail.loading = index < 6 ? 'eager' : 'lazy';
    thumbnail.decoding = 'async';
    card.append(thumbnail);
    const copy = text('span', '', 'gallery-card-text');
    copy.append(text('strong', item.title));
    copy.append(text('span', item.date || (Number.isInteger(item.year) ? String(item.year) : tr('Ajoitus tuntematon')), 'fine'));
    copy.append(text('small', item.locationEvidence === 'title' ? tr('Paikka päätelty nimestä') : tr('Koordinaatteihin liittyvä löytö')));
    card.append(copy);
    grid.append(card);
  });
}
function applySourceFilters() {
  const category = byId('source-category').value;
  const time = byId('source-time').value;
  media = allMedia.filter(image => {
    if (category !== 'all' && (image.category || 'other') !== category) return false;
    if (time === 'unknown') return !Number.isInteger(image.year);
    if (time === 'exact') return currentYear !== null && image.year === currentYear;
    if (time === 'near') return currentYear !== null && Number.isInteger(image.year) && Math.abs(image.year - currentYear) <= 10;
    return true;
  });
  photoIndex = 0;
  byId('source-filter-status').textContent = tr('Näytetään ') + media.length + ' / ' + allMedia.length + tr(' löydöstä.') +
    (currentYear === null && (time === 'near' || time === 'exact') ? tr(' Valitse ensin vuosiluku yläreunasta.') : '');
  if (explorerVisible()) {
    byId('selected-photo').hidden = true;
    renderGallery();
    showStations();
    refreshPhotoMarkers();
  } else if (media.length) renderPhoto();
  else { clearPhoto(); byId('photo-number').textContent = ''; }
}
byId('source-category').addEventListener('change', applySourceFilters);
byId('source-time').addEventListener('change', applySourceFilters);
function openExplorer() {
  if (!current) return;
  byId('atlas').hidden = true;
  byId('explorer').hidden = false;
  byId('back').hidden = true;
  byId('explore-title').textContent = current.name || tr('Karttapiste');
  byId('explore-era').textContent = tr('{0} · OIKEAT LÄHTEET, EI HISTORIALLINEN 3D-KATUKUVA', currentYear === null ? tr('KAIKKI VUODET') : tr('VUOSI {0}', yearLabel(currentYear)));
  byId('explore-year').value = currentYear ?? '';
  byId('selected-photo').hidden = true;
  byId('explore-location').textContent = `${pointLabel(current.lat, current.lon)} · ${current.label || current.name || ''}`;
  byId('explore-demo').hidden = !showDemo;
  byId('explore-empty').textContent = currentYear === null ? tr('Tästä pisteestä ei löydy käyttökelpoista valokuvaa. Voit silti tutkia karttaa ja Wikipedia-kohteita.') : tr("Vuodelta {0} ei löytynyt varmennettua kuvaa tältä paikalta. Nykykartta ei kuvaa historiallista vuotta.", yearLabel(currentYear));
  renderExplorerNearby();
  buildExplorerMap();
  renderGallery();
  showStations();
  if (!media.length) showEmptyExplorer();
  requestAnimationFrame(() => { explorerMap?.invalidateSize({ pan:false }); refreshPhotoMarkers(); });
  window.scrollTo(0,0);
  byId('explore-close').focus({ preventScroll:true });
}
function closeExplorer() {
  byId('explorer').hidden = true;
  byId('atlas').hidden = false;
  byId('back').hidden = false;
  if (explorerRoad && explorerTiles) { explorerMap.removeLayer(explorerTiles); explorerRoad = false; byId('explore-road').textContent = tr('Näytä nykyinen katukartta'); }
  if (media.length) renderPhoto();
  requestAnimationFrame(() => { (isStreet ? roadMap : map).invalidateSize({ pan:false }); });
}
byId('enter-explorer').addEventListener('click', openExplorer);
byId('explore-year-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!current) return;
  const input = byId('explore-year');
  const raw = input.value.trim();
  const year = raw ? Number(raw) : null;
  if (raw && (!Number.isInteger(year) || year === 0 || Math.abs(year) > 100000)) {
    input.setCustomValidity(tr('Anna kelvollinen vuosiluku. Vuotta nolla ei käytetä.'));
    input.reportValidity();
    return;
  }
  input.setCustomValidity('');
  const point = current;
  closeExplorer();
  const ok = await travel(point,year,false);
  if (ok && current === point && !placeRequest?.signal.aborted) openExplorer();
});
byId('explore-year').addEventListener('input', event => event.target.setCustomValidity(''));
for(const anchor of document.querySelectorAll('[data-language]'))anchor.addEventListener('click',()=>{
  const target=new URL(anchor.href);
  if(current) {
    for(const [key,value] of Object.entries({lat:current.lat,lon:current.lon,name:current.name || '',
      article:current.article || '',year:currentYear ?? '',kind:current.kind || 'place'}))target.searchParams.set(key,value);
  } else target.searchParams.set('q',byId('query').value);
  anchor.href=target.href;
});
const restore=new URL(location.href).searchParams;
if(restore.has('lat')&&restore.has('lon')) {
  const lat=Number(restore.get('lat')),lon=Number(restore.get('lon'));
  const year=restore.get('year')?Number(restore.get('year')):null;
  if(Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180&&
    (year===null||Number.isInteger(year)&&year!==0&&Math.abs(year)<=100000)) {
    const kind=['point','country'].includes(restore.get('kind'))?restore.get('kind'):'place';
    travel({lat,lon,kind,name:kind==='point'?tr('Karttapiste'):restore.get('name') || tr('Karttapiste'),article:restore.get('article') || '',label:''},year);
  }
} else if(restore.has('q'))byId('query').value=restore.get('q').slice(0,140);
byId('explore-close').addEventListener('click', closeExplorer);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && explorerVisible()) { event.preventDefault(); closeExplorer(); }
});

// An explicit research-trail link restores the selected point without geocoding.
let aimesTrailRestored=false;
function restoreAimesTrail(){
  if(aimesTrailRestored)return;
  const state=window.AimesJourney?.state;if(!state)return;
  aimesTrailRestored=true;
  byId('query').value=state.name;
  travel({...state,label:state.name,kind:'place'}, /^\d{4}$/.test(state.period)?Number(state.period):null);
}
document.addEventListener('DOMContentLoaded',restoreAimesTrail,{once:true});
window.addEventListener('aimes-shell-ready',restoreAimesTrail,{once:true});

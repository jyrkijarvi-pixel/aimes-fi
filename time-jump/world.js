'use strict';

const byId = id => document.getElementById(id);
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const worldBounds = L.latLngBounds([-90, -180], [90, 180]);
const atlas = byId('atlas');
const map = L.map('map', { crs: L.CRS.EPSG4326, zoomControl:false, zoomAnimation:false, minZoom: -2, maxZoom: 17, zoomSnap: .25, maxBounds: worldBounds, maxBoundsViscosity: 1 });
map.attributionControl.setPrefix(false).addAttribution('<a href="https://www.naturalearthdata.com/about/terms-of-use/">Natural Earth · nykykartta</a>');
let roadMap;
let roadMarker;
let roadTiles;
let isStreet = false;
let current = null;
let currentYear = null;
let media = [];
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
  ['Pohjois-Amerikka', 48, -108], ['Etelä-Amerikka', -16, -59], ['Eurooppa', 53, 19],
  ['Afrikka', 7, 19], ['Aasia', 50, 92], ['Oseania', -25, 139], ['Etelämanner', -78, 0]
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
  if (!response.ok) throw new Error('Karttaa ei voitu ladata');
  return response.json();
}).then(world => {
  L.geoJSON(world, { interactive:false, style: { fillColor:'#79b8a0', fillOpacity:.78, color:'#143c3c', weight:1 } }).addTo(map);
  if (current) marker.bringToFront();
}).catch(() => { byId('search-status').textContent = 'Maailmankartan rajat eivät latautuneet. Koordinaatit ja paikkahaku ovat edelleen käytössä.'; });

const markerStyle = { radius:8, color:'#142825', fillColor:'#ffda8f', fillOpacity:1, weight:3, interactive:false };
const marker = L.circleMarker([0,0], markerStyle);
function pin(pinMarker, point, layer) {
  pinMarker.setLatLng([point.lat, point.lon]).addTo(layer).bringToFront();
  pinMarker.unbindTooltip().bindTooltip(text('span', point.name || 'Karttapiste'), {
    permanent:true, direction:'top', offset:[0,-9], className:'place-pin'
  });
}

function pointLabel(lat, lon) {
  return `${Math.abs(lat).toFixed(4)}° ${lat < 0 ? 'S' : 'N'} · ${Math.abs(lon).toFixed(4)}° ${lon < 0 ? 'W' : 'E'}`;
}

function pointAt(coordinates) {
  const point = coordinates.wrap();
  return { lat: Math.max(-90, Math.min(90, point.lat)), lon: point.lng, name: 'Karttapiste', label: '', kind: 'point' };
}

function streetView(enable) {
  if (enable && Math.abs((current?.lat ?? map.getCenter().lat)) > 85) {
    byId(current ? 'travel-status' : 'search-status').textContent = 'Katukartta ei ulotu näin lähelle napaa. Piste näkyy maailmankartalla.';
    return;
  }
  if (enable === isStreet) return;
  const center = isStreet ? roadMap.getCenter() : map.getCenter();
  isStreet = enable;
  byId('street-map').hidden = !enable;
  byId('map').hidden = enable;
  byId('detail-toggle').setAttribute('aria-pressed', String(enable));
  byId('detail-toggle').textContent = enable ? 'Yleiskartta' : 'Katukartta';
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
      byId(current ? 'travel-status' : 'search-status').textContent = 'Katukartan tiiliä ei saatu ladattua. Yleiskartta toimii myös ilman verkkoa.';
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
  const response = await fetch(`/time-jump/api/${route}?${new URLSearchParams(params)}`, { signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Pyyntö epäonnistui.');
  return data;
}

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
  caption.replaceChildren(text('strong', image.title), document.createTextNode(`${image.artist} · `));
  caption.append(image.licenseUrl ? link(image.license, image.licenseUrl) : document.createTextNode(image.license));
  if (image.date) caption.append(document.createTextNode(` · Kuvausaika lähteen mukaan: ${image.date}`));
  if (image.distance !== undefined) caption.append(document.createTextNode(` · Paikkatieto: ${formatDistance(image.distance)} kohdepisteestä`));
  caption.append(document.createElement('br'), link('Kuvan lähde Wikimedia Commonsissa ↗', image.url));
  if (image.original) caption.append(document.createTextNode(' · '), link('Museon tietue Finnassa ↗', image.original));
  if (image.restrictions) caption.append(text('p', `Muut käyttöehdot lähteessä: ${image.restrictions}`));
  byId('photo').hidden = false;
  byId('photo-controls').hidden = media.length < 2;
  byId('photo-number').textContent = `${photoIndex + 1} / ${media.length}`;
  byId('prev').disabled = photoIndex === 0;
  byId('next').disabled = photoIndex === media.length - 1;
  preview.hidden = false;
  preview.onerror = () => {
    if (token !== loadSequence) return;
    preview.hidden = true;
    caption.prepend(text('p', 'Kuva ei latautunut. Voit avata sen lähdesivun.'));
  };
  preview.src = image.src;
}

function formatDistance(metres) {
  return metres < 1000 ? `${metres} m` : `${(metres / 1000).toLocaleString('fi', { maximumFractionDigits: 1 })} km`;
}

byId('prev').addEventListener('click', () => { if (photoIndex > 0) { photoIndex--; renderPhoto(); } });
byId('next').addEventListener('click', () => { if (photoIndex + 1 < media.length) { photoIndex++; renderPhoto(); } });

function renderContext(wiki, available) {
  const context = byId('context');
  context.replaceChildren();
  if (wiki.main) {
    context.append(text('h3', wiki.main.title));
    if (wiki.main.extract) context.append(text('p', wiki.main.extract));
    context.append(link('Englanninkielinen Wikipedia · artikkeli ja tekijät ↗', wiki.main.url), document.createTextNode(' · '), link('CC BY-SA', 'https://creativecommons.org/licenses/by-sa/4.0/'));
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
    context.append(text('h3', 'Lähikohteet'), list);
  } else if (!wiki.main) {
    context.append(text('p', available ? 'Läheltä ei löytynyt koordinaatein merkittyjä Wikipedia-artikkeleita.' : 'Wikipedia-tietoja ei saatu ladattua.'));
  }
}

function yearLabel(year) {
  return year < 0 ? `${-year} eaa.` : String(year);
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
  byId('place-title').textContent = point.name || 'Karttapiste';
  byId('place-label').textContent = point.label === point.name ? '' : point.label || '';
  byId('coordinates').textContent = `${pointLabel(point.lat, point.lon)} · ${year === null ? 'NYKYHETKI' : yearLabel(year)}`;
  byId('year').value = year ?? '';
  byId('year').setCustomValidity('');
  byId('street').href = `https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lon}#map=13/${point.lat}/${point.lon}`;
  byId('demo').hidden = true;
  byId('context').replaceChildren();
  media = [];
  nearbyPlaces = [];
  showDemo = false;
  clearPhoto();
  byId('media-title').textContent = year === null ? 'Valokuvia paikan ympäristöstä' : `Aineistoa vuodelta ${yearLabel(year)}`;
  byId('media-note').textContent = '';
  byId('travel-status').textContent = 'Etsitään paikan kuvia ja lähikohteita…';
  if (move) {
    moveMap(point);
    byId('place-title').focus({ preventScroll:true });
    window.scrollTo(0, 0);
  }
  try {
    const params = { lat:point.lat, lon:point.lon, name:point.kind === 'point' ? '' : point.name, kind:point.kind || 'place', article:point.article || '', year:year ?? '' };
    const data = await api('place', params, request.signal);
    if (request.signal.aborted) return;
    byId('travel-status').textContent = '';
    byId('demo').hidden = !data.demo;
    media = data.photos;
    photoIndex = 0;
    nearbyPlaces = data.wiki?.nearby || [];
    showDemo = !!data.demo;
    if (media.length) {
      byId('media-note').textContent = year === null ? 'Kuvat on paikannettu lähialueelle. Niiden kuvausvuodet vaihtelevat.' : (data.demo ? 'Arkistovalokuva ja erillinen elämyksellinen rekonstruktio.' : 'Kuvausvuosi perustuu kuvan lähdetietoihin. Kartta kuvaa nykyhetkeä.');
      renderPhoto();
    } else {
      byId('media-note').textContent = !data.availability.photos
        ? 'Kuvahaku ei vastannut. Voit jatkaa kartalla tai yrittää uudelleen.'
        : year === null ? 'Läheltä ei löytynyt paikkatiedolla ja käyttöluvalla varustettua valokuvaa.'
        : 'Tälle paikalle ja vuodelle ei löytynyt varmennettua valokuvaa tai rakennettua aikamatkanäkymää. Kartta kuvaa nykyhetkeä.';
    }
    renderContext(data.wiki, data.availability.wiki);
  } catch (error) {
    if (!request.signal.aborted) byId('travel-status').textContent = `Aineiston lataus epäonnistui. ${error.message}`;
  }
}

byId('year').addEventListener('input', event => event.target.setCustomValidity(''));
byId('time').addEventListener('submit', event => {
  event.preventDefault();
  const field = byId('year');
  if (field.value === '0') {
    field.setCustomValidity('Valitse eaa. tai jaa. Vuotta nolla ei käytetä.');
    field.reportValidity();
    return;
  }
  if (current) travel(current, field.value ? Number(field.value) : null, false);
});
byId('present').addEventListener('click', () => { if (current) travel(current, null, false); });

byId('helsinki').addEventListener('click', () => travel({ name:'Helsinki', label:'Helsinki, Suomi', lat:60.1699, lon:24.9384, article:'Helsinki' }, 1952));
byId('back').addEventListener('click', () => {
  placeRequest?.abort();
  streetView(false);
  current = null;
  currentYear = null;
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
  const coordinate = q.match(/^([+-]?\d+(?:\.\d+)?)\s*[,;]\s*([+-]?\d+(?:\.\d+)?)$/);
  byId('results').replaceChildren();
  if (coordinate) {
    const [, a, b] = coordinate;
    if (Math.abs(+a) > 90 || Math.abs(+b) > 180) {
      byId('search-status').textContent = 'Leveysaste on −90…90 ja pituusaste −180…180.';
      return;
    }
    byId('search-status').textContent = '';
    travel(pointAt(L.latLng(+a,+b)));
    return;
  }
  if (q.length < 2) { byId('search-status').textContent = 'Kirjoita vähintään kaksi merkkiä.'; return; }
  byId('search-status').textContent = 'Haetaan paikkoja…';
  try {
    const data = await api('search', { q }, request.signal);
    if (request.signal.aborted) return;
    for (const place of data.results) {
      const item = document.createElement('li');
      const choose = button(place.label, () => travel(place));
      choose.append(text('small', place.source));
      item.append(choose);
      byId('results').append(item);
    }
    byId('search-status').textContent = data.results.length
      ? `${data.results.length} tulosta${data.online ? '' : ' paikallisesta hakemistosta'}.`
      : data.online ? 'Paikkaa ei löytynyt. Kokeile toista nimeä tai valitse kartalta.'
      : 'Verkkohaku ei vastannut, eikä nimeä löytynyt paikallisesta hakemistosta. Valitse kartalta tai anna koordinaatit.';
  } catch (error) {
    if (!request.signal.aborted) byId('search-status').textContent = error.message;
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
  credit.append(document.createTextNode(`${image.artist || 'Tekijä tuntematon'} · ${image.license || 'Lisenssi tarkistettava'} · `));
  if (image.url) credit.append(link('Alkuperäinen kuva Wikimedia Commonsissa ↗', image.url));
  if (image.licenseUrl) credit.append(document.createTextNode(' · '), link('Lisenssi ↗', image.licenseUrl));
  if (image.original) credit.append(document.createTextNode(' · '), link('Museon alkuperäinen tietue ↗', image.original));
  if (image.restrictions) credit.append(text('p', `Lähteen muut ehdot: ${image.restrictions}`));
}
function showStations() {
  const list = byId('explore-stations');
  list.replaceChildren();
  byId('explore-stations-count').textContent = `(${media.length})`;
  if (!media.length) { list.append(text('p', 'Tälle vuodelle ei löytynyt todennettua, paikkatiedolla varustettua valokuvaa.', 'fine')); return; }
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
    details.append(text('small', `KUVAUSPISTE ${index + 1}`), text('strong', photo.title));
    details.append(text('span', `Aineiston päiväys: ${photo.date || 'ei tarkkaa vuotta'}`, 'fine'));
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
  stageImage.alt = `${photo.title}. Aito lähdekuva; ei historiallinen 3D-näkymä.`;
  stageImage.onerror = () => { stageImage.hidden = true; byId('explore-empty').hidden = false; byId('explore-empty').textContent = 'Valokuva ei latautunut. Alkuperäinen kuva on avattavissa lähdelinkistä.'; };
  stageImage.onload = () => { byId('explore-empty').hidden = true; };
  byId('explore-empty').hidden = true;
  byId('explore-photo-title').textContent = photo.title;
  const coords = Number.isFinite(photo.lat) && Number.isFinite(photo.lon) ? ` · ${photo.locationApprox ? 'Arvioitu kuvauspaikka' : 'Kuvan paikkatieto'}: ${pointLabel(photo.lat, photo.lon)}` : '';
  byId('explore-photo-detail').textContent = `Lähteen ilmoittama kuvausaika: ${photo.date || 'ei tarkkaa päiväystä'}${coords}`;
  byId('explore-authenticity').textContent = 'AITO LÄHDEKUVA · EI 3D-REKONSTRUKTIO';
  byId('explore-counter').textContent = `${index + 1} / ${media.length} kuvauspistettä`;
  byId('explore-prev').disabled = index === 0;
  byId('explore-next').disabled = index === media.length - 1;
  safeCredit(photo);
  showStations();
  refreshPhotoMarkers();
  applyExploreTransform();
}
byId('explore-prev').addEventListener('click', () => selectStation(photoIndex - 1));
byId('explore-next').addEventListener('click', () => selectStation(photoIndex + 1));

function renderExplorerNearby() {
  const list = byId('explore-nearby');
  list.replaceChildren();
  if (!nearbyPlaces.length) { list.append(text('p', 'Tälle pisteelle ei löytynyt lähikohteita tai Wikipedia ei vastannut.', 'fine')); return; }
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
  explorerMap = L.map('explore-map', { crs:L.CRS.EPSG4326, zoomControl:false, zoomAnimation:false, minZoom:-2, maxZoom:17, maxBounds:worldBounds });
  explorerMap.attributionControl.setPrefix(false).addAttribution('<a href="https://www.naturalearthdata.com/about/terms-of-use/">Natural Earth · nykykartta</a>');
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
    byId('explore-road').textContent = 'Näytä nykyinen katukartta';
    refreshPhotoMarkers();
  } else {
    if (Math.abs(current?.lat || 0) > 85) return;
    explorerTiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom:18, keepBuffer:1, updateWhenIdle:true,
      attribution:'<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>'
    }).addTo(explorerMap);
    explorerRoad = true;
    byId('explore-road').textContent = 'Näytä yleiskartta';
    refreshPhotoMarkers();
  }
}
byId('explore-road').addEventListener('click', toggleExplorerStreet);
function openExplorer() {
  if (!current) return;
  byId('atlas').hidden = true;
  byId('explorer').hidden = false;
  byId('back').hidden = true;
  byId('explore-title').textContent = current.name || 'Karttapiste';
  byId('explore-era').textContent = `${currentYear === null ? 'NYKYHETKI' : `VUOSI ${yearLabel(currentYear)}`} · OIKEAT LÄHTEET, EI AUTOMAATTISESTI HISTORIALLINEN KATUKUVA`;
  byId('explore-location').textContent = `${pointLabel(current.lat, current.lon)} · ${current.label || current.name || ''}`;
  byId('explore-demo').hidden = !showDemo;
  byId('explore-empty').textContent = currentYear === null ? 'Tästä pisteestä ei löydy käyttökelpoista valokuvaa. Voit silti tutkia karttaa ja Wikipedia-kohteita.' : `Vuodelta ${yearLabel(currentYear)} ei löytynyt varmennettua kuvaa tältä paikalta. Nykykartta ei kuvaa historiallista vuotta.`;
  renderExplorerNearby();
  buildExplorerMap();
  if (media.length) selectStation(Math.min(photoIndex, media.length - 1));
  else {
    stageImage.hidden = true;
    stageImage.removeAttribute('src');
    byId('explore-empty').hidden = false;
    byId('explore-photo-title').textContent = 'Tutki karttaa ja lähikohteita';
    byId('explore-photo-detail').textContent = 'Tälle ajalle ei löytynyt varmennettua lähdekuvaa.';
    byId('explore-counter').textContent = '0 / 0 kuvauspistettä';
    byId('explore-authenticity').textContent = 'EI VARMENNETTUA KUVA-AINEISTOA';
    byId('explore-prev').disabled = true;
    byId('explore-next').disabled = true;
    safeCredit(null);
    showStations();
    refreshPhotoMarkers();
    applyExploreTransform();
  }
  requestAnimationFrame(() => { explorerMap?.invalidateSize({ pan:false }); refreshPhotoMarkers(); });
  window.scrollTo(0,0);
  byId('explore-close').focus({ preventScroll:true });
}
function closeExplorer() {
  byId('explorer').hidden = true;
  byId('atlas').hidden = false;
  byId('back').hidden = false;
  if (explorerRoad && explorerTiles) { explorerMap.removeLayer(explorerTiles); explorerRoad = false; byId('explore-road').textContent = 'Näytä nykyinen katukartta'; }
  if (media.length) renderPhoto();
  requestAnimationFrame(() => { (isStreet ? roadMap : map).invalidateSize({ pan:false }); });
}
byId('enter-explorer').addEventListener('click', openExplorer);
byId('explore-close').addEventListener('click', closeExplorer);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && explorerVisible()) { event.preventDefault(); closeExplorer(); }
});

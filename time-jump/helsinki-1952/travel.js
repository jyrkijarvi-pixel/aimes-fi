'use strict';

const places = window.travelPlaces;
const byId = id => document.getElementById(id);
const found = new Set();
const dialog = byId('discovery');
let current = 0;
let soundEnabled = false;
let audioContext;
let noise;
let ambience;
let soundRequest = 0;

function button(text, action) {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = text;
  element.addEventListener('click', action);
  return element;
}

const route = places.map((place, index) => {
  const stop = button(place.name, () => showPlace(index));
  const district = document.createElement('small');
  district.textContent = place.district;
  stop.prepend(district);
  byId('route').append(stop);
  return stop;
});

function showPlace(index) {
  current = index;
  const place = places[index];
  byId('scene').dataset.place = place.image;
  const view = byId('view');
  view.src = `images/${place.image}.webp`;
  view.alt = place.alt;
  byId('scene-title').textContent = place.name;
  byId('scene-line').textContent = place.line;
  byId('hotspots').replaceChildren(...place.finds.map((find, position) => {
    const spot = button(find.label, () => openFind(index, position));
    spot.className = 'hotspot';
    spot.dataset.found = String(found.has(find));
    spot.dataset.position = position;
    return spot;
  }));
  route.forEach((stop, position) => {
    if (position === index) stop.setAttribute('aria-current', 'location');
    else stop.removeAttribute('aria-current');
  });
  if (soundEnabled) playAmbience();
  window.TimeJumpWalk?.switchZone(index);
  const inWalk = window.TimeJumpWalk?.getState().running;
  byId(inWalk ? 'walk-canvas' : 'scene-title').focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function openFind(placeIndex, position) {
  const place = places[placeIndex];
  const find = place.finds[position];
  byId('discovery-kind').textContent = find.kind;
  byId('discovery-title').textContent = find.title;
  byId('discovery-body').textContent = find.body;
  const source = byId('discovery-source');
  source.replaceChildren();
  source.hidden = !find.source;
  if (find.source) {
    const link = document.createElement('a');
    [link.textContent, link.href] = find.source;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    source.append(link);
  }

  if (!found.has(find)) {
    found.add(find);
    const item = document.createElement('li');
    item.append(button(`${place.name} · ${find.title}`, () => openFind(placeIndex, position)));
    byId('finds').append(item);
    byId('journal-label').textContent = `Matkamuistiinpanot · ${found.size}`;
    byId('empty').hidden = true;
    if (placeIndex === current) byId('hotspots').children[position].dataset.found = 'true';
  }
  dialog.showModal();
}

function prepareAudio() {
  if (audioContext) return;
  audioContext = new AudioContext();
  noise = audioContext.createBuffer(1, audioContext.sampleRate * 5, audioContext.sampleRate);
  const samples = noise.getChannelData(0);
  let seed = 1952;
  for (let i = 0; i < samples.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    samples[i] = (seed / 2147483648 - 1) * Math.sin(Math.PI * i / samples.length) ** 0.22;
  }
}

function stopAmbience() {
  if (!ambience) return;
  const { source, pulse, filter, gain, depth } = ambience;
  source.stop();
  pulse.stop();
  source.disconnect();
  pulse.disconnect();
  filter.disconnect();
  gain.disconnect();
  depth.disconnect();
  ambience = null;
}

function playAmbience() {
  stopAmbience();
  const source = audioContext.createBufferSource();
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();
  const pulse = audioContext.createOscillator();
  const profile = [
    { filter: 'lowpass', frequency: 540, gain: .13, pulse: .31 },
    { filter: 'lowpass', frequency: 330, gain: .09, pulse: .12 },
    { filter: 'bandpass', frequency: 790, gain: .065, pulse: .19 }
  ][current];
  source.buffer = noise;
  source.loop = true;
  filter.type = profile.filter;
  filter.frequency.value = profile.frequency;
  filter.Q.value = .55;
  gain.gain.value = profile.gain;
  pulse.frequency.value = profile.pulse;
  const depth = audioContext.createGain();
  depth.gain.value = profile.gain * .2;
  pulse.connect(depth).connect(gain.gain);
  source.connect(filter).connect(gain).connect(audioContext.destination);
  source.start();
  pulse.start();
  ambience = { source, pulse, filter, gain, depth };
}

function disableSound() {
  soundRequest += 1;
  soundEnabled = false;
  stopAmbience();
  byId('sound').setAttribute('aria-pressed', 'false');
}

byId('sound').addEventListener('click', async () => {
  if (soundEnabled) {
    disableSound();
    byId('status').textContent = 'Äänimaisema pois päältä.';
    return;
  }
  const request = ++soundRequest;
  try {
    prepareAudio();
    await audioContext.resume();
    if (request !== soundRequest) return;
    soundEnabled = true;
    playAmbience();
    byId('sound').setAttribute('aria-pressed', 'true');
    byId('status').textContent = 'Äänimaisema soi.';
  } catch {
    if (request !== soundRequest) return;
    disableSound();
    byId('status').textContent = 'Äänimaisemaa ei saatu käyntiin tässä selaimessa.';
  }
});

window.timeJumpOpenFind = openFind;
window.timeJumpShowPlace = index => { if(index >= 0 && index < places.length) showPlace(index); };

byId('ticket').addEventListener('submit', event => {
  event.preventDefault();
  byId('arrival').hidden = true;
  byId('journey').hidden = false;
  byId('home').hidden = false;
  showPlace(current);
  window.TimeJumpWalk?.start();
});

byId('home').addEventListener('click', () => {
  disableSound();
  window.TimeJumpWalk?.stop();
  byId('journey').hidden = true;
  byId('home').hidden = true;
  byId('arrival').hidden = false;
  window.scrollTo(0, 0);
  byId('place').focus({ preventScroll: true });
});
window.addEventListener('pagehide', disableSound);

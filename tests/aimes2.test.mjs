import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {finnishDay,dailyIndex,isPreview,readJourney,withJourney} from '../aimes2/journey.mjs';
import {discoveries} from '../aimes2/discoveries.mjs';

test('Finnish calendar changes at midnight, including summer and winter time',()=>{
  assert.equal(finnishDay(new Date('2026-11-24T21:59:59Z')),'2026-11-24');
  assert.equal(finnishDay(new Date('2026-11-24T22:00:00Z')),'2026-11-25');
  assert.equal(finnishDay(new Date('2026-07-24T20:59:59Z')),'2026-07-24');
  assert.equal(finnishDay(new Date('2026-07-24T21:00:00Z')),'2026-07-25');
  assert.equal(finnishDay(new Date('2026-03-29T00:59:59Z')),'2026-03-29');
  assert.equal(finnishDay(new Date('2026-03-29T01:00:00Z')),'2026-03-29');
  assert.equal(dailyIndex(new Date('2026-11-24T05:00:00Z'),3),dailyIndex(new Date('2026-11-24T21:59:59Z'),3));
  assert.notEqual(dailyIndex(new Date('2026-11-24T21:59:59Z'),3),dailyIndex(new Date('2026-11-24T22:00:00Z'),3));
});
test('all three entries rotate; production URLs cannot enable preview controls',()=>{
  const indices=[24,25,26].map(day=>dailyIndex(new Date(`2026-11-${day}T12:00:00Z`),discoveries.length));
  assert.equal(new Set(indices).size,3);
  for(const origin of ['https://aimes.fi','https://www.aimes.fi','https://aimes-fi.pages.dev'])assert.equal(isPreview(origin+'/?preview=1'),false);
  assert.equal(isPreview('https://feature-aimes-2-prototype.aimes-fi.pages.dev/?preview=1'),true);
  assert.equal(isPreview('https://feature-aimes-2-prototype.aimes-fi.pages.dev/'),false);
  assert.equal(isPreview('https://aimes.fi.example.org/?preview=1'),false);
});
test('place and period survive map/history/museum/language URLs; leaving removes the trail',()=>{
  const state={name:'Punkalaidun',lat:61.11578,lon:23.09936,period:'1954',article:'Punkalaidun',country:'FI'};
  for(const address of ['https://example.org/','https://example.org/time-jump/eras/','https://example.org/en/museum/?q=Punkalaidun&lang=en']){
    const url=withJourney(address,state);assert.deepEqual(readJourney(url),state);
    const clear=withJourney(url,null);assert.equal(readJourney(clear),null);assert.equal(clear.searchParams.get('q'),new URL(address).searchParams.get('q'));
  }
  assert.equal(readJourney('https://example.org/?jname=Place&jlat=91&jlon=0'),null);
  assert.equal(readJourney('https://example.org/?jname=Place&jlon=0'),null);
  assert.equal(readJourney('https://example.org/?jname=Place&jlat=0&jlon=0&jperiod=garbage').period,'');
});
test('curated entries have bilingual copy, local previews and original rights/source links',async()=>{
  assert.equal(new Set(discoveries.map(d=>d.id)).size,3);
  for(const d of discoveries){
    assert.match(d.source,/^https:\/\//);assert.match(d.license,/^https:\/\/creativecommons.org\//);
    for(const lang of ['fi','en'])for(const key of ['title','text','type','date'])assert.ok(d[lang][key]);
    const image=await readFile(new URL('..'+d.image,import.meta.url));assert.ok(image.length<60000);assert.equal(image.toString('ascii',8,12),'WEBP');
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const base='0e1cbb326f483430df32405a485a26963620b099';
const original=path=>execFileSync('git',['show',base+':'+path],{maxBuffer:3000000});
const text=async path=>(await readFile(new URL('../'+path,import.meta.url),'utf8')).replaceAll('\r\n','\n');

test('FI, EN and existing map alias retain every non-image element, credit and link',async()=>{
  for(const path of ['index.html','en/index.html','time-jump/index.html']){
    const page=await text(path);
    assert.ok(!page.includes('/aimes2/'));
    const reverted=page.replace(/<img\b[^>]*>/g,tag=>tag
      .replace('src="data/previews/olympics.webp"','src="data/helsinki-1952-archive.jpg"')
      .replace('src="data/previews/kauppatori.webp"','src="helsinki-1952-photo/kolera-allas.webp"')
      .replace(/ (?:loading="(?:eager|lazy)"|decoding="async")/g,''));
    // The existing reconstruction placeholder already used loading=lazy.
    const baseline=original(path).toString().replaceAll('\r\n','\n').replace(/<img\b[^>]*>/g,tag=>tag.replace(/ (?:loading="(?:eager|lazy)"|decoding="async")/g,''));
    assert.equal(reverted,baseline);
    assert.match(page,/<img src="data\/previews\/olympics.webp" loading="eager"/);
  }
});

test('only the gallery projection changes; main map, search and photo zoom logic are preserved',async()=>{
  const baseline=original('time-jump/world.js').toString().replaceAll('\r\n','\n');
  const changed=await text('time-jump/world.js');
  const from="  explorerMap = L.map('explore-map', { crs:L.CRS.EPSG4326, zoomControl:false, zoomAnimation:false, minZoom:-2, maxZoom:17, maxBounds:worldBounds });";
  const to="  // Share Web Mercator between the local vector overview and OSM street tiles.\n  explorerMap = L.map('explore-map', { zoomControl:false, zoomAnimation:false, minZoom:-2, maxZoom:17, maxBounds:worldBounds });";
  assert.equal(changed.replace(to,from),baseline);
});

test('previews have a small transfer budget while full-size archive and zoom sources are preserved',async()=>{
  for(const path of ['time-jump/data/helsinki-1952-archive.jpg','time-jump/helsinki-1952-photo/kolera-allas.webp','functions/time-jump/api/[[path]].js','time-jump/helsinki-1952-photo/photo.js','time-jump/style.css']){
    const binary=/\.(?:jpg|webp)$/.test(path);
    const actual=await readFile(new URL('../'+path,import.meta.url)),expected=original(path);
    const digest=bytes=>createHash('sha256').update(binary?bytes:bytes.toString().replaceAll('\r\n','\n')).digest('hex');
    assert.equal(digest(actual),digest(expected),path+' must remain unchanged');
  }
  for(const name of ['olympics','kauppatori']){
    const data=await readFile(new URL('../time-jump/data/previews/'+name+'.webp',import.meta.url));
    assert.equal(data.toString('ascii',0,4),'RIFF');assert.equal(data.toString('ascii',8,12),'WEBP');
    assert.ok(data.length<50000,'Preview must stay below 50 kB');
  }
});

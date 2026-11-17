import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { onRequest } from '../functions/time-jump/api/[[path]].js';
import { combinePhotos } from '../functions/time-jump/finna.js';

const photograph=(id,date,place='Suomi, Kerava',copyright='CC BY 4.0')=>({
  id,title:'Test photograph',year:'1952',formats:[{value:'1/Image/Photo/'}],
  fullRecord:'<event><eventType><term>valmistus</term></eventType><eventDate><displayDate>'+
    date+'</displayDate></eventDate><eventPlace><displayPlace>'+place+'</displayPlace></eventPlace></event>'+
    '<event><eventType><term>acquisition</term></eventType><eventDate><displayDate>1952</displayDate></eventDate></event>',
  imagesExtended:[{urls:{medium:'/Cover/Show?id='+id},rights:{copyright,link:'https://creativecommons.org/licenses/by/4.0/'}}],
  rawData:{institution:['Finnish museum']},nonPresenterAuthors:[{name:'Photographer'}]
});

test('Finna evidence, rights, periods, caching and failure isolation',async()=>{
  const nativeFetch=globalThis.fetch;
  let requests=0;
  let fail=false;
  const records=[
    photograph('test.exact','kuvausaika 1952'),
    photograph('test.circa','Noin 1952'),
    photograph('test.unknown',''),
    photograph('test.abroad','1952','France, Paris'),
    photograph('test.restricted','1952','Suomi, Kerava','CNE'),
    photograph('test.range','1930–1939')
  ];
  globalThis.fetch=async url=>{
    if(String(url).includes('api.finna.fi/v1/search')){
      requests++;
      if(fail)throw Error('Finna unavailable');
      return Response.json({status:'OK',resultCount:records.length,records});
    }
    return Response.json({query:{pages:[]}});
  };
  async function request(params) {
    const response=await onRequest({
      request:new Request('https://aimes.test/time-jump/api/eras?'+new URLSearchParams(params)),
      env:{ASSETS:{fetch:async request=>{
        const file=new URL(request.url).pathname.slice('/time-jump/data/'.length);
        return new Response(await readFile(new URL('../time-jump/data/'+file,import.meta.url)));
      }}}
    });
    assert.equal(response.status,200);
    return response.json();
  }
  try {
    const result=await request({country:'FI',source:'finna'});
    assert.ok(!result.photos.some(photo=>photo.finnaIds.includes('test.abroad')));
    const find=id=>result.photos.find(photo=>photo.finnaIds.includes(id));
    assert.equal(find('test.exact').capture.precision,'exact');
    assert.equal(find('test.circa').capture.uncertain,true);
    assert.equal(find('test.unknown').capture.precision,'unknown');
    assert.equal(find('test.restricted').src,null);
    assert.ok(find('test.exact').src.startsWith('https://api.finna.fi/Cover/Show'));
    assert.ok(find('test.restricted').original.includes('finna.fi/Record/'));
    assert.ok(result.decades.some(row=>row.decade===1930&&row.approximate===1));
    await request({country:'FI',source:'finna'});
    assert.equal(requests,1);
    const year=await request({country:'FI',source:'finna',period:'1952'});
    assert.equal(year.photos.length,2);
    assert.ok(year.photos.every(photo=>photo.capture.precision==='exact'&&photo.capture.start===1952));
    fail=true;
    const fallback=await request({country:'FI',period:'1950s'});
    assert.equal(fallback.availability.finna,false);
    assert.ok(fallback.photos.some(photo=>photo.capture.start===1954));
    assert.equal(fallback.diagnostics.succeeded,2);
  } finally {globalThis.fetch=nativeFetch;}
});

test('Shared Finna identifiers merge records and preserve alternate metadata',()=>{
  const commons={source:'commons',url:'https://commons.wikimedia.org/wiki/File:Photo.jpg',
    finnaIds:['test.exact'],date:'1952',license:'CC BY 4.0'};
  const finna={source:'finna',url:'https://www.finna.fi/Record/test.exact',
    finnaIds:['test.exact','test.alias'],date:'Noin 1952',license:'PDM'};
  const result=combinePhotos([commons],[finna]);
  assert.equal(result.duplicates,1);
  assert.equal(result.photos.length,1);
  assert.equal(result.photos[0].alternatives[0].date,'Noin 1952');
  assert.equal(result.photos[0].alternatives[0].license,'PDM');
  const different=combinePhotos([{...commons,finnaIds:[]}],[{...finna,finnaIds:['other'],url:'https://www.finna.fi/Record/other'}]);
  assert.equal(different.photos.length,2);
});

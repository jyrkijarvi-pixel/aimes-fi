import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { onRequest } from '../functions/time-jump/api/[[path]].js';
import { combinePhotos } from '../functions/time-jump/finna.js';
import { searchFinna, diversifyPhotos, finnaPhoto } from '../functions/time-jump/finna.js';

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
    return Response.json({query:{pages:[{
      title:'File:Photograph.jpg',coordinates:[{lat:60.4,lon:25.1,globe:'earth'}],
      imageinfo:[{mime:'image/jpeg',thumburl:'https://upload.wikimedia.org/example.jpg',
        descriptionurl:'https://commons.wikimedia.org/wiki/File:Photograph.jpg',extmetadata:{
          Artist:{value:'Photographer'},LicenseShortName:{value:'CC BY 4.0'},
          DateTimeOriginal:{value:'1952'},Credit:{value:'https://www.finna.fi/Record/test.circa'}
        }}]
    }]}});
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
    assert.equal(requests,2);
    const year=await request({country:'FI',source:'finna',period:'1952'});
    assert.equal(year.photos.length,2);
    assert.ok(year.photos.every(photo=>photo.capture.precision==='exact'&&photo.capture.start===1952));
    const combinedYear=await request({country:'FI',period:'1952'});
    assert.ok(combinedYear.photos.some(photo=>photo.source==='commons'&&photo.finnaIds.includes('test.circa')));
    assert.ok(!combinedYear.photos.flatMap(photo=>[photo,...photo.alternatives || []])
      .some(photo=>photo.source==='finna'&&photo.finnaIds?.includes('test.circa')));
    fail=true;
    const fallback=await request({country:'FI',period:'1950s'});
    assert.equal(fallback.availability.finna,false);
    assert.ok(fallback.photos.some(photo=>photo.capture.start===1954));
    assert.equal(fallback.diagnostics.succeeded,2);
  } finally {globalThis.fetch=nativeFetch;}
});

test('Geographic and text streams paginate, deduplicate and retry a partially failed batch',async()=>{
  const original=globalThis.fetch;
  let failGeo=true;
  let calls=0;
  const cache=new Map();
  const cached=async(key,load)=>{
    if(cache.has(key))return cache.get(key);
    const result=await load();
    cache.set(key,result);
    return result;
  };
  globalThis.fetch=async address=>{
    calls++;
    const url=new URL(address);
    assert.equal(url.searchParams.get('limit'),'24');
    const geographic=url.searchParams.get('lookfor').startsWith('geographic:');
    if(geographic&&failGeo)throw Error('Temporary geographic search failure');
    const page=Number(url.searchParams.get('page'));
    return Response.json({status:'OK',resultCount:48,records:Array.from({length:24},(_,index)=>({
      id:'record.'+((page-1)*24+index),title:'Archive photograph'
    }))});
  };
  try {
    const partial=await searchFinna({names:['Example place'],cached});
    assert.equal(partial.partial,true);
    assert.equal(partial.nextPage,1);
    assert.equal(partial.records.length,24);
    failGeo=false;
    const first=await searchFinna({names:['Example place'],cached});
    assert.equal(first.nextPage,2);
    assert.equal(first.requests,1);
    assert.equal(first.records.length,24);
    const second=await searchFinna({names:['Example place'],page:2,cached});
    assert.equal(second.nextPage,null);
    assert.equal(second.records[0].id,'record.24');
    assert.equal(second.requests,2);
    await searchFinna({names:['Example place'],page:2,cached});
    assert.equal(calls,5);
  } finally {globalThis.fetch=original;}
});

test('Topic ordering retains all records and reduces consecutive photographs of one subject',()=>{
  const photos=[
    ...Array.from({length:12},(_,index)=>({url:'church'+index,title:'Village church',src:'preview'})),
    {url:'weaving',title:'Mattojen kudontaa',src:'preview'},
    {url:'portrait',title:'Portrait',src:null},
    {url:'school',title:'School',subjects:['koulut'],src:'preview'}
  ];
  const ordered=diversifyPhotos(photos);
  assert.equal(ordered.length,photos.length);
  assert.equal(new Set(ordered.map(photo=>photo.url)).size,photos.length);
  assert.equal(ordered.slice(0,4).filter(photo=>photo.topic==='religion').length,1);
});

test('Municipality place metadata accepts rural archive points and rejects conflicting towns',()=>{
  const record=photograph('rural.photo','1954','Suomi, Example municipality');
  record.rawData.location_geo=['POINT(23.6 61.2)'];
  const options={point:{lat:61,lon:23},names:['Example municipality'],code:'FI',
    countryNames:new Map([['suomi',['FI']]]),cities:{},boundary:{},
    withinCountry:()=>true,distance:()=>22000,captureDate:()=>({precision:'exact',start:1954,end:1954})};
  assert.ok(finnaPhoto(record,options));
  const conflicting=photograph('wrong.photo','1954','Suomi, Other town, Example municipality');
  conflicting.rawData.location_geo=['POINT(23.6 61.2)'];
  assert.equal(finnaPhoto(conflicting,{...options,cities:{'other town':['FI']}}),null);
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

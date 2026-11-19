import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalize,safeUrl} from '../museum/smithsonian.js';
import {parseSearch,onRequest} from '../functions/museum/api/search.js';
import {guardDatabase} from './museum-db.mjs';
const base='https://preview.example/museum/api/search';
let requestId = 0;
const ctx=(query,env={})=>({request:new Request(base+query,{headers:{'CF-Connecting-IP':'test-'+(++requestId)}}),env,waitUntil:()=>{}});
test('guided entry, bounded pagination and literal queries',async()=>{
 assert.equal(parseSearch(new URL(base)).guided,true);
 assert.equal(parseSearch(new URL(base+'?topic=unknown')),null);
 assert.equal(parseSearch(new URL(base+'?start=13')),null);
 assert.equal(parseSearch(new URL(base+'?start=252')),null);
 assert.equal(parseSearch(new URL(base+'?q=a')),null);
 const search=parseSearch(new URL(base+'?q=Apollo%2011&topic=models&start=12'));
 assert.equal(search.query,'"Apollo" AND "11"');assert.equal(search.start,12);assert.deepEqual(search.filters,['online_media_type:"3D Models"']);
 assert.equal((await (await onRequest(ctx(''))).json()).upstreamRequests,0);
 assert.equal((await onRequest(ctx('?q=Apollo'))).status,503);
});
test('metadata CC0 never grants image rights; only validated CC0 viewer URLs',()=>{
 const n={metadata_usage:{access:'CC0'},online_media:{media:[{type:'Images',usage:{access:'restricted'},thumbnail:'https://ids.si.edu/a'},
 {type:'Images',usage:{access:'CC0'},thumbnail:'https://evil.example/a'},
 {type:'Images',usage:{access:'CC0'},thumbnail:'https://ids.si.edu/a'},
 {type:'3d_voyager',usage:{access:'CC0'},content:'https://3d-api.si.edu/voyager/3d_package:d8c6457e-4ebc-11ea-b77f-2e728ce88125'},
 {type:'3d_voyager',usage:{access:'CC0'},content:'https://evil.example/voyager/anything'}]}};
 const row=normalize({title:'<i>Original</i>',content:{descriptiveNonRepeating:n,freetext:{date:[{label:'Date',content:'1963; printed 2013'}],place:[{label:'Place printed',content:'New York'}]}}});
 assert.equal(row.images.length,1);assert.equal(row.models.length,1);assert.equal(row.title,'Original');assert.equal(row.dates[0].value,'1963; printed 2013');assert.equal(row.places[0].label,'Place printed');assert.equal(safeUrl('javascript:alert(1)'),null);
});
test('upstream requests are cached, deduplicated, timed out and isolated',async()=>{
 const original=globalThis.fetch;let calls=0;
 try{
 globalThis.fetch=async(url,options)=>{calls++;assert.equal(new URL(url).searchParams.get('rows'),'12');assert.equal(options.headers['X-Api-Key'],'test-only-key');assert(!url.toString().includes('test-only-key'));return Response.json({status:200,response:{rowCount:30,rows:[{id:'one',title:'Object',content:{}}]}})};
 const env={SMITHSONIAN_API_KEY:'test-only-key',MUSEUM_GUARD:guardDatabase()};
 const [a,b]=await Promise.all([onRequest(ctx('?q=cache-case',env)),onRequest(ctx('?q=cache-case',env))]);assert.equal(a.status,200);assert.equal(b.status,200);assert.equal(calls,1);assert.equal((await a.json()).next,12);assert.equal((await b.json()).upstreamRequests,0);
 const cached=await(await onRequest(ctx('?q=cache-case',env))).json();assert.equal(cached.cached,true);assert.equal(calls,1);
 globalThis.fetch=async()=>{throw new DOMException('Timeout','TimeoutError')};assert.equal((await onRequest(ctx('?q=timeout-case',env))).status,503);
 globalThis.fetch=async()=>new Response('private upstream body with test-only-key',{status:500});const failure=await onRequest(ctx('?q=failure-case',env));assert.equal(failure.status,503);assert(!(await failure.text()).includes('test-only-key'));
 globalThis.fetch=async()=>new Response('',{status:429,headers:{'Retry-After':'120'}});const limited=await onRequest(ctx('?q=limit-case',env));assert.equal(limited.status,429);assert(Number(limited.headers.get('Retry-After'))>=119);
 // Already cached searches still work while uncached traffic observes cooldown.
 assert.equal((await onRequest(ctx('?q=cache-case',env))).status,200);
 assert.equal((await onRequest(ctx('?q=another-case',env))).status,429);
 }finally{globalThis.fetch=original}
});
test('method and cross-origin guards',async()=>{
 const request=new Request(base,{method:'POST'});assert.equal((await onRequest({request,env:{}})).status,405);
 const other=new Request(base+'?q=test',{headers:{Origin:'https://other.example'}});assert.equal((await onRequest({request:other,env:{}})).status,403);
});

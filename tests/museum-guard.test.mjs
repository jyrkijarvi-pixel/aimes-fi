import {test} from 'node:test';
import assert from 'node:assert/strict';
import {guardDatabase} from './museum-db.mjs';
import {control,reserve,cooldown,retrySeconds} from '../functions/museum/guard.js';
import {onRequest} from '../functions/museum/api/search.js';
const url='https://preview.example/museum/api/search?q=guard-test';
const ctx=(db,ip='guard-test')=>({request:new Request(url,{headers:{'CF-Connecting-IP':ip}}),env:{MUSEUM_GUARD:db,SMITHSONIAN_API_KEY:'fake-test-key'},waitUntil:()=>{}});
test('new guard is disabled; no database means fail closed',async()=>{
 await assert.rejects(control(guardDatabase(false)),/configuration/);
 const missing=await onRequest(ctx(null));assert.equal(missing.status,503);
});
test('atomic shared budget counts reservations, resets UTC periods, and survives new callers',async()=>{
 const db=guardDatabase();db.sqlite.exec('UPDATE aimes_museum_guard SET hour_limit=2,day_limit=3');
 const now=Date.UTC(2026,10,19,12,0);
 const attempts=await Promise.allSettled([reserve(db,now),reserve(db,now),reserve(db,now)]);
 assert.equal(attempts.filter(r=>r.status==='fulfilled').length,2);
 assert.equal((await control(db)).hour_used,2);assert.equal((await control(db)).day_used,2);
 assert.equal(retrySeconds(await control(db),now),3600);
 await reserve(db,now+3600000);
 await assert.rejects(reserve(db,now+3600000),e=>e.message==='limit'&&e.retryAfter===39600);
 await reserve(db,now+86400000);
 assert.equal((await control(db)).day_used,1);
});
test('emergency stop blocks cached responses immediately and re-enables without losing budget',async()=>{
 const db=guardDatabase(),original=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async()=>{calls++;return Response.json({status:200,response:{rowCount:1,rows:[{id:'safe',content:{}}]}})};
  assert.equal((await onRequest(ctx(db,'stop-a'))).status,200);
  const used=(await control(db)).day_used;
  db.sqlite.exec('UPDATE aimes_museum_guard SET enabled=0');
  assert.equal((await onRequest(ctx(db,'stop-b'))).status,503);assert.equal(calls,1);
  db.sqlite.exec('UPDATE aimes_museum_guard SET enabled=1');
  const cached=await(await onRequest(ctx(db,'stop-c'))).json();assert.equal(cached.cached,true);assert.equal(calls,1);assert.equal((await control(db)).day_used,used);
 }finally{globalThis.fetch=original}
});
test('shared cooldown is visible to another caller and cannot be shortened',async()=>{
 const db=guardDatabase();await cooldown(db,120);const first=(await control(db)).retry_until;await cooldown(db,60);assert.equal((await control(db)).retry_until,first);
 await assert.rejects(reserve(db),e=>e.message==='limit'&&e.retryAfter>=119);
});
test('database outage never falls through to an unbudgeted upstream request',async()=>{
 const original=globalThis.fetch;let calls=0;
 try{globalThis.fetch=async()=>{calls++;throw Error('must not run')};const db={prepare(){throw Error('unavailable')}};assert.equal((await onRequest(ctx(db,'outage'))).status,503);assert.equal(calls,0)}finally{globalThis.fetch=original}
});
test('IP limit also covers repeated cache hits',async()=>{
 const original=globalThis.fetch,db=guardDatabase();
 try{globalThis.fetch=async()=>Response.json({status:200,response:{rowCount:0,rows:[]}});for(let i=0;i<5;i++)assert.equal((await onRequest(ctx(db,'repeat-ip'))).status,200);assert.equal((await onRequest(ctx(db,'repeat-ip'))).status,429)}finally{globalThis.fetch=original}
});

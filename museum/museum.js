import {fi,en} from './i18n.js';
const english=document.documentElement.lang==='en', copy=english?en:fi;
const t=(key,...args)=>copy[key].replace(/\{(\d+)\}/g,(_,n)=>String(args[n]??''));
const $=s=>document.querySelector(s), node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el};
const form=$('#museum-search'),query=$('#museum-query'),topic=$('#museum-topic'),status=$('#museum-status'),grid=$('#museum-results'),more=$('#museum-more'),dialog=$('#museum-dialog');
let rows=[],active=null,controller,next=null,busy=false;
function link(url,label){const a=node('a',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.referrerPolicy='no-referrer';return a}
function button(label,fn,cls='outline'){const b=node('button',label,cls);b.type='button';b.addEventListener('click',fn);return b}
function picture(image,alt,onDone){
 const img=node('img');img.alt=image.alt||alt;img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';let attempt=0;
 img.addEventListener('error',()=>{if(++attempt<image.alternatives.length)img.src=image.alternatives[attempt];else{const p=node('p',t('imageFailed'),'notice');img.replaceWith(p);onDone?.()}});img.src=image.thumb;return img;
}
function fields(host,title,values){if(!values?.length)return;host.append(node('h3',title));const dl=node('dl');for(const f of values)dl.append(node('dt',f.label),node('dd',f.value));host.append(dl)}
function openObject(row){
 $('#museum-object-title').textContent=row.title;const content=$('#museum-object');content.replaceChildren();
 if(row.images.length){const figure=node('figure'),holder=node('div'),controls=node('div',undefined,'image-controls'),position=node('span');let index=0;
  const draw=()=>{holder.replaceChildren();const image=row.images[index];holder.append(picture({...image,thumb:image.display,alternatives:[...new Set([image.display,...image.alternatives])]},row.title));holder.querySelector('img')?.classList.add('large-image');position.textContent=t('image')+' '+(index+1)+' / '+row.images.length;prev.disabled=index===0;following.disabled=index===row.images.length-1};
  const prev=button(t('previous'),()=>{index--;draw()}),following=button(t('next'),()=>{index++;draw()});controls.append(prev,position,following);figure.append(holder,node('figcaption',t('cc0'),'tag'));if(row.images.length>1)figure.append(controls);content.append(figure);draw();
 }
 if(row.models.length){const section=node('section',undefined,'model-section');section.append(node('h3',t('model')),node('p',t('modelNote'),'small'));
  const load=button(t('loadModel'),()=>{load.disabled=true;const frame=node('iframe');frame.src=row.models[0].url;frame.title=t('model')+': '+row.title;frame.allow='fullscreen; xr-spatial-tracking';frame.allowFullscreen=true;frame.referrerPolicy='no-referrer';frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-pointer-lock');section.append(frame,node('p',t('modelFallback'),'small'));},'primary');
  section.append(load,node('p','CC0','tag'),link(row.models[0].url,t('externalModel')));content.append(section);
 }
 if(!row.images.length&&!row.models.length)content.append(node('p',t('noPreview'),'notice'));
 const details=node('div',undefined,'fields');fields(details,t('description'),row.notes);fields(details,t('dates'),row.dates);if(row.dates.length)details.append(node('p',t('dateNote'),'small'));
 fields(details,t('places'),row.places);fields(details,t('people'),row.people);fields(details,t('rights'),row.rights);details.append(node('p',t('mediaNote'),'small'));
 fields(details,t('credits'),[{label:'Smithsonian',value:row.museum},{label:'ID',value:row.id},...row.credits]);if(row.types.length)fields(details,t('types'),[{label:t('types'),value:row.types.join(', ')}]);if(row.source)details.append(link(row.source,t('source')));content.append(details);
 dialog.showModal();dialog.scrollTop=0;
}
function renderCards(){grid.replaceChildren();for(const row of rows){const card=node('article'),body=node('div',undefined,'card-body');
 if(row.images.length){const preview=button(t('enlarge')+': '+row.title,()=>openObject(row),'preview');preview.setAttribute('aria-label',t('enlarge')+': '+row.title);preview.textContent='';preview.append(picture(row.images[0],row.title));card.append(preview)}
 body.append(node('span',row.models.length?'3D · CC0':row.images.length?'CC0':row.museum,'tag'),node('h2',row.title),node('p',row.museum,'small'));
 if(row.dates.length)body.append(node('p',row.dates.slice(0,2).map(v=>v.label+': '+v.value).join(' · '),'small'));
 if(!row.images.length)body.append(node('p',t('noPreview'),'small'));
 const actions=node('div',undefined,'actions');actions.append(button(t('details'),()=>openObject(row)));if(row.source)actions.append(link(row.source,t('source')));body.append(actions);card.append(body);grid.append(card)}
}
function syncUrl(){const url=new URL(location.href);for(const [k,v]of Object.entries(active||{})){if(v)url.searchParams.set(k,v);else url.searchParams.delete(k)}history.replaceState(null,'',url);for(const a of document.querySelectorAll('[data-language]')){const target=new URL(a.href);for(const [k,v] of Object.entries(active||{})){if(v)target.searchParams.set(k,v);else target.searchParams.delete(k)}a.href=target.href}}
function syncTopics(){document.querySelectorAll('[data-topic]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.topic===topic.value)))}
async function search(append=false){
 if(!append){active={q:query.value.trim(),topic:topic.value};syncUrl()}
 if(!active.q&&!active.topic){controller?.abort();rows=[];renderCards();status.textContent=t('guide');more.hidden=true;return}
 if(active.q&&(active.q.length<2||active.q.length>100)){status.textContent=t('invalid');return}
 controller?.abort();const request=new AbortController();controller=request;busy=true;form.querySelector('button').disabled=true;more.disabled=true;status.textContent=t('loading');
 const url=new URL('/museum/api/search',location.origin);url.searchParams.set('q',active.q);url.searchParams.set('topic',active.topic);if(append)url.searchParams.set('start',next);
 try{const response=await fetch(url,{signal:request.signal,headers:{Accept:'application/json'}});const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error||'unavailable'),{retry:data.retryAfter});
  rows=append?[...new Map([...rows,...data.rows].map(r=>[r.id,r])).values()]:data.rows;next=data.next;renderCards();status.textContent=rows.length?t('found',data.total.toLocaleString(english?'en':'fi'),rows.length)+' '+(data.bounded?t('limitPages'):t('partial')):t('empty');more.hidden=next===null||next===undefined;window.dispatchEvent(new CustomEvent('museum-search-complete',{detail:{count:rows.length,cached:data.cached}}));
 }catch(e){if(e.name==='AbortError')return;status.textContent=e.message==='limit'?t('limit',e.retry||60):t(['configuration','invalid','unavailable'].includes(e.message)?e.message:'unavailable');if(!append){rows=[];renderCards();more.hidden=true}}
 finally{if(controller===request){busy=false;form.querySelector('button').disabled=false;more.disabled=false}}
}
form.addEventListener('submit',event=>{event.preventDefault();search()});more.addEventListener('click',()=>{if(!busy&&next!==null)search(true)});
for(const button of document.querySelectorAll('[data-topic]'))button.addEventListener('click',()=>{topic.value=button.dataset.topic;syncTopics();search()});topic.addEventListener('change',syncTopics);
$('#museum-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{$('#museum-object').replaceChildren()});
const initial=new URL(location.href);query.value=(initial.searchParams.get('q')||'').slice(0,100);const selected=initial.searchParams.get('topic');if([...topic.options].some(o=>o.value===selected))topic.value=selected;syncTopics();if(query.value||topic.value)search();

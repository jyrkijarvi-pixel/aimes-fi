const VERSION='2026-10-30-v1';
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers});
const fail=(status,code)=>{throw Object.assign(new Error(code),{status})};
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
async function hash(s){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),n=>n.toString(16).padStart(2,'0')).join('')}
async function equal(a,b){return await hash(a)===await hash(b)}
function bearer(r){return r.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1]||''}
async function body(r){if(!r.headers.get('Content-Type')?.startsWith('application/json'))fail(415,'json_required');const reader=r.body?.getReader();if(!reader)fail(400,'invalid');let n=0,chunks=[];while(true){const {value,done}=await reader.read();if(done)break;n+=value.length;if(n>30000){await reader.cancel();fail(413,'too_large')}chunks.push(value)}const all=new Uint8Array(n);let p=0;for(const c of chunks){all.set(c,p);p+=c.length}try{return JSON.parse(new TextDecoder().decode(all))}catch{fail(400,'invalid')}}
function clean(x){
 if(!x||typeof x!=='object'||x.consent!==true||x.consentVersion!==VERSION)fail(400,'consent_required');
 const fields={title:100,text:6000,nickname:60,where:120},v={};for(const [k,max]of Object.entries(fields)){if(typeof x[k]!=='string'||x[k].length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(x[k]))fail(400,'invalid');v[k]=x[k].trim()}
 if(!v.title||v.text.length<20||!['memory','skill','observation'].includes(x.kind)||!['fi','en'].includes(x.language)||x.website)fail(400,'invalid');return {...v,kind:x.kind,language:x.language};
}
const publicRow=r=>({id:r.id,kind:r.kind,title:r.title,text:r.body,nickname:r.nickname,where:r.place,language:r.language,updated:r.updated_at,revision:r.revision});
async function admin(r,env){const t=bearer(r);if(!env.ADMIN_TOKEN||!t||!await equal(t,env.ADMIN_TOKEN))fail(401,'unauthorized')}
async function owner(r,env,id){const row=await env.DB.prepare('SELECT * FROM stories WHERE id=?').bind(id).first();const t=bearer(r);if(!row||!t||!await equal(await hash(t),row.token_hash))fail(404,'not_found');return row}
async function rate(r,env){const ip=r.headers.get('CF-Connecting-IP');if(!ip&&!env.LOCAL_TEST)fail(503,'unavailable');const now=Math.floor(Date.now()/1000),bucket=Math.floor(now/3600);const key=await hash(env.RATE_SECRET+':'+bucket+':'+(ip||'local'));const row=await env.DB.prepare('INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,now+7200).first();if(row.count>4)fail(429,'rate_limit');await env.DB.prepare('DELETE FROM rate_limits WHERE expires_at<?').bind(now).run()}
export async function handle(request,env){try{
 const url=new URL(request.url),path=url.pathname.replace(/\/$/,''),method=request.method;
 if(method!=='GET'&&method!=='HEAD'){if(request.headers.get('Origin')!==url.origin)fail(403,'origin');if(!['POST','PUT','DELETE'].includes(method))fail(405,'method')}
 let contact=null;try{const u=new URL(env.CONTACT);if((u.protocol==='mailto:'&&/^[^@\s]+@[^@\s]+$/.test(u.pathname))||(u.protocol==='https:'&&u.hostname))contact=u.href}catch{}
 const configured=!!(env.DB&&/^[a-f0-9]{64}$/.test(env.ADMIN_TOKEN||'')&&/^[a-f0-9]{64}$/.test(env.RATE_SECRET||'')&&contact);
 if(path==='/api/status'&&method==='GET'){let ready=configured;if(ready)try{await env.DB.prepare('SELECT id FROM stories LIMIT 1').first();await env.DB.prepare('SELECT key FROM rate_limits LIMIT 1').first()}catch{ready=false}return json({ready,version:VERSION,contact})}
 if(!configured)fail(503,'unavailable');
 // Pending stories expire after 90 days. A normal API request performs the sweep.
 const now=Math.floor(Date.now()/1000);await env.DB.prepare('DELETE FROM rate_limits WHERE expires_at<?').bind(now).run();await env.DB.prepare("DELETE FROM stories WHERE status!='approved' AND updated_at<?").bind(now-90*86400).run();
 if(path==='/api/stories'&&method==='GET'){const cursor=url.searchParams.get('before')||'',parts=cursor.match(/^(\d{1,12}):([a-f0-9]{32})$/);if(cursor&&!parts)fail(400,'invalid');const stamp=parts?Number(parts[1]):0,id=parts?parts[2]:'';const result=await env.DB.prepare("SELECT id,kind,title,body,nickname,place,language,updated_at,revision FROM stories WHERE status='approved' AND (?=0 OR updated_at<? OR (updated_at=? AND id<?)) ORDER BY updated_at DESC,id DESC LIMIT 31").bind(stamp,stamp,stamp,id).all();const rows=result.results||[];return json({stories:rows.slice(0,30).map(publicRow),more:rows.length>30,next:rows.length>30?rows[29].updated_at+':'+rows[29].id:null})}
 if(path==='/api/stories'&&method==='POST'){await rate(request,env);const v=clean(await body(request)),id=random().slice(0,32),token=random();await env.DB.prepare('INSERT INTO stories(id,token_hash,kind,title,body,nickname,place,language,status,consent_version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,await hash(token),v.kind,v.title,v.text,v.nickname,v.where,v.language,'pending',VERSION,now,now).run();return json({id,token,status:'pending',revision:1},201)}
 const match=path.match(/^\/api\/stories\/([a-f0-9]{32})$/);
 if(match){const id=match[1],row=await owner(request,env,id);if(method==='GET')return json({...publicRow(row),status:row.status});if(method==='DELETE'){await env.DB.prepare('DELETE FROM stories WHERE id=?').bind(id).run();return json({deleted:true})}if(method==='PUT'){const raw=await body(request),v=clean(raw);if(raw.revision!==row.revision)fail(409,'conflict');const result=await env.DB.prepare("UPDATE stories SET kind=?,title=?,body=?,nickname=?,place=?,language=?,status='pending',consent_version=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=?").bind(v.kind,v.title,v.text,v.nickname,v.where,v.language,VERSION,now,id,row.revision).run();if(!result.meta.changes)fail(409,'conflict');return json({id,status:'pending',revision:row.revision+1})}}
 if(path==='/api/admin'&&method==='GET'){await admin(request,env);const rows=await env.DB.prepare("SELECT id,kind,title,body,nickname,place,language,status,created_at,updated_at,revision FROM stories ORDER BY CASE WHEN status='pending' THEN 0 ELSE 1 END, updated_at ASC LIMIT 100").all();return json({stories:rows.results.map(r=>({...publicRow(r),status:r.status}))})}
 const mod=path.match(/^\/api\/admin\/([a-f0-9]{32})$/);if(mod&&['PUT','DELETE'].includes(method)){await admin(request,env);if(method==='DELETE'){await env.DB.prepare('DELETE FROM stories WHERE id=?').bind(mod[1]).run();return json({deleted:true})}const v=await body(request);if(!['approved','pending'].includes(v.status)||!Number.isSafeInteger(v.revision))fail(400,'invalid');const result=await env.DB.prepare('UPDATE stories SET status=? WHERE id=? AND revision=?').bind(v.status,mod[1],v.revision).run();if(!result.meta.changes)fail(409,'conflict');return json({ok:true})}
 fail(404,'not_found');
 }catch(e){return json({error:e.status?e.message:'unavailable'},e.status||503)}}

export async function onRequest(context){return handle(context.request,context.env)}
